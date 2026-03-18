/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * GDAL operation result
 */
export interface GdalResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * GDAL version info
 */
export interface GdalVersion {
  version: string;
  releaseDate: string;
}

/**
 * GDAL service for ogr2ogr operations
 */
@Injectable()
export class GdalService {
  private readonly logger = new Logger(GdalService.name);
  private available: boolean | null = null;
  private versionInfo?: GdalVersion;
  private initPromise?: Promise<boolean>;

  /**
   * Initialize and check GDAL availability
   */
  async onModuleInit() {
    await this.cleanupStaleTempFiles();
    await this.ensureInitialized();
  }

  /**
   * Cleanup stale temporary files from previous runs
   * This is a safeguard for cases where cleanup() was not called
   * (process crash, OOM kill, container restart, etc.)
   */
  private async cleanupStaleTempFiles(): Promise<void> {
    try {
      const tempDir = os.tmpdir();
      const minioPrefix = 'minio-';
      const gdalPrefix = 'gdal-';

      this.logger.log(`Cleaning up stale temp files in ${tempDir}...`);

      const entries = await fs.readdir(tempDir, { withFileTypes: true });
      let cleanedCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory() &&
            (entry.name.startsWith(minioPrefix) || entry.name.startsWith(gdalPrefix))) {
          try {
            await fs.rm(path.join(tempDir, entry.name), { recursive: true, force: true });
            cleanedCount++;
            this.logger.debug(`Cleaned up stale temp dir: ${entry.name}`);
          } catch (error) {
            this.logger.warn(`Failed to cleanup temp dir ${entry.name}: ${error}`);
          }
        }
      }

