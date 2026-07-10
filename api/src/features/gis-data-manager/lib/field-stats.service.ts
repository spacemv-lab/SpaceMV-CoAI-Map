/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import {
  FieldStatsResponse,
  FieldStatsRequest,
  getFieldStatsCacheKey,
} from '../dto/field-stats.dto';
import Redis from 'ioredis';
import { buildRedisOptions } from '../utils/redis.config';

/**
 * 字段统计服务
 * 使用 PostgreSQL 聚合函数计算字段统计值
 * 用于分级色彩渲染
 */
@Injectable()
export class FieldStatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FieldStatsService.name);
  private redis: Redis | null = null;

  constructor(private readonly datasetService: DatasetService) {}

  async onModuleInit() {
    // 初始化 Redis 连接（用于缓存统计结果）
    try {
      const redisOptions = buildRedisOptions('field-stats');
      this.redis = new Redis(redisOptions);

      this.redis.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected for field stats caching');
      });
    } catch (e) {
      this.logger.warn('Redis connection failed, stats will not be cached');
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * 计算字段统计值
   */
  async computeFieldStats(
    datasetId: string,
    request: FieldStatsRequest,
  ): Promise<FieldStatsResponse> {
    const { field, method, classes } = request;

    // 1. 检查缓存
    const cacheKey = getFieldStatsCacheKey(datasetId, field, method, classes);
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.logger.log(`Field stats cache hit: ${cacheKey}`);
          return JSON.parse(cached);
        }
      } catch (e) {
        this.logger.warn(`Redis get failed: ${e}`);
      }
    }

    // 2. 获取 dataset 和 version
    const dataset = await this.datasetService.getDataset(datasetId);
    if (!dataset || !dataset.currentVersion) {
      throw new Error(`Dataset ${datasetId} not found or has no version`);
    }

    const versionId = dataset.currentVersion.id;

    // 3. 计算基础统计（min/max/mean）
    const baseStats = await this.computeBaseStats(versionId, field);

    // 4. 根据分级方法计算断点
    const breakpoints = await this.computeBreakpoints(
      versionId,
      field,
      method,
      classes,
      baseStats,
    );

    // 5. 构建响应
    const response: FieldStatsResponse = {
      field,
      min: baseStats.min,
      max: baseStats.max,
      mean: baseStats.mean,
      breakpoints,
      computedAt: new Date().toISOString(),
    };

    // 6. 缓存结果（10分钟）
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 600, JSON.stringify(response));
        this.logger.log(`Field stats cached: ${cacheKey}`);
      } catch (e) {
        this.logger.warn(`Redis set failed: ${e}`);
      }
    }

    return response;
  }

  /**
   * 计算基础统计值（min/max/mean）
   * 使用 PostgreSQL 聚合函数
   */
  private async computeBaseStats(
    versionId: string,
    field: string,
  ): Promise<{ min: number; max: number; mean: number }> {
    // 使用 PostgreSQL 聚合函数
    // properties 是 JSONB 类型，使用 ->> 提取字段值并转换为 numeric
    // 只对“看起来是数字”的值做聚合：空串/文本/非法值用正则前置过滤，
    // 避免 (properties ->> field)::numeric 对 '' 或 'abc' 抛 22P02 invalid input syntax。
    // （空串常见于“清空单元格”后存入的 ""；加字段回填的是 null，已被 IS NOT NULL 滤掉。）
    const result: any[] = await this.datasetService.$queryRaw`
      SELECT
        MIN((properties ->> ${field})::numeric) as min,
        MAX((properties ->> ${field})::numeric) as max,
        AVG((properties ->> ${field})::numeric) as mean
      FROM "GisFeature"
      WHERE "versionId" = ${versionId}
        AND (properties ->> ${field}) IS NOT NULL
        AND (properties ->> ${field}) <> ''
        AND (properties ->> ${field}) ~ '^-?[0-9]+(\\.[0-9]+)?$'
    `;

    if (!result || result.length === 0 || result[0].min === null) {
      throw new Error(`No valid values found for field ${field}`);
    }

    return {
      min: Number(result[0].min),
      max: Number(result[0].max),
      mean: Number(result[0].mean),
    };
  }

  /**
   * 根据分级方法计算断点
   */
  private async computeBreakpoints(
    versionId: string,
    field: string,
    method: string,
    classes: number,
    baseStats: { min: number; max: number },
  ): Promise<number[]> {
    switch (method) {
      case 'equal-interval':
        return this.computeEqualInterval(baseStats.min, baseStats.max, classes);

      case 'quantile':
        return await this.computeQuantile(versionId, field, classes);

      case 'natural-breaks':
        // Jenks 自然间断算法较复杂，暂用 quantile 替代
        // 可后续集成更复杂的实现
        return await this.computeQuantile(versionId, field, classes);

      default:
        return this.computeEqualInterval(baseStats.min, baseStats.max, classes);
    }
  }

  /**
   * 等间距断点计算
   */
  private computeEqualInterval(
    min: number,
    max: number,
    classes: number,
  ): number[] {
    const step = (max - min) / classes;
    const breakpoints: number[] = [];

    for (let i = 0; i <= classes; i++) {
      breakpoints.push(min + i * step);
    }

    return breakpoints;
  }

  /**
   * 分位数断点计算（使用 PostgreSQL percentile_cont）
   */
  private async computeQuantile(
    versionId: string,
    field: string,
    classes: number,
  ): Promise<number[]> {
    // percentile_cont 是连续分位数函数
    // 计算每个分位点（0, 1/classes, 2/classes, ..., 1）
    const percentiles: number[] = [];
    for (let i = 0; i <= classes; i++) {
      percentiles.push(i / classes);
    }

    // PostgreSQL percentile_cont WITHIN GROUP 只能计算单个分位点
    // 需要逐个查询每个分位点
    // 注意：Prisma $queryRaw 不支持浮点数参数，使用 $queryRawUnsafe
    const breakpoints: number[] = [];

    for (const p of percentiles) {
      // 构建安全的 SQL 查询（参数已验证为数值）
      const sql = `
        SELECT percentile_cont(${p})
          WITHIN GROUP (ORDER BY (properties ->> '${field}')::numeric) as value
        FROM "GisFeature"
        WHERE "versionId" = '${versionId}'
          AND (properties ->> '${field}') IS NOT NULL
          AND (properties ->> '${field}') <> ''
          AND (properties ->> '${field}') ~ '^-?[0-9]+(\\.[0-9]+)?$'
      `;

      const qResult: any[] = await this.datasetService.$queryRawUnsafe(sql);

      if (qResult && qResult.length > 0 && qResult[0].value !== null) {
        breakpoints.push(Number(qResult[0].value));
      } else {
        // 如果查询失败，使用等间距 fallback
        this.logger.warn(`Quantile query failed for percentile ${p}`);
        // 获取 min/max 作为 fallback
        const baseStats = await this.computeBaseStats(versionId, field);
        return this.computeEqualInterval(baseStats.min, baseStats.max, classes);
      }
    }

    // 验证断点数量
    if (breakpoints.length !== classes + 1) {
      this.logger.warn(
        `Quantile computation returned ${breakpoints.length} values, expected ${classes + 1}`,
      );
      // 从 min/max 计算 fallback
      return this.computeEqualInterval(
        breakpoints[0] || 0,
        breakpoints[breakpoints.length - 1] || 100,
        classes,
      );
    }

    return breakpoints;
  }
}