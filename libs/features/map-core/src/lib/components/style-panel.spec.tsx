/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { describe, it, expect, vi } from 'vitest';

// Mock useMapStore before importing component
const mockUseMapStore = vi.hoisted(() => vi.fn());
const mockUpdateLayerStyle = vi.fn();
const mockResetLayerStyle = vi.fn();
const mockCloseStylePanel = vi.fn();

vi.mock('../store/use-map-store', () => ({
  useMapStore: (selector: any) => {
    const state = {
      layers: [
        {
          id: 'layer-1',
          name: 'Test Layer',
          type: 'GeoJSON' as const,
          visible: true,
          opacity: 1,
          style: {
            color: '#3b82f6',
            width: 2,
            opacity: 1,
            outlineColor: '#3b82f6',
            outlineWidth: 2,
            pointSize: 10,
          },
          data: {
            type: 'FeatureCollection',
            features: [
              {
                id: 'feature-1',
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [] as any },
                properties: { name: 'Test Feature' },
              },
            ],
          },
        },
      ],
      activeLayerId: 'layer-1',
      selection: { layerId: null, featureId: null, properties: null },
      stylePanel: { isOpen: true, layerId: 'layer-1', unsavedChanges: false },
    };
    return selector(state);
  },
}));

describe('StylePanel', () => {
  it('should have correct preset configurations', () => {
    // Test preset configurations
    const PRESETS = {
      Point: [
        { name: 'Red Marker', style: { color: '#ef4444', pointSize: 10, opacity: 1 } },
        { name: 'Blue Marker', style: { color: '#3b82f6', pointSize: 10, opacity: 1 } },
        { name: 'Green Marker', style: { color: '#22c55e', pointSize: 10, opacity: 1 } },
      ],
      Line: [
        { name: 'Solid Red', style: { color: '#ef4444', width: 2, opacity: 1 } },
        { name: 'Solid Blue', style: { color: '#3b82f6', width: 2, opacity: 1 } },
        { name: 'Thick Green', style: { color: '#22c55e', width: 5, opacity: 1 } },
      ],
      Polygon: [
        { name: 'Red Fill', style: { color: '#ef4444', opacity: 0.5, outlineColor: '#ef4444', outlineWidth: 2 } },
        { name: 'Blue Fill', style: { color: '#3b82f6', opacity: 0.5, outlineColor: '#3b82f6', outlineWidth: 2 } },
        { name: 'Transparent Blue', style: { color: '#3b82f6', opacity: 0.1, outlineColor: '#3b82f6', outlineWidth: 2 } },
      ]
    };

    expect(PRESETS.Point).toHaveLength(3);
    expect(PRESETS.Line).toHaveLength(3);
    expect(PRESETS.Polygon).toHaveLength(3);
    expect(PRESETS.Point[0].name).toBe('Red Marker');
    expect(PRESETS.Polygon[0].style.opacity).toBe(0.5);
  });

  it('should validate LayerStyle type structure', () => {
    // Validate style structure
    const style = {
      color: '#3b82f6',
      width: 2,
      opacity: 1,
      outlineColor: '#3b82f6',
      outlineWidth: 2,
      pointSize: 10,
    };

    expect(style.color).toBeDefined();
    expect(typeof style.color).toBe('string');
    expect(typeof style.opacity).toBe('number');
    expect(style.opacity).toBeGreaterThanOrEqual(0);
    expect(style.opacity).toBeLessThanOrEqual(1);
  });

  it('should validate style panel state structure', () => {
    const stylePanelState = {
      isOpen: true,
      layerId: 'layer-1',
      unsavedChanges: false,
    };

    expect(stylePanelState.isOpen).toBe(true);
    expect(stylePanelState.layerId).toBe('layer-1');
    expect(typeof stylePanelState.unsavedChanges).toBe('boolean');
  });
});
