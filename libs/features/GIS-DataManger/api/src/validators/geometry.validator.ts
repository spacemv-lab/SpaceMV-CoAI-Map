/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';

export interface GeometryValidationResult {
  isValid: boolean;
  errors: GeometryError[];
  warnings: GeometryWarning[];
  repairedGeometry?: any;
}

export interface GeometryError {
  featureId: string;
  errorType: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface GeometryWarning {
  featureId: string;
  warningType: string;
  message: string;
}

/**
 * Geometry validator for PostGIS geometry validation
 */
@Injectable()
export class GeometryValidator {
  private readonly logger = new Logger(GeometryValidator.name);

  /**
   * Validate a GeoJSON geometry
   */
  validateGeoJSON(geometry: any): GeometryValidationResult {
    const errors: GeometryError[] = [];
    const warnings: GeometryWarning[] = [];

    if (!geometry) {
      errors.push({
        featureId: 'unknown',
        errorType: 'NULL_GEOMETRY',
        message: 'Geometry is null or undefined',
        severity: 'critical',
      });
      return { isValid: false, errors, warnings };
    }

    // Check geometry type
    const validTypes = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];
    if (!geometry.type || !validTypes.includes(geometry.type)) {
      errors.push({
        featureId: 'unknown',
        errorType: 'INVALID_TYPE',
        message: `Invalid geometry type: ${geometry.type}`,
        severity: 'critical',
      });
      return { isValid: false, errors, warnings };
    }

    // Validate coordinates
    const coordErrors = this.validateCoordinates(geometry);
    errors.push(...coordErrors);

    // Type-specific validations
    switch (geometry.type) {
      case 'Polygon':
        const polygonWarnings = this.validatePolygon(geometry);
        warnings.push(...polygonWarnings);
        break;
      case 'MultiPolygon':
        const multiPolygonWarnings = this.validateMultiPolygon(geometry);
        warnings.push(...multiPolygonWarnings);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate geometry using PostGIS ST_IsValid
   * This requires a database connection
   */
  async validateWithPostGIS(
    geometry: any,
    executeRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<any>
  ): Promise<GeometryValidationResult> {
    try {
      const geomJson = JSON.stringify(geometry);

      // Check validity
      const validityResult = await executeRaw`
        SELECT ST_IsValid(ST_GeomFromGeoJSON(${geomJson})) as is_valid,
               ST_IsValidReason(ST_GeomFromGeoJSON(${geomJson})) as reason
      `;

      const isValid = validityResult[0]?.is_valid || false;
      const reason = validityResult[0]?.reason || '';

      if (!isValid) {
        return {
          isValid: false,
          errors: [{
            featureId: 'unknown',
            errorType: 'POSTGIS_INVALID',
            message: reason,
            severity: 'error',
          }],
          warnings: [],
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      this.logger.error('PostGIS validation failed', error);
      return {
        isValid: false,
        errors: [{
          featureId: 'unknown',
          errorType: 'VALIDATION_ERROR',
          message: error.message,
          severity: 'critical',
        }],
        warnings: [],
      };
    }
  }

  /**
   * Repair invalid geometry using PostGIS ST_MakeValid
   */
  async repairWithPostGIS(
    geometry: any,
    executeRaw: (query: TemplateStringsArray, ...values: any[]) => Promise<any>
  ): Promise<any> {
    try {
      const geomJson = JSON.stringify(geometry);

      const result = await executeRaw`
        SELECT ST_AsGeoJSON(ST_MakeValid(ST_GeomFromGeoJSON(${geomJson})))::json as repaired
      `;

      return result[0]?.repaired || null;
    } catch (error) {
      this.logger.error('PostGIS repair failed', error);
      return null;
    }
  }

  private validateCoordinates(geometry: any): GeometryError[] {
    const errors: GeometryError[] = [];

    const checkCoord = (coord: any[], path: string = '') => {
      if (!Array.isArray(coord)) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'INVALID_COORD',
          message: 'Coordinates must be an array',
          severity: 'critical',
        });
        return;
      }

      if (coord.length < 2) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'INSUFFICIENT_COORDS',
          message: 'Coordinates must have at least 2 values (lon, lat)',
          severity: 'critical',
        });
        return;
      }

      const [lon, lat] = coord;

      if (typeof lon !== 'number' || isNaN(lon)) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'INVALID_LON',
          message: `Longitude must be a number, got: ${lon}`,
          severity: 'error',
        });
      } else if (lon < -180 || lon > 180) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'LON_OUT_OF_RANGE',
          message: `Longitude ${lon} is out of range [-180, 180]`,
          severity: 'error',
        });
      }

      if (typeof lat !== 'number' || isNaN(lat)) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'INVALID_LAT',
          message: `Latitude must be a number, got: ${lat}`,
          severity: 'error',
        });
      } else if (lat < -90 || lat > 90) {
        errors.push({
          featureId: path || 'unknown',
          errorType: 'LAT_OUT_OF_RANGE',
          message: `Latitude ${lat} is out of range [-90, 90]`,
          severity: 'error',
        });
      }
    };

    const traverse = (geom: any, path: string = '') => {
      if (!geom) return;

      if (geom.type === 'Point') {
        checkCoord(geom.coordinates, path || 'point');
      } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
        geom.coordinates?.forEach((coord: any[], i: number) => {
          checkCoord(coord, `${path || geom.type.toLowerCase()}[${i}]`);
        });
      } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
        geom.coordinates?.forEach((ring: any[], i: number) => {
          ring.forEach((coord: any[], j: number) => {
            checkCoord(coord, `${path || geom.type.toLowerCase()}[${i}][${j}]`);
          });
        });
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates?.forEach((poly: any[], i: number) => {
          poly.forEach((ring: any[], j: number) => {
            ring.forEach((coord: any[], k: number) => {
              checkCoord(coord, `${path || 'multipolygon'}[${i}][${j}][${k}]`);
            });
          });
        });
      }
    };

    traverse(geometry);
    return errors;
  }

  private validatePolygon(geometry: any): GeometryWarning[] {
    const warnings: GeometryWarning[] = [];

    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      return warnings;
    }

    // Check if ring is closed
    const exteriorRing = geometry.coordinates[0];
    if (exteriorRing && exteriorRing.length > 0) {
      const first = exteriorRing[0];
      const last = exteriorRing[exteriorRing.length - 1];

      if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
        warnings.push({
          featureId: 'unknown',
          warningType: 'RING_NOT_CLOSED',
          message: 'Polygon exterior ring is not closed',
        });
      }
    }

    return warnings;
  }

  private validateMultiPolygon(geometry: any): GeometryWarning[] {
    const warnings: GeometryWarning[] = [];

    if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
      return warnings;
    }

    for (let i = 0; i < geometry.coordinates.length; i++) {
      const polygon = geometry.coordinates[i];
      if (polygon && polygon[0]) {
        const exteriorRing = polygon[0];
        const first = exteriorRing[0];
        const last = exteriorRing[exteriorRing.length - 1];

        if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
          warnings.push({
            featureId: `polygon[${i}]`,
            warningType: 'RING_NOT_CLOSED',
            message: `Polygon ${i} exterior ring is not closed`,
          });
        }
      }
    }

    return warnings;
  }
}
