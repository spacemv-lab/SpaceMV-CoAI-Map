/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { GisQueue } from '../queues/gis.queue';
import { GeometryValidator } from '../validators/geometry.validator';
import { CrsValidator } from '../validators/crs.validator';
import { DatasetService } from '../lib/dataset.service';

export interface UploadOptions {
  targetCRS?: string;
  validateGeometry?: boolean;
  repairGeometry?: boolean;
  mappingProfileId?: string;
}

/**
 * GIS Parse Service - Handles GIS data parsing and ingestion
 */
@Injectable()
export class GisParseService {
  private readonly logger = new Logger(GisParseService.name);

  constructor(
    private datasetService: DatasetService,
    private gisQueue: GisQueue,
    private geometryValidator: GeometryValidator,
    private crsValidator: CrsValidator,
  ) {}

  /**
   * Start async parsing job
   */
  async startIngest(
    versionId: string,
    datasetId: string,
    filePath: string,
    fileType: string,
    options?: UploadOptions,
  ): Promise<{ jobId: string; status: string }> {
    this.logger.log(`Starting ingest for version ${versionId}`);

    // Update version status to PENDING
    await this.datasetService.datasetVersion.update({
      where: { id: versionId },
      data: {
        status: 'PENDING',
        startedAt: new Date(),
      },
    });

    // Add job to queue
    const job = await this.gisQueue.addJob({
      versionId,
      datasetId,
      filePath,
      fileType,
      options,
    });

    return {
      jobId: job.id,
      status: 'PENDING',
    };
  }

  /**
   * Get ingest status
   */
  async getIngestStatus(versionId: string): Promise<any> {
    const version = await this.datasetService.datasetVersion.findUnique({
      where: { id: versionId },
      include: {
        validationReport: true,
      },
    });

    if (!version) {
      return null;
    }

    const job = await this.gisQueue.getJobByVersionId(versionId);
    const jobState = job ? await job.getState() : null;

    return {
      versionId: version.id,
      datasetId: version.datasetId,
      status: version.status,
      statusMessage: version.statusMessage,
      progress: this.calculateProgress(version.status),
      createdAt: version.createdAt,
      startedAt: version.startedAt,
      completedAt: version.completedAt,
      jobState,
      validationReport: version.validationReport,
    };
  }

  /**
   * Calculate progress percentage based on status
   */
  private calculateProgress(status: string): number {
    const progressMap: Record<string, number> = {
      'PENDING': 0,
      'PARSING': 25,
      'VALIDATING': 50,
      'IMPORTING': 75,
      'INDEXING': 90,
      'SUCCESS': 100,
      'FAILED': -1,
    };
    return progressMap[status] || 0;
  }

  /**
   * Parse CRS from file or use default
   */
  detectCRS(fileContent: any): string | null {
    // Try to detect CRS from GeoJSON
    if (fileContent?.crs) {
      const crsInfo = this.crsValidator.parseCRS(fileContent.crs.properties?.name || '');
      if (crsInfo) {
        return `EPSG:${crsInfo.epsg}`;
      }
    }

    return null;
  }

  /**
   * Validate and repair a single geometry
   */
  async validateAndRepairGeometry(geometry: any): Promise<{
    isValid: boolean;
    repairedGeometry?: any;
    errors: any[];
  }> {
    const validationResult = this.geometryValidator.validateGeoJSON(geometry);

    if (validationResult.isValid) {
      return {
        isValid: true,
        errors: [],
      };
    }

    // Try to repair using PostGIS
    const repairedGeometry = await this.geometryValidator.repairWithPostGIS(
      geometry,
      this.datasetService.$executeRaw.bind(this.datasetService),
    );

    if (repairedGeometry) {
      const revalidate = this.geometryValidator.validateGeoJSON(repairedGeometry);
      if (revalidate.isValid) {
        return {
          isValid: true,
          repairedGeometry,
          errors: validationResult.errors,
        };
      }
    }

    return {
      isValid: false,
      errors: validationResult.errors,
    };
  }
}
