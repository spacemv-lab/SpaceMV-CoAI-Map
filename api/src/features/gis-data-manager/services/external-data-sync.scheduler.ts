/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { AdsbSyncService } from './adsb-sync.service';
import { AisSourceFactoryService } from './ais-source-factory.service';
import { buildRedisOptions } from '../utils/redis.config';
import { parseDataSourcesConfig } from '../utils/ais-data-source-config.util';

/**
 * 外部数据同步调度器
 *
 * 使用 BullMQ repeatable jobs 实现定时同步
 */
@Injectable()
export class ExternalDataSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExternalDataSyncScheduler.name);
  private queue: Queue;
  private worker: Worker; // 单一 Worker，根据 job.name 路由
  private redisConnection: Redis;
  private aisInstances: Map<string, any> = new Map();

  constructor(
    private adsbSyncService: AdsbSyncService,
    private aisSourceFactory: AisSourceFactoryService,
  ) {}

  async onModuleInit() {
    const redisOptions = buildRedisOptions('external-sync-scheduler');
    this.redisConnection = new Redis(redisOptions);

    this.queue = new Queue('external-data-sync', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 5000,
        },
      },
    });

    this.logger.log('ExternalDataSyncScheduler 初始化完成');

    // 创建多实例 AIS 同步服务
    this.createAisInstances();

    // 注册定时任务
    await this.registerRepeatableJobs();

    // 注册工作处理器
    this.registerWorkers();
  }

  /**
   * 创建多实例 AIS 同步服务
   * 使用外部已验证的配置，不再重复解析
   */
  private createAisInstances() {
    const configs = parseDataSourcesConfig('AIS_DATA_SOURCES');
    if (configs.length === 0) {
      throw new Error('AIS_DATA_SOURCES 配置为空数组，至少需要配置一个 AIS 数据源');
    }
    this.aisInstances = this.aisSourceFactory.createSources(configs);
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
    if (this.worker) {
      await this.worker.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    this.logger.log('ExternalDataSyncScheduler 已销毁');
  }

  /**
   * 注册定时同步任务
   */
  private async registerRepeatableJobs() {
    try {
      // ADS-B 每小时同步一次（整点执行）
      await this.queue.add(
        'adsb-sync',
        {},
        {
          repeat: {
            pattern: '0 * * * *', // 每小时 0 分
          },
          jobId: 'adsb-sync-hourly',
        }
      );
      this.logger.log('ADS-B 定时任务已注册（每小时执行）');

      // AIS 定时任务：为每个数据源注册独立的定时任务
      if (this.aisInstances.size > 0) {
        for (const [sourceName, service] of this.aisInstances.entries()) {
          const jobId = `ais-sync-${sourceName.toLowerCase()}`;
          await this.queue.add(
            `ais-sync:${sourceName}`,
            {},
            {
              repeat: {
                pattern: service.schedule || '0 * * * *', // 使用配置的 cron，默认每小时
              },
              jobId,
            }
          );
          this.logger.log(`AIS 数据源 [${sourceName}] 定时任务已注册（${service.schedule || '每小时执行'}）`);
        }
      } else {
        // 降级：如果没有配置多数据源，使用默认单实例
        await this.queue.add(
          'ais-sync',
          {},
          {
            repeat: {
              pattern: '0 * * * *',
            },
            jobId: 'ais-sync-hourly',
          }
        );
        this.logger.log('AIS 定时任务已注册（每小时执行，默认单实例）');
      }

      this.logger.log(`定时任务注册完成，共 ${this.aisInstances.size + 1} 个任务`);
    } catch (error) {
      this.logger.error(`注册定时任务失败：${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 注册工作处理器
   * 单一 Worker 根据 job.name 路由到正确的同步服务
   */
  private registerWorkers() {
    this.worker = new Worker(
      'external-data-sync',
      async (job) => {
        this.logger.log(`开始执行 ${job.name} 同步任务`);

        let result;
        switch (true) {
          case job.name === 'adsb-sync':
            result = await this.adsbSyncService.sync();
            break;
          case job.name.startsWith('ais-sync:'): {
            // 多实例 AIS 路由：ais-sync:{sourceName}
            const sourceName = job.name.split(':')[1];
            const service = this.aisInstances.get(sourceName);
            if (!service) {
              throw new Error(`未知的 AIS 数据源：${sourceName}`);
            }
            result = await service.sync();
            break;
          }
          case job.name === 'ais-sync': {
            // 降级：默认单实例（向后兼容）
            const firstInstance = this.aisInstances.values().next().value;
            if (firstInstance) {
              result = await firstInstance.sync();
            } else {
              throw new Error('没有可用的 AIS 同步服务实例');
            }
            break;
          }
          default:
            throw new Error(`未知的同步任务类型：${job.name}`);
        }

        if (!result.success) {
          throw new Error(`${job.name} 同步失败：${result.error}`);
        }
        return result;
      },
      {
        connection: this.redisConnection,
        concurrency: 1,
      }
    );

    this.logger.log('ADS-B/AIS 工作处理器已注册（单一 Worker 路由模式）');
  }
}
