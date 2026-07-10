/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { readFile } from 'fs/promises';
import { MinioService } from '../services/minio.service';
import { DatasetService } from './dataset.service';
import { SyncStatusService } from '../services/sync-status.service';
import { AdsbSyncService } from '../services/adsb-sync.service';
import { parseDataSourcesConfig, deriveNaming } from '../utils/ais-data-source-config.util';
import { success } from './api-response';

/**
 * 外部数据源配置项（前端返回简化版）
 */
interface ExternalDataSourceConfig {
  id: string;
  name: string;
  type: 'ADS-B' | 'AIS';
  description: string;
  icon: 'plane' | 'ship';
  tag: string;
  externalId: string;
}

/**
 * 外部数据同步与快照管理控制器
 *
 * 提供 AIS/ADS-B 等外部数据源的快照查询、下载和同步状态接口
 */
@Controller()
export class ExternalDataController {
  private readonly logger = new Logger(ExternalDataController.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly datasetService: DatasetService,
    private readonly syncStatusService: SyncStatusService,
    private readonly adsbSyncService: AdsbSyncService,
  ) {}

  /**
   * 获取外部数据源配置列表（动态读取 AIS_DATA_SOURCES 配置 + ADS-B）
   */
  @Get('datasets/external/sources')
  async getExternalDataSources() {
    const items: ExternalDataSourceConfig[] = [];

    try {
      // 1. 解析 AIS 配置
      const configs = parseDataSourcesConfig('AIS_DATA_SOURCES');

      for (const config of configs) {
        if (!config.enabled) continue;

        const naming = deriveNaming(config.name);
        const isAdsb = config.type === 'websocket' && config.url.includes('opensky');
        const isAis = config.type === 'websocket' && !isAdsb;

        items.push({
          id: `${config.type.toLowerCase()}-${config.name.toLowerCase()}`,
          name: config.type === 'websocket'
            ? (isAdsb ? 'ADS-B (OpenSky Network)' : `AIS (${config.name})`)
            : `AIS (${config.name})`,
          type: isAdsb ? 'ADS-B' : 'AIS',
          description: isAdsb
            ? '全球航空器位置数据，来自 OpenSky Network'
            : `全球船舶位置数据，来自 ${config.name}`,
          icon: isAdsb ? 'plane' : 'ship',
          tag: isAdsb ? 'ads-b' : 'ais',
          externalId: naming.externalId,
        });
      }
    } catch (error) {
      this.logger.warn(`获取 AIS 数据源配置失败：${error.message}`);
    }

    // 2. 添加 ADS-B (OpenSky Network) - 通过 AdsbSyncService
    // 检查是否有 OpenSky 凭证配置
    const hasOpenSkyCredentials = process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD;
    if (hasOpenSkyCredentials) {
      // 检查是否已在 AIS_DATA_SOURCES 中配置了 OpenSky
      const hasExistingAdsb = items.some(item => item.tag === 'ads-b');
      if (!hasExistingAdsb) {
        items.push({
          id: 'adsb-opensky',
          name: 'ADS-B (OpenSky Network)',
          type: 'ADS-B',
          description: '全球航空器位置数据，来自 OpenSky Network',
          icon: 'plane',
          tag: 'ads-b',
          externalId: this.adsbSyncService.config.externalId,
        });
      }
    }

    return success({ items });
  }

