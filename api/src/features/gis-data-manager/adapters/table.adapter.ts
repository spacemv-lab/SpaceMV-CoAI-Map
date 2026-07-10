/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { BaseAdapter, ParseResult, ParsedFeature } from './base.adapter';
import { MinioService } from '../services/minio.service';

// Dynamic imports for optional dependencies
let Papa: any;
let XLSX: any;

@Injectable()
export class TableAdapter extends BaseAdapter {
  constructor(private minioService: MinioService) {
    super();
  }
  getSupportedExtensions(): string[] {
    return ['csv', 'xls', 'xlsx'];
  }

  async parse(
    filePathOrBuffer: string | Buffer,
    options?: {
      geometryColumn?: string;
      latitudeColumn?: string;
      longitudeColumn?: string;
      wktColumn?: string;
      headerRow?: number; // 1-based，默认 1（首行为表头）
      sheet?: string; // Excel 工作表名
    }
  ): Promise<ParseResult> {
    let filePath: string;
    let ext: string;
    let cleanup: (() => Promise<void>) | undefined;

    try {
      // Handle buffer vs file path
      if (Buffer.isBuffer(filePathOrBuffer)) {
        // Write buffer to temp file
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'table-'));
        filePath = path.join(tempDir, 'upload');
        await fs.writeFile(filePath, filePathOrBuffer);

        // Determine extension from original name or assume csv
        ext = 'csv';
      } else if (this.minioService.isMinioKey(filePathOrBuffer)) {
        // Download from MinIO to temp file
        this.logger.log(`Downloading from MinIO: ${filePathOrBuffer}`);
        const result = await this.minioService.downloadToTempFile(filePathOrBuffer);
        filePath = result.filePath;
        ext = path.extname(filePath).slice(1).toLowerCase();
        cleanup = result.cleanup;
      } else {
        filePath = filePathOrBuffer;
        ext = path.extname(filePath).slice(1).toLowerCase();
      }

      let records: Record<string, any>[] = [];
      let fields: { name: string; type: string }[] = [];

      if (ext === 'csv') {
        const result = await this.parseCSV(filePath, options);
        records = result.records;
        fields = result.fields;
      } else if (ext === 'xls' || ext === 'xlsx') {
        const result = await this.parseExcel(filePath, options);
        records = result.records;
        fields = result.fields;
      } else {
        throw new Error(`Unsupported file format: ${ext}`);
      }

      // Convert records to features
      const features: ParsedFeature[] = [];
      const geometryColumn = options?.geometryColumn || this.detectGeometryColumn(records);
      const wktColumn = options?.wktColumn || this.detectWktColumn(records);
      const latColumn = options?.latitudeColumn || this.detectLatitudeColumn(records);
      const lonColumn = options?.longitudeColumn || this.detectLongitudeColumn(records);

      this.logger.debug(`Table parse: geometryColumn=${geometryColumn}, wktColumn=${wktColumn}, latColumn=${latColumn}, lonColumn=${lonColumn}`);
      this.logger.debug(`CSV fields: ${fields.map(f => f.name).join(', ')}`);

      for (const record of records) {
        const properties: Record<string, any> = {};
        let geometry: any = null;

        for (const [key, value] of Object.entries(record)) {
          // Skip geometry columns for properties
          if (key === geometryColumn || key === wktColumn || key === latColumn || key === lonColumn) {
            continue;
          }
          properties[key] = value;
        }

        // Extract geometry
        if (wktColumn && record[wktColumn]) {
          geometry = this.wktToGeoJSON(record[wktColumn]);
        } else if (geometryColumn && record[geometryColumn]) {
          try {
            geometry = JSON.parse(record[geometryColumn]);
          } catch {
            geometry = this.wktToGeoJSON(record[geometryColumn]);
          }
        } else if (latColumn && lonColumn && record[latColumn] && record[lonColumn]) {
          const lat = parseFloat(record[latColumn]);
          const lon = parseFloat(record[lonColumn]);
          if (!isNaN(lat) && !isNaN(lon)) {
            geometry = {
              type: 'Point',
              coordinates: [lon, lat],
            };
          }
        }

        features.push({
          properties,
          geometry,
        });
      }

