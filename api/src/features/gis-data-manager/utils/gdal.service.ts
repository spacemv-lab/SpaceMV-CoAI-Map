/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Supported encodings for shapefile DBF attributes
 * These are common Chinese and standard encodings used in GIS data
 */
export const SUPPORTED_ENCODINGS = ['GBK', 'GB18030', 'BIG5', 'UTF-8'] as const;
export type SupportedEncoding = (typeof SUPPORTED_ENCODINGS)[number];

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
 * GDAL 后端类型。api 镜像(map-ai-api.Dockerfile)已 `apt install gdal-bin`,
 * 容器内自带 ogr2ogr/ogrinfo/gdal_translate,统一走 local。
 *
 * 历史:曾有 'docker'/'wsl-docker'(api 派生 WSL docker 容器跑 GDAL),但 api
 * 永远跑在自带 GDAL 的镜像里、且容器内无 docker socket / wsl.exe,那条路径从未
 * 生效——为消除歧义已移除,仅保留 local。
 */
export type GdalBackend = 'local' | 'none';

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * GDAL service for ogr2ogr / ogrinfo operations (容器内本地 CLI)
 */
@Injectable()
export class GdalService {
  private readonly logger = new Logger(GdalService.name);
  private available: boolean | null = null;
  private versionInfo?: GdalVersion;
  private initPromise?: Promise<boolean>;
  private backend: GdalBackend = 'none';
  private readonly commandTimeoutMs = Number(
    process.env.GDAL_COMMAND_TIMEOUT_MS || 120000,
  );

