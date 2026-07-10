/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  _Object,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

/**
 * 将 sourceKey 映射到标准的 sourceName
 * 例如：aisstream → AISStream, fleetmon → FleetMon, openseamap → OpenSeaMap, aishub → AISHub
 */
function mapSourceKeyToName(sourceKey: string): string {
  const mapping: Record<string, string> = {
    'aisstream': 'AISStream',
    'fleetmon': 'FleetMon',
    'openseamap': 'OpenSeaMap',
    'aishub': 'AISHub',
    'mock': 'Mock',
  };
  return mapping[sourceKey.toLowerCase()] || sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1);
}

export interface UploadResult {
  key: string;
  etag?: string;
}

export interface DownloadResult {
  filePath: string;
  cleanup: () => Promise<void>;
  content?: string; // 直接返回文件内容（可选）
}

/**
 * AIS 快照元数据
 */
export interface AisSnapshotMeta {
  snapshotId: string;
  sourceName: string;
  externalId: string;
  tag: string;
  filePath: string;
  recordCount: number;
  fileSize: number;
  capturedAt: Date;
  status: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private s3Client: S3Client;
  private endpoint: string;
  private bucket: string;
  private initialized = false;
  private initPromise?: Promise<void>;

  async onModuleInit(): Promise<void> {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const endpoint = process.env.MINIO_ENDPOINT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;
    const region = process.env.MINIO_REGION || 'us-east-1';
    const usePathStyle = process.env.MINIO_USE_PATH_STYLE === 'true';
    this.bucket = process.env.MINIO_BUCKET || 'gis-uploads';
    this.endpoint = endpoint;

    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn('MinIO configuration missing, will use local storage fallback');
      return;
    }