      // Determine geometry type
      let geometryType = 'UNKNOWN';
      const firstWithGeometry = features.find(f => f.geometry);
      if (firstWithGeometry?.geometry?.type) {
        geometryType = this.normalizeGeometryType(firstWithGeometry.geometry.type);
      }

      const bbox = this.computeBbox(features);

      return {
        features,
        geometryType,
        recordCount: features.length,
        fields,
        bbox,
      };
    } finally {
      // Cleanup temp file if we created one or downloaded from MinIO
      if (cleanup) {
        await cleanup();
      } else if (Buffer.isBuffer(filePathOrBuffer) && filePath) {
        await fs.rm(path.dirname(filePath), { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  async getMetadata(filePathOrBuffer: string | Buffer): Promise<Record<string, any>> {
    const result = await this.parse(filePathOrBuffer);
    return {
      format: 'Table',
      recordCount: result.recordCount,
      geometryType: result.geometryType,
      fields: result.fields,
      hasGeometry: result.features.some(f => f.geometry !== null),
    };
  }

  private async parseCSV(
    filePath: string,
    options?: { headerRow?: number },
  ): Promise<{ records: Record<string, any>[]; fields: { name: string; type: string }[] }> {
    if (!Papa) {
      Papa = await import('papaparse');
    }

    // Read raw buffer
    const buffer = await fs.readFile(filePath);

    // Detect encoding - try UTF-8 first, then fallback to GBK/GB2312 for Chinese Excel files
    let content: string;
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      // UTF-8 BOM
      content = buffer.toString('utf-8');
    } else {
      // Try UTF-8 first
      try {
        content = buffer.toString('utf-8');
        // Check if content looks like garbled text (common pattern for Chinese GBK decoded as UTF-8)
        if (/[\uFFFD\u0080-\u009F]/.test(content) || content.includes('ï') || content.includes('Â')) {
          // Likely GBK/GB2312 encoding - use iconv-lite to decode
          const iconv = await import('iconv-lite');
          content = iconv.decode(buffer, 'gbk');
          this.logger.debug('Detected GBK encoding, converted to UTF-8');
        }
      } catch {
        // Fallback to GBK directly
        const iconv = await import('iconv-lite');
        content = iconv.decode(buffer, 'gbk');
      }
    }

    // headerRow: 1-based，默认 1（首行为表头）。指定 N 时跳过前 N-1 行、第 N 行作表头。
    const headerRow = options?.headerRow && options.headerRow > 0 ? options.headerRow : 1;
    const headerIndex = headerRow - 1;

    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: false, // 关闭自动表头，手动按 headerRow 取表头行（支持"第 N 行才是表头"）
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results: any) => {
          const rows: any[][] = results.data;
          if (rows.length <= headerIndex) {
            resolve({ records: [], fields: [] });
            return;
          }
          const headerFields = (rows[headerIndex] as any[]).map((cell) =>
            String(cell ?? '').trim(),
          );
          const dataRows = rows.slice(headerIndex + 1);

          // zip 每行成对象，键来自表头行；空名/重名列加序号避免覆盖
          const records: Record<string, any>[] = dataRows.map((row) => {
            const obj: Record<string, any> = {};
            row.forEach((cell, i) => {
              const raw = headerFields[i] ?? '';
              const name = raw === '' ? `_col${i}` : raw;
              if (name in obj) {
                obj[`${name}_${i}`] = cell;
              } else {
                obj[name] = cell;
              }
            });
            return obj;
          });

          const fields = headerFields.map((name, i) => ({
            name: name || `_col${i}`,
            type: 'string',
          }));

          resolve({ records, fields });
        },
        error: reject,
      });
    });
  }

  private async parseExcel(
    filePath: string,
    options?: { sheet?: string; headerRow?: number },
  ): Promise<{ records: Record<string, any>[]; fields: { name: string; type: string }[] }> {
    if (!XLSX) {
      XLSX = await import('xlsx');
    }

    const workbook = XLSX.readFile(filePath);
    // 选 sheet：未指定或名字不存在时回退第一个 sheet
    const sheetName =
      options?.sheet && workbook.SheetNames.includes(options.sheet)
        ? options.sheet
        : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // headerRow: 1-based，默认 1。range 指定起始行(0-based)，sheet_to_json 把该行当表头。
    const headerRow = options?.headerRow && options.headerRow > 0 ? options.headerRow : 1;
    const data = XLSX.utils.sheet_to_json(sheet, { range: headerRow - 1 });

    const fields: { name: string; type: string }[] = [];
    if (data.length > 0) {
      for (const key of Object.keys(data[0])) {
        fields.push({ name: key, type: 'string' });
      }
    }

    return { records: data, fields };
  }

  private detectGeometryColumn(records: Record<string, any>[]): string | undefined {
    const candidates = ['geometry', 'geom', 'geojson', 'shape', 'wkt_geometry'];
    return this.detectColumnByName(records, candidates);
  }

  private detectWktColumn(records: Record<string, any>[]): string | undefined {
    const candidates = ['wkt', 'wkt_geometry', 'geom_wkt'];
    return this.detectColumnByName(records, candidates);
  }

  private detectLatitudeColumn(records: Record<string, any>[]): string | undefined {
    // Support both correct and common typo (维度 instead of 纬度)
    const candidates = ['lat', 'latitude', 'y', '纬度', '维度', 'latitud'];
    return this.detectColumnByName(records, candidates);
  }

  private detectLongitudeColumn(records: Record<string, any>[]): string | undefined {
    const candidates = ['lon', 'lng', 'longitude', 'x', '经度', 'longitud'];
    return this.detectColumnByName(records, candidates);
  }

  private detectColumnByName(records: Record<string, any>[], candidates: string[]): string | undefined {
    if (records.length === 0) return undefined;

    const columns = Object.keys(records[0]);
    for (const candidate of candidates) {
      const match = columns.find(col => col.toLowerCase() === candidate.toLowerCase());
      if (match) return match;
    }
    return undefined;
  }

  private wktToGeoJSON(wkt: string): any {
    if (!wkt || typeof wkt !== 'string') return null;

    // Simple WKT parser - production should use a library like wellknown
    const wktUpper = wkt.toUpperCase().trim();

    // POINT
    const pointMatch = wktUpper.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
      return {
        type: 'Point',
        coordinates: [parseFloat(pointMatch[1]), parseFloat(pointMatch[2])],
      };
    }

    // LINESTRING
    const lineMatch = wktUpper.match(/LINESTRING\s*\(\s*([\d\s.,-]+)\s*\)/i);
    if (lineMatch) {
      const coords = lineMatch[1].trim().split(',').map((c: string) => {
        const [x, y] = c.trim().split(/\s+/).map(Number);
        return [x, y];
      });
      return {
        type: 'LineString',
        coordinates: coords,
      };
    }

    // POLYGON
    const polyMatch = wktUpper.match(/POLYGON\s*\(\s*\(\s*([\d\s.,-]+)\s*\)\s*\)/i);
    if (polyMatch) {
      const coords = polyMatch[1].trim().split(',').map((c: string) => {
        const [x, y] = c.trim().split(/\s+/).map(Number);
        return [x, y];
      });
      return {
        type: 'Polygon',
        coordinates: [coords],
      };
    }

    // If parsing fails, return null
    return null;
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

  /** 遍历所有要素坐标算 bbox[minLon,minLat,maxLon,maxLat]，供"缩放至图层"用 */
  private computeBbox(features: ParsedFeature[]): [number, number, number, number] | undefined {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    let has = false;
    const visit = (coords: any) => {
      if (!Array.isArray(coords)) return;
      if (
        coords.length >= 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        const lon = coords[0];
        const lat = coords[1];
        if (
          !Number.isNaN(lon) &&
          !Number.isNaN(lat) &&
          Math.abs(lon) <= 180 &&
          Math.abs(lat) <= 90
        ) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          has = true;
        }
        return;
      }
      for (const c of coords) visit(c);
    };
    for (const f of features) {
      if (f.geometry?.coordinates) visit(f.geometry.coordinates);
    }
    return has ? [minLon, minLat, maxLon, maxLat] : undefined;
  }
}
