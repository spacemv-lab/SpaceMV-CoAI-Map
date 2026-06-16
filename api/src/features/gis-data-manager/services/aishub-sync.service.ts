/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExternalDataSyncService, ExternalDataSourceConfig, FetchedData, SyncResult } from '../services/external-data-sync.base';
import { DatasetService } from '../lib/dataset.service';
import { GisQueue } from '../queues/gis.queue';
import { AISHubAdapter } from '../adapters/aishub.adapter';
import { GeometryType } from '@prisma/client';
import { MinioService } from './minio.service';

/**
 * AISHub 数据同步服务配置
 */
export interface AISHubSyncServiceConfig {
  sourceName: string;
  datasetName: string;
  externalId: string;
  tag: string;
  schedule: string;
}

/**
 * AISHub 数据同步服务
 *
 * 定时从 AISHub 获取全球船舶位置数据
 */
@Injectable()
export class AISHubSyncService extends ExternalDataSyncService implements OnModuleInit {
  protected readonly logger = new Logger(AISHubSyncService.name);
  readonly schedule: string;
  readonly config: ExternalDataSourceConfig;

  constructor(
    datasetService: DatasetService,
    gisQueue: GisQueue,
    private aishubAdapter: AISHubAdapter,
    private minioService: MinioService,
    serviceConfig: AISHubSyncServiceConfig,
  ) {
    super(datasetService, gisQueue);
    this.schedule = serviceConfig.schedule;
    this.config = {
      sourceName: serviceConfig.sourceName,
      datasetName: serviceConfig.datasetName,
      geometryType: GeometryType.POINT,
      sourceType: 'SYNC',
      defaultTags: ['ais', 'maritime', 'free-tier', serviceConfig.tag],
      externalId: serviceConfig.externalId,
    };
  }

  async onModuleInit() {
    this.logger.log(`AISHubSyncService[${this.config.sourceName}] 初始化完成`);
  }

  /**
   * 抓取 AISHub 数据
   */
  async fetchData(): Promise<FetchedData> {
    return this.aishubAdapter.fetchAll();
  }

  /**
   * 重写 sync 方法，在同步完成后保存原始快照
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`开始同步 ${this.config.sourceName} 数据...`);

      const externalData = await this.fetchData();
      this.logger.log(`从 ${this.config.sourceName} 获取到 ${externalData.features.length} 条记录`);

      const dataset = await this.ensureDataset();
      this.logger.log(`数据集 ${this.config.datasetName} 已就绪 (ID: ${dataset.id})`);

      const version = await this.createVersion(dataset.id, externalData);
      this.logger.log(`创建版本 ${version.version} (ID: ${version.id})`);

      const filePath = await this.writeTempData(externalData.features, version.id);

      const rawJsonBuffer = Buffer.from(
        JSON.stringify({
          type: 'FeatureCollection',
          features: externalData.features,
          bbox: externalData.bbox,
          timestamp: externalData.timestamp,
        }),
        'utf-8'
      );

      let snapshotKey: string | null = null;
      try {
        snapshotKey = await this.minioService.saveAisSnapshot(this.config.sourceName, rawJsonBuffer, {
          timestamp: externalData.timestamp,
          recordCount: externalData.features.length,
        });
        this.logger.log(`AIS 原始快照已保存：${snapshotKey}`);
      } catch (error) {
        this.logger.error(`保存 AIS 原始快照失败：${error.message}`);
      }

      if (snapshotKey) {
        await this.datasetService.datasetVersion.update({
          where: { id: version.id },
          data: {
            filePath: snapshotKey,
            fileSize: rawJsonBuffer.length,
          },
        });
      }

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
   * 创建 AISHub 同步服务实例
   */
  static createInstance(
    datasetService: DatasetService,
    gisQueue: GisQueue,
    minioService: MinioService,
    config: AISHubSyncServiceConfig,
  ): AISHubSyncService {
    const adapter = new AISHubAdapter();
    return new AISHubSyncService(datasetService, gisQueue, adapter, minioService, config);
  }
}
