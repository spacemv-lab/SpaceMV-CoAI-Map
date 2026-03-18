/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  Logger,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { DatasetService } from './dataset.service';
import { GisParseService } from '../services/gis-parse.service';
import { ValidationService } from '../services/validation.service';
import { MinioService } from '../services/minio.service';

const ALLOWED_EXTENSIONS = ['.geojson', '.json', '.zip', '.csv', '.xls', '.xlsx', '.kml', '.kmz'];

@Controller('datasets')
export class DatasetController {
  private readonly logger = new Logger(DatasetController.name);

  constructor(
    private readonly datasetService: DatasetService,
    private readonly gisParseService: GisParseService,
    private readonly validationService: ValidationService,
    private readonly minioService: MinioService,
  ) {}

  // ============================================
  // Project Management
  // ============================================

  @Post('project')
  async createProject(
    @Body() body: { name: string; description?: string; ownerId: string },
  ) {
    return this.datasetService.createProject({
      name: body.name,
      description: body.description,
      ownerId: body.ownerId,
    });
  }

  // ============================================
  // Dataset CRUD
  // ============================================

  @Get()
  async listDatasets(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('projectId') projectId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } },
      ];
    }

    return this.datasetService.listDatasets({
      skip: skip || 0,
      take: take || 10,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async getDataset(@Param('id') id: string) {
    const dataset = await this.datasetService.getDataset(id);
    if (!dataset) {
      throw new NotFoundException(`Dataset with ID ${id} not found`);
    }
    return dataset;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return await this.datasetService.deleteDataset(id);
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Dataset with ID ${id} not found`);
      }
      throw error;
    }
  }

  // ============================================
  // File Upload
  // ============================================

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @Body('name') name?: string,
    @Body('tags') tags?: string[],
    @Body('description') description?: string,
    @Body('targetCRS') targetCRS?: string,
    @Body('mappingProfileId') mappingProfileId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Fix Chinese filename encoding issue
    // Multer uses Latin-1 encoding by default, so UTF-8 Chinese characters get mangled
    // We need to re-interpret the Latin-1 bytes as UTF-8
    let originalName = file.originalname;
    try {
      // Convert the mangled string back to bytes, then interpret as UTF-8
      const latin1Bytes = Buffer.from(originalName, 'latin1');
      originalName = latin1Bytes.toString('utf8');
      this.logger.log(`[FILENAME FIX] original="${file.originalname}" -> fixed="${originalName}"`);
    } catch (e) {
      this.logger.warn(`Failed to fix filename encoding: ${e.message}`);
    }

    // Validate file extension
    const ext = extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `Unsupported file format. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // 从 DATABASE_URL 提取数据库信息用于日志
    // 格式：postgresql://user:password@host:port/database?options
    const databaseUrl = process.env.DATABASE_URL || 'not set';
    const urlPattern = /postgresql:\/\/[^@]+@([^:/]+):(\d+)\/([^?]+)/;
    const dbMatch = databaseUrl.match(urlPattern);
    const dbHost = dbMatch ? dbMatch[1] : 'unknown';
    const dbPort = dbMatch ? dbMatch[2] : '5432';
    const dbName = dbMatch ? dbMatch[3] : 'unknown';

    try {
      this.logger.log(`Received file upload: ${originalName} for project ${projectId}`);
      this.logger.log(`Data will be stored to PostgreSQL at ${dbHost}:${dbPort}/${dbName}`);

      // Find or create dataset
      let dataset = await this.datasetService.listDatasets({
        where: { projectId, name: name || originalName },
      }).then(r => r.items[0]);

      if (!dataset) {
        // Ensure project exists
        let project = await this.datasetService.getProject(projectId);
        if (!project) {
          project = await this.datasetService.createProject({
            id: projectId,
            name: 'Default Project',
            ownerId: 'system',
            description: 'Auto-created default project',
          });
        }

        // Create new dataset
        const newDataset = await this.datasetService.createDataset({
          projectId,
          name: name || originalName,
          description: description,
          tags,
        });

        // Fetch full dataset with relations
        dataset = await this.datasetService.getDataset(newDataset.id);
      }

      // Upload to MinIO or use local storage fallback
      let storageKey: string;

      if (this.minioService.isInitialized()) {
        // Upload to MinIO
        this.logger.log(`[DEBUG] Received file: originalname="${file.originalname}", fixed="${originalName}", buffer.length=${file.buffer.length}`);
        const key = this.minioService.generateStorageKey(originalName, dataset.id);
        this.logger.log(`[DEBUG] Generated key: ${key}`);
        await this.minioService.uploadFile(key, file.buffer, file.mimetype);
        storageKey = key;
        this.logger.log(`File uploaded to MinIO: ${storageKey}`);
      } else {
        // Fallback to local storage
        const fs = await import('fs/promises');
        const localPath = `./uploads/${Date.now()}-${file.originalname}`;
        await fs.mkdir('./uploads', { recursive: true });
        await fs.writeFile(localPath, file.buffer);
        storageKey = localPath;
        this.logger.log(`File saved to local storage: ${storageKey}`);
      }

      // Create version record
      const version = await this.datasetService.createVersion({
        datasetId: dataset.id,
        filePath: storageKey,
        fileSize: file.size,
        uploadedBy: 'system',
        mappingProfileId,
      });

      // Start async ingest job
      const ingestResult = await this.gisParseService.startIngest(
        version.id,
        dataset.id,
        storageKey,
        ext,
        {
          targetCRS,
          validateGeometry: true,
          repairGeometry: true,
        },
      );

      return {
        datasetId: dataset.id,
        versionId: version.id,
        jobId: ingestResult.jobId,
        status: ingestResult.status,
        message: 'Upload received. Processing started.',
      };
    } catch (error) {
      this.logger.error('Upload failed', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  // ============================================
  // GeoJSON Export
  // ============================================

  @Get(':id/geojson')
  async getGeoJSON(@Param('id') id: string) {
    const geoJSON = await this.datasetService.getDatasetGeoJSON(id);
    if (!geoJSON || geoJSON.features.length === 0) {
      throw new NotFoundException(`GeoJSON for Dataset with ID ${id} not found or empty`);
    }
    return geoJSON;
  }

  @Get('versions/:versionId/geojson')
  async getVersionGeoJSON(@Param('versionId') versionId: string) {
    const geoJSON = await this.datasetService.getVersionGeoJSON(versionId);
    return geoJSON;
  }

  // ============================================
  // MVT Tiles
  // ============================================

  @Get(':id/mvt/:z/:x/:y')
  async getMVT(
    @Param('id') id: string,
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
  ) {
    const dataset = await this.datasetService.getDataset(id);
    if (!dataset || !dataset.currentVersionId) {
      throw new NotFoundException(`Dataset ${id} not found or has no version`);
    }

    const mvtBuffer = await this.datasetService.getMVT(dataset.currentVersionId, z, x, y);
    if (!mvtBuffer) {
      throw new NotFoundException('No tile data available');
    }

    return mvtBuffer;
  }

  // ============================================
  // Version Status
  // ============================================

  @Get('versions/:versionId/status')
  async getVersionStatus(@Param('versionId') versionId: string) {
    const status = await this.gisParseService.getIngestStatus(versionId);
    if (!status) {
      throw new NotFoundException(`Version ${versionId} not found`);
    }
    return status;
  }

  // ============================================
  // Validation Report
  // ============================================

  @Get('versions/:versionId/report')
  async getValidationReport(@Param('versionId') versionId: string) {
    const report = await this.validationService.getValidationReport(versionId);
    if (!report) {
      throw new NotFoundException(`Validation report for version ${versionId} not found`);
    }
    return report;
  }
}
