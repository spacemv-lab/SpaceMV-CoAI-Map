/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';
import { GisQueue } from '../queues/gis.queue';
import { GeometryType } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 外部数据源同步结果
 */
export interface SyncResult {
  success: boolean;
  /** 同步状态：PENDING（已入队等待处理）、SUCCESS（处理完成）、FAILED（处理失败） */
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  recordCount: number;
  datasetId: string;
  versionId: string;
  error?: string;
}

/**
 * 外部数据源配置
 */
export interface ExternalDataSourceConfig {
  /** 数据源名称 */
  sourceName: string;
  /** 数据集名称（用于在平台中标识） */
  datasetName: string;
  /** 几何类型 */
  geometryType: GeometryType;
  /** 数据来源标记 */
  sourceType: string;
  /** 默认标签 */
  defaultTags: string[];
  /** 外部唯一标识（用于稳定查找数据集，避免名称冲突） */
  externalId: string;
}

/**
 * 外部数据抓取结果
 */
export interface FetchedData {
  features: Array<{
    id: string;
    properties: Record<string, any>;
    geometry: {
      type: string;
      coordinates: number[];
    };
  }>;
  bbox?: [number, number, number, number];
  timestamp: Date;
}

/**
 * 外部数据同步服务抽象基类
 *
 * 所有外部数据源同步服务都应继承此类，实现具体的数据抓取逻辑
 */
export abstract class ExternalDataSyncService {
  protected readonly logger = new Logger(this.constructor.name);

  /** 数据源配置（由子类实现） */
  abstract readonly config: ExternalDataSourceConfig;

  /** 抓取外部数据（由子类实现） */
  abstract fetchData(): Promise<FetchedData>;

  constructor(
    protected datasetService: DatasetService,
    protected gisQueue: GisQueue,
  ) {}

  /**
   * 同步数据入口方法
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`开始同步 ${this.config.sourceName} 数据...`);

      // 1. 抓取外部数据
      const externalData = await this.fetchData();
      this.logger.log(`从 ${this.config.sourceName} 获取到 ${externalData.features.length} 条记录`);

      // 2. 确保数据集存在
      const dataset = await this.ensureDataset();
      this.logger.log(`数据集 ${this.config.datasetName} 已就绪 (ID: ${dataset.id})`);

      // 3. 创建新版本
      const version = await this.createVersion(dataset.id, externalData);
      this.logger.log(`创建版本 ${version.version} (ID: ${version.id})`);

      // 4. 将数据写入临时文件（供 GisProcessor 处理）
      const filePath = await this.writeTempData(externalData.features, version.id);

      // 5. 入队 GIS 处理队列（解析 + 入库）
      await this.gisQueue.addJob({
        versionId: version.id,
        datasetId: dataset.id,
        filePath,
        fileType: '.geojson',
        options: {
          targetCRS: 'EPSG:4326',
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `${this.config.sourceName} 数据已入队处理，耗时 ${duration}ms，` +
        `共 ${externalData.features.length} 条记录待导入`
      );

      // 返回 PENDING 状态，表示已入队等待处理
      // 调用者需要轮询版本状态来确认最终结果
      return {
        success: true,
        status: 'PENDING',
        recordCount: externalData.features.length,
        datasetId: dataset.id,
        versionId: version.id,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `${this.config.sourceName} 同步失败，耗时 ${duration}ms: ${error.message}`,
        error.stack
      );

      return {
        success: false,
        status: 'FAILED',
        recordCount: 0,
        datasetId: '',
        versionId: '',
        error: error.message,
      };
    }
  }

  /**
   * 系统外部数据项目的稳定标识
   */
  protected static readonly SYSTEM_PROJECT_EXTERNAL_ID = 'system-external-data';

  /**
   * 确保数据集存在（不存在则创建）
   * 使用 externalId 作为稳定标识，避免名称冲突导致的租户隔离问题
   * 外部数据源创建为 GLOBAL scope，所有项目可用
   */
  protected async ensureDataset() {
    // 使用配置中的外部唯一标识
    const datasetExternalId = this.config.externalId;

    // 先用 externalId 查找（稳定标识，避免租户冲突）
    const existing = await this.datasetService.dataset.findFirst({
      where: {
        externalId: datasetExternalId,
      },
    });

    if (existing) {
      return existing;
    }

    // 创建新数据集，设置为 GLOBAL scope（所有项目可用）
    return this.datasetService.createDataset({
      projectId: null,  // GLOBAL scope 不需要 projectId
      scope: 'GLOBAL',  // 外部数据源为全局数据
      name: this.config.datasetName,
      type: this.config.geometryType,
      source: this.config.sourceType,
      tags: this.config.defaultTags,
      description: `Auto-synced from ${this.config.sourceName}`,
      externalId: datasetExternalId,
    });
  }

  /**
   * 创建数据集版本
   * 使用事务确保版本号分配的原子性
   */
  protected async createVersion(
    datasetId: string,
    externalData: FetchedData
  ) {
    // 使用事务确保版本号分配和创建是原子的
    return this.datasetService.$transaction(async (tx) => {
      // 获取当前最大版本号
      const latest = await tx.datasetVersion.findFirst({
        where: { datasetId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = (latest?.version || 0) + 1;

      // 创建新版本
      return tx.datasetVersion.create({
        data: {
          datasetId,
          version: nextVersion,
          filePath: `/tmp/sync-${datasetId}-${Date.now()}.geojson`,
          fileSize: 0,
          recordCount: externalData.features.length,
          status: 'PENDING',
          sourceCRS: 'EPSG:4326',
          bbox: externalData.bbox as any,
          startedAt: new Date(),
        },
      });
    });
  }

  /**
   * 获取下一个版本号
   */
  protected async getNextVersionNumber(datasetId: string): Promise<number> {
    const latest = await this.datasetService.datasetVersion.findFirst({
      where: { datasetId },
      orderBy: { version: 'desc' },
    });
    return (latest?.version || 0) + 1;
  }

  /**
   * 写入临时数据文件
   */
  protected async writeTempData(
    features: Array<{ id: string; properties: Record<string, any>; geometry: any }>,
    versionId: string
  ): Promise<string> {
    const tempDir = '/tmp/gis-sync';
    await fs.mkdir(tempDir, { recursive: true });

    const filePath = path.join(tempDir, `${versionId}.geojson`);
    const geojson = {
      type: 'FeatureCollection' as const,
      features: features.map(f => ({
        type: 'Feature' as const,
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    await fs.writeFile(filePath, JSON.stringify(geojson), 'utf-8');
    return filePath;
  }

  /**
   * 获取外部项目 ID
   * 使用 externalId 作为稳定标识，避免名称冲突导致的租户隔离问题
   */
  protected async getExternalProjectId(): Promise<string> {
    // 用 externalId 查找系统外部数据项目（稳定标识）
    const existing = await this.datasetService.project.findFirst({
      where: { externalId: ExternalDataSyncService.SYSTEM_PROJECT_EXTERNAL_ID },
    });

    if (existing) {
      return existing.id;
    }

    // 创建新项目，设置 externalId
    const project = await this.datasetService.createProject({
      name: 'External Data',
      description: 'Auto-synced external data sources',
      ownerId: 'system',
      externalId: ExternalDataSyncService.SYSTEM_PROJECT_EXTERNAL_ID,
    });

    return project.id;
  }
}
