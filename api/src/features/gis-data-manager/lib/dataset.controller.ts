/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { DatasetScope } from '@prisma/client';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  Header,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { DatasetService } from './dataset.service';
import { GisParseService } from '../services/gis-parse.service';
import { ValidationService } from '../services/validation.service';
import { MinioService } from '../services/minio.service';
import { FieldStatsService } from './field-stats.service';
import { FieldStatsRequest } from '../dto/field-stats.dto';
import { CreateDatasetRequest } from '../dto/create-dataset.dto';
import { UpdateDatasetDto } from '../dto/dataset.dto';
import { success } from './api-response';
import { SkipAuth } from './skip-auth.decorator';

const ALLOWED_EXTENSIONS = ['.geojson', '.json', '.zip', '.csv', '.xls', '.xlsx', '.kml', '.kmz'];

@Controller('datasets')
export class DatasetController {
  private readonly logger = new Logger(DatasetController.name);

  constructor(
    private readonly datasetService: DatasetService,
    private readonly gisParseService: GisParseService,
    private readonly validationService: ValidationService,
    private readonly minioService: MinioService,
    private readonly fieldStatsService: FieldStatsService,
  ) {}

  // ============================================
  // Project Management
  // ============================================

  @Post('project')
  async createProject(
    @Body() body: { name: string; description?: string; ownerId: string },
  ) {
    return success(await this.datasetService.createProject({
      name: body.name,
      description: body.description,
      ownerId: body.ownerId,
    }));
  }

  // ============================================
  // Dataset CRUD
  // ============================================

