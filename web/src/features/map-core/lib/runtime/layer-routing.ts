/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { getStyleConfig } from '../constants/style-config';
import {
  ComplexityLevel,
  DataResidency,
  DeviceClass,
  GeometryType,
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
  };
}
