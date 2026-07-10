/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { buildRedisOptions } from '../utils/redis.config';

export interface CogJobData {
  tileSourceId: string;
}

export interface CogJobResult {
  success: boolean;
  cogKey?: string;
  error?: string;
}

/**
 * BullMQ queue for GeoTIFF → COG conversion (Phase 2 影像动态切片)
 */
@Injectable()
export class CogQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CogQueue.name);
  private queue: Queue<CogJobData, CogJobResult>;
  private redisConnection: Redis;

  async onModuleInit() {
    const redisOptions = buildRedisOptions('cog-queue', {
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.redisConnection = new Redis(redisOptions);
    this.redisConnection.on('error', (e) =>
      this.logger.error(`Redis error: ${e.message}`),
    );

    this.queue = new Queue<CogJobData, CogJobResult>('cog-ingest', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 1, // COG 失败多为确定性(坏文件/不支持格式),不重试
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });

    this.logger.log('CogQueue initialized');
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.redisConnection?.quit();
  }

  /**
   * Add a COG conversion job (jobId 用 tileSourceId 保证幂等)
   */
  async addJob(tileSourceId: string): Promise<Job<CogJobData, CogJobResult>> {
    const job = await this.queue.add(
      'cog-ingest-job',
      { tileSourceId },
      { jobId: `cog-${tileSourceId}` },
    );
    this.logger.log(`COG job added: ${job.id} for tile source ${tileSourceId}`);
    return job;
  }
}
