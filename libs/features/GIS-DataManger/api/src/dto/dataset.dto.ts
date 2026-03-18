/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { IsString, IsOptional, IsArray, IsEnum, IsObject, IsNumber, IsBoolean } from 'class-validator';
import { GeometryType, IngestStatus } from '@prisma/client';

// Create Dataset DTO
export class CreateDatasetDto {
  @IsString()
  projectId!: string;

  @IsString()
  name!: string;

  @IsEnum(GeometryType)
  type!: GeometryType;

  @IsString()
  source!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}

// Update Dataset DTO
export class UpdateDatasetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}

// Dataset Version DTO
export class DatasetVersionDto {
  @IsString()
  id!: string;

  @IsString()
  datasetId!: string;

  @IsNumber()
  version!: number;

  @IsString()
  filePath!: string;

  @IsNumber()
  fileSize!: number;

  @IsNumber()
  recordCount!: number;

  @IsString()
  status!: IngestStatus;

  @IsOptional()
  @IsString()
  statusMessage?: string;

  @IsOptional()
  @IsString()
  sourceCRS?: string;

  @IsOptional()
  @IsString()
  targetCRS?: string;

  @IsOptional()
  @IsObject()
  bbox?: any;

  @IsOptional()
  @IsString()
  uploadedBy?: string;

  createdAt!: Date;

  @IsOptional()
  startedAt?: Date;

  @IsOptional()
  completedAt?: Date;
}

// Dataset List Query DTO
export class DatasetListQueryDto {
  @IsOptional()
  @IsNumber()
  skip?: number;

  @IsOptional()
  @IsNumber()
  take?: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(IngestStatus)
  status?: IngestStatus;
}

// Dataset Response DTO
export class DatasetResponseDto {
  @IsString()
  id!: string;

  @IsString()
  projectId!: string;

  @IsString()
  name!: string;

  @IsEnum(GeometryType)
  type!: GeometryType;

  @IsString()
  source!: string;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  currentVersionId?: string;

  versions?: DatasetVersionDto[];

  createdAt!: Date;
  updatedAt!: Date;
}
