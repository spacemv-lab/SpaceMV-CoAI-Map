# Cesium 图层管理机制分析与设计

## 1. 问题背景

Cesium 本身**没有图层（Layer）的概念**，它使用的是以下数据结构：

| Cesium 原生概念 | 用途 | 局限性 |
|----------------|------|--------|
| `ImageryLayer` | 底图/影像图层 | 仅支持栅格数据，不支持矢量 |
| `DataSource` | 矢量数据源（GeoJSON、KML、CZML） | 管理离散，缺乏统一控制 |
| `Entity` | 单个几何对象 | 数量多时性能差 |
| `Primitive` | 低级图形对象 | API 底层，使用复杂 |
| `GroundPrimitive` | 贴地几何 | 仅支持特定几何类型 |

**核心问题**：如何在 Cesium 之上实现类似 GIS 软件（ArcGIS、QGIS）的**图层层级管理**？

---

## 2. 当前实现方案分析

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (React)                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              LayerManager 组件                    │    │
│  │  - 图层列表显示                                   │    │
│  │  - 拖拽重排序                                     │    │
│  │  - 可见性控制                                     │    │
│  │  - 图层操作菜单                                   │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │                 Zustand Store                   │    │
│  │  - layers: LayerState[]                         │    │
│  │  - 统一的图层状态管理                            │    │
│  │  - actions: add/remove/update/reorder           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         │ 订阅状态变化
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   渲染层 (LayerRenderer)                │
│  ┌─────────────────────────────────────────────────┐    │
│  │           dataSourcesRef: Map<string,           │    │
│  │                        Cesium.DataSource>       │    │
│  │  - 维护 Layer ID → Cesium DataSource 的映射     │    │
│  │  - 增量更新（检测变化）                          │    │
│  │  - 状态同步（reconciliation）                   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Cesium Viewer                          │
│  - viewer.dataSources: DataSourceCollection            │
│  - 实际的渲染和交互                                      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 核心设计模式

#### 模式 1：逻辑图层与物理渲染分离

```typescript
// 逻辑图层（应用层）
interface LayerState {
  id: string;           // 唯一标识
  name: string;         // 显示名称
  type: 'GeoJSON' | 'Tile' | 'Model' | 'Draw';
  geometryType?: GeometryType;
  visible: boolean;     // 可见性
  opacity: number;      // 透明度
  style: LayerStyle;    // 样式配置
  sourceId?: string;    // 关联后端数据集
  data?: GeoJSON;       // GeoJSON 数据（Draw 层）
  // dataSource 字段被注释掉，因为它是非序列化的 Cesium 引用
}

// 物理渲染（Cesium 层）
// dataSourcesRef.current: Map<string, Cesium.DataSource>
// Key = LayerState.id, Value = Cesium.DataSource
```

**优势**：
- 应用层保持纯净的 JavaScript 对象，可序列化/持久化
- 渲染层负责与 Cesium 交互，可热更新
- 支持多个逻辑图层共享同一个 Cesium DataSource（虽然当前未使用）

#### 模式 2：引用式状态管理

```typescript
// use-map-store.ts
const dataSourcesRef = useRef<Map<string, Cesium.DataSource>>(new Map());
const prevLayersRef = useRef<Map<string, LayerState>>(new Map());
```

**作用**：
- `dataSourcesRef`: 维护 Layer ID 到 Cesium DataSource 的映射，用于增量更新
- `prevLayersRef`: 缓存上一帧的图层状态，用于检测变化（避免不必要的更新）

#### 模式 3：增量同步（Reconciliation）

```typescript
// layer-renderer.tsx:265-345 syncLayers()
const syncLayers = async () => {
  const viewer = window.CESIUM_VIEWER;
  if (!viewer) return;

  // 1. 恢复引用（如果 renderer 重新挂载）
  if (dataSourcesRef.current.size === 0 && viewer.dataSources.length > 0) {
    const validLayerIds = new Set(layers.map((l) => l.id));
    for (let i = 0; i < viewer.dataSources.length; i++) {
      const ds = viewer.dataSources.get(i);
      if (validLayerIds.has(ds.name)) {
        dataSourcesRef.current.set(ds.name, ds);
      }
    }
  }

  // 2. 删除不再存在的图层
  const validLayerIds = new Set(layers.map((l) => l.id));
  for (const id of dataSourcesRef.current.keys()) {
    if (!validLayerIds.has(id)) {
      const ds = dataSourcesRef.current.get(id);
      if (ds) {
        viewer.dataSources.remove(ds, true);
        dataSourcesRef.current.delete(id);
      }
    }
  }

  // 3. 添加或更新图层
  for (const layer of layers) {
    let ds = dataSourcesRef.current.get(layer.id);

    // 检测是否需要重新加载数据
    const needsReload = /* 检测 data 或 sourceId 变化 */;

    if (needsReload && ds) {
      viewer.dataSources.remove(ds, true);
      dataSourcesRef.current.delete(layer.id);
      ds = undefined;
    }

    if (!ds) {
      await addLayerToViewer(layer, viewer);
      ds = dataSourcesRef.current.get(layer.id);
    }

    if (ds) {
      // 更新可见性
      if (ds.show !== layer.visible) {
        ds.show = layer.visible;
      }

      // 更新样式（如果变化）
      const styleChanged = !prevLayer ||
        JSON.stringify(prevLayer.style) !== JSON.stringify(layer.style);
      if (styleChanged) {
        updateLayerStyle(layer, ds);
      }
    }
  }
};
```

