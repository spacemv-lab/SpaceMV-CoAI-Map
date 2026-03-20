/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * 几何类型枚举
 * 用于区分图层样式配置的 UI 和预设
 */
export type GeometryType = 'POINT' | 'LINESTRING' | 'POLYGON';

/**
 * 点渲染模式
 * - point: PointPrimitiveCollection，高性能，适合大量点
 * - billboard: BillboardCollection，支持图片和复杂符号
 * - model: ModelCollection，3D 模型（预留）
 */
export type PointRenderMode = 'point' | 'billboard' | 'model';

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
  text?: string; // 标注文字（为空则不显示）
  font?: string; // 字体（如 '14px sans-serif'）
  fillColor?: string; // 填充颜色
  outlineColor?: string; // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
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
  pointRenderMode?: PointRenderMode; // 渲染模式
  pointOutlineColor?: string; // 轮廓颜色（PointPrimitive）
  pointOutlineWidth?: number; // 轮廓宽度（PointPrimitive）
  pointRotation?: number; // 旋转角度（Billboard）
  pointImageUri?: string; // 自定义图片（Billboard）
  pointVerticalOrigin?: 'TOP' | 'MIDDLE' | 'BOTTOM'; // 垂直原点
  pointHorizontalOrigin?: 'LEFT' | 'CENTER' | 'RIGHT'; // 水平原点
  pointHeightOffset?: number; // 高度偏移（米），用于调整点相对于地面的高度

  // ===== 文字标注专属 =====
  label?: LabelStyle; // 文字标注配置

  // 线样式专属
  lineType?: string;
  dashPattern?: number[];

  // 面样式专属
  outlineColor?: string;
  outlineWidth?: number;

  // 扩展字段 (支持未来新增)
  [key: string]: unknown;
};

export type LayerState = {
  id: string;
  name: string;
  type: 'GeoJSON' | 'Tile' | 'Model' | 'Draw';
  geometryType?: GeometryType; // 几何类型（从后端数据集获取或创建时指定）
  visible: boolean;
  opacity: number;
  style: LayerStyle;
  sourceId?: string; // 关联后端 Dataset ID
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
};

export type StylePanelState = {
  isOpen: boolean;
  layerId: string | null;
  unsavedChanges?: boolean;
};

export type AttributePanelTab = 'records' | 'fields';

export type AttributePanelState = {
  isOpen: boolean;
  layerId: string | null;
  tab: AttributePanelTab;
  isCollapsed: boolean;
  height: number;
};

export type MapStateSchema = {
  conversationId: string;
  viewport: ViewportState;
  basemap: string;
  layers: LayerState[];
  activeLayerId: string | null; // For editing/drawing
  stylePanel: StylePanelState;
  attributePanel: AttributePanelState;
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
