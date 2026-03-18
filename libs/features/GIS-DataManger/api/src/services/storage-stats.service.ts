/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Storage Stats Service - Handles storage statistics
 */
@Injectable()
export class StorageStatsService {
  private readonly logger = new Logger(StorageStatsService.name);

  constructor(private datasetService: DatasetService) {}

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalSpace: number;
    usedSpace: number;
    usagePercent: number;
    datasetCount: number;
    featureCount: number;
    fileStats: {
      totalFiles: number;
      totalSize: number;
    };
  }> {
    try {
      // Get dataset count
      const datasetCount = await this.datasetService.dataset.count();

      // Get feature count
      const featureCountResult = await this.datasetService.$queryRaw`
        SELECT COUNT(*) as count FROM "GisFeature"
      `;
      const featureCount = parseInt(featureCountResult[0]?.count || '0', 10);

      // Get total file size from dataset versions
      const fileStatsResult = await this.datasetService.$queryRaw`
        SELECT
          COUNT(*) as "totalFiles",
          COALESCE(SUM("fileSize"), 0) as "totalSize"
        FROM "DatasetVersion"
      `;
      const fileStats = {
        totalFiles: parseInt(fileStatsResult[0]?.totalFiles || '0', 10),
        totalSize: parseInt(fileStatsResult[0]?.totalSize || '0', 10),
      };

      // Get database size
      const dbSizeResult = await this.datasetService.$queryRaw`
        SELECT pg_database_size(current_database()) as size
      `;
      const dbSize = parseInt(dbSizeResult[0]?.size || '0', 10);

      // Default total space (100GB)
      const totalSpace = 100 * 1024 * 1024 * 1024;
      const usedSpace = dbSize + fileStats.totalSize;
      const usagePercent = (usedSpace / totalSpace) * 100;

      return {
        totalSpace,
        usedSpace,
        usagePercent: Math.round(usagePercent * 100) / 100,
        datasetCount,
        featureCount,
        fileStats,
      };
    } catch (error) {
      this.logger.error('Failed to get storage stats', error);
      throw error;
    }
  }

  /**
   * Get dataset-specific stats
   */
  async getDatasetStats(datasetId: string): Promise<{
    versionCount: number;
    totalFeatures: number;
    totalSize: number;
    latestVersion?: any;
    bbox?: any;
  }> {
    const dataset = await this.datasetService.dataset.findUnique({
      where: { id: datasetId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!dataset) {
      return null;
    }

    const versionCount = dataset.versions.length;
    const totalSize = dataset.versions.reduce((sum, v) => sum + v.fileSize, 0);

    // Get total features across all versions
    const versionIds = dataset.versions.map(v => v.id);
    const featureCountResult = await this.datasetService.$queryRaw`
      SELECT COUNT(*) as count FROM "GisFeature"
      WHERE "versionId" = ANY(${versionIds})
    `;
    const totalFeatures = parseInt(featureCountResult[0]?.count || '0', 10);

    // Get latest version bbox
    const latestVersion = dataset.versions[0];
    const bbox = latestVersion?.bbox;

    return {
      versionCount,
      totalFeatures,
      totalSize,
      latestVersion: latestVersion ? {
        id: latestVersion.id,
        version: latestVersion.version,
        createdAt: latestVersion.createdAt,
        status: latestVersion.status,
      } : undefined,
      bbox,
    };
  }

  /**
   * Get system disk usage (Linux only)
   */
  async getDiskUsage(): Promise<{
    total: number;
    used: number;
    available: number;
    percent: number;
  }> {
    try {
      const { stdout } = await execAsync('df -B1 / | tail -1');
      const parts = stdout.trim().split(/\s+/);

      return {
        total: parseInt(parts[1], 10),
        used: parseInt(parts[2], 10),
        available: parseInt(parts[3], 10),
        percent: parseFloat(parts[4]) * 100,
      };
    } catch (error) {
      this.logger.warn('Failed to get disk usage', error);
      return {
        total: 0,
        used: 0,
        available: 0,
        percent: 0,
      };
    }
  }
}
