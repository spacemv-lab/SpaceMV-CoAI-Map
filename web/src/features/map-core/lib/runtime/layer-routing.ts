/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { getStyleConfig } from '../constants/style-config';
import {
  AttributeFieldType,
  ComplexityLevel,
  DataResidency,
  DeviceClass,
  GeometryType,
  LayerFieldDefinition,
  LayerRoutingMetadata,
  LayerRuntimeRoute,
  LayerState,
  RuntimePath,
  SceneType,
} from '../types/map-state';
import { detectDeviceClass } from '../monitoring/performance-monitor';

export interface DatasetRoutingSummary {
  id: string;
  name: string;
  type?: string;
  geometryType?: string;
  bbox?: [number, number, number, number] | null;
  fileSize?: number;
  recordCount?: number;
  complexityLevel?: ComplexityLevel;
  complexityScore?: number;
  geojsonUrl?: string;
  mvtUrlTemplate?: string;
  /**
   * Dataset field definitions, returned by GET /datasets (list) and
   * GET /datasets/:id. Carried into LayerState so the label/attribute panels
   * have fields immediately on add — without this, fields only appear after a
   * project reload (server-side getProjectState enrichment).
   */
  fields?: Array<{ name: string; alias?: string; type: string }>;
}

interface LayerRoutingInput {
  complexityLevel?: ComplexityLevel;
  deviceClass: DeviceClass;
  sceneType: SceneType;
}

function getDataResidency(runtimePath: RuntimePath): DataResidency {
  if (runtimePath === 'EDIT') {
    return 'full';
  }

  return 'metadata-only';
}

export function normalizeGeometryType(type?: string): GeometryType | undefined {
  const normalized = type?.toUpperCase();

  if (normalized === 'POINT' || normalized === 'MULTIPOINT') {
    return 'POINT';
  }

  if (normalized === 'LINESTRING' || normalized === 'MULTILINESTRING') {
    return 'LINESTRING';
  }

  if (normalized === 'POLYGON' || normalized === 'MULTIPOLYGON') {
    return 'POLYGON';
  }

  if (normalized === 'MULTI_POINT') {
    return 'POINT';
  }

  if (normalized === 'MULTI_LINESTRING') {
    return 'LINESTRING';
  }

  if (normalized === 'MULTI_POLYGON') {
    return 'POLYGON';
  }

  return undefined;
}

export function selectLayerRuntimePath(
  input: LayerRoutingInput,
): LayerRuntimeRoute {
  let runtimePath: RuntimePath;
  let reason: string;

  if (input.sceneType === 'showcase') {
    runtimePath = 'SHOWCASE';
    reason = 'showcase scenes must route through the thematic rendering path';
  } else if (input.sceneType === 'edit') {
    runtimePath = 'EDIT';
    reason = 'explicit edit scenes require full-detail data residency';
  } else if (input.deviceClass === 'mobile') {
    if (
      input.complexityLevel === 'M' ||
      input.complexityLevel === 'L' ||
      input.complexityLevel === 'XL'
    ) {
      runtimePath = 'BROWSE';
      reason = 'mobile-class devices force medium and larger datasets into the browse path';
    } else {
      runtimePath = 'EDIT';
      reason = 'small browse datasets may still use the detail path on mobile';
    }
  } else if (
    input.complexityLevel === 'L' ||
    input.complexityLevel === 'XL'
  ) {
    runtimePath = 'BROWSE';
    reason = 'large desktop datasets default to the browse path';
  } else if (input.complexityLevel === 'M') {
    runtimePath = 'BROWSE';
    reason = 'medium browse datasets default to the browse path baseline';
  } else {
    runtimePath = 'EDIT';
    reason = 'small desktop browse datasets can remain in the detail path';
  }

  return {
    runtimePath,
    deviceClass: input.deviceClass,
    sceneType: input.sceneType,
    dataResidency: getDataResidency(runtimePath),
    selectedAt: Date.now(),
    reason,
  };
}

export function toLayerRoutingMetadata(
  dataset: DatasetRoutingSummary,
): LayerRoutingMetadata {
  return {
    datasetId: dataset.id,
    geometryType: normalizeGeometryType(dataset.geometryType ?? dataset.type),
    bbox: dataset.bbox ?? null,
    fileSize: dataset.fileSize,
    recordCount: dataset.recordCount,
    complexityLevel: dataset.complexityLevel,
    complexityScore: dataset.complexityScore,
    geojsonUrl: dataset.geojsonUrl,
    mvtUrlTemplate: dataset.mvtUrlTemplate,
  };
}

/**
 * Coerce a backend field-type string into the frontend AttributeFieldType.
 * The field pickers only use `type` for display, so a coarse category is
 * enough; anything unrecognized falls back to 'unknown'.
 */
function coerceFieldType(raw?: string): AttributeFieldType {
  switch ((raw || '').toLowerCase()) {
    case 'string':
    case 'text':
    case 'varchar':
    case 'char':
      return 'string';
    case 'number':
    case 'integer':
    case 'int':
    case 'float':
    case 'double':
    case 'decimal':
    case 'real':
    case 'long':
      return 'number';
    case 'boolean':
    case 'bool':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'date';
    default:
      return 'unknown';
  }
}

/**
 * Map backend dataset field definitions into the store's LayerFieldDefinition.
 * Returns undefined when the dataset carries no fields so the layer keeps the
 * default (empty) field list and normalizeLayerFields can still infer from data
 * later if it ever gets loaded.
 */
function toLayerFields(
  dataset: DatasetRoutingSummary,
): LayerFieldDefinition[] | undefined {
  if (!dataset.fields || dataset.fields.length === 0) return undefined;
  return dataset.fields.map((field) => ({
    name: field.name,
    alias: field.alias || field.name,
    type: coerceFieldType(field.type),
    nullable: true,
    indexed: false,
    remark: '',
  }));
}

export function createLayerFromDataset(
  dataset: DatasetRoutingSummary,
  sceneType: SceneType = 'browse',
): LayerState {
  const geometryType = normalizeGeometryType(dataset.geometryType ?? dataset.type);
  const routingMetadata = toLayerRoutingMetadata(dataset);
  const runtimeRoute = selectLayerRuntimePath({
    complexityLevel: routingMetadata.complexityLevel,
    deviceClass: detectDeviceClass(),
    sceneType,
  });
  const defaultStyle = geometryType
    ? getStyleConfig(geometryType).defaultStyle
    : { color: '#3388ff', opacity: 0.5 };

  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2),
    name: dataset.name,
    type: 'GeoJSON',
    geometryType,
    visible: true,
    opacity: 1,
    style: defaultStyle,
    sourceId: dataset.id,
    routingMetadata,
    runtimeRoute,
    data: undefined,
    dataSource: undefined,
    fields: toLayerFields(dataset),
  };
}
