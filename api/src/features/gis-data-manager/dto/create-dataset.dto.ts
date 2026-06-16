/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsString, IsOptional, IsArray, ValidateNested, IsObject, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { GeometryType } from '@prisma/client';

export enum PointSizeUnit {
  PIXELS = 'pixels',
  METERS = 'meters',
}

export class FeatureDto {
  @IsString()
  id: string;

  @IsObject()
  geometry: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}

export class LabelStyleDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsString()
  font?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class LayerStyleDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pointSize?: number;

  @IsOptional()
  @IsEnum(PointSizeUnit)
  pointSizeUnit?: PointSizeUnit;

  @IsOptional()
  @IsString()
  pointSymbol?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @IsOptional()
  @IsString()
  outlineColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outlineWidth?: number;

  @IsOptional()
  @IsString()
  lineType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LabelStyleDto)
  label?: LabelStyleDto;

  @IsOptional()
  @IsObject()
  graduatedConfig?: Record<string, unknown>;
}

export class CreateDatasetRequest {
  @IsString()
  name: string;

  @IsEnum(GeometryType)
  geometryType: GeometryType;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LayerStyleDto)
  style?: LayerStyleDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeatureDto)
  features: FeatureDto[];
}
