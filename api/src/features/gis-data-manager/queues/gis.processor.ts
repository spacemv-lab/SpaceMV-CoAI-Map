/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { GisJobData, GisJobResult } from './gis.queue';
import { GeoJsonAdapter } from '../adapters/geojson.adapter';
import { ShapefileAdapter } from '../adapters/shapefile.adapter';
import { KmlAdapter } from '../adapters/kml.adapter';
import { TableAdapter } from '../adapters/table.adapter';
import { DatasetService } from '../lib/dataset.service';
import { IngestStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildRedisOptions } from '../utils/redis.config';
import { geoJsonGeometryToWkt } from '../utils/geometry-wkt';

/**
 * 从 value 推断字段类型
 */
function inferFieldType(value: unknown): 'string' | 'number' | 'boolean' | 'date' | 'unknown' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    // 尝试解析日期格式
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'string';
  }
  return 'unknown';
}

/**
 * 从首条 feature 提取字段定义
 */
function extractFieldDefinitions(
  features: any[],
  datasetId: string,
): { datasetId: string; name: string; alias: string; type: string; nullable: boolean; sampleValue: any }[] {
  if (!features.length) return [];

  const firstProps = features[0].properties || {};
  const fieldDefs: { datasetId: string; name: string; alias: string; type: string; nullable: boolean; sampleValue: any }[] = [];

  for (const [name, value] of Object.entries(firstProps)) {
    fieldDefs.push({
      datasetId,
      name,
      alias: name,
      type: inferFieldType(value),
      nullable: true,
      sampleValue: value,
    });
  }

  return fieldDefs;
}

/**
 * GIS data processor using BullMQ worker
 */
