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

type GdalBackend = 'local' | 'docker' | 'wsl-docker' | 'none';

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface DockerMount {
  hostPath: string;
  containerPath: string;
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
  private backend: GdalBackend = 'none';
  private readonly mode =
    (process.env.GDAL_MODE || 'auto').trim().toLowerCase();
  private readonly dockerImage =
    process.env.GDAL_DOCKER_IMAGE?.trim() ||
    'osgeo/gdal:ubuntu-small-latest';
  private readonly dockerUseWsl =
    process.env.GDAL_DOCKER_USE_WSL === 'true';
  private readonly wslDistro =
    process.env.GDAL_WSL_DISTRO?.trim() || 'Ubuntu';
  private readonly wslUser =
    process.env.GDAL_WSL_USER?.trim() || '';
  private readonly localOgr2ogrPath =
    process.env.GDAL_OGR2OGR_PATH?.trim() || '';
  private readonly localOgrinfoPath =
    process.env.GDAL_OGRINFO_PATH?.trim() || '';
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
   * Check if GDAL is available
   */
  private async checkAvailability(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    if (this.mode === 'local') {
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
        'GDAL local mode requires GDAL_OGR2OGR_PATH and GDAL_OGRINFO_PATH to be configured',
      );
      return false;
    }

    if (this.mode === 'docker') {
      const dockerVersion = await this.detectDockerGdal();
      if (dockerVersion) {
        this.backend = this.dockerUseWsl ? 'wsl-docker' : 'docker';
        this.available = true;
        this.versionInfo = dockerVersion;
        this.logger.log(
          `GDAL available via ${this.dockerUseWsl ? 'WSL Docker' : 'Docker'} image ${this.dockerImage}: ${dockerVersion.version} (${dockerVersion.releaseDate})`,
        );
        return true;
      }

      this.backend = 'none';
      this.available = false;
      this.logger.warn(
        'GDAL docker mode is configured but the Docker image is not available',
      );
      return false;
    }

    this.backend = 'none';
    this.available = false;
    this.logger.warn(
      `Unsupported GDAL_MODE "${this.mode}". Use "docker" or "local".`,
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
      let result: CommandResult;
      if (this.backend === 'docker' || this.backend === 'wsl-docker') {
        result = await this.runDockerTool('ogr2ogr', args, []);
      } else {
        result = await this.runCommand(this.localOgr2ogrPath, args);
      }

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
    if (options?.targetCRS) {
      args.push('-t_srs', options.targetCRS);
    } else {
      args.push('-t_srs', 'EPSG:4326');
    }

    // Output format
    args.push('-f', 'GeoJSON');

    // Output file
    const output = outputPath || (await this.createTempFile('.geojson'));

    // Input file - support virtual paths
    // Only use /vsizip/ for zip files, otherwise use the path directly
    let input: string;
    const outputResolved = path.resolve(output);

    if (this.backend === 'docker' || this.backend === 'wsl-docker') {
      const dockerPaths = this.buildDockerPathContext([
        path.resolve(inputPath),
        outputResolved,
      ]);
      const containerInputPath = dockerPaths.toContainerPath(path.resolve(inputPath));
      input = inputPath.toLowerCase().endsWith('.zip')
        ? this.createVirtualPath(containerInputPath, 'zip')
        : containerInputPath;
      args.push(dockerPaths.toContainerPath(outputResolved));
      args.push(input);

      if (options?.layerName) {
        args.push('-nln', options.layerName);
      }

      if (options?.encoding) {
        args.push('-oo', `ENCODING=${options.encoding}`);
      }

      return this.executeDockerOgr2ogr(args, dockerPaths.mounts);
    }

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
      let output: string;
      if (this.backend === 'docker' || this.backend === 'wsl-docker') {
        const dockerPaths = this.buildDockerPathContext([path.resolve(filePath)]);
        const containerInputPath = dockerPaths.toContainerPath(path.resolve(filePath));
        const input = filePath.toLowerCase().endsWith('.zip')
          ? this.createVirtualPath(containerInputPath)
          : containerInputPath;
        const result = await this.runDockerTool(
          'ogrinfo',
          ['-so', '-al', input],
          dockerPaths.mounts,
        );
        if (result.code !== 0) {
          throw new Error(result.stderr || result.stdout || 'ogrinfo failed');
        }
        output = result.stdout;
      } else {
        const input = filePath.toLowerCase().endsWith('.zip')
          ? this.createVirtualPath(filePath)
          : path.resolve(filePath);
        const result = await this.runCommand(this.localOgrinfoPath, ['-so', '-al', input]);
        if (result.code !== 0) {
          throw new Error(result.stderr || result.stdout || 'ogrinfo failed');
        }
        output = result.stdout;
      }

      // Parse ogrinfo output
      return this.parseOgrinfoOutput(output);
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
    if (!this.localOgr2ogrPath || !this.localOgrinfoPath) {
      return null;
    }

    try {
      const result = await this.runCommand(
        this.localOgr2ogrPath,
        ['--version'],
        10000,
      );
      if (result.code !== 0) {
        return null;
      }
      return this.parseVersionInfo(result.stdout.trim());
    } catch {
      return null;
    }
  }

  private async detectDockerGdal(): Promise<GdalVersion | null> {
    try {
      const result = await this.runDockerTool(
        'ogr2ogr',
        ['--version'],
        [],
        30000,
      );
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

  private async executeDockerOgr2ogr(
    args: string[],
    mounts: DockerMount[],
  ): Promise<GdalResult> {
    try {
      const result = await this.runDockerTool(
        'ogr2ogr',
        args,
        mounts,
      );

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

  private buildDockerPathContext(filePaths: string[]): {
    mounts: DockerMount[];
    toContainerPath: (hostPath: string) => string;
  } {
    const dirMap = new Map<string, string>();
    const mounts: DockerMount[] = [];

    for (const filePath of filePaths) {
      const resolved = path.resolve(filePath);
      const hostDir = path.dirname(resolved);
      if (dirMap.has(hostDir)) {
        continue;
      }

      const containerPath = `/gdal/vol${mounts.length}`;
      dirMap.set(hostDir, containerPath);
      mounts.push({
        hostPath: hostDir,
        containerPath,
      });
    }

    return {
      mounts,
      toContainerPath: (hostPath: string) => {
        const resolved = path.resolve(hostPath);
        const hostDir = path.dirname(resolved);
        const containerDir = dirMap.get(hostDir);
        if (!containerDir) {
          throw new Error(`No Docker mount found for ${resolved}`);
        }
        return path.posix.join(
          containerDir,
          path.basename(resolved).replace(/\\/g, '/'),
        );
      },
    };
  }

  private async runDockerTool(
    tool: 'ogr2ogr' | 'ogrinfo',
    toolArgs: string[],
    mounts: DockerMount[],
    timeoutMs = this.commandTimeoutMs,
  ): Promise<CommandResult> {
    const dockerArgs = ['run', '--rm'];
    for (const mount of mounts) {
      const hostPath = this.dockerUseWsl
        ? this.convertWindowsPathToWsl(mount.hostPath)
        : mount.hostPath;
      dockerArgs.push('-v', `${hostPath}:${mount.containerPath}`);
    }
    dockerArgs.push('--entrypoint', tool, this.dockerImage, ...toolArgs);

    if (this.dockerUseWsl) {
      const wslArgs = ['-d', this.wslDistro];
      if (this.wslUser) {
        wslArgs.push('-u', this.wslUser);
      }
      wslArgs.push('--', 'docker', ...dockerArgs);
      return this.runCommand('wsl.exe', wslArgs, timeoutMs);
    }

    return this.runCommand('docker', dockerArgs, timeoutMs);
  }

  private convertWindowsPathToWsl(inputPath: string): string {
    if (!/^[a-zA-Z]:\\/.test(inputPath)) {
      return inputPath.replace(/\\/g, '/');
    }

    const drive = inputPath[0].toLowerCase();
    const normalizedPath = inputPath
      .slice(2)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    return `/mnt/${drive}/${normalizedPath}`;
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
