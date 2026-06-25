/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 *
 */
import type { Feature as GeoJSONFeature } from 'geojson';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { httpClient, getRefreshToken } from '@txwx-monorepo/api-client';
import {
  AttributeFieldType,
  AttributePanelTab,
  EditPanelState,
  EditState,
  ExperimentalConfig,
  GeoJSONData,
  InteractionMode,
  LabelPanelState,
  LayerFieldDefinition,
  LayerState,
  MapStateSchema,
  PopupState,
  RightPanelTab,
  SelectionState,
  ViewportState,
} from '../types/map-state';
import { LabelStyle } from '../types/map-state';
import {
  ExportPanelState,
  ExportConfig,
  DEFAULT_EXPORT_CONFIG,
  getOffsetsForPreset,
} from '../types/export-state';
import {
  addDatasetField,
  updateDatasetField,
  removeDatasetField,
} from '@/features/gis-data-manager/feature-api';
import { toast } from 'sonner';

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
  openLabelPanel: (layerId: string) => void;
  closeLabelPanel: () => void;
  updateLabelStyle: (layerId: string, labelStyle: Partial<LabelStyle>) => void;
  toggleLabelEnabled: (layerId: string, enabled: boolean) => void;
  openEditPanel: (featureId: string) => void;
  closeEditPanel: () => void;
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
  setPanelResizing: (isResizing: boolean) => void;
  setLegendVisible: (visible: boolean) => void;
  setExperimental: (config: Partial<ExperimentalConfig>) => void;
  setReadOnly: (value: boolean) => void;
  setRightPanelActiveTab: (tab: RightPanelTab) => void;
  setSelectedFeature: (feature: {
    layerId: string;
    featureId: string;
    properties: Record<string, unknown> | null;
  } | null) => void;
  setEditFeature: (feature: GeoJSONFeature | null) => void;
  setHasUnsavedChanges: (has: boolean) => void;
  pushUndo: (feature: GeoJSONFeature) => void;
  undoEdit: () => GeoJSONFeature | null;
  clearEditState: () => void;
  getSnapshot: () => MapStateSchema;
  // Export panel actions
  openExportPanel: () => void;
  closeExportPanel: () => void;
  setExportSelectionBox: (box: ExportPanelState['selectionBox']) => void;
  setExportAspectRatio: (ratio: number | null) => void;
  setExportContainerSize: (size: { width: number; height: number } | null) => void;
  resizeExportBox: (exportWidth: number, exportHeight: number) => void;
  setExportConfig: (config: ExportConfig) => void;
  updateExportElement: (
    element: 'title' | 'northArrow' | 'scaleBar' | 'legend' | 'tianditu' | 'brand',
    updates: Partial<ExportConfig['title']> | Partial<ExportConfig['northArrow']> | Partial<ExportConfig['scaleBar']> | Partial<ExportConfig['legend']> | Partial<ExportConfig['tianditu']> | Partial<ExportConfig['brand']>
  ) => void;
  // Project context actions
  setCurrentProjectId: (projectId: string | null) => void;
  setCurrentProjectName: (projectName: string | null) => void;
  switchProject: (projectId: string) => void;
  resetProjectUIState: () => void;
  captureProjectState: () => { viewport: ViewportState; basemap: string; layers: LayerState[] };
}

interface MapStoreState extends MapStateSchema, MapStoreActions {}

const DEFAULT_ATTRIBUTE_PANEL_HEIGHT = 320;
const MIN_ATTRIBUTE_PANEL_HEIGHT = 280;
const MAX_ATTRIBUTE_PANEL_HEIGHT = 720;

// Draw 图层 ID 常量（与 draw-renderer.tsx 保持一致）
const DRAW_LAYER_IDS = {
  POINT: 'user-drawings-points',
  LINESTRING: 'user-drawings-lines',
  POLYGON: 'user-drawings-polygons',
} as const;

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
  currentProjectId: null,
  currentProjectName: null,
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
  labelPanel: {
    isOpen: false,
    layerId: null,
  },
  editPanel: {
    isOpen: false,
    featureId: null,
  },
  rightPanelActiveTab: 'ai',
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
    datasetId: null,
  },
  viewerReady: false,
  legendVisible: false,
  isPanelResizing: false,
  readOnly: false,
  edit: {
    selectedFeature: null,
    editFeature: null,
    hasUnsavedChanges: false,
    undoStack: [],
  },
  experimental: { useMaplibre: true } as ExperimentalConfig,
  exportPanel: {
    isOpen: false,
    selectionBox: null,
    config: DEFAULT_EXPORT_CONFIG,
    pixelSize: null,
    aspectRatio: null,
    containerSize: null,
  },
};

