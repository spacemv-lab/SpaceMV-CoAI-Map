/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Dataset, DatasetVersion, Prisma, IngestStatus } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Dataset Service - Manages dataset metadata (refactored)
 * Parsing logic has been moved to GisParseService and adapters
 */
@Injectable()
export class DatasetService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatasetService.name);

  async onModuleInit() {
    // 从 DATABASE_URL 提取数据库信息用于日志
    // 格式：postgresql://user:password@host:port/database?options
    const databaseUrl = process.env.DATABASE_URL || 'not set';
    const urlPattern = /postgresql:\/\/[^@]+@([^:/]+):(\d+)\/([^?]+)/;
    const dbMatch = databaseUrl.match(urlPattern);
    const dbHost = dbMatch ? dbMatch[1] : 'unknown';
    const dbPort = dbMatch ? dbMatch[2] : '5432';
    const dbName = dbMatch ? dbMatch[3] : 'unknown';

    this.logger.log(`Connecting to PostgreSQL at ${dbHost}:${dbPort}/${dbName}`);
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // ============================================
  // Project Management
  // ============================================

  async createProject(data: Prisma.ProjectCreateInput) {
    return this.project.create({ data });
  }

  async getProject(id: string) {
    return this.project.findUnique({ where: { id } });
  }

  async deleteProject(id: string) {
    // Cascade delete datasets
    await this.dataset.deleteMany({ where: { projectId: id } });
    return this.project.delete({ where: { id } });
  }

  // ============================================
  // Dataset Management (Metadata Only)
  // ============================================

  async createDataset(data: {
    projectId: string;
    name: string;
    type?: string;
    source?: string;
    tags?: string[];
    description?: string;
  }) {
    return this.dataset.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        type: (data.type as any) || 'UNKNOWN',
        source: data.source || 'UPLOAD',
        tags: data.tags || [],
        description: data.description,
      },
    });
  }

  async listDatasets(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.DatasetWhereUniqueInput;
    where?: Prisma.DatasetWhereInput;
    orderBy?: Prisma.DatasetOrderByWithRelationInput;
  }) {
    const { skip, take, cursor, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.dataset.findMany({
        skip,
        take,
        cursor,
        where,
        orderBy,
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
            select: {
              id: true,
              version: true,
              status: true,
              recordCount: true,
              fileSize: true,
              createdAt: true,
            },
          },
          currentVersion: {
            select: {
              id: true,
              version: true,
              status: true,
              recordCount: true,
              bbox: true,
            },
          },
        },
      }),
      this.dataset.count({ where }),
    ]);

    return { items, total };
  }

  async getDataset(id: string) {
    return this.dataset.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            status: true,
            statusMessage: true,
            recordCount: true,
            fileSize: true,
            sourceCRS: true,
            bbox: true,
            createdAt: true,
            completedAt: true,
          },
        },
        currentVersion: true,
        project: true,
        mappingProfiles: true,
      },
    });
  }

  async updateDataset(id: string, data: {
    name?: string;
    description?: string;
    tags?: string[];
    currentVersionId?: string;
  }) {
    return this.dataset.update({
      where: { id },
      data,
    });
  }

  async deleteDataset(id: string) {
    // Find all versions and their features
    const versions = await this.datasetVersion.findMany({
      where: { datasetId: id },
      select: { id: true },
    });

    // Delete features for each version
    for (const version of versions) {
      await this.gisFeature.deleteMany({ where: { versionId: version.id } });
    }

    // Delete mapping profiles
    await this.mappingProfile.deleteMany({ where: { datasetId: id } });

    // Delete versions
    await this.datasetVersion.deleteMany({ where: { datasetId: id } });

    // Delete dataset
    return this.dataset.delete({ where: { id } });
  }

  // ============================================
  // Dataset Version Management
  // ============================================

  async createVersion(data: {
    datasetId: string;
    filePath: string;
    fileSize: number;
    uploadedBy?: string;
    mappingProfileId?: string;
  }) {
    const dataset = await this.dataset.findUnique({
      where: { id: data.datasetId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    const nextVersion = dataset?.versions?.[0]?.version
      ? dataset.versions[0].version + 1
      : 1;

    const version = await this.datasetVersion.create({
      data: {
        datasetId: data.datasetId,
        version: nextVersion,
        filePath: data.filePath,
        fileSize: data.fileSize,
        uploadedBy: data.uploadedBy || 'system',
        mappingProfileId: data.mappingProfileId,
        status: 'PENDING',
      },
    });

    // Update dataset's currentVersionId
    await this.dataset.update({
      where: { id: data.datasetId },
      data: { currentVersionId: version.id },
    });

    return version;
  }

  async getVersionStatus(versionId: string) {
    return this.datasetVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        status: true,
        statusMessage: true,
        recordCount: true,
        startedAt: true,
        completedAt: true,
        validationReport: true,
      },
    });
  }

  async updateVersionStatus(
    versionId: string,
    status: IngestStatus,
    statusMessage?: string,
  ) {
    return this.datasetVersion.update({
      where: { id: versionId },
      data: {
        status,
        statusMessage,
        completedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : undefined,
      },
    });
  }

  // ============================================
  // Feature Data Access
  // ============================================

  async getDatasetGeoJSON(id: string) {
    const dataset = await this.dataset.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!dataset || !dataset.versions.length) {
      return { type: 'FeatureCollection', features: [] };
    }

    const versionId = dataset.versions[0].id;

    // Use raw SQL to get features with GeoJSON geometry
    const features: any[] = await this.$queryRaw`
      SELECT
        id,
        properties,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM "GisFeature"
      WHERE "versionId" = ${versionId}
    `;

    return {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };
  }

  async getVersionGeoJSON(versionId: string) {
    const features: any[] = await this.$queryRaw`
      SELECT
        id,
        properties,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM "GisFeature"
      WHERE "versionId" = ${versionId}
    `;

    return {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };
  }

  // ============================================
  // MVT Tile Generation
  // ============================================

  async getMVT(versionId: string, z: number, x: number, y: number): Promise<Buffer> {
    // Use PostGIS ST_AsMVT to generate vector tile
    const result = await this.$queryRaw`
      SELECT ST_AsMVT(tile, 'public.features', 4326, 'geom') as mvt
      FROM (
        SELECT
          id,
          properties,
          ST_AsMVTGeom(
            ST_Transform(geometry, 3857),
            ST_TileEnvelope(${z}, ${x}, ${y}),
            4096,
            256,
            true
          ) as geom
        FROM "GisFeature"
        WHERE "versionId" = ${versionId}
          AND geometry && ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326)
      ) as tile
    `;

    return result[0]?.mvt || null;
  }

  // ============================================
  // File Management
  // ============================================

  async deleteFile(filePath: string) {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Deleted file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
