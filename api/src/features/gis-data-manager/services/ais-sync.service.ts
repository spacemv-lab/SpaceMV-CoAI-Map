/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ExternalDataSyncService, ExternalDataSourceConfig, FetchedData, SyncResult } from '../services/external-data-sync.base';
import { DatasetService } from '../lib/dataset.service';
import { GisQueue } from '../queues/gis.queue';
import { AISStreamAdapter } from '../adapters/aisstream.adapter';
import { GeometryType } from '@prisma/client';
import { MinioService } from './minio.service';

/**
 * AIS 数据同步服务配置
 */
export interface AisSyncServiceConfig {
  sourceName: string;
  datasetName: string;
  externalId: string;
  tag: string;
  schedule: string;
}

/**
 * AIS 数据同步服务
 *
 * 定时从 AISStream 抓取全球船舶位置数据
 */
@Injectable()
export class AisSyncService extends ExternalDataSyncService implements OnModuleInit {
  protected readonly logger = new Logger(AisSyncService.name);
  readonly schedule: string;
  readonly config: ExternalDataSourceConfig;

  constructor(
    datasetService: DatasetService,
    gisQueue: GisQueue,
    private aisStreamAdapter: AISStreamAdapter,
    private minioService: MinioService,
    serviceConfig: AisSyncServiceConfig,
  ) {
    super(datasetService, gisQueue);
    this.schedule = serviceConfig.schedule;
    this.config = {
      sourceName: serviceConfig.sourceName,
      datasetName: serviceConfig.datasetName,
      geometryType: GeometryType.POINT,
      sourceType: 'SYNC',
      defaultTags: ['ais', 'maritime', 'real-time', serviceConfig.tag],
      externalId: serviceConfig.externalId,
    };
  }

  async onModuleInit() {
    this.logger.log(`AisSyncService[${this.config.sourceName}] 初始化完成`);
  }

  /**
   * 抓取 AIS 数据
   *
   * 由于 AISStream 是 WebSocket 长连接，采用批处理模式抓取 30 秒数据
   */
  async fetchData(): Promise<FetchedData> {
    return this.aisStreamAdapter.fetchBatch(30);
  }

  /**
   * 重写 sync 方法，在同步完成后保存原始快照
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

      // 5. 保存原始快照到 MinIO（任务 2.2）
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
        // 降级处理：不阻断同步流程
      }

      // 6. 更新 DatasetVersion 的 filePath 和 fileSize（任务 2.3）
      if (snapshotKey) {
        await this.datasetService.datasetVersion.update({
          where: { id: version.id },
          data: {
            filePath: snapshotKey,
            fileSize: rawJsonBuffer.length,
          },
        });
        this.logger.log(`DatasetVersion ${version.id} 已更新 filePath 和 fileSize`);
      }

      // 7. 入队 GIS 处理队列（解析 + 入库）
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
   * 创建 AIS 同步服务实例的静态工厂方法
   *
   * @param datasetService 数据集服务
   * @param gisQueue GIS 队列
   * @param minioService MinIO 服务
   * @param config 服务配置
   * @param apiKey API Key（用于 AISStreamAdapter 初始化）
   * @param url WebSocket URL（可选，默认为 AISStream 默认地址）
   * @param bbox 订阅区域（可选）
   * @returns AisSyncService 实例
   */
  static createInstance(
    datasetService: DatasetService,
    gisQueue: GisQueue,
    minioService: MinioService,
    config: AisSyncServiceConfig,
    apiKey: string,
    url?: string,
    bbox?: [[number, number], [number, number]],
  ): AisSyncService {
    // AISStreamAdapter 是无参构造，通过 setter 方法初始化
    const adapter = new AISStreamAdapter();
    // 通过 setter 注入配置（如果适配器支持）
    // 注意：当前 AISStreamAdapter 从环境变量读取配置，这里暂不处理
    // 如需动态配置，需在 AISStreamAdapter 中添加 initialize 方法

    return new AisSyncService(datasetService, gisQueue, adapter, minioService, config);
  }
}
