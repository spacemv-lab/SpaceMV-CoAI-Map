/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { IsString, IsOptional, IsArray, IsObject, IsEnum, IsNumber } from 'class-validator';
import { GeometryType } from '@prisma/client';

export class UploadDto {
  @IsString()
  projectId!: string;

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

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UploadFileDto {
  @IsString()
  filename!: string;

  @IsString()
  originalname!: string;

  @IsString()
  mimetype!: string;

  @IsNumber()
  size!: number;

  @IsString()
  path!: string;
}

export class UploadResponseDto {
  datasetId!: string;
  versionId!: string;
  status: string = 'PENDING';
  message?: string;
}
