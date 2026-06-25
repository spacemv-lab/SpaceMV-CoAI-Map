/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { DatasetScope, GeometryType } from '@prisma/client';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient, Dataset, DatasetVersion, Prisma, IngestStatus, ProjectState } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DatasetComplexityLevel } from '../dto';
import { ViewportState, LayerState } from '../dto/project.dto';

/**
 * 将 GeoJSON geometry 转换为 WKT 格式
 * 用于兼容不支持 ST_GeomFromGeoJSON 的 PostGIS 安装
 */
function geojsonToWKT(geometry: Record<string, unknown>): string {
  const type = geometry.type as string;
  const coords = geometry.coordinates as unknown;

  switch (type) {
    case 'Point':
      const pointCoords = coords as number[];
      return `POINT(${pointCoords[0]} ${pointCoords[1]})`;

    case 'LineString':
      const lineCoords = coords as number[][];
      return `LINESTRING(${lineCoords.map(c => `${c[0]} ${c[1]}`).join(',')})`;

    case 'Polygon':
      const polyCoords = coords as number[][][];
      const rings = polyCoords.map(ring =>
        `(${ring.map(c => `${c[0]} ${c[1]}`).join(',')})`
      ).join(',');
      return `POLYGON(${rings})`;

    case 'MultiPoint':
      const mpCoords = coords as number[][];
      return `MULTIPOINT(${mpCoords.map(c => `(${c[0]} ${c[1]})`).join(',')})`;

    case 'MultiLineString':
      const mlCoords = coords as number[][][];
      const mlLines = mlCoords.map(line =>
        `(${line.map(c => `${c[0]} ${c[1]}`).join(',')})`
      ).join(',');
      return `MULTILINESTRING(${mlLines})`;

    case 'MultiPolygon':
      const mpolyCoords = coords as number[][][][];
      const mpolyParts = mpolyCoords.map(poly => {
        const rings = poly.map(ring =>
          `(${ring.map(c => `${c[0]} ${c[1]}`).join(',')})`
        ).join(',');
        return `(${rings})`;
      }).join(',');
      return `MULTIPOLYGON(${mpolyParts})`;

    default:
      throw new Error(`Unsupported geometry type: ${type}`);
  }
}

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

  private readonly complexityFileSizeThresholdsMb = [1, 5, 20, 80];

  private readonly complexityRecordThresholds = [1000, 5000, 20000, 100000];

  private normalizeBbox(value: unknown): [number, number, number, number] | null {
    if (!Array.isArray(value) || value.length < 4) {
      return null;
    }

    const bbox = value
      .slice(0, 4)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));

    if (bbox.length !== 4) {
      return null;
    }

    return bbox as [number, number, number, number];
  }

  private toComplexityBucket(
    value: number,
    thresholds: number[],
  ): number {
    let bucket = 0;

    for (const threshold of thresholds) {
      if (value > threshold) {
        bucket += 1;
      }
    }

    return bucket;
  }

  private getGeometryComplexityWeight(type?: string): number {
    switch (type) {
      case 'POLYGON':
      case 'MULTI_POLYGON':
        return 2;
      case 'LINESTRING':
      case 'MULTI_LINESTRING':
        return 1;
      default:
        return 0;
    }
  }

  private classifyComplexity(
    type: string | undefined,
    fileSizeBytes: number,
    recordCount: number,
  ): {
    complexityLevel: DatasetComplexityLevel;
    complexityScore: number;
  } {
    const fileSizeMb = fileSizeBytes / (1024 * 1024);
    const fileSizeScore = this.toComplexityBucket(
      fileSizeMb,
      this.complexityFileSizeThresholdsMb,
    );
    const recordScore = this.toComplexityBucket(
      recordCount,
      this.complexityRecordThresholds,
    );
    const geometryScore = this.getGeometryComplexityWeight(type);
    const complexityScore = fileSizeScore + recordScore + geometryScore;

    if (complexityScore <= 1) {
      return {
        complexityLevel: DatasetComplexityLevel.XS,
        complexityScore,
      };
    }

    if (complexityScore <= 3) {
      return {
        complexityLevel: DatasetComplexityLevel.S,
        complexityScore,
      };
    }

    if (complexityScore <= 5) {
      return {
        complexityLevel: DatasetComplexityLevel.M,
        complexityScore,
      };
    }

    if (complexityScore <= 7) {
      return {
        complexityLevel: DatasetComplexityLevel.L,
        complexityScore,
      };
    }

    return {
      complexityLevel: DatasetComplexityLevel.XL,
      complexityScore,
    };
  }

  private buildDatasetRoutingSummary<
    T extends {
      id: string;
      type: string;
      currentVersionId?: string | null;
      currentVersion?: {
        id: string;
        status: IngestStatus;
        recordCount: number;
        fileSize?: number | null;
        bbox?: unknown;
      } | null;
      versions?: Array<{
        id: string;
        status: IngestStatus;
        recordCount?: number | null;
        fileSize?: number | null;
        bbox?: unknown;
      }>;
    },
  >(dataset: T) {
    const currentVersion = dataset.currentVersion ?? dataset.versions?.[0] ?? null;
    const bbox = this.normalizeBbox(currentVersion?.bbox);
    const fileSize = currentVersion?.fileSize ?? dataset.versions?.[0]?.fileSize ?? 0;
    const recordCount =
      currentVersion?.recordCount ??
      dataset.versions?.[0]?.recordCount ??
      0;
    const { complexityLevel, complexityScore } = this.classifyComplexity(
      dataset.type,
      fileSize,
      recordCount,
    );
    const hasCurrentVersion = Boolean(dataset.currentVersionId || currentVersion?.id);

    return {
      datasetId: dataset.id,
      geometryType: dataset.type,
      fileSize,
      recordCount,
      bbox,
      complexityLevel,
      complexityScore,
      geojsonUrl: hasCurrentVersion ? `/api/datasets/${dataset.id}/geojson` : undefined,
      mvtUrlTemplate: hasCurrentVersion
        ? `/api/datasets/${dataset.id}/mvt/{z}/{x}/{y}`
        : undefined,
    };
  }

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
    return this.$transaction(async (tx) => {
      // 只删除 PROJECT scope 的 dataset，保留 GLOBAL 数据
      await tx.dataset.deleteMany({
        where: {
          projectId: id,
          scope: 'PROJECT',  // 只删除工程私有数据
        },
      });

      // 将 projectId 指向该工程但 scope=GLOBAL 的数据，解除关联
      await tx.dataset.updateMany({
        where: {
          projectId: id,
          scope: 'GLOBAL',
        },
        data: {
          projectId: null,  // 解除工程关联，保留为全局数据
        },
      });

      return tx.project.delete({ where: { id } });
    });
  }

  async listProjects(params?: {
    skip?: number;
    take?: number;
    ownerId?: string;
  }) {
    const { skip = 0, take = 100, ownerId } = params || {};

    const where: Prisma.ProjectWhereInput = ownerId ? { ownerId } : {};

    const [items, total] = await Promise.all([
      this.project.findMany({
        skip,
        take,
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { datasets: true } },
          state: { select: { layers: true, updatedAt: true } },
        },
      }),
      this.project.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        ownerId: item.ownerId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        datasetCount: item.state?.layers
          ? (item.state.layers as unknown as any[]).length
          : 0,
        stateUpdatedAt: item.state?.updatedAt,
      })),
      total,
    };
  }

  // ============================================
  // Project State Management
  // ============================================

  async getProjectState(projectId: string) {
    const state = await this.projectState.findUnique({
      where: { projectId },
    });

    if (!state) {
      // Return default state for new projects (matches frontend default: Chengdu)
      return {
        viewport: { center: [104.06, 30.67] as [number, number], zoom: 600000, heading: 0, pitch: -90 },
        basemap: 'tianditu-vec',
        layers: [],
        updatedAt: null,
      };
    }

    // 动态补充每个图层的 fields 信息（从 DatasetField 表）
    const layers = state.layers as unknown as LayerState[];
    const enrichedLayers = await Promise.all(
      layers.map(async (layer) => {
        // 如果图层有 sourceId（datasetId），从 DatasetField 表获取字段
        const datasetId = (layer as any).sourceId || (layer as any).datasetId;
        if (datasetId) {
          const fields = await this.datasetField.findMany({
            where: { datasetId },
            select: { name: true, alias: true, type: true, nullable: true },
            orderBy: { name: 'asc' },
          });
          return { ...layer, fields };
        }
        return layer;
      }),
    );

    return {
      viewport: state.viewport as unknown as ViewportState,
      basemap: state.basemap,
      layers: enrichedLayers,
      updatedAt: state.updatedAt,
    };
  }

  async saveProjectState(
    projectId: string,
    data: {
      viewport: ViewportState;
      basemap?: string;
      layers: LayerState[];
    },
  ) {
    // Ensure project exists
    const project = await this.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Upsert state
    return this.projectState.upsert({
      where: { projectId },
      create: {
        projectId,
        viewport: data.viewport as unknown as Prisma.InputJsonValue,
        basemap: data.basemap || 'tianditu-vec',
        layers: data.layers as unknown as Prisma.InputJsonValue,
      },
      update: {
        viewport: data.viewport as unknown as Prisma.InputJsonValue,
        basemap: data.basemap || 'tianditu-vec',
        layers: data.layers as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async deleteProjectState(projectId: string) {
    try {
      return await this.projectState.delete({ where: { projectId } });
    } catch (error) {
      // Ignore if state doesn't exist
      if (error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  // ============================================
  // Dataset Management (Metadata Only)
  // ============================================

  async getDatasetByExternalId(externalId: string) {
    return this.dataset.findUnique({ where: { externalId } });
  }

  async createDataset(data: {
    projectId?: string; // 改为可选，全局数据不需要
    scope?: DatasetScope; // 新增 scope 参数
    name: string;
    type?: string;
    source?: string;
    tags?: string[];
    description?: string;
    externalId?: string; // 新增 externalId 参数
  }) {
    // 确定 scope，默认 PROJECT
    const datasetScope = data.scope || 'PROJECT';

    return this.dataset.create({
      data: {
        projectId: datasetScope === 'GLOBAL' ? null : data.projectId,
        scope: datasetScope,
        name: data.name,
        type: (data.type as any) || 'UNKNOWN',
        source: data.source || 'UPLOAD',
        tags: data.tags || [],
        externalId: data.externalId,
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
              fileSize: true,
              bbox: true,
            },
          },
          fields: {
            select: {
              name: true,
              alias: true,
              type: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      }),
      this.dataset.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        ...this.buildDatasetRoutingSummary(item),
      })),
      total,
    };
  }

  async getDataset(id: string) {
    const dataset = await this.dataset.findUnique({
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
        fields: {
          select: {
            name: true,
            alias: true,
            type: true,
            nullable: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!dataset) {
      return null;
    }

    return {
      ...dataset,
      ...this.buildDatasetRoutingSummary(dataset),
    };
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
  // Features List (for Attribute Table)
  // ============================================

  async listFeatures(
    datasetId: string,
    options: {
      page: number;
      pageSize: number;
      search?: string;
    },
  ) {
    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      include: { currentVersion: true },
    });

    if (!dataset?.currentVersionId) {
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: options.pageSize,
        totalPages: 0,
      };
    }

    const where: Prisma.GisFeatureWhereInput = {
      versionId: dataset.currentVersionId,
    };

    // 分页查询（不返回 geometry，减少数据量）
    const features = await this.gisFeature.findMany({
      where,
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        properties: true,
      },
    });

    const total = await this.gisFeature.count({ where });

    return {
      items: features.map((f) => ({
        id: f.id,
        properties: f.properties as Record<string, unknown>,
      })),
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    };
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

  // ============================================
  // Create Dataset from Draw Features
  // ============================================

  async createDatasetWithFeatures(data: {
    projectId?: string;
    name: string;
    geometryType: GeometryType;
    style?: Record<string, unknown>;
    features: Array<{
      id: string;
      geometry: Record<string, unknown>;
      properties?: Record<string, unknown>;
    }>;
  }) {
    return this.$transaction(async (tx) => {
      // 1. 创建 Dataset
      const dataset = await tx.dataset.create({
        data: {
          projectId: data.projectId,
          scope: data.projectId ? 'PROJECT' : 'GLOBAL',
          name: data.name,
          type: data.geometryType as any,
          source: 'DRAW',
          style: data.style as any,
        },
      });

      // 2. 创建 DatasetVersion
      const version = await tx.datasetVersion.create({
        data: {
          datasetId: dataset.id,
          version: 1,
          filePath: '',
          fileSize: 0,
          status: 'SUCCESS',
          recordCount: data.features.length,
          completedAt: new Date(),
        },
      });

      // 3. 更新 Dataset.currentVersionId
      await tx.dataset.update({
        where: { id: dataset.id },
        data: { currentVersionId: version.id },
      });

      // 4. 批量插入 Features (使用 geojsonToWKT 函数)
      for (const feature of data.features) {
        const wkt = geojsonToWKT(feature.geometry);
        await tx.$executeRaw`
          INSERT INTO "GisFeature" (id, "versionId", properties, geometry)
          VALUES (
            ${feature.id},
            ${version.id},
            ${feature.properties ?? {}},
            ST_GeomFromText(${wkt}, 4326)
          )
        `;
      }

      // 5. 返回完整 Dataset 信息 (使用 tx 查询)
      const fullDataset = await tx.dataset.findUnique({
        where: { id: dataset.id },
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
          fields: {
            select: {
              name: true,
              alias: true,
              type: true,
              nullable: true,
            },
            orderBy: { name: 'asc' },
          },
        },
      });

      if (!fullDataset) {
        // This shouldn't happen since we just created it
        throw new Error(`Dataset ${dataset.id} not found after creation`);
      }

      return {
        ...fullDataset,
        ...this.buildDatasetRoutingSummary(fullDataset),
      };
    });
  }

  // ============================================
  // Dataset Style Management
  // ============================================

  async saveDatasetStyle(datasetId: string, style: Record<string, unknown>) {
    const dataset = await this.dataset.findUnique({ where: { id: datasetId } });
    if (!dataset) {
      throw new NotFoundException(`Dataset ${datasetId} not found`);
    }
    return this.dataset.update({
      where: { id: datasetId },
      data: { style: style as any },
    });
  }

  async getDatasetStyle(datasetId: string) {
    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      select: { style: true },
    });
    if (!dataset) {
      throw new NotFoundException(`Dataset ${datasetId} not found`);
    }
    return dataset.style as Record<string, unknown> | null;
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
  // Feature Detail (for popup)
  // ============================================

  async getFeatureGeoJSON(datasetId: string, featureId: string) {
    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      include: { currentVersion: true },
    });

    if (!dataset || !dataset.currentVersion) {
      return null;
    }

    const versionId = dataset.currentVersion.id;

    const result: any[] = await this.$queryRaw`
      SELECT
        id,
        properties,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM "GisFeature"
      WHERE "versionId" = ${versionId} AND id = ${featureId}
      LIMIT 1
    `;

    if (!result.length) {
      return null;
    }

    return {
      type: 'Feature' as const,
      id: result[0].id,
      properties: result[0].properties,
      geometry: result[0].geometry,
    };
  }

  async getFeatureDetail(datasetId: string, featureId: string) {
    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      include: { currentVersion: true },
    });

    if (!dataset || !dataset.currentVersion) {
      return null;
    }

    const versionId = dataset.currentVersion.id;

    const result: any[] = await this.$queryRaw`
      SELECT
        id,
        properties
      FROM "GisFeature"
      WHERE "versionId" = ${versionId} AND id = ${featureId}
      LIMIT 1
    `;

    if (!result.length) {
      return null;
    }

    return {
      featureId: result[0].id,
      datasetId,
      properties: result[0].properties,
    };
  }

  // ============================================
  // Feature Edit & Delete
  // ============================================

  async saveFeatureGeometry(
    datasetId: string,
    featureId: string,
    geometry: Record<string, unknown>,
    properties?: Record<string, unknown>,
  ) {
    this.logger.log(`[saveFeatureGeometry] datasetId=${datasetId}, featureId=${featureId}`);

    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      include: { currentVersion: true },
    });

    this.logger.log(`[saveFeatureGeometry] dataset found: ${!!dataset}, currentVersion: ${!!dataset?.currentVersion}`);
    if (dataset?.currentVersion) {
      this.logger.log(`[saveFeatureGeometry] currentVersionId: ${dataset.currentVersion.id}`);
    }

    if (!dataset || !dataset.currentVersion) {
      throw new Error(`Dataset ${datasetId} not found or has no current version`);
    }

    const versionId = dataset.currentVersion.id;
    const geojsonStr = JSON.stringify(geometry);

    this.logger.log(`[saveFeatureGeometry] executing UPDATE for versionId=${versionId}`);

    // 使用 WKT 格式而不是 GeoJSON，兼容不支持 JSON-C 的 PostGIS
    const wkt = geojsonToWKT(geometry);
    this.logger.log(`[saveFeatureGeometry] converted to WKT: ${wkt}`);

    const result = await this.$executeRaw`
      UPDATE "GisFeature"
      SET geometry = ST_GeomFromText(${wkt}, 4326),
          properties = ${properties !== undefined ? (properties as Prisma.JsonObject) : Prisma.sql`properties`}
      WHERE "versionId" = ${versionId} AND id = ${featureId}
    `;

    this.logger.log(`[saveFeatureGeometry] UPDATE result: ${result} rows affected`);

    if (result === 0) {
      throw new Error(`Feature ${featureId} not found in version ${versionId}`);
    }

    return { success: true, affected: result };
  }

  /** 仅更新要素属性（不动几何）；properties 为整份替换 */
  async updateFeatureProperties(
    datasetId: string,
    featureId: string,
    properties: Record<string, unknown>,
  ) {
    const versionId = await this.resolveCurrentVersionId(this, datasetId);
    const result = await this.$executeRaw`
      UPDATE "GisFeature"
      SET properties = ${properties as Prisma.JsonObject}
      WHERE "versionId" = ${versionId} AND id = ${featureId}
    `;
    if (result === 0) {
      throw new NotFoundException(
        `Feature ${featureId} not found in dataset ${datasetId}`,
      );
    }
    return { success: true, affected: result };
  }

  /** 往已有数据集当前版本新增单个要素（绘制入已保存图层用） */
  async createFeature(
    datasetId: string,
    data: {
      id?: string;
      geometry: Record<string, unknown>;
      properties?: Record<string, unknown>;
    },
  ) {
    const versionId = await this.resolveCurrentVersionId(this, datasetId);
    const featureId = data.id?.trim() || randomUUID();
    const wkt = geojsonToWKT(data.geometry);
    await this.$executeRaw`
      INSERT INTO "GisFeature" (id, "versionId", properties, geometry)
      VALUES (
        ${featureId},
        ${versionId},
        ${data.properties ?? ({} as Prisma.JsonObject)},
        ST_GeomFromText(${wkt}, 4326)
      )
    `;
    return { featureId };
  }

  /** 解析数据集当前版本 id（事务内传 tx，事务外传 this） */
  private async resolveCurrentVersionId(
    client: Pick<PrismaClient, 'dataset'>,
    datasetId: string,
  ): Promise<string> {
    const dataset = await client.dataset.findUnique({
      where: { id: datasetId },
      select: { currentVersionId: true },
    });
    if (!dataset?.currentVersionId) {
      throw new NotFoundException(
        `Dataset ${datasetId} not found or has no current version`,
      );
    }
    return dataset.currentVersionId;
  }

  /** 新增字段：写 DatasetField + 给当前版本所有要素补默认值（不覆盖已有 key） */
  async addDatasetField(
    datasetId: string,
    field: {
      name: string;
      alias?: string;
      type?: string;
      nullable?: boolean;
      defaultValue?: unknown;
    },
  ) {
    const name = field.name.trim();
    if (!name) {
      throw new BadRequestException('字段名不能为空');
    }
    return this.$transaction(async (tx) => {
      try {
        await tx.datasetField.create({
          data: {
            datasetId,
            name,
            alias: field.alias?.trim() || name,
            type: field.type || 'string',
            nullable: field.nullable ?? true,
          },
        });
      } catch {
        throw new BadRequestException(`字段 "${name}" 已存在`);
      }
      const versionId = await this.resolveCurrentVersionId(tx, datasetId);
      const defaultValue = field.defaultValue ?? null;
      await tx.$executeRaw`
        UPDATE "GisFeature"
        SET properties = properties || jsonb_build_object(${name}, ${defaultValue}::jsonb)
        WHERE "versionId" = ${versionId}
          AND NOT (properties ? ${name})
      `;
      return { datasetId, name };
    });
  }

  /** 更新字段（别名/类型/可空；改名时同步所有要素 properties 的 key） */
  async updateDatasetField(
    datasetId: string,
    fieldName: string,
    updates: {
      name?: string;
      alias?: string;
      type?: string;
      nullable?: boolean;
    },
  ) {
    return this.$transaction(async (tx) => {
      const existing = await tx.datasetField.findFirst({
        where: { datasetId, name: fieldName },
      });
      if (!existing) {
        throw new NotFoundException(`字段 "${fieldName}" 不存在`);
      }
      const newName = updates.name?.trim() || existing.name;
      await tx.datasetField.update({
        where: { id: existing.id },
        data: {
          name: newName,
          alias:
            updates.alias !== undefined
              ? updates.alias?.trim() || newName
              : existing.alias,
          type: updates.type ?? existing.type,
          nullable: updates.nullable ?? existing.nullable,
        },
      });
      if (newName !== existing.name) {
        const versionId = await this.resolveCurrentVersionId(tx, datasetId);
        await tx.$executeRaw`
          UPDATE "GisFeature"
          SET properties =
            (properties - ${existing.name})
            || jsonb_build_object(${newName}, properties -> ${existing.name})
          WHERE "versionId" = ${versionId}
        `;
      }
      return { datasetId, name: newName };
    });
  }

  /** 删除字段：删 DatasetField + 移除所有要素 properties 的对应 key */
  async removeDatasetField(datasetId: string, fieldName: string) {
    return this.$transaction(async (tx) => {
      const existing = await tx.datasetField.findFirst({
        where: { datasetId, name: fieldName },
      });
      if (!existing) {
        throw new NotFoundException(`字段 "${fieldName}" 不存在`);
      }
      await tx.datasetField.delete({ where: { id: existing.id } });
      const versionId = await this.resolveCurrentVersionId(tx, datasetId);
      await tx.$executeRaw`
        UPDATE "GisFeature"
        SET properties = properties - ${fieldName}
        WHERE "versionId" = ${versionId}
      `;
      return { datasetId, name: fieldName };
    });
  }

  async deleteFeature(
    datasetId: string,
    featureId: string,
  ) {
    const dataset = await this.dataset.findUnique({
      where: { id: datasetId },
      include: { currentVersion: true },
    });

    if (!dataset || !dataset.currentVersion) {
      throw new Error(`Dataset ${datasetId} not found or has no current version`);
    }

    const versionId = dataset.currentVersion.id;

    const result = await this.gisFeature.deleteMany({
      where: { versionId, id: featureId },
    });

    return { success: true, count: result.count };
  }

  // ============================================
  // MVT Tile Generation
  // ============================================

  async getMVT(versionId: string, z: number, x: number, y: number): Promise<Buffer> {
    // Use PostGIS ST_AsMVT to generate vector tile
    // Note:
    // 1. ST_TileEnvelope requires integer parameters
    // 2. geometry should be EPSG:4326 (from GeoJSON import), transform to 3857 for MVT
    // 3. ST_SetSRID ensures correct coordinate transformation
    // 4. ST_AsMVT(schema, name, extent, geom_column_name, id_column_name)
    // 5. MVT id must be a positive integer. GisFeature.id is a UUID (not an
    //    integer), so derive a STABLE integer id from it: MapLibre dedupes a
    //    feature's label across tiles by (layer, id), so the same polygon must
    //    get the SAME id in every tile. ROW_NUMBER() was per-tile-sequential,
    //    which made a large polygon that spans several tiles render one label
    //    per tile. A 53-bit hash of the UUID text is stable across tiles and
    //    stays within JS's safe-integer range (2^53), so the cross-tile dedup
    //    pairs the instances up -> one label per feature.
    const result = await this.$queryRaw`
      SELECT ST_AsMVT(tile, 'features', 4096, 'geom', 'mvt_id') as mvt
      FROM (
        SELECT
          (hashtextextended(id::text, 0) & 9007199254740991) as mvt_id,
          id as feature_id,
          properties,
          ST_AsMVTGeom(
            ST_Transform(ST_SetSRID(geometry, 4326), 3857),
            ST_TileEnvelope(${z}::integer, ${x}::integer, ${y}::integer),
            4096,
            256,
            true
          ) as geom
        FROM "GisFeature"
        WHERE "versionId" = ${versionId}
          AND ST_SetSRID(geometry, 4326) && ST_Transform(ST_TileEnvelope(${z}::integer, ${x}::integer, ${y}::integer), 4326)
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