  /**
   * 根据 externalId 获取数据集版本列表
   */
  @Get('datasets/external/:externalId/versions')
  async getDatasetVersionsByExternalId(@Param('externalId') externalId: string) {
    const dataset = await this.datasetService.getDatasetByExternalId(externalId);
    if (!dataset) {
      throw new NotFoundException(`数据集 ${externalId} 不存在`);
    }

    const versions = await this.datasetService.datasetVersion.findMany({
      where: { datasetId: dataset.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return success({
      datasetId: dataset.id,
      datasetName: dataset.name,
      versions: versions.map(v => ({
        id: v.id,
        createdAt: v.createdAt,
        recordCount: v.recordCount,
        status: v.status,
      })),
    });
  }

  // ============================================
  // AIS Snapshots API
  // ============================================

  /**
   * 列出指定数据源和日期的快照
   *
   * @param source 数据源名称（可选）
   * @param date 日期（YYYY-MM-DD，可选）
   * @returns 快照元数据列表
   */
  @Get('snapshots')
  async listSnapshots(
    @Query('source') source?: string,
    @Query('date') date?: string,
  ) {
    const snapshots = await this.minioService.listAisSnapshots(source, date);

    // 关联数据库查询，补充 snapshotId 和 recordCount
    const enrichedSnapshots = await Promise.all(
      snapshots.map(async (snapshot) => {
        // 根据 externalId 查找数据集
        const dataset = await this.datasetService.getDatasetByExternalId(snapshot.externalId);
        if (dataset) {
          snapshot.snapshotId = dataset.currentVersionId || '';
          // 查找对应日期的版本记录
          const version = await this.datasetService.datasetVersion.findFirst({
            where: {
              datasetId: dataset.id,
              filePath: snapshot.filePath,
            },
            orderBy: { createdAt: 'desc' },
          });
          if (version) {
            snapshot.snapshotId = version.id;
            snapshot.recordCount = version.recordCount || 0;
          }
        }
        return snapshot;
      })
    );

    return success({
      items: enrichedSnapshots,
      total: enrichedSnapshots.length,
    });
  }

  /**
   * 下载指定快照（返回文件内容）
   *
   * @param snapshotId DatasetVersion.id
   * @returns 文件内容（JSON 字符串）
   */
  @Get('snapshots/:snapshotId/download')
  async downloadSnapshot(@Param('snapshotId') snapshotId: string) {
    // 通过 snapshotId 查找版本记录，获取 filePath
    const version = await this.datasetService.datasetVersion.findUnique({
      where: { id: snapshotId },
      select: { filePath: true },
    });

    if (!version) {
      throw new NotFoundException(`版本 ${snapshotId} 不存在`);
    }

    const filePath = version.filePath;
    if (!filePath) {
      throw new NotFoundException(`版本 ${snapshotId} 没有关联的文件路径`);
    }

    const result = await this.minioService.downloadAisSnapshot(snapshotId, filePath);
    // 直接返回文件内容（JSON 字符串;downloadToTempFile 现流式落盘不返 content,自行读小文件）
    const content = await readFile(result.filePath, 'utf-8');
    return success({
      content,
      filePath: result.filePath,
    });
  }

  // ============================================
  // Sync Status API
  // ============================================

  /**
   * 查询所有数据源同步状态
   *
   * @returns 所有数据源状态列表
   */
  @Get('sync/status')
  async getAllSyncStatus() {
    return success(await this.syncStatusService.getAllStatus());
  }

  /**
   * 查询单个数据源同步状态
   *
   * @param sourceName 数据源名称
   * @returns 单个数据源状态
   */
  @Get('sync/status/:sourceName')
  async getSourceSyncStatus(@Param('sourceName') sourceName: string) {
    const status = await this.syncStatusService.getSourceStatus(sourceName);
    if (!status) {
      throw new NotFoundException(`数据源 ${sourceName} 不存在`);
    }
    return success(status);
  }

  // ============================================
  // Manual Sync API
  // ============================================

  /**
   * 手动触发 ADS-B 同步
   *
   * @returns 同步结果
   */
  @Post('sync/adsb')
  async triggerAdsbSync() {
    this.logger.log('手动触发 ADS-B 同步');
    const result = await this.adsbSyncService.sync();
    return success({
      success: result.success,
      recordCount: result.recordCount,
      versionId: result.versionId,
      message: result.success
        ? `ADS-B 同步成功，共 ${result.recordCount} 条记录`
        : `ADS-B 同步失败：${result.error}`,
    });
  }

  /**
   * 手动触发 AIS 同步（指定数据源）
   *
   * @param sourceName 数据源名称（如 AISStream）
   * @returns 同步结果
   */
  @Post('sync/ais/:sourceName')
  async triggerAisSync(@Param('sourceName') sourceName: string) {
    this.logger.log(`手动触发 AIS 同步：${sourceName}`);
    // 获取 AIS 同步服务实例
    const configs = parseDataSourcesConfig('AIS_DATA_SOURCES');
    const config = configs.find(c => c.name === sourceName);
    if (!config) {
      throw new NotFoundException(`AIS 数据源 ${sourceName} 未配置`);
    }

    // 通过 AisSourceFactoryService 获取实例并同步
    // 这里简化处理：直接调用 AdsbSyncService 不适用，需要工厂服务
    throw new BadRequestException('AIS 手动同步需要通过 AisSourceFactoryService，暂未实现');
  }
}
