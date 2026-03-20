/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { IsString, IsOptional, IsArray, IsEnum, IsObject, IsBoolean, ValidateNested } from 'class-validator';
import { MappingType } from '@prisma/client';
import { Type } from 'class-transformer';

// Mapping Item DTO
export class MappingItemDto {
  @IsString()
  sourceColumn!: string;

  @IsString()
  targetField!: string;

  @IsEnum(MappingType)
  mappingType!: MappingType;

  @IsOptional()
  @IsString()
  expression?: string;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsObject()
  lookupConfig?: Record<string, any>;
}

// Create Mapping Profile DTO
export class CreateMappingProfileDto {
  @IsString()
  datasetId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(MappingType, { each: true })
  sourceType!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingItemDto)
  mappings!: MappingItemDto[];

  @IsOptional()
  @IsString()
  crs?: string;

  @IsOptional()
  @IsString()
  geometryColumn?: string;

  @IsOptional()
  @IsString()
  geometryType?: string;
}

// Update Mapping Profile DTO
export class UpdateMappingProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MappingItemDto)
  mappings?: MappingItemDto[];

  @IsOptional()
  @IsString()
  crs?: string;

  @IsOptional()
  @IsString()
  geometryColumn?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Mapping Profile Response DTO
export class MappingProfileResponseDto {
  @IsString()
  id!: string;

  @IsString()
  datasetId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  sourceType!: string;

  mappings!: any[];

  @IsOptional()
  @IsString()
  crs?: string;

  @IsOptional()
  @IsString()
  geometryColumn?: string;

  @IsOptional()
  @IsString()
  geometryType?: string;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
