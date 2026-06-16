/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { describe, expect, it } from 'vitest';
import { selectLayerRuntimePath, toLayerRoutingMetadata } from './layer-routing';

describe('layer routing policy', () => {
  it('routes large browse datasets to the browse path', () => {
    const route = selectLayerRuntimePath({
      complexityLevel: 'L',
      deviceClass: 'desktop',
      sceneType: 'browse',
    });

    expect(route.runtimePath).toBe('BROWSE');
    expect(route.dataResidency).toBe('metadata-only');
  });

  it('keeps small explicit edit scenes in the edit path', () => {
    const route = selectLayerRuntimePath({
      complexityLevel: 'S',
      deviceClass: 'desktop',
      sceneType: 'edit',
    });

    expect(route.runtimePath).toBe('EDIT');
    expect(route.dataResidency).toBe('full');
  });

  it('forces mobile medium datasets into the browse path', () => {
    const route = selectLayerRuntimePath({
      complexityLevel: 'M',
      deviceClass: 'mobile',
      sceneType: 'browse',
    });

    expect(route.runtimePath).toBe('BROWSE');
  });

  it('normalizes routing metadata geometry values from dataset summaries', () => {
    const metadata = toLayerRoutingMetadata({
      id: 'dataset-1',
      name: 'County polygons',
      geometryType: 'MULTI_POLYGON',
      complexityLevel: 'XL',
      recordCount: 240000,
      fileSize: 8388608,
      bbox: [100, 20, 110, 30],
      geojsonUrl: '/api/datasets/dataset-1/geojson',
      mvtUrlTemplate: '/api/datasets/dataset-1/mvt/{z}/{x}/{y}',
    });

    expect(metadata.geometryType).toBe('POLYGON');
    expect(metadata.complexityLevel).toBe('XL');
    expect(metadata.mvtUrlTemplate).toContain('{z}');
  });
});
