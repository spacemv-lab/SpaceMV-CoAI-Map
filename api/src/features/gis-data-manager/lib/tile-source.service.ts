/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DatasetService } from './dataset.service';
import { GdalService } from '../utils/gdal.service';
import { MinioService } from '../services/minio.service';
import { CogQueue, CogJobResult } from '../queues/cog.queue';
import {
  encryptSecret,
  decryptSecret,
  EncryptedSecret,
} from '../utils/crypto.util';

const TIANDITU_KIND = 'tianditu';

/**
 * 瓦片源服务
 *
 * 本批仅落地天地图 token 的存取（加密落库）+ 平台兜底下发：
 * - getPlatformTiandituToken：env TIANDITU_DEFAULT_TOKEN（匿名/无用户 token 时兜底）
 * - getUserTiandituToken / setTiandituCredential：当前用户的天地图 token（AES-256-GCM 加密）
 *
 * 通过注入 DatasetService（其本身是 PrismaClient）访问 tileSource 委托。
 * 加密主密钥 TILE_SOURCE_ENCRYPTION_KEY 仅在凭据读写时按需校验（缺则抛错，不阻断 api 启动）。
 */
@Injectable()
export class TileSourceService {
  private readonly logger = new Logger(TileSourceService.name);

  constructor(
    private readonly datasetService: DatasetService,
    private readonly config: ConfigService,
    private readonly gdalService: GdalService,
    private readonly minioService: MinioService,
    private readonly cogQueue: CogQueue,
  ) {}

  private get source() {
    return this.datasetService.tileSource;
  }

  /** AES 主密钥(base64, 32 字节);仅凭据操作需要,缺则抛错(fail-fast at point of use) */
  private get encryptionKey(): string {
    const key = this.config.get<string>('TILE_SOURCE_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('TILE_SOURCE_ENCRYPTION_KEY 未配置,无法读写瓦片源凭据');
    }
    return key;
  }

  /** 平台兜底 token(env);匿名/无用户 token 时使用 */
  getPlatformTiandituToken(): string {
    return this.config.get<string>('TIANDITU_DEFAULT_TOKEN') ?? '';
  }

  /** 当前用户的天地图 token(解密);无记录返回 null */
  async getUserTiandituToken(userId: string): Promise<string | null> {
    const row = await this.source.findFirst({
      where: { ownerId: userId, kind: TIANDITU_KIND },
      select: { credential: true },
    });
    if (!row?.credential) return null;
    return decryptSecret(
      row.credential as unknown as EncryptedSecret,
      this.encryptionKey,
    );
  }

  /** 设置/更新当前用户的天地图 token(加密 upsert) */
  async setTiandituCredential(
    userId: string,
    token: string,
  ): Promise<{ updatedAt: Date }> {
    const encrypted = encryptSecret(token, this.encryptionKey);
    const existing = await this.source.findFirst({
      where: { ownerId: userId, kind: TIANDITU_KIND },
      select: { id: true },
    });
    if (existing) {
      const updated = await this.source.update({
        where: { id: existing.id },
        data: { credential: encrypted as unknown as Prisma.InputJsonValue },
      });
      return { updatedAt: updated.updatedAt };
    }
    const created = await this.source.create({
      data: {
        name: '天地图',
        ownerId: userId,
        kind: TIANDITU_KIND,
        config: {} as Prisma.InputJsonValue,
        credential: encrypted as unknown as Prisma.InputJsonValue,
      },
    });
    return { updatedAt: created.updatedAt };
  }

  /** 清除当前用户的天地图 token（删除凭据行 → 回退平台兜底） */
  async clearTiandituCredential(userId: string): Promise<void> {
    const existing = await this.source.findFirst({
      where: { ownerId: userId, kind: TIANDITU_KIND },
      select: { id: true },
    });
    if (existing) {
      await this.source.delete({ where: { id: existing.id } });
    }
  }

  // ===== GeoTIFF → COG（Phase 2 影像动态切片）=====

  /** 删除当前用户的影像瓦片源(删 DB 行 + MinIO COG 对象) */
  async deleteCogSource(userId: string, id: string): Promise<void> {
    const ts = await this.source.findFirst({
      where: { id, ownerId: userId, kind: 'titiler-cog' },
    });
    if (!ts) {
      throw new NotFoundException(`TileSource ${id} not found`);
    }
    if (ts.objectKey) {
      await this.minioService.deleteFile(ts.objectKey).catch((e: any) => {
        this.logger.warn(`删除 COG MinIO 对象失败(非致命): ${e.message}`);
      });
    }
    await this.source.delete({ where: { id } });
  }

