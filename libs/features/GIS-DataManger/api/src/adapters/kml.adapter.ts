/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { BaseAdapter, ParseResult, ParsedFeature } from './base.adapter';
import { MinioService } from '../services/minio.service';

/**
 * KML adapter for parsing .kml and .kmz files
 * Note: Full KML parsing requires additional dependencies like @placemarkio/tokml
 * or xml parsing with regex/string parsing
 */
@Injectable()
export class KmlAdapter extends BaseAdapter {
  constructor(private minioService: MinioService) {
    super();
  }
  getSupportedExtensions(): string[] {
    return ['kml', 'kmz'];
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

      const features: ParsedFeature[] = [];
      let geometryType = 'UNKNOWN';

      // Simple KML parsing - extract Placemarks
      // This is a basic implementation; production should use a proper KML parser
      const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
      let match: RegExpExecArray | null;

      while ((match = placemarkRegex.exec(content)) !== null) {
        const placemark = match[1];
        const feature = this.parsePlacemark(placemark);

        if (feature) {
          features.push(feature);

          if (geometryType === 'UNKNOWN' && feature.geometry?.type) {
            geometryType = this.normalizeGeometryType(feature.geometry.type);
          }
        }
      }

      return {
        features,
        geometryType,
        recordCount: features.length,
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
      format: 'KML',
      recordCount: result.recordCount,
      geometryType: result.geometryType,
    };
  }

  private parsePlacemark(placemark: string): ParsedFeature | null {
    const properties: Record<string, any> = {};
    let geometry: any = null;

    // Extract name
    const nameMatch = placemark.match(/<name[^>]*>([^<]*)<\/name>/i);
    if (nameMatch) {
      properties.name = this.stripHtml(nameMatch[1]);
    }

    // Extract description
    const descMatch = placemark.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch) {
      properties.description = this.stripHtml(descMatch[1]);
    }

    // Extract ExtendedData
    const extendedDataMatch = placemark.match(/<ExtendedData[^>]*>([\s\S]*?)<\/ExtendedData>/i);
    if (extendedDataMatch) {
      const dataMatches = extendedDataMatch[1].matchAll(/<Data\s+name="([^"]+)"[^>]*><value[^>]*>([^<]*)<\/value>/gi);
      for (const dataMatch of dataMatches) {
        properties[dataMatch[1]] = this.stripHtml(dataMatch[2]);
      }
    }

    // Extract Point
    const pointMatch = placemark.match(/<Point[^>]*>([\s\S]*?)<\/Point>/i);
    if (pointMatch) {
      const coordsMatch = pointMatch[1].match(/<coordinates[^>]*>([^<]*)<\/coordinates>/i);
      if (coordsMatch) {
        const coords = this.parseCoordinates(coordsMatch[1]);
        if (coords.length > 0) {
          geometry = {
            type: 'Point',
            coordinates: coords[0],
          };
        }
      }
    }

    // Extract LineString
    const lineMatch = placemark.match(/<LineString[^>]*>([\s\S]*?)<\/LineString>/i);
    if (lineMatch && !geometry) {
      const coordsMatch = lineMatch[1].match(/<coordinates[^>]*>([^<]*)<\/coordinates>/i);
      if (coordsMatch) {
        const coords = this.parseCoordinates(coordsMatch[1]);
        geometry = {
          type: 'LineString',
          coordinates: coords,
        };
      }
    }

    // Extract Polygon
    const polygonMatch = placemark.match(/<Polygon[^>]*>([\s\S]*?)<\/Polygon>/i);
    if (polygonMatch && !geometry) {
      geometry = this.parsePolygon(polygonMatch[1]);
    }

    if (!geometry) {
      return null;
    }

    return {
      properties,
      geometry,
    };
  }

  private parseCoordinates(coordString: string): number[][] {
    const coords: number[][] = [];
    const tuples = coordString.trim().split(/\s+/);

    for (const tuple of tuples) {
      const parts = tuple.split(',').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        // KML uses lon,lat[,alt]
        coords.push([parts[0], parts[1], ...(parts.length > 2 ? [parts[2]] : [])]);
      }
    }

    return coords;
  }

  private parsePolygon(polygonContent: string): any {
    // Try OuterBoundary first
    const outerMatch = polygonContent.match(/<OuterBoundaryIs[^>]*>([\s\S]*?)<\/OuterBoundaryIs>/i);
    if (outerMatch) {
      const coordsMatch = outerMatch[1].match(/<coordinates[^>]*>([^<]*)<\/coordinates>/i);
      if (coordsMatch) {
        const coords = this.parseCoordinates(coordsMatch[1]);
        // Close the ring if not already closed
        if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
          coords.push([...coords[0]]);
        }
        return {
          type: 'Polygon',
          coordinates: [coords],
        };
      }
    }
    return null;
  }

  private normalizeGeometryType(type: string): string {
    const normalized = type.toUpperCase();
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

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
