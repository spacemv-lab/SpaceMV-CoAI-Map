/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { ExportPanelState } from './export-state';
import { RenderingType, GraduatedConfig } from './graduated-style';
import { LabelPosition } from './label-position';

/**
 * 几何类型枚举
 * 用于区分图层样式配置的 UI 和预设
 */
export type GeometryType = 'POINT' | 'LINESTRING' | 'POLYGON';

/**
 * 右侧多功能面板的 tab 类型
 */
export type RightPanelTab = 'ai' | 'attributes' | 'style' | 'label';

export type ComplexityLevel = 'XS' | 'S' | 'M' | 'L' | 'XL';

export type DeviceClass = 'mobile' | 'desktop';

export type SceneType = 'browse' | 'showcase' | 'edit';

export type RuntimePath = 'BROWSE' | 'SHOWCASE' | 'EDIT';

export type DataResidency = 'metadata-only' | 'full';

export interface LayerRoutingMetadata {
  datasetId: string;
  geometryType?: GeometryType;
  bbox?: [number, number, number, number] | null;
  fileSize?: number;
  recordCount?: number;
  complexityLevel?: ComplexityLevel;
  complexityScore?: number;
  geojsonUrl?: string;
  mvtUrlTemplate?: string;
}

export interface LayerRuntimeRoute {
  runtimePath: RuntimePath;
  deviceClass: DeviceClass;
  sceneType: SceneType;
  dataResidency: DataResidency;
  selectedAt: number;
  reason: string;
}

/**
 * 点符号形状（2D Canvas 可绘制的）
 */
export type PointSymbolShape =
  | 'circle' // 圆形
  | 'square' // 方形
  | 'triangle' // 三角形
  | 'star' // 五角星
  | 'diamond' // 菱形
  | 'cross' // 十字形
  | 'custom'; // 自定义图片

/**
 * 文字标注配置
 */
export interface LabelStyle {
  // === 新增字段 ===
  enabled?: boolean; // 是否启用标注（默认 false）
  expression?: string; // 标注表达式（替代 text，支持 "{name} - {type}"）
  minZoom?: number; // 最小可见层级（默认 10）
  maxZoom?: number; // 最大可见层级（默认 18）
  position?: LabelPosition; // 标注位置
  repeatInterval?: number; // 沿线标注重复间隔（米，线要素专用）
  offsetX?: number; // X轴偏移（像素，点/面要素专用，负值左，正值右）
  offsetY?: number; // Y轴偏移（像素，点/面要素专用，负值上，正值下）
  fontSize?: number; // 字号（px，默认 14）
  padding?: number; // 标注间最小间距（像素，默认 2）

  // === 现有字段（保留兼容） ===
  text?: string; // 标注文字（向后兼容，优先使用 expression）
  font?: string; // 字体（如 'Microsoft YaHei'）
  fillColor?: string; // 填充颜色（标注文字颜色）
  outlineColor?: string; // 轮廓颜色（文字描边）
  outlineWidth?: number; // 轮廓宽度（文字描边宽度）
  style?: 'FILL' | 'OUTLINE' | 'FILL_AND_OUTLINE';
  horizontalOrigin?: 'LEFT' | 'CENTER' | 'RIGHT';
  verticalOrigin?: 'TOP' | 'CENTER' | 'BOTTOM'; // 保留但不再使用
  pixelOffset?: [number, number]; // 保留但不再使用
  labelOffset?: number; // 文字底部到图标顶部的距离（像素）
}

/**
 * 单点要素的覆盖配置（用于精细化控制）
 */
export interface FeatureOverride {
  visible?: boolean; // 是否显示
  showLabel?: boolean; // 是否显示标签
  labelOverride?: Partial<LabelStyle>; // 标签样式覆盖
  styleOverride?: Partial<LayerStyle>; // 样式覆盖
}

export type AttributeFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'unknown';

export interface LayerFieldDefinition {
  name: string;
  alias?: string;
  type: AttributeFieldType;
  length?: number | null;
  nullable?: boolean;
  indexed?: boolean;
  remark?: string;
}

export type LayerStyle = {
  // 通用属性
  color?: string;
  width?: number;
  opacity?: number;

  // ===== 点样式专属 =====
  pointSize?: number;
  pointSizeUnit?: 'pixels' | 'meters';
  pointSymbol?: PointSymbolShape;
  pointOutlineColor?: string;
  pointOutlineWidth?: number;
  pointRotation?: number;
  pointImageUri?: string;

  // ===== 文字标注专属 =====
  label?: LabelStyle; // 文字标注配置

  // 线样式专属
  lineType?: string;
  dashPattern?: number[];

  // 面样式专属
  outlineColor?: string;
  outlineWidth?: number;

  // ===== 渲染类型与分级色彩 =====
  renderingType?: RenderingType;
  graduatedConfig?: GraduatedConfig;

  // 扩展字段 (支持未来新增)
  [key: string]: unknown;
};

