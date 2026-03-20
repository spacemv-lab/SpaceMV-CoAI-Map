/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { IsString, IsEnum, IsOptional, IsObject, IsNumber } from 'class-validator';
import { IngestStatus } from '@prisma/client';

// Ingest Status Response DTO
export class IngestStatusResponseDto {
  @IsString()
  versionId!: string;

  @IsString()
  datasetId!: string;

  @IsEnum(IngestStatus)
  status!: IngestStatus;

  @IsOptional()
  @IsString()
  statusMessage?: string;

  @IsOptional()
  @IsNumber()
  progress?: number; // 0-100

  @IsOptional()
  @IsObject()
  details?: {
    parsedCount?: number;
    validCount?: number;
    errorCount?: number;
    importedCount?: number;
  };

  createdAt!: Date;

  @IsOptional()
  startedAt?: Date;

  @IsOptional()
  completedAt?: Date;

  @IsOptional()
  estimatedTimeRemaining?: number; // seconds
}

// Status Update DTO (for internal use)
export class UpdateIngestStatusDto {
  @IsEnum(IngestStatus)
  status!: IngestStatus;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}