    try {
      this.s3Client = new S3Client({
        endpoint,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        region,
        forcePathStyle: usePathStyle,
      });

      // Test connection (async, but don't block module initialization)
      this.initPromise = this.testConnection();
      await this.initPromise;
    } catch (error) {
      this.logger.warn(`MinIO initialization failed: ${error.message}, will use local storage fallback`);
      this.initialized = false;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.initialized = true;
      this.logger.log(`MinIO connected successfully: ${this.endpoint}/${this.bucket}`);
    } catch (error) {
      this.initialized = false;
      this.logger.warn(`MinIO bucket test failed: ${error.message}`);
    }
  }

  /**
   * Wait for initialization to complete
   */
  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate a storage key for the file
   * Organizes files by date for better management
   */
  generateStorageKey(originalName: string, datasetId?: string): string {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex');

    // Organize by date: uploads/2024/01/15/dataset-id/filename-timestamp-random.ext
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const safeDatasetId = datasetId ? `${datasetId}/` : '';
    // Keep Unicode characters (including Chinese) but replace unsafe characters
    const safeBaseName = baseName.replace(/[<>:"/\\|？*]/g, '_');

    const key = `uploads/${year}/${month}/${day}/${safeDatasetId}${safeBaseName}-${timestamp}-${randomStr}${ext}`;

    // Debug log: show original and processed names
    this.logger.debug(`generateStorageKey: originalName="${originalName}", baseName="${baseName}", safeBaseName="${safeBaseName}", key="${key}"`);

    return key;
  }

  /**
   * Upload a buffer to MinIO
   */
  async uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<UploadResult> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO service not initialized');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      const result = await this.s3Client.send(command);

      this.logger.log(`File uploaded to MinIO: ${key}`);

      return {
        key,
        etag: result.ETag?.replace(/"/g, ''),
      };
    } catch (error) {
      this.logger.error(`Failed to upload file to MinIO: ${key}`, error);
      throw new Error(`MinIO upload failed: ${error.message}`);
    }
  }

  /**
   * Upload a file (by local path) to MinIO via stream —— 适合大文件(GeoTIFF/COG),
   * 不把整个文件读进内存。
   */
  async uploadFileFromPath(
    key: string,
    filePath: string,
    contentType?: string,
  ): Promise<UploadResult> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO service not initialized');
    }

    try {
      const stat = await fs.stat(filePath);
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        ContentLength: stat.size,
      });
      const result = await this.s3Client.send(command);
      this.logger.log(`File uploaded to MinIO (stream): ${key} (${stat.size} bytes)`);
      return {
        key,
        etag: result.ETag?.replace(/"/g, ''),
      };
    } catch (error) {
      this.logger.error(`Failed to upload file (stream) to MinIO: ${key}`, error);
      throw new Error(`MinIO upload failed: ${error.message}`);
    }
  }

  /**
   * Download a file from MinIO to a temporary file
   * Returns the file path and a cleanup function
   */
  async downloadToTempFile(key: string): Promise<DownloadResult> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      // Create temp directory
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'minio-'));
      const ext = path.extname(key);
      const tempFileName = `download-${Date.now()}${ext}`;
      const filePath = path.join(tempDir, tempFileName);

      // 流式落盘(不把整文件读进内存——大文件 buffer+toString 会撞 V8 字符串上限)
      const body = response.Body as NodeJS.ReadableStream;
      const writeStream = createWriteStream(filePath);
      await new Promise<void>((resolve, reject) => {
        body.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        body.on('error', reject);
      });

      this.logger.log(`File downloaded from MinIO to temp: ${filePath}`);

      const cleanup = async () => {
        try {
          await fs.unlink(filePath);
          await fs.rmdir(tempDir);
          this.logger.debug(`Temp file cleaned up: ${filePath}`);
        } catch (error) {
          this.logger.warn(`Failed to cleanup temp file: ${filePath}`, error);
        }
      };

      return {
        filePath,
        cleanup,
      };
    } catch (error) {
      this.logger.error(`Failed to download file from MinIO: ${key}`, error);
      throw new Error(`MinIO download failed: ${error.message}`);
    }
  }

  /**
   * 读取对象为内存 Buffer（供图片下载代理用；仅适合小文件如要素图片，
   * 大文件请用 downloadToTempFile 流式落盘避免撑爆内存）。
   */
  async getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO service not initialized');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      this.logger.debug(`File read into buffer from MinIO: ${key} (${buffer.length} bytes)`);

      return {
        buffer,
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch (error) {
      this.logger.error(`Failed to read file from MinIO: ${key}`, error);
      throw new Error(`MinIO read failed: ${error.message}`);
    }
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(key: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO service not initialized');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted from MinIO: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from MinIO: ${key}`, error);
      throw new Error(`MinIO delete failed: ${error.message}`);
    }
  }

  /**
   * Check if a key looks like a MinIO storage key
   */
  isMinioKey(key: string): boolean {
    return key.startsWith('uploads/') && !key.startsWith('./') && !key.startsWith('/');
  }

  /**
   * 保存 AIS 原始快照到 MinIO
   *
   * @param sourceName 数据源名称（如 AISStream）
   * @param data 原始 JSON 数据 Buffer
   * @param metadata 快照元数据
   * @returns 对象 key
   */
  async saveAisSnapshot(
    sourceName: string,
    data: Buffer,
    metadata: {
      timestamp: Date;
      recordCount: number;
    },
  ): Promise<string> {
    await this.ensureInitialized();

    if (!this.initialized) {
      this.logger.warn('MinIO 未初始化，跳过 AIS 原始快照保存');
      return null;
    }

    const sourceKey = sourceName.toLowerCase();
    const date = metadata.timestamp;
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // 生成 snapshotId 作为文件名一部分
    const snapshotId = crypto.randomUUID();

    // 对象 key 格式：ais-raw/{sourceKey}/{YYYY-MM-DD}/{timestamp}-{snapshotId}.json
    // timestamp 使用 ISO 格式避免解析问题
    const timestampStr = date.toISOString().replace(/[:.]/g, '-');
    const key = `ais-raw/${sourceKey}/${year}-${month}-${day}/${timestampStr}-${snapshotId}.json`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      this.logger.log(`AIS 原始快照已保存到 MinIO: ${key}`);

      return key;
    } catch (error) {
      this.logger.error(`保存 AIS 原始快照失败：${key}`, error);
      throw new Error(`MinIO 保存 AIS 快照失败：${error.message}`);
    }
  }

  /**
   * 列出指定数据源和日期的快照
   *
   * @param sourceName 数据源名称
   * @param date 日期（YYYY-MM-DD）
   * @returns 快照元数据列表
   */
  async listAisSnapshots(
    sourceName?: string,
    date?: string,
  ): Promise<AisSnapshotMeta[]> {
    await this.ensureInitialized();

    if (!this.initialized) {
      this.logger.warn('MinIO 未初始化，无法列出快照');
      return [];
    }

    try {
      // 构建 prefix：ais-raw/{sourceKey}/{date}/
      let prefix = 'ais-raw/';
      if (sourceName) {
        prefix += `${sourceName.toLowerCase()}/`;
        if (date) {
          prefix += `${date}/`;
        }
      }

      this.logger.debug(`列出 AIS 快照，prefix="${prefix}"`);

      const snapshots: AisSnapshotMeta[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });

        const response = await this.s3Client.send(command);

        for (const obj of response.Contents || []) {
          // 从 key 解析元数据
          // key 格式：ais-raw/{sourceKey}/{YYYY-MM-DD}/{timestamp}-{snapshotId}.json
          const key = obj.Key!;
          const keyParts = key.split('/');
          if (keyParts.length < 4) continue;

          const parsedSourceKey = keyParts[1];
          const parsedDate = keyParts[2];
          const fileName = keyParts[3];

          // 解析时间戳和 snapshotId
          // fileName 格式：{timestampStr}-{snapshotId}.json
          // timestampStr = 2024-01-15T10-30-45-123Z（ISO 格式，:和.被替换为-）
          // snapshotId = UUID 格式（xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）
          // 使用正则表达式匹配：时间戳部分以 Z 结尾，后跟 UUID
          const match = fileName.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-([a-f0-9-]+)\.json$/);
          if (!match) {
            this.logger.warn(`无法解析文件名：${fileName}`);
            continue;
          }

          const timestampStr = match[1];
          // snapshotId = match[2]; // 暂不需要

          // 将时间戳字符串转回 ISO 格式（替换回标准格式）
          const isoStr = timestampStr.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, '$1T$2:$3:$4.$5Z');
          const capturedAt = new Date(isoStr);

          // 修复 sourceName 大小写：aisstream → AISStream, fleetmon → FleetMon, openseamap → OpenSeaMap, aishub → AISHub
          const sourceName = mapSourceKeyToName(parsedSourceKey);

          snapshots.push({
            snapshotId: '', // 需要关联数据库查询
            sourceName,
            externalId: `global-ais-${parsedSourceKey}`,
            tag: `source:${parsedSourceKey}`,
            filePath: key,
            recordCount: 0, // 需要关联数据库查询
            fileSize: obj.Size || 0,
            capturedAt,
            status: 'SUCCESS', // MinIO 中存在即表示成功
          });
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);

      // 按时间倒序排序
      snapshots.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

      this.logger.log(`找到 ${snapshots.length} 个 AIS 快照`);
      return snapshots;
    } catch (error) {
      this.logger.error(`列出 AIS 快照失败：${error.message}`, error);
      return [];
    }
  }

  /**
   * 下载指定快照
   *
   * @param snapshotId DatasetVersion.id
   * @param filePath 快照对象 key
   * @returns 下载结果
   */
  async downloadAisSnapshot(snapshotId: string, filePath: string): Promise<DownloadResult> {
    await this.ensureInitialized();

    if (!this.initialized) {
      throw new Error('MinIO 服务未初始化');
    }

    return this.downloadToTempFile(filePath);
  }
}
