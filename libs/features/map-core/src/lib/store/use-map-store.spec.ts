/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from './use-map-store';
import { LayerState } from '../types/map-state';

describe('useMapStore - Style Panel Actions', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useMapStore.setState({
      conversationId: 'global',
      viewport: {
        center: [104.06, 30.67],
        zoom: 10,
        heading: 0,
        pitch: -90,
      },
      basemap: 'tianditu',
      layers: [],
      activeLayerId: null,
      stylePanel: {
        isOpen: false,
        layerId: null,
        unsavedChanges: false,
      },
      attributePanel: {
        isOpen: false,
        layerId: null,
        tab: 'records',
        isCollapsed: false,
        height: 320,
      },
      popups: [],
      selectedFeatureIds: [],
      interaction: {
        mode: 'default',
      },
      selection: {
        layerId: null,
        featureId: null,
        properties: null,
      },
    });
  });

  const mockLayer: LayerState = {
    id: 'test-layer-1',
    name: 'Test Layer',
    type: 'GeoJSON',
    visible: true,
    opacity: 1,
    style: {
      color: '#3b82f6',
      width: 2,
      opacity: 1,
    },
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  };

  describe('openStylePanel', () => {
    it('should open style panel with given layerId', () => {
      const store = useMapStore.getState();
      store.openStylePanel('test-layer-1');

      const state = useMapStore.getState();
      expect(state.stylePanel.isOpen).toBe(true);
      expect(state.stylePanel.layerId).toBe('test-layer-1');
      expect(state.stylePanel.unsavedChanges).toBe(false);
    });
  });

  describe('closeStylePanel', () => {
    it('should close style panel', () => {
      const store = useMapStore.getState();
      store.openStylePanel('test-layer-1');
      store.closeStylePanel();

      const state = useMapStore.getState();
      expect(state.stylePanel.isOpen).toBe(false);
      expect(state.stylePanel.layerId).toBe(null);
      expect(state.stylePanel.unsavedChanges).toBe(false);
    });
  });

  describe('updateLayerStyle', () => {
    beforeEach(() => {
      useMapStore.getState().addLayer(mockLayer);
    });

    it('should update layer style', () => {
      const store = useMapStore.getState();
      store.updateLayerStyle('test-layer-1', { color: '#ef4444' });

      const state = useMapStore.getState();
      const layer = state.layers.find((l) => l.id === 'test-layer-1');
      expect(layer?.style.color).toBe('#ef4444');
    });

    it('should update multiple style properties', () => {
      const store = useMapStore.getState();
      store.updateLayerStyle('test-layer-1', {
        color: '#ef4444',
        width: 5,
        opacity: 0.8,
      });

      const state = useMapStore.getState();
      const layer = state.layers.find((l) => l.id === 'test-layer-1');
      expect(layer?.style.color).toBe('#ef4444');
      expect(layer?.style.width).toBe(5);
      expect(layer?.style.opacity).toBe(0.8);
    });

    it('should set unsavedChanges to true when updating style panel layer', () => {
      const store = useMapStore.getState();
      store.openStylePanel('test-layer-1');
      store.updateLayerStyle('test-layer-1', { color: '#ef4444' });

      const state = useMapStore.getState();
      expect(state.stylePanel.unsavedChanges).toBe(true);
    });
  });

  describe('resetLayerStyle', () => {
    beforeEach(() => {
      useMapStore.getState().addLayer(mockLayer);
    });

    it('should reset layer style to default', () => {
      const store = useMapStore.getState();
      store.updateLayerStyle('test-layer-1', { color: '#ef4444', width: 10 });
      store.resetLayerStyle('test-layer-1');

      const state = useMapStore.getState();
      const layer = state.layers.find((l) => l.id === 'test-layer-1');
      expect(layer?.style.color).toBe('#cccccc');
    });

    it('should reset layer style to custom default', () => {
      const store = useMapStore.getState();
      const customDefault = {
        color: '#00ff00',
        width: 3,
        opacity: 0.5,
      };
      store.resetLayerStyle('test-layer-1', customDefault);

      const state = useMapStore.getState();
      const layer = state.layers.find((l) => l.id === 'test-layer-1');
      expect(layer?.style.color).toBe('#00ff00');
      expect(layer?.style.width).toBe(3);
      expect(layer?.style.opacity).toBe(0.5);
    });

    it('should set unsavedChanges to false when resetting style panel layer', () => {
      const store = useMapStore.getState();
      store.openStylePanel('test-layer-1');
      store.updateLayerStyle('test-layer-1', { color: '#ef4444' });
      store.resetLayerStyle('test-layer-1');

      const state = useMapStore.getState();
      expect(state.stylePanel.unsavedChanges).toBe(false);
    });
  });

  describe('getSnapshot', () => {
    it('should include stylePanel in snapshot', () => {
      const store = useMapStore.getState();
      store.openStylePanel('test-layer-1');
      store.openAttributePanel('test-layer-1', 'fields');

      const snapshot = store.getSnapshot();
      expect(snapshot.stylePanel).toEqual({
        isOpen: true,
        layerId: 'test-layer-1',
        unsavedChanges: false,
      });
      expect(snapshot.attributePanel).toEqual({
        isOpen: true,
        layerId: 'test-layer-1',
        tab: 'fields',
        isCollapsed: false,
        height: 320,
      });
    });
  });

  describe('removeLayer', () => {
    it('should clear related ui state when removing an active layer', () => {
      const store = useMapStore.getState();
      store.addLayer(mockLayer);
      store.setActiveLayer(mockLayer.id);
      store.openStylePanel(mockLayer.id);
      store.openAttributePanel(mockLayer.id);
      store.setSelection({
        layerId: mockLayer.id,
        featureId: 'feature-1',
        properties: { name: 'feature' },
      });
      store.setHover({
        layerId: mockLayer.id,
        featureId: 'feature-1',
      });
      store.addPopup({
        id: 'popup-1',
        position: [104.06, 30.67],
        properties: { name: 'feature' },
      });

      store.removeLayer(mockLayer.id);

      const state = useMapStore.getState();
      expect(state.layers).toHaveLength(0);
      expect(state.activeLayerId).toBe(null);
      expect(state.stylePanel).toEqual({
        isOpen: false,
        layerId: null,
        unsavedChanges: false,
      });
      expect(state.attributePanel).toEqual({
        isOpen: false,
        layerId: null,
        tab: 'records',
        isCollapsed: false,
        height: 320,
      });
      expect(state.selection).toEqual({
        layerId: null,
        featureId: null,
        properties: null,
      });
      expect(state.selectedFeatureIds).toEqual([]);
      expect(state.hover).toEqual({
        layerId: null,
        featureId: null,
      });
      expect(state.popups).toEqual([]);
    });
  });

  describe('attribute panel actions', () => {
    beforeEach(() => {
      useMapStore.getState().addLayer(mockLayer);
    });

    it('should open attribute panel independent from active layer', () => {
      const store = useMapStore.getState();
      store.setActiveLayer('another-layer');
      store.openAttributePanel(mockLayer.id, 'fields');

      const state = useMapStore.getState();
      expect(state.activeLayerId).toBe('another-layer');
      expect(state.attributePanel).toEqual({
        isOpen: true,
        layerId: mockLayer.id,
        tab: 'fields',
        isCollapsed: false,
        height: 320,
      });
    });

    it('should manage layer fields', () => {
      const store = useMapStore.getState();
      store.addLayerField(mockLayer.id, {
        name: 'name',
        alias: '名称',
        type: 'string',
        length: 64,
        nullable: true,
        indexed: false,
        remark: '',
      });
      store.updateLayerField(mockLayer.id, 'name', { alias: '地名' });

      let layer = useMapStore.getState().layers.find((item) => item.id === mockLayer.id);
      expect(layer?.fields?.[0].alias).toBe('地名');

      store.removeLayerField(mockLayer.id, 'name');
      layer = useMapStore.getState().layers.find((item) => item.id === mockLayer.id);
      expect(layer?.fields).toEqual([]);
    });
  });
});
