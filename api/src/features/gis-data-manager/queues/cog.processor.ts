/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { buildRedisOptions } from '../utils/redis.config';
import { CogJobData, CogJobResult } from './cog.queue';
import { TileSourceService } from '../lib/tile-source.service';

/**
 * BullMQ worker:取 tileSourceId → TileSourceService.processCog 跑完整 COG 管线。
 *
 * 业务逻辑(下载原档→gdal_translate→上传 COG→更新 TileSource)在 service 层;
 * 本 processor 仅负责 BullMQ 调度。processCog 内部 catch 并把状态置 FAILED,
 * 所以 job 本身通常正常完成(返回 success: false),不会触发 bullmq 重试。
 */
@Injectable()
export class CogProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CogProcessor.name);
  private worker: Worker<CogJobData, CogJobResult>;
  private redisConnection: Redis;

  constructor(private readonly tileSourceService: TileSourceService) {}

  async onModuleInit() {
    const redisOptions = buildRedisOptions('cog-processor');
    this.redisConnection = new Redis(redisOptions);

    this.worker = new Worker<CogJobData, CogJobResult>(
      'cog-ingest',
      async (job: Job<CogJobData, CogJobResult>) => {
        const { tileSourceId } = job.data;
        this.logger.log(
          `Processing COG job ${job.id} for tile source ${tileSourceId}`,
        );
        return await this.tileSourceService.processCog(tileSourceId);
      },
      { connection: this.redisConnection, concurrency: 1 },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`COG job ${job?.id} failed (bullmq): ${err.message}`);
    });

    this.logger.log('CogProcessor initialized');
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redisConnection?.quit();
  }
}
