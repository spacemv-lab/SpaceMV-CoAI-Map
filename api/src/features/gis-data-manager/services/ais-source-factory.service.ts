/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AisSyncService, AisSyncServiceConfig } from './ais-sync.service';
import { DatasetService } from '../lib/dataset.service';
import { GisQueue } from '../queues/gis.queue';
import { MinioService } from './minio.service';
import {
  AisDataSourceConfig,
  deriveNaming,
} from '../utils/ais-data-source-config.util';
import { FleetMonSyncService, FleetMonSyncServiceConfig } from './fleetmon-sync.service';
import { OpenSeaMapSyncService, OpenSeaMapSyncServiceConfig } from './openseamap-sync.service';
import { AISHubSyncService, AISHubSyncServiceConfig } from './aishub-sync.service';

/**
 * AIS 数据源工厂服务
 *
 * 根据配置动态创建多个 AisSyncService 实例（支持 WebSocket 和 HTTP 类型）
 */
@Injectable()
export class AisSourceFactoryService {
  private readonly logger = new Logger(AisSourceFactoryService.name);
  private instances: Map<string, AisSyncService | FleetMonSyncService | OpenSeaMapSyncService | AISHubSyncService> = new Map();

  constructor(
    private datasetService: DatasetService,
    private gisQueue: GisQueue,
    private minioService: MinioService,
  ) {}

  /**
   * 根据配置创建多个 AIS 数据源实例
   *
   * @param configs 数据源配置数组
   * @returns AIS 数据源实例 Map（key 为 sourceName）
   */
  createSources(configs: AisDataSourceConfig[]): Map<string, AisSyncService | FleetMonSyncService | OpenSeaMapSyncService | AISHubSyncService> {
    this.instances.clear();

    for (const config of configs) {
      if (!config.enabled) {
        this.logger.debug(`跳过未启用的数据源：${config.name}`);
        continue;
      }

      const naming = deriveNaming(config.name);
      this.logger.debug(`创建 AIS 数据源实例：${config.name} -> ${naming.datasetName}`);

      try {
        const service = this.createSource(config, naming);
        this.instances.set(config.name, service);
      } catch (error) {
        this.logger.error(`创建数据源 ${config.name} 失败：${error.message}`);
      }
    }

    this.logger.log(`成功创建 ${this.instances.size} 个 AIS 数据源实例`);
    return this.instances;
  }

  /**
   * 获取所有已创建的实例
   */
  getInstances(): Map<string, AisSyncService | FleetMonSyncService | OpenSeaMapSyncService | AISHubSyncService> {
    return this.instances;
  }

  /**
   * 创建单个 AIS 数据源实例
   *
   * @param config 数据源配置
   * @param naming 派生命名
   * @returns AIS 数据源服务实例
   */
  private createSource(
    config: AisDataSourceConfig,
    naming: {
      sourceName: string;
      sourceKey: string;
      datasetName: string;
      externalId: string;
      tag: string;
      jobId: string;
    },
  ): AisSyncService | FleetMonSyncService | OpenSeaMapSyncService | AISHubSyncService {
    // 根据类型创建不同的适配器实例
    if (config.type === 'websocket') {
      // 从环境变量获取 API Key（支持 env: 前缀）
      let apiKey = config.apiKey || '';
      if (apiKey.startsWith('env:')) {
        const envVarName = apiKey.substring(4);
        apiKey = process.env[envVarName] || '';
      }

      const serviceConfig: AisSyncServiceConfig = {
        sourceName: naming.sourceName,
        datasetName: naming.datasetName,
        externalId: naming.externalId,
        tag: naming.tag,
        schedule: config.schedule,
      };

      return AisSyncService.createInstance(
        this.datasetService,
        this.gisQueue,
        this.minioService,
        serviceConfig,
        apiKey,
        config.url,
        config.bbox,
      );
    } else if (config.type === 'http') {
      // HTTP 类型：根据 URL 或名称判断使用哪个适配器
      const lowerName = config.name.toLowerCase();
      const lowerUrl = config.url.toLowerCase();

      const isFleetMon = lowerUrl.includes('fleetmon') || lowerName.includes('fleetmon');
      const isOpenSeaMap = lowerUrl.includes('openseamap') || lowerName.includes('openseamap');
      const isAISHub = lowerUrl.includes('aishub') || lowerName.includes('aishub');

      if (isFleetMon) {
        const serviceConfig: FleetMonSyncServiceConfig = {
          sourceName: naming.sourceName,
          datasetName: naming.datasetName,
          externalId: naming.externalId,
          tag: naming.tag,
          schedule: config.schedule,
        };

        return FleetMonSyncService.createInstance(
          this.datasetService,
          this.gisQueue,
          this.minioService,
          serviceConfig,
        );
      } else if (isOpenSeaMap) {
        const serviceConfig: OpenSeaMapSyncServiceConfig = {
          sourceName: naming.sourceName,
          datasetName: naming.datasetName,
          externalId: naming.externalId,
          tag: naming.tag,
          schedule: config.schedule,
        };

        return OpenSeaMapSyncService.createInstance(
          this.datasetService,
          this.gisQueue,
          this.minioService,
          serviceConfig,
        );
      } else if (isAISHub) {
        const serviceConfig: AISHubSyncServiceConfig = {
          sourceName: naming.sourceName,
          datasetName: naming.datasetName,
          externalId: naming.externalId,
          tag: naming.tag,
          schedule: config.schedule,
        };

        return AISHubSyncService.createInstance(
          this.datasetService,
          this.gisQueue,
          this.minioService,
          serviceConfig,
        );
      } else {
        // 其他 HTTP 数据源暂不支持
        this.logger.warn(`数据源 ${config.name} 类型为 HTTP，但不在支持列表中（当前支持：FleetMon, OpenSeaMap, AISHub）`);
        throw new Error(`不支持的 HTTP 数据源：${config.name}`);
      }
    } else {
      this.logger.warn(`数据源 ${config.name} 类型未知：${config.type}`);
      throw new Error(`不支持的数据源类型：${config.type}`);
    }
  }
}
