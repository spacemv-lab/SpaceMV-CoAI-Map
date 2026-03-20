/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAdapter, ParseResult, ParsedFeature } from './base.adapter';
import { GdalService } from '../utils/gdal.service';
import { MinioService } from '../services/minio.service';

/**
 * Shapefile adapter for parsing .zip files containing shapefile components
 * Uses GDAL ogr2ogr as primary parser with shpjs as fallback
 */
@Injectable()
export class ShapefileAdapter extends BaseAdapter {
  constructor(
    private gdalService: GdalService,
    private minioService: MinioService,
  ) {
    super();
  }

  getSupportedExtensions(): string[] {
    return ['zip'];
  }

  /**
   * Parse shapefile zip using GDAL ogr2ogr
   */
  async parse(filePathOrBuffer: string | Buffer): Promise<ParseResult> {
    let filePath: string;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      // Handle buffer input
      if (Buffer.isBuffer(filePathOrBuffer)) {
        filePath = await this.saveBufferToTemp(filePathOrBuffer);
      } else if (this.minioService.isMinioKey(filePathOrBuffer)) {
        // Download from MinIO to temp file
        this.logger.log(`Downloading from MinIO: ${filePathOrBuffer}`);
        const result = await this.minioService.downloadToTempFile(filePathOrBuffer);
        filePath = result.filePath;
        cleanup = result.cleanup;
      } else {
        filePath = filePathOrBuffer;
      }

      // Use GDAL for parsing
      const gdalAvailable = await this.gdalService.isAvailable();
      if (!gdalAvailable) {
        throw new Error('GDAL not available - please install GDAL or check your deployment');
      }

      return await this.parseWithGdal(filePath);
    } finally {
      // Cleanup temp file if we downloaded from MinIO
      if (cleanup) {
        await cleanup();
      }
    }
  }

  /**
   * Parse using GDAL ogr2ogr
   */
  private async parseWithGdal(filePath: string): Promise<ParseResult> {
    this.logger.log(`Parsing shapefile with GDAL: ${filePath}`);

    // Validate zip file contents before GDAL processing
    await this.validateZipContents(filePath);

    // Extract zip to temp directory and use the .shp file directly
    const extractedPath = await this.extractZipToTemp(filePath);

    try {
      // Create temp file for output
      const geojsonPath = await this.gdalService.createTempFile('.geojson');

      try {
        // Convert to GeoJSON using the extracted .shp file
        const result = await this.gdalService.convertToGeoJSON(extractedPath, geojsonPath, {
          targetCRS: 'EPSG:4326',
          encoding: 'UTF-8',
        });

        if (!result.success) {
          throw new Error(`GDAL conversion failed: ${result.error}`);
        }

        // Read the converted GeoJSON
        const geojsonContent = await fs.readFile(geojsonPath, 'utf-8');
        const geojson = JSON.parse(geojsonContent);

        // Parse the GeoJSON result
        const parseResult = this.parseGeoJSONResult(geojson);

        // Get additional metadata from GDAL
        const fileInfo = await this.gdalService.getFileInfo(extractedPath);
        if (fileInfo) {
          parseResult.sourceCRS = fileInfo.sourceCRS;
          if (fileInfo.bbox && !parseResult.bbox) {
            parseResult.bbox = fileInfo.bbox;
          }
        }

        return parseResult;
      } finally {
        // Cleanup temp files
        await this.gdalService.cleanup(geojsonPath);
      }
    } finally {
      // Cleanup extracted files
      if (extractedPath) {
        const dir = path.dirname(extractedPath);
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Extract zip file to temp directory and return path to .shp file
   */
  private async extractZipToTemp(zipPath: string): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const zipData = await fs.readFile(zipPath);
    const zip = await JSZip.loadAsync(zipData);

    // Create temp directory
    const tempDir = await fs.mkdtemp('/tmp/shapefile-');
    let shpPath: string | null = null;

    // Extract all files
    for (const [name, file] of Object.entries(zip.files)) {
      const targetPath = path.join(tempDir, name);
      const content = await file.async('nodebuffer');
      await fs.writeFile(targetPath, content);

      if (name.toLowerCase().endsWith('.shp')) {
        shpPath = targetPath;
      }
    }

    if (!shpPath) {
      throw new Error('No .shp file found in zip');
    }

    this.logger.debug(`Extracted shapefile to: ${shpPath}`);
    return shpPath;
  }

  /**
   * Validate that zip file contains valid shapefile components
   */
  private async validateZipContents(filePath: string): Promise<void> {
    try {
      // Use Node.js zip library or read zip header
      const JSZip = (await import('jszip')).default;
      const zipData = await fs.readFile(filePath);
      const zip = await JSZip.loadAsync(zipData);

      const fileNames = Object.keys(zip.files);
      this.logger.debug(`Zip contains ${fileNames.length} files: ${fileNames.slice(0, 10).join(', ')}`);

      // Check for required shapefile components (case-insensitive)
      const hasShp = fileNames.some(name => name.toLowerCase().endsWith('.shp'));
      const hasShx = fileNames.some(name => name.toLowerCase().endsWith('.shx'));
      const hasDbf = fileNames.some(name => name.toLowerCase().endsWith('.dbf'));

      this.logger.debug(`Zip contents check: SHP=${hasShp}, SHX=${hasShx}, DBF=${hasDbf}`);

      if (!hasShp || !hasShx || !hasDbf) {
        const missing = [];
        if (!hasShp) missing.push('.shp');
        if (!hasShx) missing.push('.shx');
        if (!hasDbf) missing.push('.dbf');
        throw new Error(`Invalid shapefile zip: missing required files (${missing.join(', ')})`);
      }
    } catch (error: any) {
      if (error.message.includes('jszip')) {
        this.logger.warn(`JSZip not available, skipping validation`);
      } else {
        this.logger.warn(`Zip validation warning: ${error.message}`);
      }
      // Don't block, just warn
    }
  }

  /**
   * Parse using shpjs (fallback)
   */
  private async parseWithShpjs(filePath: string): Promise<ParseResult> {
    this.logger.log(`Parsing shapefile with shpjs (fallback): ${filePath}`);

    // Polyfill self for shpjs (required in Node.js environment)
    if (typeof (global as any).self === 'undefined') {
      (global as any).self = global;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const shpjs = require('shpjs');

    const buffer = await fs.readFile(filePath);

    try {
      // Use shpjs to parse the shapefile zip
      // shpjs exports as default, so we need to access it correctly
      const parse = shpjs.default || shpjs;
      const geojson = await parse(buffer);

      const features: ParsedFeature[] = [];
      let geometryType = 'UNKNOWN';
      let bbox: [number, number, number, number] | undefined;

      // Handle FeatureCollection or array of features
      const featureArray = Array.isArray(geojson)
        ? geojson.flatMap((g: any) => g.features || [g])
        : geojson.features || [geojson];

      // Extract bbox if available
      if (geojson.bbox) {
        bbox = geojson.bbox as [number, number, number, number];
      }

      for (const feature of featureArray) {
        if (feature.type === 'Feature') {
          // Normalize properties
          const properties: Record<string, any> = {};
          for (const [key, value] of Object.entries(feature.properties || {})) {
            properties[key] = this.normalizeValue(value);
          }

          features.push({
            properties,
            geometry: feature.geometry,
          });

          if (geometryType === 'UNKNOWN' && feature.geometry?.type) {
            geometryType = this.normalizeGeometryType(feature.geometry.type);
          }
        }
      }

      // Calculate bbox if not provided
      if (!bbox && features.length > 0) {
        bbox = this.calculateBbox(features);
      }

      return {
        features,
        geometryType,
        recordCount: features.length,
        bbox,
      };
    } catch (error) {
      this.logger.error('Failed to parse shapefile with shpjs', error);
      throw new Error(`Shapefile parse error: ${error.message}`);
    }
  }

  /**
   * Save buffer to temporary file
   */
  private async saveBufferToTemp(buffer: Buffer): Promise<string> {
    const tempPath = await this.gdalService.createTempFile('.zip', 'shapefile-');
    await fs.writeFile(tempPath, buffer);
    return tempPath;
  }

  /**
   * Parse GeoJSON result from GDAL
   */
  private parseGeoJSONResult(geojson: any): ParseResult {
    const features: ParsedFeature[] = [];
    let geometryType = 'UNKNOWN';
    let bbox: [number, number, number, number] | undefined;

    // Handle FeatureCollection or array of features
    const featureArray = Array.isArray(geojson)
      ? geojson.flatMap((g: any) => g.features || [g])
      : geojson.features || [geojson];

    // Extract bbox if available
    if (geojson.bbox) {
      bbox = geojson.bbox as [number, number, number, number];
    }

    for (const feature of featureArray) {
      if (feature.type === 'Feature') {
        // GDAL may encode some properties specially, normalize them
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(feature.properties || {})) {
          properties[key] = this.normalizeValue(value);
        }

        features.push({
          properties,
          geometry: feature.geometry,
        });

        if (geometryType === 'UNKNOWN' && feature.geometry?.type) {
          geometryType = this.normalizeGeometryType(feature.geometry.type);
        }
      }
    }

    // Calculate bbox if not provided
    if (!bbox && features.length > 0) {
      bbox = this.calculateBbox(features);
    }

    return {
      features,
      geometryType,
      recordCount: features.length,
      bbox,
    };
  }

  async getMetadata(filePathOrBuffer: string | Buffer): Promise<Record<string, any>> {
    const result = await this.parse(filePathOrBuffer);
    return {
      format: 'Shapefile',
      recordCount: result.recordCount,
      geometryType: result.geometryType,
      bbox: result.bbox,
      sourceCRS: result.sourceCRS,
      parser: this.gdalService.isAvailableSync() ? 'GDAL' : 'shpjs',
    };
  }

  async validate(filePathOrBuffer: string | Buffer): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      let buffer: Buffer;
      if (Buffer.isBuffer(filePathOrBuffer)) {
        buffer = filePathOrBuffer;
      } else {
        buffer = await fs.readFile(filePathOrBuffer);
      }

      // Check if it's a valid zip file
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        errors.push('Invalid zip file signature');
        return { valid: false, errors };
      }

      // Try to parse
      await this.parse(buffer);
    } catch (error) {
      errors.push(`Parse error: ${error.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private normalizeValue(value: any): any {
    if (typeof value === 'string') {
      // Handle potential encoding issues from DBF
      try {
        // Try to decode as UTF-8, fallback to original
        return Buffer.from(value, 'latin1').toString('utf-8');
      } catch {
        return value;
      }
    }
    return value;
  }

  private normalizeGeometryType(type: string): string {
    const normalized = type.toUpperCase().replace(/-/g, '_');
    const typeMap: Record<string, string> = {
      'POINT': 'POINT',
      'LINESTRING': 'LINESTRING',
      'POLYGON': 'POLYGON',
      'MULTIPOINT': 'MULTI_POINT',
      'MULTILINESTRING': 'MULTI_LINESTRING',
      'MULTIPOLYGON': 'MULTI_POLYGON',
    };
    return typeMap[normalized] || 'UNKNOWN';
  }

  private calculateBbox(features: ParsedFeature[]): [number, number, number, number] | undefined {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const feature of features) {
      const coords = this.extractCoordinates(feature.geometry);
      for (const coord of coords) {
        if (coord[0] < minX) minX = coord[0];
        if (coord[1] < minY) minY = coord[1];
        if (coord[0] > maxX) maxX = coord[0];
        if (coord[1] > maxY) maxY = coord[1];
      }
    }

    if (minX === Infinity) return undefined;
    return [minX, minY, maxX, maxY];
  }

  private extractCoordinates(geometry: any): number[][] {
    if (!geometry) return [];

    const coords: number[][] = [];

    const extract = (geom: any) => {
      if (!geom) return;

      if (geom.type === 'Point') {
        coords.push(geom.coordinates);
      } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
        for (const coord of geom.coordinates) {
          coords.push(coord);
        }
      } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
        for (const ring of geom.coordinates) {
          for (const coord of ring) {
            coords.push(coord);
          }
        }
      } else if (geom.type === 'MultiPolygon') {
        for (const polygon of geom.coordinates) {
          for (const ring of polygon) {
            for (const coord of ring) {
              coords.push(coord);
            }
          }
        }
      }
    };

    extract(geometry);
    return coords;
  }
}
