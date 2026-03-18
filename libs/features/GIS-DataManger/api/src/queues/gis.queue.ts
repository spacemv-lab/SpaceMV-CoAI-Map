/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { buildRedisOptions } from '../utils/redis.config';

export interface GisJobData {
  versionId: string;
  datasetId: string;
  filePath: string;
  fileType: string;
  options?: {
    targetCRS?: string;
    mappingProfileId?: string;
    validateGeometry?: boolean;
    repairGeometry?: boolean;
  };
}

export interface GisJobResult {
  success: boolean;
  recordCount?: number;
  geometryType?: string;
  bbox?: [number, number, number, number];
  error?: string;
}

/**
 * BullMQ queue for GIS data processing
 */
@Injectable()
export class GisQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GisQueue.name);
  private queue: Queue<GisJobData, GisJobResult>;
  private redisConnection: Redis;

  constructor() {
    // Redis connection will be initialized in onModuleInit
  }

  async onModuleInit() {
    const redisOptions = buildRedisOptions('gis-queue', {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.logger.log(
      `Connecting to Redis at ${redisOptions.host}:${redisOptions.port}`,
    );

    this.redisConnection = new Redis(redisOptions);

    this.redisConnection.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redisConnection.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redisConnection.on('ready', () => {
      this.logger.log('Redis ready');
    });

    this.queue = new Queue<GisJobData, GisJobResult>('gis-ingest', {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs
        },
      },
    });

    this.logger.log('GisQueue initialized');
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    this.logger.log('GisQueue destroyed');
  }

  /**
   * Add a job to the queue
   */
  async addJob(data: GisJobData, options?: { priority?: number; delay?: number }): Promise<Job<GisJobData, GisJobResult>> {
    const job = await this.queue.add('gis-ingest-job', data, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
      jobId: `gis-${data.versionId}`, // Use versionId as job ID for idempotency
    });

    this.logger.log(`Job added: ${job.id} for version ${data.versionId}`);
    return job;
  }

  /**
   * Get job by version ID
   */
  async getJobByVersionId(versionId: string): Promise<Job<GisJobData, GisJobResult> | null> {
    const job = await this.queue.getJob(`gis-${versionId}`);
    return job;
  }

  /**
   * Get job status
   */
  async getJobStatus(versionId: string): Promise<string | null> {
    const job = await this.getJobByVersionId(versionId);
    if (!job) return null;
    return job.getState();
  }

  /**
   * Get queue stats
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const stats = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting: stats[0],
      active: stats[1],
      completed: stats[2],
      failed: stats[3],
      delayed: stats[4],
    };
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.logger.log('Queue paused');
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.logger.log('Queue resumed');
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(gracePeriodMs: number = 3600000): Promise<void> {
    await this.queue.clean(gracePeriodMs, 100, 'completed');
    await this.queue.clean(gracePeriodMs, 100, 'failed');
    this.logger.log('Old jobs cleaned');
  }
}
