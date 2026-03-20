/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 *
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  AttributeFieldType,
  AttributePanelTab,
  GeoJSONData,
  InteractionMode,
  LayerFieldDefinition,
  LayerState,
  MapStateSchema,
  PopupState,
  SelectionState,
  ViewportState,
} from '../types/map-state';

interface MapStoreActions {
  addLayer: (layer: LayerState) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<LayerState>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  addBlankLayer: (name: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  setLayers: (layers: LayerState[]) => void;
  updateLayerFeature: (
    layerId: string,
    featureId: string,
    properties: Record<string, unknown>,
  ) => void;
  deleteLayerFeatures: (layerId: string, featureIds: string[]) => void;
  updateLayerData: (layerId: string, geojsonData: GeoJSONData) => void;
  addLayerField: (
    layerId: string,
    field: LayerFieldDefinition,
    defaultValue?: unknown,
  ) => void;
  updateLayerField: (
    layerId: string,
    fieldName: string,
    updates: Partial<LayerFieldDefinition>,
  ) => void;
  removeLayerField: (layerId: string, fieldName: string) => void;
  setFeatureOverride: (
    layerId: string,
    featureId: string,
    override: Partial<import('../types/map-state').FeatureOverride>,
  ) => void;
  clearFeatureOverride: (layerId: string, featureId: string) => void;
  batchSetFeatureOverrides: (
    layerId: string,
    overrides: Record<
      string,
      Partial<import('../types/map-state').FeatureOverride>
    >,
  ) => void;
  setActiveLayer: (id: string | null) => void;
  openStylePanel: (layerId: string) => void;
  closeStylePanel: () => void;
  updateLayerStyle: (
    layerId: string,
    style: Partial<import('../types/map-state').LayerStyle>,
  ) => void;
  resetLayerStyle: (
    layerId: string,
    defaultStyle?: import('../types/map-state').LayerStyle,
  ) => void;
  openAttributePanel: (layerId: string, tab?: AttributePanelTab) => void;
  closeAttributePanel: () => void;
  setAttributePanelTab: (tab: AttributePanelTab) => void;
  setAttributePanelCollapsed: (isCollapsed: boolean) => void;
  setAttributePanelHeight: (height: number) => void;
  addPopup: (popup: PopupState) => void;
  removePopup: (id: string) => void;
  clearPopups: () => void;
  setViewport: (viewport: Partial<ViewportState>) => void;
  setBasemap: (basemap: string) => void;
  setSelection: (selection: SelectionState) => void;
  setHover: (hover: {
    layerId: string | null;
    featureId: string | null;
  }) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  setViewerReady: (ready: boolean) => void;
  getSnapshot: () => MapStateSchema;
}

interface MapStoreState extends MapStateSchema, MapStoreActions {}

const DEFAULT_ATTRIBUTE_PANEL_HEIGHT = 320;
const MIN_ATTRIBUTE_PANEL_HEIGHT = 280;
const MAX_ATTRIBUTE_PANEL_HEIGHT = 720;

function inferFieldType(value: unknown): AttributeFieldType {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  return 'unknown';
}

function normalizeLayerFields(
  layer: LayerState,
  incoming?: LayerFieldDefinition[],
): LayerFieldDefinition[] {
  const fieldMap = new Map<string, LayerFieldDefinition>();

  layer.fields?.forEach((field) => {
    fieldMap.set(field.name, field);
  });

  incoming?.forEach((field) => {
    fieldMap.set(field.name, {
      nullable: true,
      indexed: false,
      ...field,
    });
  });

  layer.data?.features.forEach((feature) => {
    Object.entries(feature.properties || {}).forEach(([name, value]) => {
      if (!fieldMap.has(name)) {
        fieldMap.set(name, {
          name,
          alias: name,
          type: inferFieldType(value),
          length: typeof value === 'string' ? String(value).length : null,
          nullable: true,
          indexed: false,
          remark: '',
        });
      }
    });
  });

  return Array.from(fieldMap.values());
}

const initialState: MapStateSchema = {
  conversationId: 'global',
  viewport: {
    center: [104.06, 30.67],
    zoom: 600000,
    heading: 0,
    pitch: -90,
  },
  basemap: 'tianditu-vec',
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
    height: DEFAULT_ATTRIBUTE_PANEL_HEIGHT,
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
  viewerReady: false,
};

export const useMapStore = create<MapStoreState>()(
  immer((set, get) => ({
    ...initialState,

    addLayer: (layer) =>
      set((state) => {
        // Prevent duplicate layer IDs
        if (state.layers.some((l) => l.id === layer.id)) {
          console.warn(`[addLayer] Layer with id "${layer.id}" already exists, skipping.`);
          return;
        }
        state.layers.push({
          ...layer,
          fields: normalizeLayerFields(layer),
        });
      }),

    removeLayer: (id) =>
      set((state) => {
        state.layers = state.layers.filter((layer) => layer.id !== id);

        if (state.activeLayerId === id) {
          state.activeLayerId = null;
        }

        if (state.stylePanel.layerId === id) {
          state.stylePanel = {
            isOpen: false,
            layerId: null,
            unsavedChanges: false,
          };
        }

        if (state.attributePanel.layerId === id) {
          const nextLayer = state.layers[0] ?? null;
          state.attributePanel = nextLayer
            ? {
                ...state.attributePanel,
                isOpen: true,
                layerId: nextLayer.id,
              }
            : {
                ...state.attributePanel,
                isOpen: false,
                layerId: null,
                isCollapsed: false,
              };
        }

        if (state.selection?.layerId === id) {
          state.selection = {
            layerId: null,
            featureId: null,
            properties: null,
          };
          state.selectedFeatureIds = [];
        }

        if (state.hover?.layerId === id) {
          state.hover = {
            layerId: null,
            featureId: null,
          };
        }

        state.popups = [];
      }),

    updateLayer: (id, updates) =>
      set((state) => {
        const index = state.layers.findIndex((layer) => layer.id === id);
        if (index !== -1) {
          state.layers[index] = { ...state.layers[index], ...updates };
          state.layers[index].fields = normalizeLayerFields(
            state.layers[index],
          );
        }
      }),

    reorderLayers: (fromIndex, toIndex) =>
      set((state) => {
        if (
          fromIndex >= 0 &&
          fromIndex < state.layers.length &&
          toIndex >= 0 &&
          toIndex < state.layers.length
        ) {
          const [removed] = state.layers.splice(fromIndex, 1);
          state.layers.splice(toIndex, 0, removed);
        }
      }),

    addBlankLayer: (name) =>
      set((state) => {
        const id = crypto.randomUUID();
        state.layers.push({
          id,
          name,
          type: 'GeoJSON',
          visible: true,
          opacity: 1,
          // 使用完整的多边形默认样式，包含透明度
          style: { color: '#cccccc', opacity: 0.5, outlineColor: '#cccccc', outlineWidth: 1 },
          data: { type: 'FeatureCollection', features: [] },
          fields: [],
        });
      }),

    setLayerVisibility: (id, visible) =>
      set((state) => {
        const layer = state.layers.find((candidate) => candidate.id === id);
        if (layer) {
          layer.visible = visible;
        }
      }),

    setLayers: (layers) =>
      set((state) => {
        state.layers = layers.map((layer) => ({
          ...layer,
          fields: normalizeLayerFields(layer),
        }));
      }),

    updateLayerFeature: (layerId, featureId, properties) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (!layer) {
          return;
        }

        if (layer.data) {
          const feature = layer.data.features?.find(
            (item) => item.id === featureId,
          );
          if (feature) {
            feature.properties = { ...feature.properties, ...properties };
          }
        }

        layer.fields = normalizeLayerFields(layer);

        if (
          state.selection?.layerId === layerId &&
          state.selection?.featureId === featureId
        ) {
          state.selection.properties = {
            ...state.selection.properties,
            ...properties,
          };
        }
      }),

    deleteLayerFeatures: (layerId, featureIds) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (!layer?.data?.features?.length || featureIds.length === 0) {
          return;
        }

        const ids = new Set(featureIds);
        layer.data.features = layer.data.features.filter(
          (feature) => !ids.has(feature.id),
        );

        if (layer.featureOverrides) {
          featureIds.forEach((featureId) => {
            delete layer.featureOverrides?.[featureId];
          });
        }

        if (
          state.selection?.layerId === layerId &&
          state.selection.featureId &&
          ids.has(state.selection.featureId)
        ) {
          state.selection = {
            layerId: null,
            featureId: null,
            properties: null,
          };
        }

        state.selectedFeatureIds = state.selectedFeatureIds.filter(
          (featureId) => !ids.has(featureId),
        );
        layer.fields = normalizeLayerFields(layer);
      }),