  /** 列出当前用户的影像瓦片源（kind=titiler-cog） */
  async listCogSources(userId: string) {
    return this.source.findMany({
      where: { kind: 'titiler-cog', ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 创建一条 cog TileSource（ingestStatus=PENDING）并返回 id。
   * rawObjectKey 为已上传到 MinIO 的原档 .tif key。调用方随后入队 processCog。
   */
  async createCogSource(
    userId: string,
    name: string,
    rawObjectKey: string,
  ): Promise<{ id: string }> {
    const created = await this.source.create({
      data: {
        name,
        ownerId: userId,
        kind: 'titiler-cog',
        scope: 'GLOBAL',
        config: {} as Prisma.InputJsonValue,
        objectKey: rawObjectKey,
        ingestStatus: 'PENDING',
      },
    });
    return { id: created.id };
  }

  /**
   * 上传 .tif 原档 → 建 cog TileSource(PENDING)→ 入队转码。
   * localFilePath 为 multer diskStorage 写的临时文件,上传完 MinIO 后由本方法删除。
   */
  async uploadCogSource(
    userId: string,
    name: string,
    localFilePath: string,
    originalName: string,
  ): Promise<{ id: string }> {
    try {
      // 1) 上传原档到 MinIO(流式)
      const rawKey = this.minioService.generateStorageKey(originalName);
      await this.minioService.uploadFileFromPath(rawKey, localFilePath, 'image/tiff');

      // 2) 创建 TileSource(PENDING)
      const { id } = await this.createCogSource(userId, name, rawKey);

      // 3) 入队转码
      await this.cogQueue.addJob(id);

      return { id };
    } finally {
      // 4) 清理本地临时文件(diskStorage 写的)
      await fs.unlink(localFilePath).catch(() => {});
      await fs.rmdir(path.dirname(localFilePath)).catch(() => {});
    }
  }

  /**
   * COG 转码管线:下载原档 → gdal_translate 转 COG(3857)→ 上传 COG → 更新 TileSource READY。
   * 全程 catch,失败时把状态置 FAILED + statusMessage 并返回 success:false
   * (不抛错,避免 bullmq 重试——COG 失败多为确定性)。
   */
  async processCog(tileSourceId: string): Promise<CogJobResult> {
    const ts = await this.source.findUnique({ where: { id: tileSourceId } });
    if (!ts || ts.kind !== 'titiler-cog') {
      return { success: false, error: 'TileSource 不存在或非 cog 源' };
    }
    if (!ts.objectKey) {
      return { success: false, error: 'TileSource 无 objectKey(原档)' };
    }

    await this.markCogStatus(tileSourceId, 'PROCESSING', '转码中');

    let inputCleanup: (() => Promise<void>) | null = null;
    let outputTempPath: string | null = null;
    try {
      // 1) 下载原档
      const dl = await this.minioService.downloadToTempFile(ts.objectKey);
      inputCleanup = dl.cleanup;

      // 2) gdal_translate 转 COG(EPSG:3857)
      outputTempPath = await this.gdalService.createTempFile('.cog.tif', 'cog-');
      const r = await this.gdalService.translateToCog(dl.filePath, outputTempPath);
      if (!r.success) {
        await this.markCogStatus(tileSourceId, 'FAILED', `gdal_translate 失败: ${r.error}`);
        return { success: false, error: r.error };
      }

      // 3) 上传 COG 到 MinIO(流式,避免大 COG 入堆)
      const cogKey = `cog/${randomUUID()}.tif`;
      await this.minioService.uploadFileFromPath(cogKey, outputTempPath, 'image/tiff');

      // 3b) 删除原档(转码完成,不再需要;失败非致命)
      await this.minioService.deleteFile(ts.objectKey).catch((e: any) =>
        this.logger.warn(`删除原档失败(非致命): ${e.message}`),
      );

      // 4) 算真彩色 rescale + bounds(TiTiler)+ 拼 urlTemplate(bidx+rescale)
      const { rescale, bidx } = await this.computeCogRenderParams(cogKey);
      const bounds = await this.fetchCogBounds(cogKey);
      const urlTemplate = this.buildCogUrlTemplate(cogKey, rescale, bidx);
      const cogConfig: Record<string, unknown> = { layers: [{ type: 'raster', urlTemplate }] };
      if (bounds) cogConfig.bounds = bounds;
      await this.source.update({
        where: { id: tileSourceId },
        data: {
          objectKey: cogKey,
          config: cogConfig as Prisma.InputJsonValue,
          ingestStatus: 'READY',
          statusMessage: null,
        },
      });
      this.logger.log(`COG ready: tileSource=${tileSourceId} cog=${cogKey}`);
      return { success: true, cogKey };
    } catch (error: any) {
      await this.markCogStatus(tileSourceId, 'FAILED', `处理失败: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      if (inputCleanup) {
        await inputCleanup().catch(() => {});
      }
      if (outputTempPath) {
        await this.gdalService.cleanup(outputTempPath).catch(() => {});
      }
    }
  }

  /** 拼接 TiTiler 瓦片 URL 模板(浏览器直连取瓦片;bidx 选波段、rescale 把 uint16 拉到 0-255 出 PNG) */
  private buildCogUrlTemplate(cogKey: string, rescale: string, bidx: string): string {
    const base = this.config.get<string>('TITILER_BASE_URL') || '';
    const bucket = process.env.MINIO_BUCKET || 'gis-uploads';
    return `${base}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=s3://${bucket}/${cogKey}${bidx}&rescale=${rescale}`;
  }

  /**
   * 取 TiTiler /cog/statistics,算真彩色渲染参数:
   *  ≥3 波段 → bidx=1,2,3(RGB)+ 三波段统一百分位 rescale(保色彩平衡,真彩色);
   *  <3 波段 → bidx=1 + 该波段百分位 rescale。
   *  TiTiler 不可用 / 失败 → 兜底 bidx=1,2,3 + rescale=0,65535(能出图,可能偏暗)。
   */
  private async computeCogRenderParams(
    cogKey: string,
  ): Promise<{ rescale: string; bidx: string }> {
    const base = this.config.get<string>('TITILER_INTERNAL_URL');
    const bucket = process.env.MINIO_BUCKET || 'gis-uploads';
    const fallback = { rescale: '0,65535', bidx: '&bidx=1&bidx=2&bidx=3' };
    if (!base) return fallback;
    try {
      const resp = await fetch(
        `${base}/cog/statistics?url=s3://${bucket}/${cogKey}`,
      );
      if (!resp.ok) return fallback;
      const stats = (await resp.json()) as Record<
        string,
        { percentile_2?: number; percentile_98?: number; min?: number; max?: number }
      >;
      const get = (b: number) => stats[String(b)] ?? stats[`b${b}`];
      const numBands = Object.keys(stats).length;
      if (numBands < 3) {
        const s = get(1);
        return s
          ? {
              rescale: `${Math.round(s.percentile_2 ?? s.min ?? 0)},${Math.round(s.percentile_98 ?? s.max ?? 65535)}`,
              bidx: '&bidx=1',
            }
          : fallback;
      }
      const bs = [1, 2, 3].map(get).filter(Boolean);
      if (bs.length < 3) return fallback;
      const p2 = Math.min(...bs.map((b) => b.percentile_2 ?? b.min ?? 0));
      const p98 = Math.max(...bs.map((b) => b.percentile_98 ?? b.max ?? 65535));
      return {
        rescale: `${Math.round(p2)},${Math.round(p98)}`,
        bidx: '&bidx=1&bidx=2&bidx=3',
      };
    } catch (e) {
      this.logger.warn(
        `computeCogRenderParams: TiTiler stats 失败,用兜底 rescale: ${(e as Error).message}`,
      );
      return fallback;
    }
  }

  /** 取 TiTiler tilejson 的 lng/lat bounds([minLng,minLat,maxLng,maxLat]),供前端"缩放至图层";失败返 null */
  private async fetchCogBounds(
    cogKey: string,
  ): Promise<[number, number, number, number] | null> {
    const base = this.config.get<string>('TITILER_INTERNAL_URL');
    const bucket = process.env.MINIO_BUCKET || 'gis-uploads';
    if (!base) return null;
    try {
      const resp = await fetch(
        `${base}/cog/WebMercatorQuad/tilejson.json?url=s3://${bucket}/${cogKey}`,
      );
      if (!resp.ok) return null;
      const tj = (await resp.json()) as { bounds?: number[] };
      const b = tj.bounds;
      return Array.isArray(b) && b.length === 4
        ? ([b[0], b[1], b[2], b[3]] as [number, number, number, number])
        : null;
    } catch {
      return null;
    }
  }

  /** 更新 COG 转码状态(失败不抛,仅记日志) */
  private async markCogStatus(
    id: string,
    status: string,
    message?: string | null,
  ): Promise<void> {
    try {
      await this.source.update({
        where: { id },
        data: { ingestStatus: status, statusMessage: message ?? null },
      });
    } catch (e: any) {
      this.logger.error(`markCogStatus failed: ${e.message}`);
    }
  }
}