      if (cleanedCount > 0) {
        this.logger.log(`Cleaned up ${cleanedCount} stale temp file(s)`);
      }
    } catch (error: any) {
      this.logger.warn(`Failed to cleanup stale temp files: ${error.message}`);
    }
  }

  /**
   * Ensure GDAL availability is checked
   */
  private async ensureInitialized(): Promise<void> {
    if (this.available === null && !this.initPromise) {
      this.initPromise = this.checkAvailability();
    }
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Check if GDAL is available - auto-initializes on first call
   */
  async isAvailable(): Promise<boolean> {
    await this.ensureInitialized();
    return this.available ?? false;
  }

  /**
   * Synchronous check (use after module is initialized)
   */
  isAvailableSync(): boolean {
    return this.available ?? false;
  }

  /**
   * Check if GDAL is available
   */
  private async checkAvailability(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    try {
      const result = await execAsync('ogr2ogr --version');
      const versionOutput = result.stdout.trim();

      // Parse version: "GDAL 3.8.4, released 2024/02/08"
      const match = versionOutput.match(/GDAL ([\d.]+), released (.+)/);
      if (match) {
        this.versionInfo = {
          version: match[1],
          releaseDate: match[2],
        };
      }

      this.available = true;
      this.logger.log(`GDAL available: ${versionOutput}`);
      return true;
    } catch (error: any) {
      this.available = false;
      this.logger.warn('GDAL not available, will use fallback adapters');
      return false;
    }
  }

  /**
   * Get GDAL version info
   */
  getVersion(): GdalVersion | undefined {
    return this.versionInfo;
  }

  /**
   * Create a virtual path for reading compressed files
   */
  createVirtualPath(filePath: string, driver: string = 'zip'): string {
    const absolutePath = path.resolve(filePath);
    // Avoid double slashes - path.resolve already returns absolute path
    const cleanPath = absolutePath.startsWith('/') ? absolutePath : `/${absolutePath}`;
    return `/vsi${driver}${cleanPath}`;
  }

  /**
   * Create a temporary file
   */
  async createTempFile(
    extension: string = '.tmp',
    prefix: string = 'gdal-',
  ): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const fileName = `${prefix}${Date.now()}${extension}`;
    return path.join(tempDir, fileName);
  }

  /**
   * Execute ogr2ogr command
   */
  async executeOgr2ogr(args: string[]): Promise<GdalResult> {
    const command = `ogr2ogr ${args.join(' ')}`;
    this.logger.debug(`Executing: ${command}`);

    try {
      const result = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error: any) {
      this.logger.error(`ogr2ogr failed: ${error.message}`);
      return {
        success: false,
        error: error.message || error.stderr || 'Unknown error',
      };
    }
  }

  /**
   * Convert file to GeoJSON using ogr2ogr
   */
  async convertToGeoJSON(
    inputPath: string,
    outputPath?: string,
    options?: {
      targetCRS?: string;
      encoding?: string;
      layerName?: string;
    },
  ): Promise<GdalResult> {
    if (!this.available) {
      return {
        success: false,
        error: 'GDAL not available',
      };
    }

    const args: string[] = [];

    // Target coordinate reference system
    if (options?.targetCRS) {
      args.push('-t_srs', options.targetCRS);
    } else {
      args.push('-t_srs', 'EPSG:4326');
    }

    // Output format
    args.push('-f', 'GeoJSON');

    // Output file
    const output = outputPath || (await this.createTempFile('.geojson'));
    args.push(output);

    // Input file - support virtual paths
    // Only use /vsizip/ for zip files, otherwise use the path directly
    let input: string;
    if (inputPath.startsWith('/vsi')) {
      input = inputPath;
    } else if (inputPath.toLowerCase().endsWith('.zip')) {
      input = this.createVirtualPath(inputPath, 'zip');
    } else {
      input = path.resolve(inputPath);
    }
    args.push(input);

    // Optional layer name
    if (options?.layerName) {
      args.push('-nln', options.layerName);
    }

    // Encoding option is not supported for GeoJSON output, skip it
    // GDAL will handle encoding internally

    return this.executeOgr2ogr(args);
  }

  /**
   * Get file metadata/information
   */
  async getFileInfo(filePath: string): Promise<Record<string, any> | null> {
    if (!this.available) {
      return null;
    }

    try {
      // Only use /vsizip/ for zip files
      const input = filePath.toLowerCase().endsWith('.zip')
        ? this.createVirtualPath(filePath)
        : path.resolve(filePath);
      const result = await execAsync(`ogrinfo -so -al "${input}"`);

      // Parse ogrinfo output
      return this.parseOgrinfoOutput(result.stdout);
    } catch (error: any) {
      this.logger.warn(`ogrinfo failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse ogrinfo output
   */
  private parseOgrinfoOutput(output: string): Record<string, any> {
    const info: Record<string, any> = {
      layers: [],
      sourceCRS: undefined,
      bbox: undefined,
    };

    const lines = output.split('\n');
    let currentLayer: any = null;

    for (const line of lines) {
      // Layer name
      const layerMatch = line.match(/^(\d+):\s+(\w+)\s+\((\w+)\)/);
      if (layerMatch) {
        if (currentLayer) {
          info.layers.push(currentLayer);
        }
        currentLayer = {
          index: layerMatch[1],
          name: layerMatch[2],
          geometryType: layerMatch[3],
          fields: [],
        };
      }

      // SRS
      const srsMatch = line.match(/SRSWKT:\s+(.+)/);
      if (srsMatch) {
        info.sourceCRS = srsMatch[1];
      }

      // Bbox
      const bboxMatch = line.match(/^\((.+)\)/);
      if (bboxMatch && !line.includes('Extent')) {
        const coords = bboxMatch[1].split(',').map((c) => parseFloat(c.trim()));
        if (coords.length === 4 && coords.every((c) => !isNaN(c))) {
          info.bbox = coords as [number, number, number, number];
        }
      }

      // Fields
      const fieldMatch = line.match(/^\s+(\w+):\s+(\w+)/);
      if (fieldMatch && currentLayer) {
        currentLayer.fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
        });
      }
    }

    if (currentLayer) {
      info.layers.push(currentLayer);
    }

    return info;
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(tempPath: string): Promise<void> {
    try {
      const dir = path.dirname(tempPath);
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      this.logger.debug(`Cleanup failed for ${tempPath}: ${error}`);
    }
  }
}