@Injectable()
export class GisProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GisProcessor.name);
  private worker: Worker<GisJobData, GisJobResult>;
  private redisConnection: Redis;

  constructor(
    private datasetService: DatasetService,
    private geoJsonAdapter: GeoJsonAdapter,
    private shapefileAdapter: ShapefileAdapter,
    private kmlAdapter: KmlAdapter,
    private tableAdapter: TableAdapter,
  ) {}

  async onModuleInit() {
    const redisOptions = buildRedisOptions('gis-processor');

    this.logger.log(
      `Connecting to Redis at ${redisOptions.host}:${redisOptions.port}`,
    );

    this.redisConnection = new Redis(redisOptions);

    // 从 DATABASE_URL 提取数据库信息用于日志
    // 格式：postgresql://user:password@host:port/database?options
    const databaseUrl = process.env.DATABASE_URL || 'not set';
    const urlPattern = /postgresql:\/\/[^@]+@([^:/]+):(\d+)\/([^?]+)/;
    const dbMatch = databaseUrl.match(urlPattern);
    const dbHost = dbMatch ? dbMatch[1] : 'unknown';
    const dbPort = dbMatch ? dbMatch[2] : '5432';
    const dbName = dbMatch ? dbMatch[3] : 'unknown';

    this.logger.log(`GisProcessor will store data to PostgreSQL at ${dbHost}:${dbPort}/${dbName}`);

    this.worker = new Worker<GisJobData, GisJobResult>(
      'gis-ingest',
      async (job) => this.processJob(job),
      {
        connection: this.redisConnection,
        concurrency: 2, // Process 2 jobs concurrently
      }
    );

    this.worker.on('completed', (job, result) => {
      this.logger.log(`Job ${job.id} completed: ${JSON.stringify(result)}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
    });

    this.logger.log('GisProcessor initialized');
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    this.logger.log('GisProcessor destroyed');
  }

  private async processJob(job: Job<GisJobData, GisJobResult>): Promise<GisJobResult> {
    const { versionId, datasetId, filePath, fileType, options } = job.data;

    this.logger.log(`Processing job for version ${versionId}`);

    try {
      // Update status to PARSING
      await this.updateStatus(versionId, 'PARSING');

      // Select appropriate adapter
      const adapter = this.getAdapter(fileType);
      if (!adapter) {
        throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Parse the file
      // Pass encoding option for shapefiles
      // fileType includes the dot (e.g. '.zip'), need to check without it
      const isZipFile = fileType.toLowerCase().replace('.', '') === 'zip';
      const parseOptions = isZipFile && options?.encoding
        ? { encoding: options.encoding }
        : undefined;

      const parseResult = await adapter.parse(filePath, parseOptions);

      // Update status to VALIDATING
      await this.updateStatus(versionId, 'VALIDATING', {
        recordCount: parseResult.recordCount,
        geometryType: parseResult.geometryType,
      });

      // Validate geometries
      const validationResults = this.validateGeometries(parseResult.features);
      const validFeatures = validationResults.valid;
      const invalidFeatures = validationResults.invalid;

      // Update status to IMPORTING
      await this.updateStatus(versionId, 'IMPORTING', {
        validCount: validFeatures.length,
        invalidCount: invalidFeatures.length,
      });

      // Store features in database
      await this.storeFeatures(versionId, validFeatures);

      // Update dataset version with results
      await this.datasetService.datasetVersion.update({
        where: { id: versionId },
        data: {
          status: 'SUCCESS',
          recordCount: validFeatures.length,
          sourceCRS: options?.targetCRS || parseResult.sourceCRS || 'EPSG:4326',
          bbox: parseResult.bbox,
          completedAt: new Date(),
        },
      });

      // Update dataset type and currentVersionId
      if (parseResult.geometryType !== 'UNKNOWN') {
        await this.datasetService.dataset.update({
          where: { id: datasetId },
          data: {
            type: parseResult.geometryType as any,
            currentVersionId: versionId,  // 设置当前版本
          },
        });
      } else {
        // 只更新 currentVersionId
        await this.datasetService.dataset.update({
          where: { id: datasetId },
          data: {
            currentVersionId: versionId,
          },
        });
      }

      // 提取并保存字段定义
      const fieldDefs = extractFieldDefinitions(validFeatures, datasetId);
      if (fieldDefs.length > 0) {
        // 先删除旧字段定义（避免重复）
        await this.datasetService.datasetField.deleteMany({
          where: { datasetId },
        });
        // 创建新字段定义
        await this.datasetService.datasetField.createMany({
          data: fieldDefs,
          skipDuplicates: true,
        });
        this.logger.log(`Extracted ${fieldDefs.length} field definitions for dataset ${datasetId}`);
      }

      // 清理旧版本的要素数据（MinIO 快照已保留历史）
      await this.cleanupOldFeatures(datasetId, versionId);

      this.logger.log(`Job completed: ${validFeatures.length} features stored`);

      return {
        success: true,
        recordCount: validFeatures.length,
        geometryType: parseResult.geometryType,
        bbox: parseResult.bbox,
      };
    } catch (error) {
      this.logger.error(`Processing failed for version ${versionId}`, error);

      await this.updateStatus(versionId, 'FAILED', {
        errorMessage: error.message,
      });

      await this.datasetService.datasetVersion.update({
        where: { id: versionId },
        data: {
          status: 'FAILED',
          statusMessage: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private getAdapter(fileType: string): any {
    const ext = fileType.toLowerCase().replace('.', '');

    switch (ext) {
      case 'geojson':
      case 'json':
        return this.geoJsonAdapter;
      case 'zip':
        return this.shapefileAdapter;
      case 'kml':
      case 'kmz':
        return this.kmlAdapter;
      case 'csv':
      case 'xls':
      case 'xlsx':
        return this.tableAdapter;
      default:
        return null;
    }
  }

  private validateGeometries(features: any[]): { valid: any[]; invalid: any[] } {
    const valid: any[] = [];
    const invalid: any[] = [];

    for (const feature of features) {
      if (feature.geometry && this.isValidGeometry(feature.geometry)) {
        valid.push(feature);
      } else {
        invalid.push(feature);
      }
    }

    return { valid, invalid };
  }

  private isValidGeometry(geometry: any): boolean {
    if (!geometry || !geometry.type || !geometry.coordinates) {
      return false;
    }

    // Basic validation
    const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
    if (!validTypes.includes(geometry.type)) {
      return false;
    }

    // Check for NaN coordinates
    const checkCoords = (coords: any): boolean => {
      if (Array.isArray(coords[0])) {
        return coords.every((c: any) => checkCoords(c));
      }
      return coords.every((c: any) => typeof c === 'number' && !isNaN(c));
    };

    return checkCoords(geometry.coordinates);
  }

  private async storeFeatures(versionId: string, features: any[]): Promise<void> {
    // Batch insert in chunks
    const chunkSize = 100;

    for (let i = 0; i < features.length; i += chunkSize) {
      const chunk = features.slice(i, i + chunkSize);

      for (const feature of chunk) {
        const featureId = randomUUID();
        const geometryWkt = geoJsonGeometryToWkt(feature.geometry);

        // Remove null bytes from properties - PostgreSQL TEXT/JSONB cannot handle \u0000
        const cleanedProperties = this.removeNullBytes(feature.properties);

        await this.datasetService.$executeRaw`
          INSERT INTO "GisFeature" ("id", "versionId", "properties", "geometry")
          VALUES (
            ${featureId},
            ${versionId},
            ${cleanedProperties}::jsonb,
            ST_SetSRID(ST_GeomFromText(${geometryWkt}), 4326)
          )
        `;
      }
    }
  }

  /**
   * Recursively remove null bytes (\u0000) from an object
   * PostgreSQL TEXT and JSONB types cannot handle null bytes
   */
  private removeNullBytes(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\u0000/g, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeNullBytes(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.removeNullBytes(value);
      }
      return result;
    }
    return obj;
  }

  /**
   * 清理旧版本的要素数据
   * 历史快照已存储在 MinIO，PostGIS 只保留当前版本
   */
  private async cleanupOldFeatures(datasetId: string, currentVersionId: string): Promise<void> {
    try {
      // 查询旧版本 ID 列表
      const oldVersions = await this.datasetService.datasetVersion.findMany({
        where: {
          datasetId,
          id: { not: currentVersionId },
        },
        select: { id: true, version: true },
      });

      if (oldVersions.length === 0) {
        return;
      }

      // 删除旧版本的要素数据
      for (const oldVersion of oldVersions) {
        await this.datasetService.$executeRaw`
          DELETE FROM "GisFeature" WHERE "versionId" = ${oldVersion.id}
        `;
      }

      // 删除旧版本记录（可选，保留版本元数据用于追踪）
      // 如果要删除版本记录，使用 CASCADE 会自动删除 GisFeature
      // 这里只删除要素数据，保留版本元数据（createdAt, recordCount 等）

      this.logger.log(`清理了 ${oldVersions.length} 个旧版本的要素数据（保留 MinIO 快照）`);
    } catch (error) {
      this.logger.warn(`清理旧版本失败: ${error.message}`);
      // 不抛出错误，清理失败不影响主流程
    }
  }

  private async updateStatus(
    versionId: string,
    status: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.datasetService.datasetVersion.update({
      where: { id: versionId },
      data: {
        status: status as IngestStatus,
        statusMessage: details ? JSON.stringify(details) : null,
        startedAt: status !== 'PENDING' ? new Date() : undefined,
      },
    });
  }
}