**同步流程**：
1. 恢复引用（处理组件重新挂载）
2. 删除无效图层
3. 添加/更新图层
   - 检测数据变化 → 重新加载
   - 检测可见性变化 → 更新 `ds.show`
   - 检测样式变化 → 更新 Entity 属性

### 2.3 图层操作实现

| 操作 | 实现方式 | Cesium 对应 |
|------|---------|------------|
| 添加图层 | `addLayer()` → `syncLayers()` → `addLayerToViewer()` | `viewer.dataSources.add()` |
| 删除图层 | `removeLayer()` → `syncLayers()` → `viewer.dataSources.remove()` | `viewer.dataSources.remove(ds, true)` |
| 重排序 | `reorderLayers(from, to)` → 修改 `layers` 数组顺序 | **无直接对应**（见下文） |
| 可见性 | `setLayerVisibility(id, visible)` → `ds.show = visible` | `DataSource.show` |
| 样式更新 | `updateLayerStyle()` → 遍历 `entities` | `entity.point/polyline/polygon.*` |
| 要素增删改 | `updateLayerData()` → 重新加载 DataSource | 重新 `load()` GeoJSON |

---

## 3. 现有实现的局限性

### 3.1 显示层级（Z-Order）问题

**当前实现**：
```typescript
// store 中的图层数组顺序
layers: LayerState[]  // 数组索引 = 渲染顺序

// layer-manager.tsx 中支持拖拽重排序
const handleDrop = (e: React.DragEvent, index: number) => {
  if (draggedItemIndex !== null && draggedItemIndex !== index) {
    reorderLayers(draggedItemIndex, index);
  }
};
```

**问题**：Cesium 的 `DataSourceCollection` **没有 z-index 概念**！

Cesium 的渲染顺序取决于：
1. **添加顺序**：先添加的 DataSource 先渲染（在下层）
2. **Primitive 的 renderOrder**（仅适用于 Primitive 集合）
3. **深度测试**：3D 场景中的深度缓冲

**当前解决方案的缺陷**：
```typescript
// 当前代码中，重排序后并没有重新调整 Cesium DataSource 的顺序
// 用户拖拽调整了 layers 数组顺序，但 viewer.dataSources 顺序不变！
```

### 3.2 要素级别操作困难

**当前实现**：
```typescript
// 更新要素属性
updateLayerFeature: (layerId, featureId, properties) => {
  const layer = state.layers.find(l => l.id === layerId);
  if (layer?.data) {
    const feature = layer.data.features.find(f => f.id === featureId);
    if (feature) {
      feature.properties = { ...feature.properties, ...properties };
    }
  }
  // 注意：这只更新了 store 中的 GeoJSON！
  // Cesium 中的 Entity 并不会自动更新
};
```

**问题**：
- 修改 `layer.data.features` 后，需要重新加载整个 DataSource
- 无法高效更新单个要素
- 频繁重加载导致性能问题和闪烁

### 3.3 样式更新性能问题

```typescript
const updateLayerStyle = (layer: LayerState, dataSource: Cesium.DataSource) => {
  // 遍历所有 Entity
  const entities = dataSource.entities.values;
  for (const entity of entities) {
    // 逐个更新属性
    if (entity.polygon) {
      entity.polygon.material = new Cesium.ColorMaterialProperty(...);
    }
    // ...
  }
};
```

**问题**：
- 每次样式变化都要遍历所有 Entity
- 大量 Entity 时性能差（1000+ 要素明显卡顿）
- 创建大量 `ConstantProperty` 对象增加 GC 压力

---

## 4. 改进方案设计

### 4.1 图层显示层级（Z-Order）控制

