# 样式设置面板详细设计文档

> **文档版本**: 1.1
> **最后更新**: 2026-03-02
> **架构方案**: 混合方案 (配置驱动 + 策略模式)

## 1. 概述

### 1.1 功能目标

样式设置面板 (StylePanel) 用于配置地图图层的视觉样式。用户通过图层管理器的"样式设置"菜单项打开右侧面板，对当前图层进行样式定制。

### 1.2 核心特性

- **几何类型自动识别**: 根据图层数据自动判断点/线/面类型，显示对应的样式选项
- **预设样式**: 提供常用样式模板，一键应用
- **自定义样式**: 支持颜色、大小、透明度等参数的精细调整
- **实时预览**: 样式修改立即反映到地图渲染
- **重置功能**: 一键恢复默认样式
- **配置驱动**: 采用混合方案，三种几何类型共享基础架构，通过配置区分 UI

### 1.3 设计原则

1. **单一几何类型**: 一个图层只包含一种几何类型 (Point/LineString/Polygon)
2. **类型隔离**: 点/线/面的预设样式和自定义选项相互独立
3. **API 优先**: 样式配置可序列化，支持通过 AI 指令远程设置
4. **配置驱动**:  UI 由配置数据驱动，新增类型无需修改组件代码

### 1.4 架构决策

**问题**: 点/线/面三种几何类型的样式面板内容不同，如何组织代码？

| 方案 | 优点 | 缺点 |
|------|------|------|
| 单一组件 + 条件渲染 | 共享逻辑集中 | 条件判断多 |
| 拆分为三个独立组件 | 逻辑清晰 | 代码重复 |
| **混合方案 (推荐)** | 配置驱动、易扩展 | 需要设计配置结构 |

**选择**: 采用**混合方案**（策略模式 + 配置驱动），将样式配置抽象为数据结构，通过配置驱动 UI 渲染。