export type LayerState = {
  id: string;
  name: string;
  type: 'GeoJSON' | 'Tile' | 'Model' | 'Draw';
  geometryType?: GeometryType; // 几何类型（从后端数据集获取或创建时指定）
  tags?: string[]; // 图层标签（用于 AIS/ADS-B 等特殊图层识别）
  visible: boolean;
  opacity: number;
  style: LayerStyle;
  sourceId?: string; // 关联后端 Dataset ID
  routingMetadata?: LayerRoutingMetadata;
  runtimeRoute?: LayerRuntimeRoute;
  dataSource?: unknown; // Cesium DataSource 引用 (非序列化，需特殊处理或仅存ID)
  data?: {
    type: string;
    features: {
      id: string;
      properties?: Record<string, unknown>;
      geometry: unknown;
    }[];
  }; // GeoJSON data for Draw layer
  fields?: LayerFieldDefinition[];
  // 要素级别的覆盖配置（用于精细化控制）
  featureOverrides?: Record<string, FeatureOverride>;
};

export type ViewportState = {
  center: [number, number]; // [lng, lat]
  zoom: number;
  heading: number;
  pitch: number;
};

export type InteractionMode =
  | 'default'
  | 'draw_point'
  | 'draw_line'
  | 'draw_polygon'
  | 'measure_distance'
  | 'measure_area'
  | 'select'; // Explicit select mode

export type PopupState = {
  id: string;
  position: [number, number]; // [lon, lat]
  properties: Record<string, unknown>;
  layerName?: string;
};

export type SelectionState = {
  layerId: string | null;
  featureId: string | null;
  properties: Record<string, unknown> | null;
  datasetId?: string | null; // Backend dataset ID (from layer.sourceId), used for API calls
  lngLat?: [number, number]; // Popup position for MapLibre
};

export type StylePanelState = {
  isOpen: boolean;
  layerId: string | null;
  unsavedChanges?: boolean;
};

/**
 * 标注面板状态
 */
export type LabelPanelState = {
  isOpen: boolean;
  layerId: string | null;
};

/**
 * 编辑面板状态
 */
export type EditPanelState = {
  isOpen: boolean;
  featureId: string | null;
};

export type AttributePanelTab = 'records' | 'fields';

export type AttributePanelState = {
  isOpen: boolean;
  layerId: string | null;
  tab: AttributePanelTab;
  isCollapsed: boolean;
  height: number;
};

/**
 * 实验性功能配置
 * 用于渐进式迁移和功能开关
 */
export interface ExperimentalConfig {
  /** 使用 MapLibre GL 替代 Cesium (迁移开关) */
  useMaplibre?: boolean;
  /** 选择器模式（双击要素进入编辑） */
  selectorMode?: boolean;
}

/**
 * 编辑模式状态
 */
export type EditState = {
  selectedFeature: {
    layerId: string;
    featureId: string;
    properties: Record<string, unknown> | null;
  } | null;
  editFeature: import('geojson').Feature | null;
  hasUnsavedChanges: boolean;
  undoStack: import('geojson').Feature[];
};

export type MapStateSchema = {
  conversationId: string;
  currentProjectId: string | null; // 当前项目 ID，用于项目隔离
  currentProjectName: string | null; // 当前项目名称，用于 TopBar 显示
  viewport: ViewportState;
  basemap: string;
  layers: LayerState[];
  activeLayerId: string | null; // For editing/drawing
  stylePanel: StylePanelState;
  labelPanel: LabelPanelState; // 标注面板状态
  editPanel: EditPanelState;
  attributePanel: AttributePanelState;
  exportPanel: ExportPanelState;
  rightPanelActiveTab: RightPanelTab; // 右侧多功能面板当前 tab
  popups: PopupState[];
  selectedFeatureIds: string[];
  interaction: {
    mode: InteractionMode;
    type?: string;
  };
  selection?: SelectionState;
  hover?: {
    layerId: string | null;
    featureId: string | null;
  };
  viewerReady: boolean;
  legendVisible: boolean;
  /**
   * 只读模式：公开分享页(/share/:token)设为 true。
   * 为 true 时，store 的所有自动写入(autosave /style、beforeunload PUT /state)一律跳过，
   * 确保只读视图绝不触发鉴权写入接口（否则匿名 401 会被全局拦截器踢去 /login）。
   */
  readOnly: boolean;
  edit: EditState;
  experimental?: ExperimentalConfig;
};

// Legacy types for compatibility (if needed)
export type Viewport = {
  center: [number, number];
  zoom: number;
};

export type PlanStep =
  | { type: 'ui_action'; payload: unknown }
  | { type: 'analysis'; payload: unknown }
  | { type: 'ask_confirm'; payload: unknown };

export type PlanSchema = {
  planId: string;
  steps: PlanStep[];
  rationale: string;
  requiresConfirmation: boolean;
  requiredInputs?: Array<{ name: string; type: string; desc?: string }>;
};

export type GraphStateSchema = {
  conversationId: string;
  currentNode: 'chat' | 'state_query' | 'ui_action' | 'analysis' | 'confirm';
  history: Array<{
    node: string;
    input?: unknown;
    output?: unknown;
    ts: number;
  }>;
  context: { map: MapStateSchema; userIntent?: unknown; constraints?: unknown };
};

export type StateQuerySchema = {
  want: string[];
  filters?: Record<string, unknown>;
  mapStateVersion?: string;
};

export type StateAnswer = {
  map?: Partial<MapStateSchema>;
  dataRefs?: string[];
  stats?: Record<string, unknown>;
};

export type GeoJSONData = {
  type: string;
  features: {
    id: string;
    properties?: Record<string, unknown>;
    geometry: unknown;
  }[];
};
