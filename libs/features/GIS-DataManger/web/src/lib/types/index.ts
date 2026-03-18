/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


export interface Dataset {
  id: string;
  projectId: string;
  name: string;
  type: GeometryType;
  source: string;
  tags: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  versions?: DatasetVersion[];
  currentVersionId?: string;
  currentVersion?: DatasetVersion;
}

export type GeometryType =
  | 'POINT'
  | 'LINESTRING'
  | 'POLYGON'
  | 'MULTI_POINT'
  | 'MULTI_LINESTRING'
  | 'MULTI_POLYGON'
  | 'RASTER'
  | 'UNKNOWN';

export type IngestStatus =
  | 'PENDING'
  | 'PARSING'
  | 'VALIDATING'
  | 'IMPORTING'
  | 'INDEXING'
  | 'SUCCESS'
  | 'FAILED';

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: number;
  filePath: string;
  fileSize: number;
  recordCount: number;
  uploadedBy?: string;
  status: IngestStatus;
  statusMessage?: string;
  sourceCRS?: string;
  targetCRS?: string;
  bbox?: [number, number, number, number];
  mappingProfileId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ValidationReport {
  id: string;
  versionId: string;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  geometryErrors?: GeometryError[];
  attributeErrors?: AttributeError[];
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeometryError {
  featureId: string;
  errorType: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface AttributeError {
  field: string;
  errorType: string;
  message: string;
}

export interface MappingProfile {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  sourceType: string;
  mappings: MappingItem[];
  crs?: string;
  geometryColumn?: string;
  geometryType?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MappingItem {
  sourceColumn: string;
  targetField: string;
  mappingType: MappingType;
  expression?: string;
  defaultValue?: string;
  lookupConfig?: Record<string, any>;
}

export type MappingType = 'DIRECT' | 'EXPRESSION' | 'LOOKUP' | 'CUSTOM';

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  totalSpace: number;
  usedSpace: number;
  usagePercent: number;
  datasetCount: number;
  featureCount: number;
  fileStats: {
    totalFiles: number;
    totalSize: number;
  };
}

export interface IngestStatusInfo {
  versionId: string;
  datasetId: string;
  status: IngestStatus;
  statusMessage?: string;
  progress?: number;
  details?: {
    parsedCount?: number;
    validCount?: number;
    errorCount?: number;
    importedCount?: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeRemaining?: number;
}

export interface UploadResult {
  datasetId: string;
  versionId: string;
  jobId: string;
  status: string;
  message: string;
}