  @Get()
  @SkipAuth() // TODO: Remove in production - for development testing
  async listDatasets(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('projectId') projectId?: string,
    @Query('scope') scope?: DatasetScope,
    @Query('keyword') keyword?: string,
  ) {
    const where: any = {};

    // scope 优先：如果指定 scope，按 scope 过滤
    if (scope === 'GLOBAL') {
      where.scope = 'GLOBAL';
      where.projectId = null;
    } else if (scope === 'PROJECT') {
      where.scope = 'PROJECT';
      if (projectId) where.projectId = projectId;
    } else {
      // 没有 scope 参数时，按原有逻辑
      if (projectId) where.projectId = projectId;
    }

    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { tags: { has: keyword } },
      ];
    }

    return success(await this.datasetService.listDatasets({
      skip: skip || 0,
      take: take || 100,
      where,
      orderBy: { createdAt: 'desc' },
    }));
  }

  @Get(':id')
  @SkipAuth() // TODO: Remove in production - for development testing
  async getDataset(@Param('id') id: string) {
    const dataset = await this.datasetService.getDataset(id);
    if (!dataset) {
      throw new NotFoundException(`Dataset with ID ${id} not found`);
    }
    return success(dataset);
  }

  @Post()
  @SkipAuth() // TODO: Remove in production - for development testing
  async createDataset(@Body() body: CreateDatasetRequest) {
    this.logger.log(`Creating dataset: ${body.name} with ${body.features.length} features`);

    const dataset = await this.datasetService.createDatasetWithFeatures({
      projectId: body.projectId,
      name: body.name,
      geometryType: body.geometryType,
      style: body.style as Record<string, unknown>,
      features: body.features.map((f) => ({
        id: f.id,
        geometry: f.geometry,
        properties: f.properties,
      })),
    });

    return success(dataset);
  }

  @Put(':id')
  @SkipAuth() // TODO: Remove in production - for development testing
  async updateDataset(
    @Param('id') id: string,
    @Body() body: UpdateDatasetDto,
  ) {
    this.logger.log(`Updating dataset ${id}: name=${body.name}`);
    const dataset = await this.datasetService.updateDataset(id, body);
    return success(dataset);
  }

  // ============================================
  // Features List (for Attribute Table)
  // ============================================

  @Get(':id/features')
  async listFeatures(
    @Param('id') id: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('search') search?: string,
  ) {
    const result = await this.datasetService.listFeatures(id, {
      page: page || 1,
      pageSize: pageSize || 50,
      search,
    });
    return success(result);
  }

  /** 往已有数据集当前版本新增单个要素（绘制入已保存图层） */
  @Post(':id/features')
  async createFeature(
    @Param('id') id: string,
    @Body() body: {
      geometry: Record<string, unknown>;
      properties?: Record<string, unknown>;
      id?: string;
    },
  ) {
    const result = await this.datasetService.createFeature(id, body);
    return success(result);
  }

  // ============================================
  // Field Statistics (for Graduated Colors)
  // ============================================

  @Post(':id/field-stats')
  async getFieldStats(
    @Param('id') id: string,
    @Body() body: FieldStatsRequest,
  ) {
    try {
      const stats = await this.fieldStatsService.computeFieldStats(id, body);
      return success(stats);
    } catch (error) {
      this.logger.error(`Field stats failed for dataset ${id}:`, error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      return success(await this.datasetService.deleteDataset(id));
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
    @Body('projectId') projectId?: string, // 改为可选
    @Body('scope') scope?: DatasetScope, // 新增 scope 参数
    @Body('name') name?: string,
    @Body('tags') tags?: string[],
    @Body('description') description?: string,
    @Body('targetCRS') targetCRS?: string,
    @Body('mappingProfileId') mappingProfileId?: string,
    @Body('encoding') encoding?: string,
    // 表格列指认（csv/xls/xlsx）：表头行 / 工作表 / 经纬度列 / wkt 列
    @Body('headerRow') headerRow?: string,
    @Body('sheet') sheet?: string,
    @Body('latitudeColumn') latitudeColumn?: string,
    @Body('longitudeColumn') longitudeColumn?: string,
    @Body('geometryColumn') geometryColumn?: string,
    @Body('wktColumn') wktColumn?: string,
  ) {
    this.logger.log(`[UPLOAD] encoding parameter received: ${encoding || 'none'}`);
    this.logger.log(`[UPLOAD] scope parameter received: ${scope || 'none'}`);
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // 确定 scope
    const datasetScope: DatasetScope = scope === 'GLOBAL' ? 'GLOBAL' : 'PROJECT';

    // 全局数据不需要 projectId
    if (datasetScope === 'GLOBAL') {
      projectId = undefined;
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
      this.logger.log(`Received file upload: ${originalName} with scope ${datasetScope}${projectId ? ` for project ${projectId}` : ' (global)'}`);
      this.logger.log(`Data will be stored to PostgreSQL at ${dbHost}:${dbPort}/${dbName}`);

      // Build query conditions based on scope
      const queryConditions: any = {
        name: name || originalName,
      };
      if (datasetScope === 'GLOBAL') {
        queryConditions.scope = 'GLOBAL';
        queryConditions.projectId = null;
      } else {
        queryConditions.scope = 'PROJECT';
        if (projectId) queryConditions.projectId = projectId;
      }

      // Find or create dataset
      let dataset = await this.datasetService.listDatasets({
        where: queryConditions,
      }).then(r => r.items[0]);

      if (!dataset) {
        // For PROJECT scope, ensure project exists
        if (datasetScope === 'PROJECT' && projectId) {
          let project = await this.datasetService.getProject(projectId);
          if (!project) {
            project = await this.datasetService.createProject({
              id: projectId,
              name: 'Default Project',
              ownerId: 'system',
              description: 'Auto-created default project',
            });
          }
        }

        // Create new dataset with scope
        const newDataset = await this.datasetService.createDataset({
          projectId: datasetScope === 'GLOBAL' ? undefined : projectId,
          scope: datasetScope,
          name: name || originalName,
          description: description,
          tags,
        });

        // Fetch full dataset with relations
        dataset = await this.datasetService.getDataset(newDataset.id);
        if (!dataset) {
          throw new Error(`Failed to load dataset ${newDataset.id} after creation`);
        }
      }

      // Upload to MinIO or use local storage fallback
      let storageKey: string;

      if (this.minioService.isInitialized()) {
        // Upload to MinIO
        const key = this.minioService.generateStorageKey(originalName, dataset.id);
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
          encoding,
          // 表格列指认透传到 TableAdapter.parse
          headerRow: headerRow ? Number(headerRow) : undefined,
          sheet,
          latitudeColumn,
          longitudeColumn,
          geometryColumn,
          wktColumn,
        },
      );

      return success({
        datasetId: dataset.id,
        versionId: version.id,
        jobId: ingestResult.jobId,
        status: ingestResult.status,
        encoding: encoding || 'auto-detect',
        message: 'Upload received. Processing started.',
      });
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
    return success(geoJSON);
  }

  @Get('versions/:versionId/geojson')
  async getVersionGeoJSON(@Param('versionId') versionId: string) {
    const geoJSON = await this.datasetService.getVersionGeoJSON(versionId);
    return success(geoJSON);
  }

  // ============================================
  // MVT Tiles
  // ============================================

  @Get(':id/mvt/:z/:x/:y')
  @SkipAuth()
  @Header('Content-Type', 'application/x-protobuf')
  async getMVT(
    @Param('id') id: string,
    @Param('z', ParseIntPipe) z: number,
    @Param('x', ParseIntPipe) x: number,
    @Param('y', ParseIntPipe) y: number,
  ): Promise<StreamableFile> {
    const dataset = await this.datasetService.getDataset(id);
    if (!dataset || !dataset.currentVersionId) {
      throw new NotFoundException(`Dataset ${id} not found or has no version`);
    }

    // 数值字段名：MVT 编码前需把这些字段强转为 numeric（见 getMVT），否则瓦片里是字符串，
    // 前端分级色彩的 interpolate 会抛 "Expected number, found string"。
    const numericFields = (dataset.fields ?? [])
      .filter((f) => f.type === 'number')
      .map((f) => f.name);

    const mvtBuffer = await this.datasetService.getMVT(
      dataset.currentVersionId,
      z,
      x,
      y,
      numericFields,
    );
    if (!mvtBuffer || mvtBuffer.length === 0) {
      // Return empty tile (valid MVT with no features)
      return new StreamableFile(Buffer.alloc(0));
    }

    return new StreamableFile(mvtBuffer);
  }

  // ============================================
  // Feature Detail (for popup)
  // ============================================

  @Get(':id/features/:featureId')
  async getFeatureDetail(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
  ) {
    const feature = await this.datasetService.getFeatureDetail(id, featureId);
    if (!feature) {
      throw new NotFoundException(
        `Feature ${featureId} not found in dataset ${id}`,
      );
    }
    return success(feature);
  }

  @Get(':id/features/:featureId/geojson')
  async getFeatureGeoJSON(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
  ) {
    const feature = await this.datasetService.getFeatureGeoJSON(id, featureId);
    if (!feature) {
      throw new NotFoundException(
        `Feature ${featureId} not found in dataset ${id}`,
      );
    }
    return success(feature);
  }

  @Put(':id/features/:featureId')
  async saveFeatureGeometry(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
    @Body() body: {
      geometry: Record<string, unknown>;
      properties?: Record<string, unknown>;
    },
  ) {
    try {
      const result = await this.datasetService.saveFeatureGeometry(
        id,
        featureId,
        body.geometry,
        body.properties,
      );
      return success(result);
    } catch {
      throw new NotFoundException(
        `Feature ${featureId} not found in dataset ${id}`,
      );
    }
  }

  @Delete(':id/features/:featureId')
  async deleteFeature(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
  ) {
    try {
      const result = await this.datasetService.deleteFeature(id, featureId);
      return success(result);
    } catch {
      throw new NotFoundException(
        `Feature ${featureId} not found in dataset ${id}`,
      );
    }
  }

  /** 仅更新要素属性（不动几何），供属性表单元格编辑使用 */
  @Patch(':id/features/:featureId/properties')
  async updateFeatureProperties(
    @Param('id') id: string,
    @Param('featureId') featureId: string,
    @Body() body: { properties: Record<string, unknown> },
  ) {
    const result = await this.datasetService.updateFeatureProperties(
      id,
      featureId,
      body.properties,
    );
    return success(result);
  }

  // ============================================
  // Dataset Images（要素属性图片：存 MinIO objectKey，下载走代理）
  // ============================================

  /** 上传要素属性图片 → 存 MinIO → 返回 objectKey 与下载代理 URL */
  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadDatasetImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!this.minioService.isInitialized()) {
      throw new InternalServerErrorException('存储服务未初始化');
    }

    // 文件名 latin1→utf8 修复（同 uploadFile，multer 默认 Latin1 会把中文打乱）
    let originalName = file.originalname;
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
      this.logger.warn(`Failed to fix filename encoding: ${e.message}`);
    }

    const key = this.minioService.generateStorageKey(originalName, id);
    await this.minioService.uploadFile(key, file.buffer, file.mimetype);
    this.logger.log(`Dataset image uploaded: dataset=${id} key=${key}`);

    return success({
      key,
      // 下载走代理 endpoint（@SkipAuth，分享页匿名 <img> 可加载）
      url: `/api/datasets/${id}/images?key=${encodeURIComponent(key)}`,
    });
  }

  /** 下载要素属性图片（代理 MinIO → 客户端；@SkipAuth 供分享页匿名 <img>） */
  @Get(':id/images')
  @SkipAuth()
  async getDatasetImage(
    @Param('id') id: string,
    @Query('key') key: string,
  ): Promise<StreamableFile> {
    if (!key || !this.minioService.isMinioKey(key)) {
      throw new BadRequestException('Invalid key');
    }
    const { buffer, contentType } = await this.minioService.getObjectBuffer(key);
    this.logger.debug(`Serving dataset image: dataset=${id} key=${key} (${buffer.length} bytes)`);
    return new StreamableFile(buffer, { type: contentType });
  }

  // ============================================
  // Dataset Fields (schema CRUD)
  // ============================================

  @Post(':id/fields')
  async addField(
    @Param('id') id: string,
    @Body() body: {
      name: string;
      alias?: string;
      type?: string;
      nullable?: boolean;
      defaultValue?: unknown;
    },
  ) {
    const result = await this.datasetService.addDatasetField(id, body);
    return success(result);
  }

  @Patch(':id/fields/:fieldName')
  async updateField(
    @Param('id') id: string,
    @Param('fieldName') fieldName: string,
    @Body() body: {
      name?: string;
      alias?: string;
      type?: string;
      nullable?: boolean;
    },
  ) {
    const result = await this.datasetService.updateDatasetField(
      id,
      fieldName,
      body,
    );
    return success(result);
  }

  @Delete(':id/fields/:fieldName')
  async removeField(
    @Param('id') id: string,
    @Param('fieldName') fieldName: string,
  ) {
    const result = await this.datasetService.removeDatasetField(id, fieldName);
    return success(result);
  }

  // ============================================
  // Dataset Style
  // ============================================

  @Put(':id/style')
  @SkipAuth() // TODO: Remove in production - for development testing
  async saveStyle(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.logger.log(`Saving style for dataset ${id}`);
    const result = await this.datasetService.saveDatasetStyle(id, body);
    return success(result);
  }

  @Get(':id/style')
  @SkipAuth() // TODO: Remove in production - for development testing
  async getStyle(@Param('id') id: string) {
    const style = await this.datasetService.getDatasetStyle(id);
    return success(style);
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
    return success(status);
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
    return success(report);
  }
}
