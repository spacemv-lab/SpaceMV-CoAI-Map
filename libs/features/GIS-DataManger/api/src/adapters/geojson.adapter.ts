/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { BaseAdapter, ParseResult, ParsedFeature } from './base.adapter';
import { MinioService } from '../services/minio.service';

/**
 * GeoJSON adapter for parsing .geojson and .json files
 */
@Injectable()
export class GeoJsonAdapter extends BaseAdapter {
  constructor(private minioService: MinioService) {
    super();
  }
  getSupportedExtensions(): string[] {
    return ['geojson', 'json'];
  }

  async parse(filePathOrBuffer: string | Buffer): Promise<ParseResult> {
    let content: string;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      if (Buffer.isBuffer(filePathOrBuffer)) {
        content = filePathOrBuffer.toString('utf-8');
      } else if (this.minioService.isMinioKey(filePathOrBuffer)) {
        // Download from MinIO to temp file
        this.logger.log(`Downloading from MinIO: ${filePathOrBuffer}`);
        const result = await this.minioService.downloadToTempFile(filePathOrBuffer);
        content = await fs.readFile(result.filePath, 'utf-8');
        cleanup = result.cleanup;
      } else {
        content = await fs.readFile(filePathOrBuffer, 'utf-8');
      }

      const data = JSON.parse(content);
      const features: ParsedFeature[] = [];
      let geometryType = 'UNKNOWN';
      let bbox: [number, number, number, number] | undefined;

      // Handle FeatureCollection
      if (data.type === 'FeatureCollection') {
        if (data.bbox) {
          bbox = data.bbox as [number, number, number, number];
        }

        for (const feature of data.features || []) {
          features.push({
            properties: feature.properties || {},
            geometry: feature.geometry,
          });

          if (geometryType === 'UNKNOWN' && feature.geometry?.type) {
            geometryType = this.normalizeGeometryType(feature.geometry.type);
          }
        }
      }
      // Handle single Feature
      else if (data.type === 'Feature') {
        features.push({
          properties: data.properties || {},
          geometry: data.geometry,
        });

        if (data.geometry?.type) {
          geometryType = this.normalizeGeometryType(data.geometry.type);
        }
      }
      // Handle Feature array
      else if (Array.isArray(data)) {
        for (const feature of data) {
          if (feature.type === 'Feature') {
            features.push({
              properties: feature.properties || {},
              geometry: feature.geometry,
            });

            if (geometryType === 'UNKNOWN' && feature.geometry?.type) {
              geometryType = this.normalizeGeometryType(feature.geometry.type);
            }
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
    } finally {
      // Cleanup temp file if we downloaded from MinIO
      if (cleanup) {
        await cleanup();
      }
    }
  }

  async getMetadata(filePathOrBuffer: string | Buffer): Promise<Record<string, any>> {
    const result = await this.parse(filePathOrBuffer);
    return {
      format: 'GeoJSON',
      recordCount: result.recordCount,
      geometryType: result.geometryType,
      bbox: result.bbox,
      hasZ: result.features.some(f => f.geometry?.coordinates?.[0]?.length === 3),
    };
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