    updateLayerData: (layerId, geojsonData) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer) {
          layer.data = geojsonData;
          layer.fields = normalizeLayerFields(layer);
        }
      }),

    addLayerField: (layerId, field, defaultValue = null) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (!layer) {
          return;
        }

        layer.fields = normalizeLayerFields(layer);
        if (layer.fields?.some((item) => item.name === field.name)) {
          return;
        }

        const normalizedField: LayerFieldDefinition = {
          alias: field.alias || field.name,
          nullable: field.nullable ?? true,
          indexed: field.indexed ?? false,
          remark: field.remark ?? '',
          length: field.type === 'string' ? (field.length ?? 255) : null,
          ...field,
        };

        layer.fields = [...(layer.fields || []), normalizedField];
        layer.data?.features.forEach((feature) => {
          feature.properties = {
            ...feature.properties,
            [normalizedField.name]: defaultValue,
          };
        });
      }),

    updateLayerField: (layerId, fieldName, updates) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (!layer) {
          return;
        }

        layer.fields = normalizeLayerFields(layer);
        const targetField = layer.fields?.find(
          (field) => field.name === fieldName,
        );
        if (!targetField) {
          return;
        }

        const nextName = updates.name?.trim() || fieldName;
        if (
          nextName !== fieldName &&
          layer.fields?.some((field) => field.name === nextName)
        ) {
          return;
        }

        Object.assign(targetField, updates, {
          name: nextName,
          alias: updates.alias ?? targetField.alias ?? nextName,
          length:
            (updates.type || targetField.type) === 'string'
              ? (updates.length ?? targetField.length ?? 255)
              : null,
        });

        if (nextName !== fieldName) {
          layer.data?.features.forEach((feature) => {
            const currentProperties = feature.properties || {};
            if (fieldName in currentProperties) {
              currentProperties[nextName] = currentProperties[fieldName];
              delete currentProperties[fieldName];
            }
            feature.properties = currentProperties;
          });
        }
      }),

    removeLayerField: (layerId, fieldName) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (!layer) {
          return;
        }

        layer.fields = normalizeLayerFields(layer);
        layer.fields = (layer.fields || []).filter(
          (field) => field.name !== fieldName,
        );
        layer.data?.features.forEach((feature) => {
          if (feature.properties && fieldName in feature.properties) {
            delete feature.properties[fieldName];
          }
        });
      }),

    setFeatureOverride: (layerId, featureId, override) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer) {
          if (!layer.featureOverrides) {
            layer.featureOverrides = {};
          }
          if (!layer.featureOverrides[featureId]) {
            layer.featureOverrides[featureId] = {};
          }
          layer.featureOverrides[featureId] = {
            ...layer.featureOverrides[featureId],
            ...override,
          };
        }
      }),

    clearFeatureOverride: (layerId, featureId) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer?.featureOverrides) {
          delete layer.featureOverrides[featureId];
        }
      }),

    batchSetFeatureOverrides: (layerId, overrides) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer) {
          layer.featureOverrides = {
            ...layer.featureOverrides,
            ...overrides,
          };
        }
      }),

    setActiveLayer: (id) =>
      set((state) => {
        state.activeLayerId = id;
      }),

    openStylePanel: (layerId) =>
      set((state) => {
        state.stylePanel = {
          isOpen: true,
          layerId,
          unsavedChanges: false,
        };
      }),

    closeStylePanel: () =>
      set((state) => {
        state.stylePanel = {
          isOpen: false,
          layerId: null,
          unsavedChanges: false,
        };
      }),

    updateLayerStyle: (layerId, style) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer) {
          layer.style = { ...layer.style, ...style };
        }
        if (state.stylePanel.layerId === layerId) {
          state.stylePanel.unsavedChanges = true;
        }
      }),

    resetLayerStyle: (layerId, defaultStyle) =>
      set((state) => {
        const layer = state.layers.find(
          (candidate) => candidate.id === layerId,
        );
        if (layer) {
          layer.style = defaultStyle
            ? { ...defaultStyle }
            : { color: '#cccccc' };
        }
        if (state.stylePanel.layerId === layerId) {
          state.stylePanel.unsavedChanges = false;
        }
      }),

    openAttributePanel: (layerId, tab = 'records') =>
      set((state) => {
        state.attributePanel = {
          ...state.attributePanel,
          isOpen: true,
          layerId,
          tab,
          isCollapsed: false,
        };
      }),

    closeAttributePanel: () =>
      set((state) => {
        state.attributePanel = {
          ...state.attributePanel,
          isOpen: false,
          layerId: null,
          isCollapsed: false,
        };
      }),

    setAttributePanelTab: (tab) =>
      set((state) => {
        state.attributePanel.tab = tab;
      }),

    setAttributePanelCollapsed: (isCollapsed) =>
      set((state) => {
        state.attributePanel.isCollapsed = isCollapsed;
      }),

    setAttributePanelHeight: (height) =>
      set((state) => {
        state.attributePanel.height = Math.min(
          MAX_ATTRIBUTE_PANEL_HEIGHT,
          Math.max(MIN_ATTRIBUTE_PANEL_HEIGHT, Math.round(height)),
        );
      }),

    addPopup: (popup) =>
      set((state) => {
        state.popups.push(popup);
      }),

    removePopup: (id) =>
      set((state) => {
        state.popups = state.popups.filter((popup) => popup.id !== id);
      }),

    clearPopups: () =>
      set((state) => {
        state.popups = [];
      }),

    setViewport: (viewport) =>
      set((state) => {
        state.viewport = { ...state.viewport, ...viewport };
      }),

    setBasemap: (basemap) =>
      set((state) => {
        state.basemap = basemap;
      }),

    setSelection: (selection) =>
      set((state) => {
        state.selection = selection;
        state.selectedFeatureIds = selection.featureId
          ? [selection.featureId]
          : [];
      }),

    setHover: (hover) =>
      set((state) => {
        state.hover = hover;
      }),

    setInteractionMode: (mode) =>
      set((state) => {
        state.interaction.mode = mode;
      }),

    setViewerReady: (ready) =>
      set((state) => {
        state.viewerReady = ready;
      }),

    getSnapshot: () => {
      const {
        conversationId,
        viewport,
        basemap,
        layers,
        activeLayerId,
        stylePanel,
        attributePanel,
        popups,
        selectedFeatureIds,
        interaction,
        selection,
        viewerReady,
      } = get();

      const serializableLayers = layers.map(({ dataSource, ...rest }) => rest);

      return {
        conversationId,
        viewport,
        basemap,
        layers: serializableLayers,
        activeLayerId,
        stylePanel,
        attributePanel,
        popups,
        selectedFeatureIds,
        interaction,
        selection,
        viewerReady,
      };
    },
  })),
);