// --- Export box geometry helpers (CSS pixel space) ---

function boxCenter(b: { startX: number; startY: number; endX: number; endY: number }) {
  return { cx: (b.startX + b.endX) / 2, cy: (b.startY + b.endY) / 2 };
}

// Largest box with the given ratio that does not exceed maxW or the container.
function fitRatioBox(
  maxW: number,
  ratio: number,
  container: { width: number; height: number },
): { w: number; h: number } {
  let w = Math.min(maxW, container.width);
  let h = w / ratio;
  if (h > container.height) {
    h = container.height;
    w = h * ratio;
  }
  if (w > container.width) {
    w = container.width;
    h = w / ratio;
  }
  return { w, h };
}

// Place a box of size (w,h) centered at (cx,cy), nudged to stay inside the container.
function placeBoxCentered(
  cx: number,
  cy: number,
  w: number,
  h: number,
  container: { width: number; height: number },
): { startX: number; startY: number; endX: number; endY: number } {
  const sw = Math.min(w, container.width);
  const sh = Math.min(h, container.height);
  let startX = cx - sw / 2;
  let startY = cy - sh / 2;
  if (startX < 0) startX = 0;
  if (startY < 0) startY = 0;
  if (startX + sw > container.width) startX = container.width - sw;
  if (startY + sh > container.height) startY = container.height - sh;
  return { startX, startY, endX: startX + sw, endY: startY + sh };
}

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

        if (state.labelPanel.layerId === id) {
          state.labelPanel = {
            isOpen: false,
            layerId: null,
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
            datasetId: null,
          };
          state.selectedFeatureIds = [];
        }

        if (state.hover?.layerId === id) {
          state.hover = {
            layerId: null,
            featureId: null,
          };
        }

        // 清理编辑态：如果正在编辑该图层，强制退出编辑
        if (state.editPanel.isOpen && state.edit.selectedFeature?.layerId === id) {
          state.editPanel = {
            isOpen: false,
            featureId: null,
          };
          state.edit = {
            selectedFeature: null,
            editFeature: null,
            hasUnsavedChanges: false,
            undoStack: [],
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
            datasetId: null,
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

    addLayerField: async (layerId, field, defaultValue = null) => {
      const layer = get().layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return;
      }
      // 数据集图层（后端存储）：先持久化字段 schema，后端会回填要素默认值
      if (layer.sourceId) {
        try {
          await addDatasetField(layer.sourceId, {
            name: field.name,
            alias: field.alias,
            type: field.type,
            nullable: field.nullable,
            defaultValue,
          });
        } catch {
          toast.error('添加字段失败');
          return;
        }
      }
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
      });
    },

    updateLayerField: async (layerId, fieldName, updates) => {
      const layer = get().layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return;
      }
      const nextName = updates.name?.trim() || fieldName;
      if (layer.sourceId) {
        try {
          await updateDatasetField(layer.sourceId, fieldName, {
            name: nextName,
            alias: updates.alias,
            type: updates.type,
            nullable: updates.nullable,
          });
        } catch {
          toast.error('更新字段失败');
          return;
        }
      }
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
      });
    },

    removeLayerField: async (layerId, fieldName) => {
      const layer = get().layers.find((candidate) => candidate.id === layerId);
      if (!layer) {
        return;
      }
      if (layer.sourceId) {
        try {
          await removeDatasetField(layer.sourceId, fieldName);
        } catch {
          toast.error('删除字段失败');
          return;
        }
      }
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
      });
    },

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
        if (!id) {
          state.editPanel = { isOpen: false, featureId: null };
        }
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

    openLabelPanel: (layerId) =>
      set((state) => {
        state.labelPanel = {
          isOpen: true,
          layerId,
        };
        // 自动启用标注
        const layer = state.layers.find((l) => l.id === layerId);
        if (layer && !layer.style?.label?.enabled) {
          layer.style = {
            ...layer.style,
            label: { ...layer.style?.label, enabled: true },
          };
        }
      }),

    closeLabelPanel: () =>
      set((state) => {
        state.labelPanel = {
          isOpen: false,
          layerId: null,
        };
      }),

    updateLabelStyle: (layerId, labelStyle) =>
      set((state) => {
        const layer = state.layers.find((l) => l.id === layerId);
        if (layer) {
          layer.style = {
            ...layer.style,
            label: { ...layer.style?.label, ...labelStyle },
          };
        }
      }),

    toggleLabelEnabled: (layerId, enabled) =>
      set((state) => {
        const layer = state.layers.find((l) => l.id === layerId);
        if (layer) {
          layer.style = {
            ...layer.style,
            label: { ...layer.style?.label, enabled },
          };
        }
      }),

    openEditPanel: (featureId) =>
      set((state) => {
        state.editPanel = {
          isOpen: true,
          featureId,
        };
      }),

    closeEditPanel: () =>
      set((state) => {
        state.editPanel = {
          isOpen: false,
          featureId: null,
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

    setPanelResizing: (isResizing) =>
      set((state) => {
        state.isPanelResizing = isResizing;
      }),

    setLegendVisible: (visible) =>
      set((state) => {
        state.legendVisible = visible;
      }),

    setExperimental: (config) =>
      set((state) => {
        state.experimental = {
          ...state.experimental,
          ...config,
        };
      }),

    setReadOnly: (value) =>
      set((state) => {
        state.readOnly = value;
      }),

    setRightPanelActiveTab: (tab) =>
      set((state) => {
        state.rightPanelActiveTab = tab;
      }),

    setSelectedFeature: (feature) =>
      set((state) => {
        state.edit.selectedFeature = feature;
      }),

    setEditFeature: (feature) =>
      set((state) => {
        state.edit.editFeature = feature;
      }),

    setHasUnsavedChanges: (has) =>
      set((state) => {
        state.edit.hasUnsavedChanges = has;
      }),

    pushUndo: (feature) =>
      set((state) => {
        state.edit.undoStack = [...state.edit.undoStack, feature].slice(-50);
      }),

    undoEdit: () => {
      const state = get();
      if (state.edit.undoStack.length === 0) return null;
      const prev = state.edit.undoStack[state.edit.undoStack.length - 1];
      set((s) => {
        s.edit.undoStack = s.edit.undoStack.slice(0, -1);
        s.edit.editFeature = prev;
      });
      return prev;
    },

    clearEditState: () =>
      set((state) => {
        state.edit = {
          selectedFeature: null,
          editFeature: null,
          hasUnsavedChanges: false,
          undoStack: [],
        };
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

    // Export panel actions
    openExportPanel: () =>
      set((state) => {
        state.exportPanel.isOpen = true;
        state.exportPanel.selectionBox = null;
        state.exportPanel.pixelSize = null;
        state.exportPanel.aspectRatio = null;
        // Reset config to defaults each time
        state.exportPanel.config = { ...DEFAULT_EXPORT_CONFIG };
      }),

    closeExportPanel: () =>
      set((state) => {
        state.exportPanel.isOpen = false;
        state.exportPanel.selectionBox = null;
        state.exportPanel.pixelSize = null;
      }),

    setExportSelectionBox: (box) =>
      set((state) => {
        state.exportPanel.selectionBox = box;
        // pixelSize = export pixels (box CSS size × devicePixelRatio)
        if (box) {
          const dpr = window.devicePixelRatio || 1;
          const cssWidth = Math.abs(box.endX - box.startX);
          const cssHeight = Math.abs(box.endY - box.startY);
          state.exportPanel.pixelSize = {
            width: Math.round(cssWidth * dpr),
            height: Math.round(cssHeight * dpr),
          };
        } else {
          state.exportPanel.pixelSize = null;
        }
      }),

    setExportAspectRatio: (ratio) =>
      set((state) => {
        state.exportPanel.aspectRatio = ratio;
        const { selectionBox, containerSize } = state.exportPanel;
        // Free mode, or nothing to reshape yet — just store the ratio.
        if (ratio == null || !selectionBox || !containerSize) return;
        // Reshape existing box to the ratio, keeping its current width, center-anchored.
        const curW = Math.abs(selectionBox.endX - selectionBox.startX);
        const { w, h } = fitRatioBox(curW, ratio, containerSize);
        const { cx, cy } = boxCenter(selectionBox);
        const dpr = window.devicePixelRatio || 1;
        state.exportPanel.selectionBox = placeBoxCentered(cx, cy, w, h, containerSize);
        state.exportPanel.pixelSize = {
          width: Math.round(w * dpr),
          height: Math.round(h * dpr),
        };
      }),

    setExportContainerSize: (size) =>
      set((state) => {
        state.exportPanel.containerSize = size;
      }),

    resizeExportBox: (exportWidth, exportHeight) =>
      set((state) => {
        const { selectionBox, containerSize, aspectRatio } = state.exportPanel;
        if (!selectionBox || !containerSize) return;
        const dpr = window.devicePixelRatio || 1;
        const cssW = Math.max(1, exportWidth / dpr);
        const cssH = Math.max(1, exportHeight / dpr);
        let w: number;
        let h: number;
        if (aspectRatio != null) {
          ({ w, h } = fitRatioBox(cssW, aspectRatio, containerSize));
        } else {
          w = Math.min(cssW, containerSize.width);
          h = Math.min(cssH, containerSize.height);
        }
        const { cx, cy } = boxCenter(selectionBox);
        state.exportPanel.selectionBox = placeBoxCentered(cx, cy, w, h, containerSize);
        state.exportPanel.pixelSize = {
          width: Math.round(w * dpr),
          height: Math.round(h * dpr),
        };
      }),

    setExportConfig: (config) =>
      set((state) => {
        state.exportPanel.config = config;
      }),

    updateExportElement: (element, updates) =>
      set((state) => {
        // When changing preset, set slider values to match preset position
        if (updates.preset) {
          const offsets = getOffsetsForPreset(updates.preset);
          // Use type assertion for immer compatibility
          (state.exportPanel.config[element] as Record<string, unknown>) = {
            ...state.exportPanel.config[element],
            ...updates,
            offsetX: offsets.offsetX,
            offsetY: offsets.offsetY,
          };
        } else {
          // Use type assertion for immer compatibility
          (state.exportPanel.config[element] as Record<string, unknown>) = {
            ...state.exportPanel.config[element],
            ...updates,
          };
        }
      }),

    // Project context actions
    setCurrentProjectId: (projectId) =>
      set((state) => {
        state.currentProjectId = projectId;
      }),

    setCurrentProjectName: (projectName) =>
      set((state) => {
        state.currentProjectName = projectName;
      }),

    // Reset all UI panel state (prevents cross-project pollution)
    // Called when entering a new project to ensure clean UI state
    resetProjectUIState: () =>
      set((state) => {
        state.stylePanel = {
          isOpen: false,
          layerId: null,
          unsavedChanges: false,
        };
        state.labelPanel = {
          isOpen: false,
          layerId: null,
        };
        state.editPanel = {
          isOpen: false,
          featureId: null,
        };
        state.rightPanelActiveTab = 'ai';
        state.attributePanel = {
          isOpen: false,
          layerId: null,
          tab: 'records',
          isCollapsed: false,
          height: DEFAULT_ATTRIBUTE_PANEL_HEIGHT,
        };
        state.activeLayerId = null;
        state.selectedFeatureIds = [];
        state.selection = {
          layerId: null,
          featureId: null,
          properties: null,
          datasetId: null,
        };
        state.popups = [];
        state.edit = {
          selectedFeature: null,
          editFeature: null,
          hasUnsavedChanges: false,
          undoStack: [],
        };
        state.interaction.mode = 'default';
        // 重置为可写（编辑器默认）；公开分享页会在 reset 后再 setReadOnly(true)
        state.readOnly = false;
      }),

    switchProject: (projectId) =>
      set((state) => {
        // 1. Clear current state (layers, selections, popups)
        // Note: State saving/loading is handled by useProjectState (database)
        state.layers = [];
        state.activeLayerId = null;
        state.selectedFeatureIds = [];
        state.selection = {
          layerId: null,
          featureId: null,
          properties: null,
          datasetId: null,
        };
        state.popups = [];
        state.stylePanel = {
          isOpen: false,
          layerId: null,
          unsavedChanges: false,
        };
        state.labelPanel = {
          isOpen: false,
          layerId: null,
        };
        state.editPanel = {
          isOpen: false,
          featureId: null,
        };
        state.rightPanelActiveTab = 'ai';
        state.attributePanel = {
          isOpen: false,
          layerId: null,
          tab: 'records',
          isCollapsed: false,
          height: DEFAULT_ATTRIBUTE_PANEL_HEIGHT,
        };
        state.edit = {
          selectedFeature: null,
          editFeature: null,
          hasUnsavedChanges: false,
          undoStack: [],
        };
        state.interaction.mode = 'default';

        // 3. Reset viewport and basemap to defaults (will be loaded from database)
        // This prevents stale viewport from causing visual jump after API returns
        state.viewport = {
          center: [104.06, 30.67],
          zoom: 600000,
          heading: 0,
          pitch: -90,
        };
        state.basemap = 'tianditu-vec';

        // 4. Set new projectId (state will be loaded from database via useProjectState)
        state.currentProjectId = projectId;
      }),

    captureProjectState: () => {
      const state = get();
      return {
        viewport: state.viewport,
        basemap: state.basemap,
        layers: state.layers.map((layer) => {
          // Remove non-serializable fields for API persistence
          const { dataSource, ...rest } = layer;
          // Convert frontend format to API format for persistence
          // Frontend: type='GeoJSON', sourceId
          // API: type='dataset', datasetId
          const apiLayer = {
            ...rest,
            type: layer.type === 'GeoJSON' ? 'dataset' : layer.type === 'Draw' ? 'draw' : 'basemap',
            datasetId: layer.sourceId, // sourceId → datasetId
          };
          // Remove sourceId (use datasetId instead)
          delete (apiLayer as any).sourceId;
          return apiLayer;
        }),
      };
    },
  })),
);

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
  (window as unknown as { useMapStore: typeof useMapStore }).useMapStore = useMapStore;
}

