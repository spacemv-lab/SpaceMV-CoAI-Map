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
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadResult {
  key: string;
  etag?: string;
}

export interface DownloadResult {
  filePath: string;
  cleanup: () => Promise<void>;
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
      const tempDir = await fs.mkdtemp('/tmp/minio-');
      const ext = path.extname(key);
      const tempFileName = `download-${Date.now()}${ext}`;
      const filePath = path.join(tempDir, tempFileName);

      // Stream to file
      const stream = response.Body as any;
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);

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

      return { filePath, cleanup };
    } catch (error) {
      this.logger.error(`Failed to download file from MinIO: ${key}`, error);
      throw new Error(`MinIO download failed: ${error.message}`);
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
}
