/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { DatasetService } from '../lib/dataset.service';

/**
 * Mapping Profile Service - Manages column mapping configurations
 */
@Injectable()
export class MappingProfileService {
  private readonly logger = new Logger(MappingProfileService.name);

  constructor(private datasetService: DatasetService) {}

  /**
   * Create a new mapping profile
   */
  async create(data: {
    datasetId: string;
    name: string;
    description?: string;
    sourceType: string;
    mappings: any[];
    crs?: string;
    geometryColumn?: string;
    geometryType?: string;
    createdBy?: string;
  }): Promise<any> {
    this.logger.log(`Creating mapping profile: ${data.name}`);

    return this.datasetService.mappingProfile.create({
      data: {
        datasetId: data.datasetId,
        name: data.name,
        description: data.description,
        sourceType: data.sourceType,
        mappings: data.mappings,
        crs: data.crs,
        geometryColumn: data.geometryColumn,
        geometryType: data.geometryType,
        createdBy: data.createdBy,
        isActive: true,
      },
    });
  }

  /**
   * Get mapping profile by ID
   */
  async findById(id: string): Promise<any> {
    return this.datasetService.mappingProfile.findUnique({
      where: { id },
      include: {
        dataset: true,
      },
    });
  }

  /**
   * Get mapping profiles by dataset ID
   */
  async findByDatasetId(datasetId: string): Promise<any[]> {
    return this.datasetService.mappingProfile.findMany({
      where: { datasetId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update mapping profile
   */
  async update(id: string, data: {
    name?: string;
    description?: string;
    mappings?: any[];
    crs?: string;
    geometryColumn?: string;
    isActive?: boolean;
  }): Promise<any> {
    this.logger.log(`Updating mapping profile: ${id}`);

    return this.datasetService.mappingProfile.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete mapping profile
   */
  async delete(id: string): Promise<any> {
    this.logger.log(`Deleting mapping profile: ${id}`);

    return this.datasetService.mappingProfile.delete({
      where: { id },
    });
  }

  /**
   * Apply mapping profile to data
   */
  applyMapping(data: Record<string, any>[], mapping: any[]): Record<string, any>[] {
    const result: Record<string, any>[] = [];

    for (const row of data) {
      const mapped: Record<string, any> = {};

      for (const map of mapping) {
        const sourceValue = row[map.sourceColumn];

        switch (map.mappingType) {
          case 'DIRECT':
            mapped[map.targetField] = sourceValue;
            break;
          case 'EXPRESSION':
            mapped[map.targetField] = this.evaluateExpression(sourceValue, map.expression, row);
            break;
          case 'LOOKUP':
            mapped[map.targetField] = this.lookupValue(sourceValue, map.lookupConfig);
            break;
          case 'CUSTOM':
            mapped[map.targetField] = sourceValue;
            break;
          default:
            mapped[map.targetField] = sourceValue;
        }

        // Apply default if value is null/undefined
        if (mapped[map.targetField] === undefined || mapped[map.targetField] === null) {
          mapped[map.targetField] = map.defaultValue;
        }
      }

      result.push(mapped);
    }

    return result;
  }

  /**
   * Evaluate simple expressions
   */
  private evaluateExpression(value: any, expression: string, context: Record<string, any>): any {
    if (!expression) return value;

    try {
      const expr = expression.replace(/value/g, JSON.stringify(value));
      const evalFunc = new Function('context', `
        with (context) {
          return ${expr};
        }
      `);
      return evalFunc(context);
    } catch {
      return value;
    }
  }

  /**
   * Lookup value from config
   */
  private lookupValue(value: any, lookupConfig: any): any {
    if (!lookupConfig) return value;
    return lookupConfig[value] || lookupConfig.default || value;
  }
}