#### 方案 A：重建 DataSource 顺序（推荐）

```typescript
const syncLayers = async () => {
  // ... 现有逻辑 ...

  // 新增：根据 layers 数组顺序调整 DataSource 顺序
  const viewer = window.CESIUM_VIEWER;

  // Cesium DataSourceCollection 没有直接的 reorder 方法
  // 需要移除后按顺序重新添加
  const orderedLayerIds = layers.map(l => l.id);

  // 移除所有由我们管理的 DataSource
  for (let i = viewer.dataSources.length - 1; i >= 0; i--) {
    const ds = viewer.dataSources.get(i);
    if (dataSourcesRef.current.has(ds.name)) {
      viewer.dataSources.remove(ds, false); // false = 不销毁
    }
  }

  // 按顺序重新添加
  for (const layerId of orderedLayerIds) {
    const ds = dataSourcesRef.current.get(layerId);
    if (ds) {
      viewer.dataSources.add(ds);
    }
  }
};
```

**优势**：简单直接，符合 Cesium 的渲染机制
**劣势**：重排序时有短暂的性能开销

#### 方案 B：使用 Primitive 集合（高级）

```typescript
// 不使用 DataSource，直接使用 Primitive 集合
const layerPrimitivesRef = useRef<Map<string, Cesium.PrimitiveCollection>>(new Map());

// 每个图层一个 PrimitiveCollection
const layerCollection = new Cesium.PrimitiveCollection();
layerPrimitivesRef.current.set(layerId, layerCollection);

// PrimitiveCollection 有 renderOrder 属性
layerCollection.renderOrder = index; // 数字越小越先渲染（在下层）
```

**优势**：真正的 z-order 控制，无需重建
**劣势**：
- 需要重写整个渲染逻辑
- 失去 DataSource 的高级功能（如自动聚合）
- 代码复杂度大幅增加

### 4.2 要素级别操作优化

#### 方案 A：Entity 缓存与增量更新

```typescript
// 在 dataSourcesRef 基础上，增加 entities 映射
const entitiesRef = useRef<Map<string, Map<string, Cesium.Entity>>>(new Map());
// Layer ID → Feature ID → Entity

const addFeature = (layerId: string, feature: GeoJSONFeature) => {
  const ds = dataSourcesRef.current.get(layerId);
  if (!ds) return;

  const entity = ds.entities.add({
    id: feature.id,
    // ... 根据 feature.geometry 创建
  });

  entitiesRef.current.get(layerId).set(feature.id, entity);
};

const updateFeature = (layerId: string, featureId: string, properties: Record<string, unknown>) => {
  const entityMap = entitiesRef.current.get(layerId);
  const entity = entityMap?.get(featureId);
  if (entity) {
    // 直接更新 Entity 属性，无需重新加载
    entity.properties = new Cesium.PropertyBag({
      ...properties
    });
  }
};

const removeFeature = (layerId: string, featureId: string) => {
  const ds = dataSourcesRef.current.get(layerId);
  const entityMap = entitiesRef.current.get(layerId);
  const entity = entityMap?.get(featureId);
  if (entity) {
    ds.entities.remove(entity);
    entityMap.delete(featureId);
  }
};
```

**优势**：
- 真正的增量更新
- 无需重新加载整个 DataSource
- 支持高效的要素级别操作

**劣势**：
- 需要维护额外的映射关系
- 初始化加载时需要建立映射

#### 方案 B：使用 EntityCollection 的 byId 索引

```typescript
// Cesium EntityCollection 本身支持 byId 访问
const ds = dataSourcesRef.current.get(layerId);
const entity = ds.entities.getById(featureId);

if (entity) {
  entity.properties = new Cesium.PropertyBag(properties);
}
```

**注意**：这要求创建 Entity 时正确设置 `id` 属性。

### 4.3 样式更新性能优化

#### 方案 A：样式缓存与材质复用

```typescript
// 缓存创建的材质
const materialCache = useRef<Map<string, Cesium.Material>>(new Map());

const getMaterial = (color: string, opacity: number) => {
  const key = `${color}-${opacity}`;
  if (!materialCache.current.has(key)) {
    materialCache.current.set(key, new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString(color).withAlpha(opacity)
    ));
  }
  return materialCache.current.get(key);
};

const updateLayerStyle = (layer: LayerState, dataSource: Cesium.DataSource) => {
  const material = getMaterial(layer.style.color, layer.style.opacity);

  for (const entity of dataSource.entities.values) {
    if (entity.polygon) {
      entity.polygon.material = material; // 复用材质
    }
  }
};
```

