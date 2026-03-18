/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';
import { GeometryValidator } from '../validators/geometry.validator';

/**
 * Validation Service - Handles geometry and data validation
 */
@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private datasetService: DatasetService,
    private geometryValidator: GeometryValidator,
  ) {}

  /**
   * Validate all features in a dataset version
   */
  async validateVersion(versionId: string): Promise<{
    isValid: boolean;
    errorCount: number;
    warningCount: number;
    report: any;
  }> {
    this.logger.log(`Validating version ${versionId}`);

    try {
      // Get all feature IDs and properties for this version
      // Note: geometry is Unsupported type, cannot be selected directly
      const features = await this.datasetService.gisFeature.findMany({
        where: { versionId },
        select: {
          id: true,
          properties: true,
        },
      });

      const allErrors: any[] = [];
      const allWarnings: any[] = [];

      // Validate each feature's geometry using raw SQL
      for (const feature of features) {
        // Get geometry as GeoJSON using raw SQL
        const geomResult = await this.datasetService.$queryRaw`
          SELECT ST_AsGeoJSON(geometry)::json as geometry
          FROM "GisFeature"
          WHERE "id" = ${feature.id}
        `;

        const geometry = geomResult[0]?.geometry;

        if (geometry) {
          const result = this.geometryValidator.validateGeoJSON(geometry);

          for (const error of result.errors) {
            allErrors.push({
              featureId: feature.id,
              ...error,
            });
          }

          for (const warning of result.warnings) {
            allWarnings.push({
              featureId: feature.id,
              ...warning,
            });
          }
        }
      }

      // Create validation report
      const report = await this.datasetService.validationReport.upsert({
        where: { versionId },
        create: {
          versionId,
          isValid: allErrors.length === 0,
          errorCount: allErrors.length,
          warningCount: allWarnings.length,
          geometryErrors: allErrors,
          attributeErrors: [],
          summary: this.generateSummary(allErrors, allWarnings),
        },
        update: {
          isValid: allErrors.length === 0,
          errorCount: allErrors.length,
          warningCount: allWarnings.length,
          geometryErrors: allErrors,
          attributeErrors: [],
          summary: this.generateSummary(allErrors, allWarnings),
        },
      });

      return {
        isValid: allErrors.length === 0,
        errorCount: allErrors.length,
        warningCount: allWarnings.length,
        report,
      };
    } catch (error) {
      this.logger.error(`Validation failed for version ${versionId}`, error);
      throw error;
    }
  }

  /**
   * Get validation report for a version
   */
  async getValidationReport(versionId: string): Promise<any> {
    return this.datasetService.validationReport.findUnique({
      where: { versionId },
    });
  }

  /**
   * Generate validation summary
   */
  private generateSummary(errors: any[], warnings: any[]): string {
    const parts: string[] = [];

    if (errors.length === 0 && warnings.length === 0) {
      return 'Validation passed with no issues';
    }

    if (errors.length > 0) {
      parts.push(`${errors.length} error(s) found`);
    }

    if (warnings.length > 0) {
      parts.push(`${warnings.length} warning(s) found`);
    }

    return parts.join(', ');
  }
}
