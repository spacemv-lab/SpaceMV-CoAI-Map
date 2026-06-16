/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';
import { AisDataSourceConfig, deriveNaming, parseDataSourcesConfig } from '../utils/ais-data-source-config.util';

/**
 * 同步状态信息
 */
export interface SyncStatusItem {
  /** 数据源名称 */
  sourceName: string;
  /** 外部唯一标识 */
  externalId: string;
  /** 标签 */
  tag: string;
  /** 定时任务 ID */
  jobId: string;
  /** 同步频率（cron 表达式） */
  schedule: string;
  /** 当前状态：IDLE（空闲）、RUNNING（同步中）、SUCCESS（成功）、FAILED（失败） */
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  /** 最后一次同步开始时间 */
  lastSyncStartedAt: Date | null;
  /** 最后一次同步完成时间 */
  lastSyncCompletedAt: Date | null;
  /** 最后一次成功同步时间 */
  lastSuccessAt: Date | null;
  /** 最后一次同步的记录数 */
  lastRecordCount: number;
  /** 最后一次快照 ID */
  lastSnapshotId: string | null;
  /** 最后一次错误信息 */
  lastErrorMessage: string | null;
}

/**
 * 同步状态查询结果
 */
export interface SyncStatusResponse {
  items: SyncStatusItem[];
  generatedAt: Date;
}

/**
 * 同步状态服务
 *
 * 提供各数据源同步状态查询功能
 */
@Injectable()
export class SyncStatusService {
  private readonly logger = new Logger(SyncStatusService.name);
  private dataSources: AisDataSourceConfig[] = [];
  private namings: Record<string, ReturnType<typeof deriveNaming>> = {};

  constructor(private datasetService: DatasetService) {
    this.loadDataSources();
  }

  /**
   * 从环境变量加载数据源配置
   */
  private loadDataSources() {
    try {
      const configs = parseDataSourcesConfig('AIS_DATA_SOURCES');
      this.dataSources = configs.filter(c => c.enabled);
      this.namings = {};
      for (const config of this.dataSources) {
        this.namings[config.name] = deriveNaming(config.name);
      }
      this.logger.log(`加载 ${this.dataSources.length} 个 AIS 数据源配置`);
    } catch (error) {
      this.logger.warn(`解析 AIS 数据源配置失败：${error.message}`);
      this.dataSources = [];
    }
  }

  /**
   * 查询所有数据源状态
   */
  async getAllStatus(): Promise<SyncStatusResponse> {
    this.loadDataSources(); // 每次查询时刷新配置（支持配置变更无需重启）

    const items = await Promise.all(
      this.dataSources.map(config => this.getSourceStatus(config.name))
    );

    return {
      items: items.filter(Boolean) as SyncStatusItem[],
      generatedAt: new Date(),
    };
  }

  /**
   * 查询单个数据源状态
   */
  async getSourceStatus(sourceName: string): Promise<SyncStatusItem | null> {
    const naming = this.namings[sourceName];
    if (!naming) {
      this.logger.warn(`未知的数据源名称：${sourceName}`);
      return null;
    }

    // 查找数据集
    const dataset = await this.datasetService.getDatasetByExternalId(naming.externalId);
    if (!dataset || !dataset.currentVersionId) {
      // 数据集不存在，返回初始状态
      return {
        sourceName: naming.sourceName,
        externalId: naming.externalId,
        tag: naming.tag,
        jobId: naming.jobId,
        schedule: this.dataSources.find(c => c.name === sourceName)?.schedule || '',
        status: 'IDLE',
        lastSyncStartedAt: null,
        lastSyncCompletedAt: null,
        lastSuccessAt: null,
        lastRecordCount: 0,
        lastSnapshotId: null,
        lastErrorMessage: null,
      };
    }

    // 查找最新的版本记录
    const latestVersion = await this.datasetService.datasetVersion.findFirst({
      where: { datasetId: dataset.id },
      orderBy: { createdAt: 'desc' },
    });

    // 查找最后一次成功的版本记录
    const lastSuccessfulVersion = await this.datasetService.datasetVersion.findFirst({
      where: { datasetId: dataset.id, status: 'SUCCESS' },
      orderBy: { completedAt: 'desc' },
    });

    // 计算状态
    let status: SyncStatusItem['status'] = 'IDLE';
    if (latestVersion) {
      switch (latestVersion.status) {
        case 'PENDING':
        case 'PARSING':
        case 'VALIDATING':
        case 'IMPORTING':
        case 'INDEXING':
          status = 'RUNNING';
          break;
        case 'SUCCESS':
          status = 'SUCCESS';
          break;
        case 'FAILED':
          status = 'FAILED';
          break;
      }
    }

    return {
      sourceName: naming.sourceName,
      externalId: naming.externalId,
      tag: naming.tag,
      jobId: naming.jobId,
      schedule: this.dataSources.find(c => c.name === sourceName)?.schedule || '',
      status,
      lastSyncStartedAt: latestVersion?.startedAt || null,
      lastSyncCompletedAt: latestVersion?.completedAt || null,
      lastSuccessAt: lastSuccessfulVersion?.completedAt || null,
      lastRecordCount: latestVersion?.recordCount || 0,
      lastSnapshotId: latestVersion?.id || null,
      lastErrorMessage: latestVersion?.statusMessage || null,
    };
  }
}