#### 方案 B：使用回调式样式（MaterialAppearance）

```typescript
// 对于 Primitive 方式，可以使用 Appearance 的 callback
const appearance = new Cesium.MaterialAppearance({
  material: new Cesium.Material({
    fabric: {
      type: 'Color',
      uniforms: {
        color: getColorForFeature // 回调函数
      }
    }
  }),
  vertexShader: '...', // 自定义着色器
});
```

---

## 5. 完整图层控制 API 设计

```typescript
interface ILayerManager {
  // ===== 图层级别操作 =====

  /** 添加图层 */
  addLayer(layer: Omit<LayerState, 'id'>): string;

  /** 删除图层 */
  removeLayer(layerId: string): void;

  /** 更新图层属性 */
  updateLayer(layerId: string, updates: Partial<LayerState>): void;

  /** 重排序图层 */
  reorderLayer(fromIndex: number, toIndex: number): void;

  /** 获取图层 */
  getLayer(layerId: string): LayerState | undefined;

  /** 获取所有图层 */
  getLayers(): LayerState[];

  /** 设置图层可见性 */
  setLayerVisible(layerId: string, visible: boolean): void;

  /** 设置图层透明度 */
  setLayerOpacity(layerId: string, opacity: number): void;

  /** 设置图层样式 */
  setLayerStyle(layerId: string, style: Partial<LayerStyle>): void;

  /** 缩放至图层范围 */
  zoomToLayer(layerId: string): Promise<void>;

  // ===== 要素级别操作 =====

  /** 添加要素 */
  addFeature(layerId: string, feature: GeoJSONFeature): string;

  /** 删除要素 */
  removeFeature(layerId: string, featureId: string): void;

  /** 更新要素属性 */
  updateFeature(layerId: string, featureId: string, properties: Record<string, unknown>): void;

  /** 获取要素 */
  getFeature(layerId: string, featureId: string): GeoJSONFeature | undefined;

  /** 获取图层所有要素 */
  getFeatures(layerId: string): GeoJSONFeature[];

  /** 查询要素（空间/属性） */
  queryFeatures(layerId: string, filter: QueryFilter): GeoJSONFeature[];

  // ===== 选择与高亮 =====

  /** 选中要素 */
  selectFeature(layerId: string, featureId: string): void;

  /** 取消选择 */
  clearSelection(): void;

  /** 高亮要素 */
  highlightFeature(layerId: string, featureId: string, style: HighlightStyle): void;

  /** 清除高亮 */
  clearHighlight(layerId: string, featureId: string): void;
}
```

---

## 6. 实施建议

### 6.1 短期（Bug 修复与基础优化）

1. **修复 Z-Order 问题**：重排序时同步调整 Cesium DataSource 顺序
2. **建立 Entity 索引**：利用 `EntityCollection.getById()` 支持要素级操作
3. **修复点样式 Bug**：参考前一份文档的实现

### 6.2 中期（功能增强）

1. **实现完整的要素 CRUD API**
2. **添加样式缓存机制**
3. **实现 `zoomToLayer` 功能**
4. **添加要素查询功能**

### 6.3 长期（架构升级）

1. **评估是否迁移到 Primitive 架构**（针对大规模数据）
2. **实现图层组/文件夹功能**
3. **添加图层快照与回滚**
4. **支持多源数据融合**（WMS、WFS、3D Tiles）

---

## 7. 总结

| 问题 | 当前状态 | 建议方案 |
|------|---------|---------|
| 图层增删 | ✅ 已实现 | 保持 |
| 图层可见性 | ✅ 已实现 | 保持 |
| 图层样式 | ⚠️ 部分实现（点样式有 Bug） | 修复 Bug + 缓存优化 |
| 图层重排序 | ⚠️ Store 层实现，Cesium 未同步 | 重排序时重建 DataSource 顺序 |
| 要素增删 | ❌ 未实现 | 建立 Entity 索引，增量更新 |
| 要素修改 | ⚠️ 仅 Store 层 | 同步更新 Entity |
| 要素查询 | ❌ 未实现 | 添加空间/属性查询 API |
| 选择高亮 | ⚠️ 基础实现 | 完善选择状态管理 |

**核心设计原则**：
1. **逻辑与物理分离**：Store 保持纯净状态，Renderer 负责 Cesium 交互
2. **增量更新**：避免全量重建，最小化 Cesium 操作
3. **引用追踪**：维护 Layer ID → DataSource → Entity 的映射链
4. **渐进优化**：先用 DataSource 快速迭代，性能瓶颈时考虑 Primitive