// ============================================
// Database Persistence
// ============================================

const API_BASE = '/api';
const DEBOUNCE_MS = 5000; // 5秒 debounce

/**
 * Debounce 函数，返回 cancel 方法
 */
function debounce<A extends unknown[], R extends void>(
  fn: (...args: A) => R,
  ms: number,
): { call: (...args: A) => void; cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return {
    call: (...args: A) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}

/**
 * 判断状态变化是否需要保存到数据库
 * 只保存核心状态：viewport, basemap, layers
 */
function shouldSave(state: MapStateSchema, prevState: MapStateSchema): boolean {
  // viewport 变化
  if (
    state.viewport.center[0] !== prevState.viewport.center[0] ||
    state.viewport.center[1] !== prevState.viewport.center[1] ||
    state.viewport.zoom !== prevState.viewport.zoom ||
    state.viewport.heading !== prevState.viewport.heading ||
    state.viewport.pitch !== prevState.viewport.pitch
  ) {
    return true;
  }

  // basemap 变化
  if (state.basemap !== prevState.basemap) {
    return true;
  }

  // layers 变化（数量或内容）
  if (state.layers.length !== prevState.layers.length) {
    return true;
  }

  // 检查每个 layer 的关键属性变化
  for (let i = 0; i < state.layers.length; i++) {
    const layer = state.layers[i];
    const prevLayer = prevState.layers[i];
    if (!prevLayer) return true;

    // Draw 图层数据变化（用户绘制）
    if (layer.type === 'Draw' && layer.data !== prevLayer.data) {
      return true;
    }

    // 图层可见性/透明度/样式变化
    if (layer.visible !== prevLayer.visible || layer.opacity !== prevLayer.opacity) {
      return true;
    }
  }

  return false;
}

/**
 * 保存状态到数据库
 */
async function saveToDatabase(projectId: string, state: MapStateSchema): Promise<void> {
  try {
    const payload = {
      viewport: state.viewport,
      basemap: state.basemap,
      layers: state.layers.map((layer) => {
        // 移除不可序列化字段
        const { dataSource, ...rest } = layer;
        return rest;
      }),
    };

    await httpClient.put(`/projects/${projectId}/state`, payload);
  } catch (err) {
    console.warn(`[MapStore] Failed to save state for project ${projectId}:`, err);
  }
}

/**
 * Debounced 保存函数
 */
const debouncedSave = debounce((projectId: string, state: MapStateSchema) => {
  saveToDatabase(projectId, state);
}, DEBOUNCE_MS);

/**
 * 记录上一次状态，用于判断变化
 */
let lastSavedState: MapStateSchema | null = null;
let lastProjectId: string | null = null;

/**
 * Subscribe 监听器：状态变化时自动保存到数据库
 *
 * 关键修复：lastSavedState 应在用户实际操作后初始化，而不是在 API 加载后
 * 使用 viewerReady 标志来判断地图是否已准备好，只有在地图准备好后才开始追踪变化
 */
useMapStore.subscribe((state) => {
  // 只读模式（公开分享页）：绝不自动保存，避免匿名触发鉴权写入 → 401 → 跳登录
  if (state.readOnly) return;

  const projectId = state.currentProjectId;

  // projectId 变化 → 立即保存旧工程状态（包括变为 null 时离开工程）
  if (projectId !== lastProjectId && lastProjectId && lastSavedState) {
    saveToDatabase(lastProjectId, lastSavedState);
  }

  // 没有 projectId（回到首页），重置追踪状态，取消 debounce 定时器
  if (!projectId) {
    if (lastProjectId) {
      debouncedSave.cancel();
    }
    lastProjectId = null;
    lastSavedState = null;
    return;
  }

  // 地图未准备好，不追踪变化（等待 API 状态加载完成）
  if (!state.viewerReady) {
    // 在 viewerReady 变为 true 时，初始化 lastSavedState
    lastSavedState = state;
    lastProjectId = projectId;
    return;
  }

  // 重置为新项目（已在上面的 projectId 变化逻辑中处理保存）
  if (projectId !== lastProjectId) {
    lastSavedState = state;
    lastProjectId = projectId;
    return;
  }

  // 判断是否需要保存（用户实际操作导致的变化）
  if (lastSavedState && shouldSave(state, lastSavedState)) {
    debouncedSave.call(projectId, state);
    lastSavedState = state;
  }

  lastProjectId = projectId;
});

// ============================================
// Style Auto-Save (Debounced)
// ============================================

/**
 * Debounced save functions per layer (避免多个图层同时保存时互相覆盖)
 */
const styleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 自动保存图层样式到后端
 * 只保存有 sourceId 的图层（已持久化的数据集）
 * Draw 图层（无 sourceId）不触发 API 保存
 */
async function saveLayerStyleToBackend(layerId: string): Promise<void> {
  const state = useMapStore.getState();
  const layer = state.layers.find((l) => l.id === layerId);

  // 只保存有 sourceId 的图层（数据库中的数据集）
  if (!layer?.sourceId) return;

  try {
    // Dynamic import to avoid circular dependency
    const { saveDatasetStyle } = await import(
      '@/features/gis-data-manager/feature-api'
    );
    await saveDatasetStyle(layer.sourceId, layer.style || {});
  } catch (err) {
    console.error('[Store] Failed to save layer style:', err);
  }
}

/**
 * Debounced style save (500ms)
 */
function debouncedStyleSave(layerId: string): void {
  // Clear existing timer for this layer
  const existingTimer = styleSaveTimers.get(layerId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer
  const timer = setTimeout(() => {
    styleSaveTimers.delete(layerId);
    saveLayerStyleToBackend(layerId);
  }, 500);

  styleSaveTimers.set(layerId, timer);
}

/**
 * Subscribe 监听样式变化
 * 当图层样式变更时，自动保存到后端
 */
useMapStore.subscribe((state, prevState) => {
  // 只读模式：不自动保存图层样式
  if (state.readOnly) return;

  for (const layer of state.layers) {
    const prevLayer = prevState.layers.find((l) => l.id === layer.id);

    // 只处理有 sourceId 的图层（已保存到数据库的数据集）
    // Draw 图层（无 sourceId）不触发保存
    if (!layer.sourceId) continue;

    // 检查样式是否变化
    if (
      prevLayer &&
      JSON.stringify(layer.style) !== JSON.stringify(prevLayer.style)
    ) {
      debouncedStyleSave(layer.id);
    }
  }
});

/**
 * 页面关闭/刷新时立即保存
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useMapStore.getState();
    const projectId = state.currentProjectId;

    if (projectId && !state.readOnly) {
      const payload = {
        viewport: state.viewport,
        basemap: state.basemap,
        layers: state.layers.map((layer) => {
          const { dataSource, ...rest } = layer;
          return rest;
        }),
      };

      // 使用 fetch + keepalive 替代 sendBeacon（支持 Authorization header）
      const token = getRefreshToken();
      fetch(`${API_BASE}/projects/${projectId}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  });
}
