/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsString, IsOptional, IsNumber, ValidateNested, IsArray, IsBoolean } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  ownerId!: string;
}

export class ProjectResponseDto {
  id!: string;
  name!: string;
  @IsOptional()
  @IsString()
  description?: string;
  ownerId!: string;
  createdAt!: Date;
  updatedAt!: Date;
  @IsOptional()
  @IsNumber()
  datasetCount?: number;
}

export class ProjectListResponseDto {
  items!: ProjectResponseDto[];
  @IsNumber()
  total!: number;
}

// Viewport state structure
export interface ViewportState {
  center: [number, number]; // [lng, lat]
  zoom: number;
  heading?: number;
  pitch?: number;
}

// Routing metadata for MVT/GeoJSON loading
export interface RoutingMetadata {
  datasetId: string;
  geometryType: string;
  geojsonUrl?: string;
  mvtUrlTemplate?: string;
  recordCount?: number;
  fileSize?: number;
  complexityLevel?: string;
  complexityScore?: number;
  bbox?: [number, number, number, number] | null;
}

// Layer state structure (matches frontend store)
export interface LayerState {
  id: string;
  name: string;
  type: 'dataset' | 'draw' | 'basemap';
  visible: boolean;
  opacity: number;
  order: number;
  datasetId?: string; // for dataset layers (maps to sourceId in frontend)
  geometryType?: 'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTI_POINT' | 'MULTI_LINESTRING' | 'MULTI_POLYGON';
  geojson?: object;   // legacy field for draw layers (GeoJSON FeatureCollection)
  data?: object;      // draw layer GeoJSON data (newer field name)
  style?: {
    color?: string;
    weight?: number;
    fillOpacity?: number;
  };
  routingMetadata?: RoutingMetadata; // for MVT tile loading
  fields?: Array<{ name: string; type: string; alias?: string }>;
}

export class ProjectStateDto {
  @ValidateNested()
  viewport!: ViewportState;

  @IsString()
  basemap!: string;

  @IsArray()
  layers!: LayerState[];

  updatedAt!: Date | null;
}

export class SaveProjectStateDto {
  @ValidateNested()
  viewport!: ViewportState;

  @IsOptional()
  @IsString()
  basemap?: string;

  @IsArray()
  layers!: LayerState[];
}