详见 [3.3 架构设计：混合方案](#33-架构设计混合方案策略模式--配置驱动)

---

## 2. 类型定义

### 2.1 图层几何类型

```typescript
// types/map-state.ts

/**
 * 几何类型枚举
 * 用于区分图层样式配置的 UI 和预设
 */
export type GeometryType = 'Point' | 'LineString' | 'Polygon';
```

### 2.2 图层样式结构

```typescript
// types/map-state.ts

/**
 * 图层样式定义
 * 所有字段均为可选，支持增量更新
 */
export type LayerStyle = {
  // 通用属性
  color?: string;         // 主颜色 (Hex 格式)
  opacity?: number;       // 不透明度 (0-1)

  // 点样式专属
  pointSize?: number;     // 点大小 (数值)
  pointSizeUnit?: 'pixels' | 'meters';  // 点大小单位 ('pixels' | 'meters')
  pointSymbol?: string;   // 点符号 ('circle' | 'square' | 'triangle' | 'star' | 'diamond')

  // 线样式专属
  width?: number;         // 线宽 (像素)
  lineType?: string;      // 线型 ('solid' | 'dashed' | 'dotted')
  dashPattern?: number[]; // 虚线图案 [实线段长，空白段长]

  // 面样式专属
  outlineColor?: string;  // 边框颜色
  outlineWidth?: number;  // 边框宽度 (像素)

  // 扩展字段 (支持未来新增)
  [key: string]: unknown;
};
```

### 2.3 样式面板状态

```typescript
// types/map-state.ts

/**
 * 样式面板状态
 */
export type StylePanelState = {
  isOpen: boolean;        // 面板是否打开
  layerId: string | null; // 当前配置的图层 ID
  unsavedChanges?: boolean; // 是否有未保存的更改 (预留)
};

// 在 MapStateSchema 中添加
export type MapStateSchema = {
  // ... 其他字段
  stylePanel: StylePanelState;
};
```

### 2.4 预设样式定义

```typescript
// constants/style-presets.ts

/**
 * 预设样式项
 */
export interface StylePreset {
  id: string;           // 预设唯一标识
  name: string;         // 预设名称 (用于显示)
  geometryType: GeometryType; // 适用的几何类型
  style: LayerStyle;    // 样式配置
  thumbnail?: string;   // 可选的预览图 (Base64 或 SVG)
}

/**
 * 点图层预设
 */
export const POINT_PRESETS: StylePreset[] = [
  {
    id: 'point-blue-circle',
    name: '蓝色圆点',
    geometryType: 'Point',
    style: {
      color: '#3b82f6',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'circle',
    },
  },
  {
    id: 'point-red-marker',
    name: '红色标记',
    geometryType: 'Point',
    style: {
      color: '#ef4444',
      pointSize: 12,
      opacity: 1,
      pointSymbol: 'circle',
      outlineColor: '#ffffff',
      outlineWidth: 2,
    },
  },
  {
    id: 'point-green-square',
    name: '绿色方块',
    geometryType: 'Point',
    style: {
      color: '#22c55e',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'square',
    },
  },
  {
    id: 'point-yellow-star',
    name: '黄色星标',
    geometryType: 'Point',
    style: {
      color: '#eab308',
      pointSize: 14,
      opacity: 1,
      pointSymbol: 'star',
    },
  },
];

/**
 * 线图层预设
 */
export const LINE_PRESETS: StylePreset[] = [
  {
    id: 'line-solid-blue',
    name: '蓝色实线',
    geometryType: 'LineString',
    style: {
      color: '#3b82f6',
      width: 2,
      opacity: 1,
      lineType: 'solid',
    },
  },
  {
    id: 'line-dashed-red',
    name: '红色虚线',
    geometryType: 'LineString',
    style: {
      color: '#ef4444',
      width: 2,
      opacity: 1,
      lineType: 'dashed',
      dashPattern: [5, 5],
    },
  },
  {
    id: 'line-bold-green',
    name: '绿色粗线',
    geometryType: 'LineString',
    style: {
      color: '#22c55e',
      width: 5,
      opacity: 1,
      lineType: 'solid',
    },
  },
];

/**
 * 面图层预设
 */
export const POLYGON_PRESETS: StylePreset[] = [
  {
    id: 'polygon-blue-fill',
    name: '蓝色填充',
    geometryType: 'Polygon',
    style: {
      color: '#3b82f6',
      opacity: 0.3,
      outlineColor: '#3b82f6',
      outlineWidth: 2,
    },
  },
  {
    id: 'polygon-red-fill',
    name: '红色填充',
    geometryType: 'Polygon',
    style: {
      color: '#ef4444',
      opacity: 0.3,
      outlineColor: '#ef4444',
      outlineWidth: 2,
    },
  },
  {
    id: 'polygon-transparent',
    name: '半透明填充',
    geometryType: 'Polygon',
    style: {
      color: '#6b7280',
      opacity: 0.1,
      outlineColor: '#6b7280',
      outlineWidth: 1,
    },
  },
];

/**
 * 根据几何类型获取预设
 */
export function getPresetsByGeometryType(type: GeometryType): StylePreset[] {
  switch (type) {
    case 'Point':
      return POINT_PRESETS;
    case 'LineString':
      return LINE_PRESETS;
    case 'Polygon':
      return POLYGON_PRESETS;
    default:
      return [];
  }
}
```

---

## 3. 组件设计

### 3.1 StylePanel 组件架构

```
StylePanel (右侧抽屉面板)
├── Header (标题栏)
│   ├── 图层名称
│   ├── 几何类型标识
│   └── 关闭按钮
│
├── PresetSection (预设样式区)
│   ├── 预设列表 (根据几何类型动态显示)
│   │   └── PresetItem (单个预设项)
│   │       ├── 预览图标
│   │       └── 预设名称
│
└── CustomSection (自定义样式区)
    ├── Reset Button (重置按钮)
    │
    ├── Common Controls (通用控制)
    │   ├── Color Picker (颜色选择器)
    │   ├── Opacity Slider (透明度滑块)
    │
    ├── Point Controls (点专属控制)
    │   ├── Point Size Slider (大小滑块)
    │   └── Point Symbol Select (符号形状下拉)
    │
    ├── Line Controls (线专属控制)
    │   ├── Width Slider (线宽滑块)
    │   └── Line Type Select (线型下拉)
    │
    └── Polygon Controls (面专属控制)
        ├── Outline Color Picker (边框颜色)
        └── Outline Width Slider (边框宽度)
```

### 3.3 架构设计：混合方案（策略模式 + 配置驱动）

为了在代码复用和类型特异性之间取得平衡，采用**混合方案**：将样式配置抽象为数据结构，通过配置驱动 UI 渲染，同时共享通用组件逻辑。

#### 3.3.1 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **方案 A：单一组件 + 条件渲染** | 共享逻辑集中、代码复用 | 条件判断多、逻辑复杂 | 快速实现 |
| **方案 B：拆分为三个独立组件** | 逻辑清晰、易维护测试 | 代码重复、需提取共享组件 | 类型间差异大 |
| **方案 C：混合方案（推荐）** | 配置驱动、易扩展、无重复 | 需要设计配置结构 | **长期维护** |

#### 3.3.2 配置驱动设计

```typescript
// constants/style-config.ts

/**
 * 样式控件类型枚举
 */
type ControlType =
  | 'color'        // 颜色选择器
  | 'opacity'      // 透明度滑块
  | 'sizeUnit'     // 尺寸单位下拉 (点)
  | 'size'         // 大小滑块 (点)
  | 'symbol'       // 符号下拉 (点)
  | 'width'        // 线宽滑块 (线)
  | 'lineType'     // 线型下拉 (线)
  | 'outline';     // 边框控制组 (面)

/**
 * 几何类型样式配置
 */
interface GeometryStyleConfig {
  type: GeometryType;
  presets: StylePreset[];                      // 预设样式列表
  customControls: ControlType[];               // 自定义控件列表 (按顺序)
  defaultStyle: LayerStyle;                    // 默认样式
}

/**
 * 三种几何类型的样式配置
 */
const STYLE_CONFIGS: Record<GeometryType, GeometryStyleConfig> = {
  Point: {
    type: 'Point',
    presets: [
      { id: 'point-blue-circle', name: '蓝色圆点', style: { color: '#3b82f6', pointSize: 10, opacity: 1, pointSymbol: 'circle' } },
      { id: 'point-red-marker', name: '红色标记', style: { color: '#ef4444', pointSize: 12, opacity: 1, pointSymbol: 'circle' } },
      { id: 'point-green-square', name: '绿色方块', style: { color: '#22c55e', pointSize: 10, opacity: 1, pointSymbol: 'square' } },
      { id: 'point-yellow-star', name: '黄色星标', style: { color: '#eab308', pointSize: 14, opacity: 1, pointSymbol: 'star' } },
      { id: 'point-purple-diamond', name: '紫色菱形', style: { color: '#a855f7', pointSize: 10, opacity: 1, pointSymbol: 'diamond' } },
    ],
    customControls: ['color', 'opacity', 'sizeUnit', 'size', 'symbol'],
    defaultStyle: { color: '#3b82f6', pointSize: 10, pointSizeUnit: 'pixels', opacity: 1, pointSymbol: 'circle' },
  },
  LineString: {
    type: 'LineString',
    presets: [
      { id: 'line-solid-blue', name: '蓝色实线', style: { color: '#3b82f6', width: 2, opacity: 1, lineType: 'solid' } },
      { id: 'line-dashed-red', name: '红色虚线', style: { color: '#ef4444', width: 2, opacity: 1, lineType: 'dashed', dashPattern: [5, 5] } },
      { id: 'line-bold-green', name: '绿色粗线', style: { color: '#22c55e', width: 5, opacity: 1, lineType: 'solid' } },
      { id: 'line-gray-dotted', name: '灰色点线', style: { color: '#6b7280', width: 1, opacity: 1, lineType: 'dotted' } },
    ],
    customControls: ['color', 'opacity', 'width', 'lineType'],
    defaultStyle: { color: '#3b82f6', width: 2, opacity: 1, lineType: 'solid' },
  },
  Polygon: {
    type: 'Polygon',
    presets: [
      { id: 'polygon-blue-fill', name: '蓝色填充', style: { color: '#3b82f6', opacity: 0.3, outlineColor: '#3b82f6', outlineWidth: 2 } },
      { id: 'polygon-red-fill', name: '红色填充', style: { color: '#ef4444', opacity: 0.3, outlineColor: '#ef4444', outlineWidth: 2 } },
      { id: 'polygon-transparent', name: '半透明填充', style: { color: '#6b7280', opacity: 0.1, outlineColor: '#6b7280', outlineWidth: 1 } },
      { id: 'polygon-green-light', name: '浅绿填充', style: { color: '#22c55e', opacity: 0.2, outlineColor: '#22c55e', outlineWidth: 1 } },
    ],
    customControls: ['color', 'opacity', 'outline'],
    defaultStyle: { color: '#3b82f6', opacity: 0.3, outlineColor: '#3b82f6', outlineWidth: 1 },
  },
};

/**
 * 根据几何类型获取配置
 */
export function getStyleConfig(geometryType: GeometryType): GeometryStyleConfig {
  return STYLE_CONFIGS[geometryType];
}
```

#### 3.3.3 组件结构

```
components/
├── style-panel/
│   ├── index.tsx              # 主入口，负责获取配置并分发
│   ├── BasePanelLayout.tsx    # 基础面板布局 (Header + Tab 结构)
│   ├── PresetTab.tsx          # 预设样式 Tab
│   ├── CustomTab.tsx          # 自定义样式 Tab
│   └── controls/
│       ├── ColorControl.tsx   # 颜色选择器
│       ├── OpacityControl.tsx # 透明度滑块
│       ├── SizeUnitControl.tsx  # 尺寸单位下拉 (点)
│       ├── SizeControl.tsx    # 大小滑块 (点)
│       ├── SymbolControl.tsx  # 符号下拉 (点)
│       ├── WidthControl.tsx   # 线宽滑块 (线)
│       ├── LineTypeControl.tsx# 线型下拉 (线)
│       └── OutlineControl.tsx # 边框控制组 (面)
```

#### 3.3.4 主组件实现

```typescript
// components/style-panel/index.tsx

export function StylePanel() {
  const layer = useLayer();
  const geometryType = useGeometryType(layer);
  const config = geometryType ? getStyleConfig(geometryType) : null;

  if (!config) {
    return <UnsupportedPanel message="无法识别图层几何类型" />;
  }

  return (
    <BasePanelLayout layer={layer} title="样式设置">
      <Tabs defaultValue="preset">
        <TabsList>
          <TabsTrigger value="preset">预设样式</TabsTrigger>
          <TabsTrigger value="custom">自定义</TabsTrigger>
        </TabsList>

        <TabsContent value="preset">
          <PresetTab
            presets={config.presets}
            geometryType={geometryType}
          />
        </TabsContent>

        <TabsContent value="custom">
          <CustomTab
            controls={config.customControls}
            style={layer.style}
            defaultStyle={config.defaultStyle}
          />
        </TabsContent>
      </Tabs>
    </BasePanelLayout>
  );
}

// components/style-panel/CustomTab.tsx

export function CustomTab({ controls, style, defaultStyle }: CustomTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ResetButton onClick={() => resetToDefault(defaultStyle)} />
      </div>

      <div className="space-y-3">
        <SectionTitle>通用</SectionTitle>
        {controls.map((controlType) => {
          switch (controlType) {
            case 'color':
              return <ColorControl key="color" value={style.color} />;
            case 'opacity':
              return <OpacityControl key="opacity" value={style.opacity} />;
            case 'size':
              return <SizeControl key="size" value={style.pointSize} />;
            case 'symbol':
              return <SymbolControl key="symbol" value={style.pointSymbol} />;
            case 'width':
              return <WidthControl key="width" value={style.width} />;
            case 'lineType':
              return <LineTypeControl key="lineType" value={style.lineType} />;
            case 'outline':
              return <OutlineControl key="outline" value={style.outlineColor} />;
          }
        })}
      </div>
    </div>
  );
}
```

#### 3.3.5 扩展性示例

如果需要添加新的几何类型（如 `MultiPoint`），只需：

```typescript
// 1. 在 types/map-state.ts 中添加类型
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint';

// 2. 在 style-config.ts 中添加配置
STYLE_CONFIGS.MultiPoint = {
  type: 'MultiPoint',
  presets: [...],
  customControls: ['color', 'opacity', 'size', 'symbol'],
  defaultStyle: { color: '#3b82f6', pointSize: 10, opacity: 1 },
};

// 3. 无需修改任何组件代码！
```

### 3.2 组件实现

> **注意**：以下是基于混合方案的实现示例。核心思想是**配置驱动 UI**，组件根据配置动态渲染对应的控件。

```typescript
// components/style-panel/index.tsx

import { useMapStore } from '../store/use-map-store';
import { Palette, X, RotateCcw } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { GeometryType, LayerStyle } from '../types/map-state';
import { getPresetsByGeometryType } from '../constants/style-presets';

/**
 * 点符号形状选项
 */
const POINT_SYMBOLS = [
  { value: 'circle', label: '圆形' },
  { value: 'square', label: '方形' },
  { value: 'triangle', label: '三角形' },
  { value: 'star', label: '五角星' },
  { value: 'diamond', label: '菱形' },
] as const;

/**
 * 线型选项
 */
const LINE_TYPES = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
] as const;

export function StylePanel() {
  // === Store 状态 ===
  const layers = useMapStore((state) => state.layers);
  const stylePanel = useMapStore((state) => state.stylePanel);
  const updateLayerStyle = useMapStore((state) => state.updateLayerStyle);
  const resetLayerStyle = useMapStore((state) => state.resetLayerStyle);
  const closeStylePanel = useMapStore((state) => state.closeStylePanel);

  // === 本地状态 ===
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');

  // === 计算目标图层 ===
  const layer = useMemo(() => {
    if (!stylePanel.layerId) return null;
    return layers.find((l) => l.id === stylePanel.layerId);
  }, [stylePanel.layerId, layers]);

  // === 自动识别几何类型 ===
  const geometryType = useMemo<GeometryType | null>(() => {
    if (!layer) return null;

    // 1. 从图层类型推断
    if (layer.type === 'Model') return 'Point';

    // 2. 从 GeoJSON 数据推断
    if (layer.data?.features?.length > 0) {
      const firstFeature = layer.data.features[0];
      const geomType = firstFeature.geometry?.type;

      if (geomType === 'Point' || geomType === 'MultiPoint') return 'Point';
      if (geomType === 'LineString' || geomType === 'MultiLineString') return 'LineString';
      if (geomType === 'Polygon' || geomType === 'MultiPolygon') return 'Polygon';
    }

    // 3. 从图层名称推断 (备用方案)
    const nameLower = layer.name.toLowerCase();
    if (nameLower.includes('点') || nameLower.includes('point')) return 'Point';
    if (nameLower.includes('线') || nameLower.includes('line')) return 'LineString';
    if (nameLower.includes('面') || nameLower.includes('polygon') || nameLower.includes('区')) return 'Polygon';

    return null;
  }, [layer]);

  // === 渲染控制 ===
  if (!stylePanel.isOpen || !layer) {
    return null;
  }

  // === 事件处理 ===
  const handleApplyPreset = (style: LayerStyle) => {
    updateLayerStyle(layer.id, style);
  };

  const handleReset = () => {
    resetLayerStyle(layer.id);
  };

  const handleColorChange = (color: string) => {
    updateLayerStyle(layer.id, { color });
  };

  const handleOpacityChange = (opacity: number) => {
    updateLayerStyle(layer.id, { opacity });
  };

  const handlePointSizeChange = (pointSize: number) => {
    updateLayerStyle(layer.id, { pointSize });
  };

  const handlePointSymbolChange = (pointSymbol: string) => {
    updateLayerStyle(layer.id, { pointSymbol });
  };

  const handleWidthChange = (width: number) => {
    updateLayerStyle(layer.id, { width });
  };

  const handleLineTypeChange = (lineType: string) => {
    updateLayerStyle(layer.id, { lineType });
  };

  const handleOutlineColorChange = (outlineColor: string) => {
    updateLayerStyle(layer.id, { outlineColor });
  };

  const handleOutlineWidthChange = (outlineWidth: number) => {
    updateLayerStyle(layer.id, { outlineWidth });
  };

  // === 渲染 ===
  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-4 w-80 text-sm pointer-events-auto max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">样式设置</h3>
        </div>
        <button
          onClick={closeStylePanel}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Info */}
      <div className="mb-4 bg-blue-50 p-2 rounded border border-blue-100">
        <div className="font-medium text-blue-900 truncate" title={layer.name}>
          {layer.name}
        </div>
        {geometryType && (
          <div className="text-xs text-blue-400 mt-1">
            {geometryType === 'Point' && '点图层'}
            {geometryType === 'LineString' && '线图层'}
            {geometryType === 'Polygon' && '面图层'}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-md mb-4">
        <button
          onClick={() => setActiveTab('preset')}
          className={`flex-1 py-1.5 text-xs rounded-sm transition-all ${
            activeTab === 'preset'
              ? 'bg-white shadow-sm text-blue-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          预设样式
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex-1 py-1.5 text-xs rounded-sm transition-all ${
            activeTab === 'custom'
              ? 'bg-white shadow-sm text-blue-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          自定义
        </button>
      </div>

      {/* Preset Section */}
      {activeTab === 'preset' && geometryType && (
        <div className="space-y-2">
          {getPresetsByGeometryType(geometryType).map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.style)}
              className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded flex items-center justify-center bg-white border border-gray-200 shadow-sm">
                <PresetPreview style={preset.style} geometryType={geometryType} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">{preset.name}</div>
                <div className="text-xs text-gray-400">点击应用</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom Section */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          {/* Reset Button */}
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
            >
              <RotateCcw className="w-3 h-3" />
              重置样式
            </button>
          </div>

          {/* Common Controls */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">通用</h4>

            {/* Color */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">颜色</label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 w-16 text-center">
                  {layer.style.color || '#cccccc'}
                </span>
                <input
                  type="color"
                  value={layer.style.color || '#cccccc'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm text-gray-600">不透明度</label>
                <span className="text-xs text-gray-500">
                  {Math.round((layer.style.opacity ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={layer.style.opacity ?? 1}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          {/* Point Controls */}
          {geometryType === 'Point' && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">点样式</h4>

              {/* Point Size */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-gray-600">大小</label>
                  <span className="text-xs text-gray-500">
                    {layer.style.pointSize || 10}px
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="30"
                  step="1"
                  value={layer.style.pointSize || 10}
                  onChange={(e) => handlePointSizeChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Point Symbol */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">符号形状</label>
                <select
                  value={layer.style.pointSymbol || 'circle'}
                  onChange={(e) => handlePointSymbolChange(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                >
                  {POINT_SYMBOLS.map((sym) => (
                    <option key={sym.value} value={sym.value}>
                      {sym.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Line Controls */}
          {geometryType === 'LineString' && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">线样式</h4>

              {/* Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-gray-600">线宽</label>
                  <span className="text-xs text-gray-500">
                    {layer.style.width || 2}px
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={layer.style.width || 2}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Line Type */}
              <div>
                <label className="text-sm text-gray-600 block mb-1">线型</label>
                <select
                  value={layer.style.lineType || 'solid'}
                  onChange={(e) => handleLineTypeChange(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm"
                >
                  {LINE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Polygon Controls */}
          {geometryType === 'Polygon' && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">面样式</h4>

              {/* Outline Color */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600">边框颜色</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 w-16 text-center">
                    {layer.style.outlineColor || layer.style.color || '#cccccc'}
                  </span>
                  <input
                    type="color"
                    value={layer.style.outlineColor || layer.style.color || '#cccccc'}
                    onChange={(e) => handleOutlineColorChange(e.target.value)}
                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Outline Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-gray-600">边框宽度</label>
                  <span className="text-xs text-gray-500">
                    {layer.style.outlineWidth || 1}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={layer.style.outlineWidth || 1}
                  onChange={(e) => handleOutlineWidthChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 预设样式预览组件
 */
function PresetPreview({ style, geometryType }: { style: LayerStyle; geometryType: GeometryType }) {
  if (geometryType === 'Point') {
    return (
      <div
        className="rounded-full"
        style={{
          backgroundColor: style.color,
          width: Math.min(20, style.pointSize || 8),
          height: Math.min(20, style.pointSize || 8),
          opacity: style.opacity,
        }}
      />
    );
  }

  if (geometryType === 'LineString') {
    return (
      <div
        style={{
          backgroundColor: style.color,
          height: Math.min(4, style.width || 2),
          width: 24,
          opacity: style.opacity,
        }}
      />
    );
  }

  if (geometryType === 'Polygon') {
    return (
      <div
        style={{
          backgroundColor: style.color,
          width: 20,
          height: 20,
          opacity: style.opacity,
          borderColor: style.outlineColor || style.color,
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      />
    );
  }

  return null;
}
```

### 3.4 控件组件实现

```typescript
// components/style-panel/controls/ColorControl.tsx

interface ColorControlProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorControl({ value, onChange, label = '颜色' }: ColorControlProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-500 w-16 text-center">
          {value || '#cccccc'}
        </span>
        <input
          type="color"
          value={value || '#cccccc'}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
        />
      </div>
    </div>
  );
}

// components/style-panel/controls/OpacityControl.tsx

interface OpacityControlProps {
  value: number;
  onChange: (opacity: number) => void;
}

export function OpacityControl({ value, onChange }: OpacityControlProps) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">不透明度</label>
        <span className="text-xs text-gray-500">{Math.round((value ?? 1) * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

// components/style-panel/controls/SizeControl.tsx

interface SizeControlProps {
  value: number;
  unit?: 'pixels' | 'meters';
  onChange: (size: number) => void;
}

export function SizeControl({ value, unit = 'pixels', onChange }: SizeControlProps) {
  // 根据单位决定范围和显示
  const range = unit === 'meters' ? { min: 50, max: 5000, step: 50 } : { min: 4, max: 30, step: 1 };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">大小</label>
        <span className="text-xs text-gray-500">{value || 10}{unit === 'meters' ? 'm' : 'px'}</span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value || 10}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );
}

// components/style-panel/controls/SizeUnitControl.tsx

const SIZE_UNIT_OPTIONS = [
  { value: 'pixels', label: '像素' },
  { value: 'meters', label: '米' },
];

interface SizeUnitControlProps {
  value: 'pixels' | 'meters';
  onChange: (unit: 'pixels' | 'meters') => void;
}

export function SizeUnitControl({ value, onChange }: SizeUnitControlProps) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-gray-600">尺寸单位</label>
      <select
        value={value || 'pixels'}
        onChange={(e) => onChange(e.target.value as 'pixels' | 'meters')}
        className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white"
      >
        {SIZE_UNIT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// components/style-panel/controls/SymbolControl.tsx

const SYMBOL_OPTIONS = [
  { value: 'circle', label: '圆形', icon: '●' },
  { value: 'square', label: '方形', icon: '■' },
  { value: 'triangle', label: '三角形', icon: '▲' },
  { value: 'star', label: '五角星', icon: '★' },
  { value: 'diamond', label: '菱形', icon: '◆' },
];

interface SymbolControlProps {
  value: string;
  onChange: (symbol: string) => void;
}

export function SymbolControl({ value, onChange }: SymbolControlProps) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">符号形状</label>
      <select
        value={value || 'circle'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm"
      >
        {SYMBOL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// components/style-panel/controls/OutlineControl.tsx

interface OutlineControlProps {
  color?: string;
  width?: number;
  onChangeColor: (color: string) => void;
  onChangeWidth: (width: number) => void;
}

export function OutlineControl({ color, width, onChangeColor, onChangeWidth }: OutlineControlProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-600">边框颜色</label>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 w-16 text-center">
            {color || '#cccccc'}
          </span>
          <input
            type="color"
            value={color || '#cccccc'}
            onChange={(e) => onChangeColor(e.target.value)}
            className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-sm text-gray-600">边框宽度</label>
          <span className="text-xs text-gray-500">{width || 1}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={width || 1}
          onChange={(e) => onChangeWidth(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </>
  );
}
```

### 3.5 组件文件结构

```
components/style-panel/
├── index.tsx                    # 主入口组件 (负责获取配置并分发)
├── base-panel-layout.tsx        # 基础面板布局 (Header + Tab 结构)
├── preset-tab.tsx               # 预设样式 Tab 内容
├── custom-tab.tsx               # 自定义样式 Tab 内容
├── preset-preview.tsx           # 预设样式预览小组件
└── controls/                    # 可复用控件目录
    ├── color-control.tsx        # 颜色选择器
    ├── opacity-control.tsx      # 透明度滑块
    ├── size-control.tsx         # 大小滑块
    ├── symbol-control.tsx       # 符号形状下拉
    ├── width-control.tsx        # 线宽滑块
    ├── line-type-control.tsx    # 线型下拉
    └── outline-control.tsx      # 边框控制组 (颜色 + 宽度)
```

### 3.6 架构决策总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 组件拆分策略 | 混合方案 (配置驱动) | 平衡代码复用与类型特异性 |
| 几何类型识别 | 数据 > 名称 | 数据优先，名称作为备用方案 |
| 预设样式存储 | 常量文件 | 易于维护和扩展 |
| 控件组件 | 独立可复用 | 支持未来跨类型复用 |
| 状态管理 | Zustand | 与现有架构一致 |

### 3.7 扩展指南

**添加新的几何类型** (如 `MultiPoint`)：

```typescript
// 1. 更新类型定义 (types/map-state.ts)
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint';

// 2. 添加样式配置 (constants/style-config.ts)
STYLE_CONFIGS.MultiPoint = {
  type: 'MultiPoint',
  presets: [...],
  customControls: ['color', 'opacity', 'size', 'symbol'],
  defaultStyle: { color: '#3b82f6', pointSize: 10, opacity: 1 },
};

// 3. 无需修改组件代码！配置会自动生效。
```

**添加新的控件类型**：

```typescript
// 1. 创建控件组件 (controls/new-control.tsx)
export function NewControl({ value, onChange }: NewControlProps) {
  // ... 实现
}

// 2. 添加到 ControlType 枚举
type ControlType = 'color' | 'opacity' | ... | 'new';

// 3. 在 CustomTab.tsx 中添加 case 分支
case 'new':
  return <NewControl key="new" value={...} />;

// 4. 在配置中引用
customControls: ['color', 'opacity', 'new']
```

---

## 4. Store 设计

### 4.1 Actions

```typescript
// store/use-map-store.ts

interface MapStoreActions {
  // === 样式面板控制 ===

  /**
   * 打开样式面板
   * @param layerId - 要配置的图层 ID
   */
  openStylePanel: (layerId: string) => void;

  /**
   * 关闭样式面板
   */
  closeStylePanel: () => void;

  // === 样式操作 ===

  /**
   * 更新图层样式
   * @param layerId - 图层 ID
   * @param style - 样式更新 (增量)
   */
  updateLayerStyle: (layerId: string, style: Partial<LayerStyle>) => void;

  /**
   * 重置图层样式为默认值
   * @param layerId - 图层 ID
   * @param defaultStyle - 可选的默认样式
   */
  resetLayerStyle: (layerId: string, defaultStyle?: LayerStyle) => void;
}
```

### 4.2 实现

```typescript
// store/use-map-store.ts

export const useMapStore = create<MapStoreState>()(
  immer((set, get) => ({
    // ... initialState

    // 打开样式面板
    openStylePanel: (layerId) =>
      set((state) => {
        state.stylePanel = {
          isOpen: true,
          layerId,
          unsavedChanges: false,
        };
      }),

    // 关闭样式面板
    closeStylePanel: () =>
      set((state) => {
        state.stylePanel = {
          isOpen: false,
          layerId: null,
          unsavedChanges: false,
        };
      }),

    // 更新图层样式
    updateLayerStyle: (layerId, style) =>
      set((state) => {
        const layer = state.layers.find((l) => l.id === layerId);
        if (layer) {
          layer.style = { ...layer.style, ...style };
        }
        // 标记为有未保存更改
        if (state.stylePanel.layerId === layerId) {
          state.stylePanel.unsavedChanges = true;
        }
      }),

    // 重置图层样式
    resetLayerStyle: (layerId, defaultStyle) =>
      set((state) => {
        const layer = state.layers.find((l) => l.id === layerId);
        if (layer) {
          layer.style = defaultStyle
            ? { ...defaultStyle }
            : {
                color: '#3b82f6',
                opacity: 1,
                width: 2,
                pointSize: 10
              };
        }
        // 清除未保存更改标记
        if (state.stylePanel.layerId === layerId) {
          state.stylePanel.unsavedChanges = false;
        }
      }),
  }))
);
```

---

## 5. 图层渲染集成

### 5.1 LayerRenderer 样式更新

```typescript
// renderer/layer-renderer.tsx

/**
 * 更新 Cesium 图层样式
 */
const updateLayerStyle = (
  layer: LayerState,
  dataSource: Cesium.DataSource,
) => {
  const entities = dataSource.entities.values;

  for (const entity of entities) {
    const color = Cesium.Color.fromCssColorString(layer.style.color || '#3388ff');
    const opacity = layer.style.opacity ?? 1;

    // 点样式
    if (entity.point) {
      entity.point.color = new Cesium.ConstantProperty(
        color.withAlpha(opacity),
      );
      entity.point.pixelSize = new Cesium.ConstantProperty(
        layer.style.pointSize || 10,
      );

      // 符号形状 (使用不同的 image)
      if (layer.style.pointSymbol) {
        const symbolMap: Record<string, string> = {
          circle: '/symbols/circle.svg',
          square: '/symbols/square.svg',
          triangle: '/symbols/triangle.svg',
          star: '/symbols/star.svg',
          diamond: '/symbols/diamond.svg',
        };
        entity.point.image = new Cesium.ConstantProperty(
          symbolMap[layer.style.pointSymbol] || symbolMap.circle,
        );
      }
    }

    // 线样式
    if (entity.polyline) {
      // 处理线型
      if (layer.style.lineType === 'dashed') {
        entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
          color: color.withAlpha(opacity),
          gapColor: Cesium.Color.TRANSPARENT,
          dashLength: layer.style.dashPattern?.[0] || 5,
          dashPattern: layer.style.dashPattern || [5, 5],
        });
      } else if (layer.style.lineType === 'dotted') {
        entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
          color: color.withAlpha(opacity),
          glowPower: 0.5,
        });
      } else {
        entity.polyline.material = new Cesium.ColorMaterialProperty(
          color.withAlpha(opacity),
        );
      }

      entity.polyline.width = new Cesium.ConstantProperty(
        layer.style.width || 2,
      );
    }

    // 面样式
    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(layer.style.opacity ?? 0.5),
      );

      if (layer.style.outlineColor) {
        entity.polygon.outlineColor = new Cesium.ConstantProperty(
          Cesium.Color.fromCssColorString(layer.style.outlineColor),
        );
        entity.polygon.outlineWidth = new Cesium.ConstantProperty(
          layer.style.outlineWidth || 1,
        );
      }
    }
  }
};
```

---

## 6. 数据流

### 6.1 样式设置完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户操作流程                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 用户在 LayerManager 中点击某图层的"样式设置"菜单项             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LayerManager 调用 openStylePanel(layerId)                    │
│     Store.stylePanel = { isOpen: true, layerId: 'xxx' }         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. StylePanel 组件检测到 stylePanel.isOpen = true               │
│     - 从 store 获取 layer 数据                                    │
│     - 自动识别 geometryType (Point/Line/Polygon)                │
│     - 渲染对应的预设样式和自定义选项                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 用户点击预设样式 / 调整自定义参数                            │
│     - 调用 updateLayerStyle(layerId, newStyle)                  │
│     - Store 更新 layer.style                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. LayerRenderer 检测到 layer.style 变化                         │
│     - 调用 updateLayerStyle() 更新 Cesium Entity                 │
│     - 地图实时预览新样式                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. 用户点击"重置样式"                                           │
│     - 调用 resetLayerStyle(layerId)                             │
│     - 恢复默认样式                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 几何类型识别流程

```
图层数据
    │
    ▼
┌─────────────────────────────────────────┐
│  1. 检查 layer.type                      │
│     - Model → Point                     │
└─────────────────────────────────────────┘
    │ (无结果)
    ▼
┌─────────────────────────────────────────┐
│  2. 检查 layer.data.features[0]          │
│     - geometry.type → Point/LineString/ │
│       Polygon                           │
└─────────────────────────────────────────┘
    │ (无结果)
    ▼
┌─────────────────────────────────────────┐
│  3. 检查 layer.name 关键词               │
│     - 包含"点"/"Point" → Point          │
│     - 包含"线"/"Line" → LineString      │
│     - 包含"面"/"区"/"Polygon" → Polygon │
└─────────────────────────────────────────┘
    │ (无结果)
    ▼
  默认 null (显示全部选项或禁用样式面板)
```

---

## 7. 图层类型判断逻辑

### 7.1 判断优先级

```typescript
/**
 * 从图层数据推断几何类型
 * @param layer - 图层状态
 * @returns 几何类型或 null
 */
function inferGeometryType(layer: LayerState): GeometryType | null {
  // 优先级 1: 从 Model 类型直接判断
  if (layer.type === 'Model') {
    return 'Point';
  }

  // 优先级 2: 从 GeoJSON 数据判断
  if (layer.data?.features?.length > 0) {
    const geomType = layer.data.features[0].geometry?.type;

    switch (geomType) {
      case 'Point':
      case 'MultiPoint':
        return 'Point';
      case 'LineString':
      case 'MultiLineString':
        return 'LineString';
      case 'Polygon':
      case 'MultiPolygon':
        return 'Polygon';
    }
  }

  // 优先级 3: 从图层名称关键词判断
  const name = layer.name.toLowerCase();

  if (name.includes('点') || name.includes('point')) {
    return 'Point';
  }
  if (name.includes('线') || name.includes('line') || name.includes('road')) {
    return 'LineString';
  }
  if (name.includes('面') || name.includes('区') || name.includes('polygon') || name.includes('zone')) {
    return 'Polygon';
  }

  // 无法判断
  return null;
}
```

### 7.2 示例场景

| 图层名称 | 图层类型 | 数据 geometry.type | 判断结果 |
|---------|---------|-------------------|---------|
| 成都市汽车销售展厅 | GeoJSON | Point | Point |
| 城市道路网 | GeoJSON | LineString | LineString |
| 行政区划 | GeoJSON | Polygon | Polygon |
| 建筑模型 | Model | N/A | Point |
| 未知数据 | GeoJSON | null | null (需用户确认) |

---

## 8. 预设样式设计

### 8.1 点图层预设

| ID | 名称 | 颜色 | 大小 | 符号 | 应用场景 |
|----|------|------|------|------|---------|
| point-blue-circle | 蓝色圆点 | #3b82f6 | 10px | circle | 默认点标记 |
| point-red-marker | 红色标记 | #ef4444 | 12px | circle | 重要位置标记 |
| point-green-square | 绿色方块 | #22c55e | 10px | square | 区域/设施标记 |
| point-yellow-star | 黄色星标 | #eab308 | 14px | star | 特殊/重点标记 |
| point-purple-diamond | 紫色菱形 | #a855f7 | 10px | diamond | 分类标记 |

### 8.2 线图层预设

| ID | 名称 | 颜色 | 线宽 | 线型 | 应用场景 |
|----|------|------|------|------|---------|
| line-solid-blue | 蓝色实线 | #3b82f6 | 2px | solid | 默认线 |
| line-dashed-red | 红色虚线 | #ef4444 | 2px | dashed | 边界/规划线 |
| line-bold-green | 绿色粗线 | #22c55e | 5px | solid | 重点路线 |
| line-gray-dotted | 灰色点线 | #6b7280 | 1px | dotted | 辅助线 |

### 8.3 面图层预设

| ID | 名称 | 填充色 | 不透明度 | 边框 | 应用场景 |
|----|------|--------|---------|------|---------|
| polygon-blue-fill | 蓝色填充 | #3b82f6 | 0.3 | 同色 2px | 默认区域 |
| polygon-red-fill | 红色填充 | #ef4444 | 0.3 | 同色 2px | 警戒/重点区 |
| polygon-transparent | 半透明 | #6b7280 | 0.1 | 同色 1px | 背景/参考区 |
| polygon-green-light | 浅绿填充 | #22c55e | 0.2 | 同色 1px | 生态/绿地区 |

---

## 9. 自定义样式选项

### 9.1 通用选项 (所有类型)

| 选项 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| 颜色 | Color Picker | Hex | #3b82f6 | 主颜色 |
| 不透明度 | Slider | 0-1 | 1 | 透明程度 |

### 9.2 点专属选项

| 选项 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| 尺寸单位 | Select | pixels/meters | pixels | 点大小的单位 |
| 大小 | Slider + Input | 4-30px (像素模式) / 50-5000m (米模式) | 10px | 点标记大小，可根据单位切换范围 |
| 符号形状 | Select | circle/square/triangle/star/diamond | circle | 点的图形符号 |

### 9.3 线专属选项

| 选项 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| 线宽 | Slider | 1-20px | 2px | 线条粗细 |
| 线型 | Select | solid/dashed/dotted | solid | 线条样式 |

### 9.4 面专属选项

| 选项 | 类型 | 范围 | 默认值 | 说明 |
|------|------|------|--------|------|
| 边框颜色 | Color Picker | Hex | 同填充色 | 边界线颜色 |
| 边框宽度 | Slider | 0-10px | 1px | 边界线粗细 |

---

## 10. 交互细节

### 10.1 面板显示/隐藏

- **打开**: 点击图层管理器的"样式设置" → 右侧滑出面板
- **关闭**: 点击面板右上角 X 按钮 → 右侧滑入隐藏
- **位置**: 固定在地图右上角，z-index 高于其他 UI

### 10.2 实时反馈

- 样式修改后**立即**更新地图渲染
- 无需手动保存
- 关闭面板后样式保持

### 10.3 重置确认

- 点击"重置样式"后弹出确认对话框
- 确认后恢复默认样式
- 取消则保持当前样式

### 10.4 错误处理

| 场景 | 处理 |
|------|------|
| 图层被删除时打开面板 | 自动关闭面板 |
| 几何类型无法识别 | 显示通用选项或提示 |
| 样式更新失败 | 回滚到原样式并提示 |

---

## 11. AI 集成

### 11.1 AI 指令格式

```json
{
  "action": "SET_STYLE",
  "payload": {
    "layerId": "layer-uuid",
    "style": {
      "color": "#ef4444",
      "pointSize": 15,
      "opacity": 0.8
    }
  }
}
```

### 11.2 AI 可执行操作

| 操作 | 参数 | 示例 |
|------|------|------|
| 设置颜色 | layerId, color | "把销售展厅改成红色" |
| 调整大小 | layerId, pointSize | "把标记点放大" |
| 修改透明度 | layerId, opacity | "让区域更透明一些" |
| 应用预设 | layerId, presetId | "使用红色标记样式" |
| 重置样式 | layerId | "恢复默认样式" |

### 11.3 状态回传

```json
{
  "eventType": "STATE_UPDATE",
  "payload": {
    "layers": [
      {
        "id": "layer-uuid",
        "name": "成都市汽车销售展厅",
        "geometryType": "Point",
        "style": {
          "color": "#ef4444",
          "pointSize": 15,
          "opacity": 0.8,
          "pointSymbol": "circle"
        }
      }
    ]
  }
}
```

---

## 12. 测试用例

### 12.1 单元测试

```typescript
// style-panel.spec.tsx

describe('StylePanel', () => {
  it('should auto-detect Point geometry type from GeoJSON', () => {
    // Given
    const layer = {
      id: 'test-1',
      name: 'Test Points',
      type: 'GeoJSON',
      data: {
        features: [{ geometry: { type: 'Point' } }]
      }
    };

    // When
    const geometryType = inferGeometryType(layer);

    // Then
    expect(geometryType).toBe('Point');
  });

  it('should auto-detect LineString geometry type from layer name', () => {
    // Given
    const layer = {
      id: 'test-2',
      name: '城市道路线',
      type: 'GeoJSON',
      data: { features: [] }
    };

    // When
    const geometryType = inferGeometryType(layer);

    // Then
    expect(geometryType).toBe('LineString');
  });

  it('should apply preset style correctly', () => {
    // Given
    const preset = POINT_PRESETS[0];
    const mockUpdateStyle = vi.fn();

    // When
    mockUpdateStyle('layer-1', preset.style);

    // Then
    expect(mockUpdateStyle).toHaveBeenCalledWith('layer-1', {
      color: '#3b82f6',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'circle'
    });
  });
});
```

### 12.2 集成测试

```typescript
// style-panel.integration.spec.tsx

describe('StylePanel Integration', () => {
  it('should open panel when clicking "样式设置" in LayerManager', async () => {
    // Given
    render(<MapViewer />);
    await waitFor(() => {
      expect(screen.getByText('图层管理')).toBeInTheDocument();
    });

    // When
    const layerActions = await screen.findAllByRole('button', { name: /更多/i });
    await userEvent.click(layerActions[0]);

    const styleMenuItem = await screen.findByText('样式设置');
    await userEvent.click(styleMenuItem);

    // Then
    expect(await screen.findByText('样式设置')).toBeInTheDocument();
    expect(useMapStore.getState().stylePanel.isOpen).toBe(true);
  });

  it('should update style in real-time when slider changes', async () => {
    // Given
    render(<MapViewer />);
    // ... setup layer and open panel

    // When
    const opacitySlider = await screen.findByLabelText('不透明度');
    await userEvent.click(opacitySlider);

    // Then
    // Verify Cesium entity style updated
  });
});
```

---

## 13. 附录

### 13.1 相关文件清单

| 文件路径 | 说明 |
|---------|------|
| `components/style-panel.tsx` | 样式面板组件 |
| `constants/style-presets.ts` | 预设样式定义 |
| `types/map-state.ts` | 类型定义 |
| `store/use-map-store.ts` | Store 实现 |
| `renderer/layer-renderer.tsx` | 渲染器样式更新 |
| `components/layer-manager.tsx` | 图层管理器 (触发入口) |

### 13.2 依赖组件

- `@txwx-monorepo/ui-kit` - UI 组件库
- `lucide-react` - 图标库
- `zustand` - 状态管理
- `cesium` - 3D 渲染引擎

### 13.3 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-02-28 | 初始设计文档 |
| 1.1 | 2026-03-02 | 更新架构方案为混合方案（配置驱动），添加组件文件结构和扩展指南 |
