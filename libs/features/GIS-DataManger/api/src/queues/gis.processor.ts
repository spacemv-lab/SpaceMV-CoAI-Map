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
      const parseResult = await adapter.parse(filePath);

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

      // Update dataset type
      if (parseResult.geometryType !== 'UNKNOWN') {
        await this.datasetService.dataset.update({
          where: { id: datasetId },
          data: {
            type: parseResult.geometryType as any,
          },
        });
      }

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