  /**
   * Initialize and check GDAL availability
   */
  async onModuleInit() {
    await this.cleanupStaleTempFiles();
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

  getBackend(): GdalBackend {
    return this.backend;
  }

  /**
   * Check if GDAL is available (容器内本地 ogr2ogr 须在 PATH)
   */
  private async checkAvailability(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    const localVersion = await this.detectLocalGdal();
    if (localVersion) {
      this.backend = 'local';
      this.available = true;
      this.versionInfo = localVersion;
      this.logger.log(
        `GDAL available locally: ${localVersion.version} (${localVersion.releaseDate})`,
      );
      return true;
    }

    this.backend = 'none';
    this.available = false;
    this.logger.warn(
      'GDAL not available: ogr2ogr not found in PATH (api 镜像须 apt install gdal-bin)',
    );
    return false;
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
    const absolutePath = filePath.startsWith('/')
      ? path.posix.normalize(filePath)
      : path.resolve(filePath).replace(/\\/g, '/');
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
    await this.ensureInitialized();

    if (!this.available) {
      return {
        success: false,
        error: 'GDAL not available',
      };
    }

    try {
      const result = await this.runCommand('ogr2ogr', args);

      if (result.code !== 0) {
        this.logger.error(`ogr2ogr failed: ${result.stderr || result.stdout}`);
        return {
          success: false,
          error: result.stderr || result.stdout || 'Unknown error',
        };
      }

      return {
        success: true,
        output: result.stdout,
      };
    } catch (error: any) {
      this.logger.error(`ogr2ogr failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * 把栅格(GeoTIFF)转成 COG(Cloud Optimized GeoTIFF),重投影到 EPSG:3857。
   *
   * 两步(本镜像的 gdal_translate 不支持 -t_srs,重投影必须走 gdalwarp):
   *   1) gdalwarp -t_srs EPSG:3857  input → reproj(临时)
   *   2) gdal_translate -of COG      reproj → output(保留原始波段 + 位深,COG 自动瓦片化 + 金字塔)
   * 真彩色 / 波段选择 / 拉伸交给 TiTiler 出瓦片时的 bidx + rescale(processCog 算 rescale)。
   * reproj 临时文件由本方法内部创建/清理,调用方只感知 input/output。
   */
  async translateToCog(
    inputPath: string,
    outputPath: string,
    options?: { targetCRS?: string; compress?: string },
  ): Promise<GdalResult> {
    await this.ensureInitialized();

    if (!this.available) {
      return {
        success: false,
        error: 'GDAL not available',
      };
    }

    const targetCRS = options?.targetCRS ?? 'EPSG:3857';
    const compress = options?.compress ?? 'DEFLATE';
    const reprojPath = await this.createTempFile('.reproj.tif', 'cog-');

    try {
      // 1) gdalwarp 重投影
      const warp = await this.runCommand('gdalwarp', [
        '-t_srs', targetCRS,
        inputPath,
        reprojPath,
      ], 1800000); // 大 tif 重投影放宽到 30 分钟(默认 GDAL_COMMAND_TIMEOUT_MS=2 分钟不够)
      if (warp.code !== 0) {
        this.logger.error(`gdalwarp failed: ${warp.stderr || warp.stdout}`);
        return {
          success: false,
          error: `gdalwarp: ${warp.stderr || warp.stdout || 'failed'}`,
        };
      }

      // 2) gdal_translate 转 COG(保留原始波段+位深;真彩色/波段/拉伸交给 TiTiler bidx+rescale)
      const cog = await this.runCommand('gdal_translate', [
        '-of', 'COG',
        '-co', `COMPRESS=${compress}`,
        '-co', 'BIGTIFF=IF_SAFER',
        reprojPath,
        outputPath,
      ], 1800000); // COG 转码(建金字塔)同样放宽
      if (cog.code !== 0) {
        this.logger.error(`gdal_translate COG failed: ${cog.stderr || cog.stdout}`);
        return {
          success: false,
          error: `gdal_translate: ${cog.stderr || cog.stdout || 'failed'}`,
        };
      }

      return {
        success: true,
        output: cog.stdout,
      };
    } catch (error: any) {
      this.logger.error(`translateToCog failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    } finally {
      await this.cleanup(reprojPath).catch(() => {});
    }
  }

  /**
   * Validate encoding parameter against supported list
   */
  isValidEncoding(encoding: string): boolean {
    return SUPPORTED_ENCODINGS.includes(encoding.toUpperCase() as SupportedEncoding);
  }

  /**
   * Get list of supported encodings
   */
  getSupportedEncodings(): readonly string[] {
    return SUPPORTED_ENCODINGS;
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
    args.push('-t_srs', options?.targetCRS ?? 'EPSG:4326');

    // Output format
    args.push('-f', 'GeoJSON');

    // Output file
    const output = outputPath || (await this.createTempFile('.geojson'));

    // Input file - support virtual paths
    let input: string;
    const outputResolved = path.resolve(output);

    if (inputPath.startsWith('/vsi')) {
      input = inputPath;
    } else if (inputPath.toLowerCase().endsWith('.zip')) {
      input = this.createVirtualPath(inputPath, 'zip');
    } else {
      input = path.resolve(inputPath);
    }
    args.push(outputResolved);
    args.push(input);

    // Optional layer name
    if (options?.layerName) {
      args.push('-nln', options.layerName);
    }

    // Encoding option for shapefile DBF attributes
    // Pass as -oo ENCODING=<value> (open option for input driver)
    if (options?.encoding) {
      args.push('-oo', `ENCODING=${options.encoding}`);
    }

    return this.executeOgr2ogr(args);
  }

  /**
   * Get file metadata/information
   */
  async getFileInfo(filePath: string): Promise<Record<string, any> | null> {
    await this.ensureInitialized();

    if (!this.available) {
      return null;
    }

    try {
      const input = filePath.toLowerCase().endsWith('.zip')
        ? this.createVirtualPath(filePath)
        : path.resolve(filePath);
      const result = await this.runCommand('ogrinfo', ['-so', '-al', input]);
      if (result.code !== 0) {
        throw new Error(result.stderr || result.stdout || 'ogrinfo failed');
      }
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

  private async detectLocalGdal(): Promise<GdalVersion | null> {
    try {
      const result = await this.runCommand('ogr2ogr', ['--version'], 10000);
      if (result.code !== 0) {
        return null;
      }
      return this.parseVersionInfo(result.stdout.trim());
    } catch {
      return null;
    }
  }

  private parseVersionInfo(versionOutput: string): GdalVersion | null {
    const match = versionOutput.match(/GDAL ([\d.]+), released (.+)/);
    if (!match) {
      return null;
    }

    return {
      version: match[1],
      releaseDate: match[2],
    };
  }

  private runCommand(
    command: string,
    args: string[],
    timeoutMs = this.commandTimeoutMs,
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill();
        reject(
          new Error(
            `${command} timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve({
          code: code ?? 1,
          stdout,
          stderr,
        });
      });
    });
  }
}
