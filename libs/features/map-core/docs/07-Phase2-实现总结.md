# Phase 2 实现总结 - 样式面板 UI 与渲染器集成

## 已完成内容

### 1. 样式面板 UI 扩展

#### 1.1 RenderModeControl 组件

**文件**: `components/style-panel/controls/render-mode-control.tsx`

**功能**: 渲染模式切换（2D 点 / 3D 广告牌）

**特性**:
- 卡片式按钮设计
- 图标指示（Layers / Image）
- 性能提示（高性能 / 高表现力）
- 选中状态高亮

**使用示例**:
```tsx
<RenderModeControl
  value={layer.style.pointRenderMode || 'billboard'}
  onChange={(pointRenderMode) =>
    updateLayerStyle(layer.id, { pointRenderMode })
  }
/>
```

---

#### 1.2 ImageUploadControl 组件

**文件**: `components/style-panel/controls/image-upload-control.tsx`

**功能**: 自定义图标上传

**特性**:
- 文件类型检查（仅图片）
- 文件大小限制（5MB）
- 实时预览
- DataURL 转换
- 上传状态显示

**使用示例**:
```tsx
<ImageUploadControl
  value={layer.style.pointImageUri}
  onChange={(pointImageUri) =>
    updateLayerStyle(layer.id, { pointImageUri })
  }
/>
```

---

#### 1.3 LabelControl 组件

**文件**: `components/style-panel/controls/label-control.tsx`

**功能**: 文字标注配置

**特性**:
- 开关控制
- 字段选择（从要素属性）
- 自定义文字输入
- 字体大小选择
- 填充/轮廓颜色选择器
- 轮廓宽度滑块
- 垂直位置选择（上/中/下）

**使用示例**:
```tsx
<LabelControl
  value={layer.style.label}
  onChange={(label) =>
    updateLayerStyle(layer.id, { label })
  }
  featureProperties={
    layer.data?.features?.[0]?.properties
      ? Object.keys(layer.data.features[0].properties)
      : []
  }
/>
```

---

#### 1.4 控件导出更新

**文件**: `components/style-panel/controls/index.ts`

**新增导出**:
```typescript
export { RenderModeControl } from './render-mode-control';
export { ImageUploadControl } from './image-upload-control';
export { LabelControl } from './label-control';
```

---

### 2. StylePanel 组件更新

**文件**: `components/style-panel/style-panel.tsx`

**变更**:
1. 导入新控件
2. 在 switch 语句中添加新控件类型处理

**新增 case**:
```typescript
case 'renderMode':
  return (
    <RenderModeControl
      key="renderMode"
      value={layer.style.pointRenderMode || 'billboard'}
      onChange={(pointRenderMode) =>
        updateLayerStyle(layer.id, { pointRenderMode })
      }
    />
  );

case 'rotation':
  return (
    <div key="rotation">
      <label className="text-sm text-gray-600 block mb-1">
        旋转角度
      </label>
      <input
        type="range"
        min="0"
        max="360"
        value={layer.style.pointRotation || 0}
        onChange={(e) =>
          updateLayerStyle(layer.id, {
            pointRotation: Number(e.target.value),
          })
        }
        className="w-full"
      />
      <div className="text-xs text-gray-400 text-right">
        {layer.style.pointRotation || 0}°
      </div>
    </div>
  );

case 'labelText':
  return (
    <LabelControl
      key="labelText"
      value={layer.style.label}
      onChange={(label) =>
        updateLayerStyle(layer.id, { label })
      }
      featureProperties={
        layer.data?.features?.[0]?.properties
          ? Object.keys(layer.data.features[0].properties)
          : []
      }
    />
  );
```

---

### 3. LayerRenderer 集成新渲染器

**文件**: `renderer/layer-renderer.tsx`

**核心变更**:

#### 3.1 新增引用
```typescript
import { PointRendererManager } from './point-renderer';

// 新增 ref
const pointRenderersRef = useRef<Map<string, PointRendererManager>>(new Map());
```

#### 3.2 新增 Helper 函数
```typescript
// Helper: Update Point Layer Styling using PointRenderer
const updatePointLayerStyle = async (
  layer: LayerState,
  viewer: Cesium.Viewer,
) => {
  if (layer.geometryType !== 'POINT') return;

  let renderer = pointRenderersRef.current.get(layer.id);

  if (!renderer) {
    renderer = new PointRendererManager();
    pointRenderersRef.current.set(layer.id, renderer);
  }

  await renderer.update(layer, viewer);
};
```

#### 3.3 修改 GeoJSON 加载
```typescript
// 禁用 Cesium 内置的点样式，由 PointRenderer 处理
dataSource = await Cesium.GeoJsonDataSource.load(data, {
  stroke: ...,
  fill: ...,
  strokeWidth: ...,
  pointRadius: 0,  // 关键：禁用内置点渲染
});
```

#### 3.4 修改样式更新逻辑
```typescript
if (styleChanged) {
  // 对于点图层，使用 PointRenderer
  if (layer.geometryType === 'POINT') {
    await updatePointLayerStyle(layer, viewer);
  }
  // 对于其他图层，使用传统样式更新
  updateLayerStyle(layer, ds);
}
```

#### 3.5 添加清理逻辑
```typescript
// Cleanup effect
useEffect(() => {
  return () => {
    pointRenderersRef.current.forEach((renderer) => {
      renderer.destroy();
    });
    pointRenderersRef.current.clear();
  };
}, []);
```

---

### 4. Store 扩展 - 要素级别控制

**文件**: `store/use-map-store.ts`

#### 4.1 新增 Action 类型
```typescript
interface MapStoreActions {
  // Feature Override Actions (精细化控制)
  setFeatureOverride: (
    layerId: string,
    featureId: string,
    override: Partial<FeatureOverride>,
  ) => void;
  clearFeatureOverride: (layerId: string, featureId: string) => void;
  batchSetFeatureOverrides: (
    layerId: string,
    overrides: Record<string, Partial<FeatureOverride>>,
  ) => void;
}
```

#### 4.2 Action 实现
```typescript
// 设置单个要素的覆盖配置
setFeatureOverride: (layerId, featureId, override) =>
  set((state) => {
    const layer = state.layers.find((l) => l.id === layerId);
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

// 清除单个要素的覆盖配置
clearFeatureOverride: (layerId, featureId) =>
  set((state) => {
    const layer = state.layers.find((l) => l.id === layerId);
    if (layer?.featureOverrides) {
      delete layer.featureOverrides[featureId];
    }
  }),

// 批量设置要素覆盖配置
batchSetFeatureOverrides: (layerId, overrides) =>
  set((state) => {
    const layer = state.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.featureOverrides = {
        ...layer.featureOverrides,
        ...overrides,
      };
    }
  }),
```

---

### 5. 样式配置更新

**文件**: `constants/style-config.ts`

**变更**:
1. 新增 ControlType: `'renderMode'`, `'rotation'`, `'labelText'`
2. 更新 POINT 配置 controls 列表
3. 新增预设 `point-simple-blue`（使用 point 模式）
4. 新增渲染模式选项 `POINT_RENDER_MODE_OPTIONS`
5. 新增符号形状 `'cross'`

```typescript
export const POINT_RENDER_MODE_OPTIONS = [
  { value: 'point', label: '2D 点' },
  { value: 'billboard', label: '3D 广告牌' },
];
```

---

## 文件清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `components/style-panel/controls/render-mode-control.tsx` | ✅ 新建 | 渲染模式切换组件 |
| `components/style-panel/controls/image-upload-control.tsx` | ✅ 新建 | 图片上传组件 |
| `components/style-panel/controls/label-control.tsx` | ✅ 新建 | 文字标注组件 |
| `components/style-panel/controls/index.ts` | ✅ 已更新 | 导出新增组件 |
| `components/style-panel/style-panel.tsx` | ✅ 已更新 | 集成新控件 |
| `renderer/layer-renderer.tsx` | ✅ 已重写 | 集成 PointRendererManager |
| `store/use-map-store.ts` | ✅ 已更新 | 新增要素级别控制 actions |
| `constants/style-config.ts` | ✅ 已更新 | 新增控件类型和选项 |

---

## 快速开始

### 1. 切换渲染模式
```typescript
// 在样式面板中点击渲染模式切换按钮
// 会自动触发 updateLayerStyle 更新 pointRenderMode
updateLayerStyle(layerId, { pointRenderMode: 'point' });
```

### 2. 上传自定义图标
```typescript
// 使用 ImageUploadControl 组件
// 上传后自动更新 pointImageUri
updateLayerStyle(layerId, { pointImageUri: 'data:image/png;base64,...' });
```

### 3. 配置文字标注
```typescript
// 启用标注并配置样式
updateLayerStyle(layerId, {
  label: {
    text: '{name}',  // 使用 name 字段
    font: '14px sans-serif',
    fillColor: '#ffffff',
    outlineColor: '#000000',
    outlineWidth: 1,
    verticalOrigin: 'TOP',
    pixelOffset: [0, 20],
  }
});
```

### 4. 精细化控制单点
```typescript
// 隐藏单个点
setFeatureOverride(layerId, 'feature-123', { visible: false });

// 单独显示某个点的标签
setFeatureOverride(layerId, 'feature-456', {
  showLabel: true,
  labelOverride: { text: '特殊标注' }
});

// 单独修改某个点的样式
setFeatureOverride(layerId, 'feature-789', {
  styleOverride: { color: '#ff0000', pointSize: 20 }
});
```

---

## 技术要点

### 1. PointRendererManager 的引入
- 每个点图层一个 PointRendererManager 实例
- 根据 `pointRenderMode` 自动选择渲染器
- 渲染模式变化时自动重建

### 2. 样式更新流程
```
用户操作 → updateLayerStyle → layer.geometryType === 'POINT'
                                    ↓
                          updatePointLayerStyle
                                    ↓
                          PointRendererManager.update()
                                    ↓
                          根据 mode 选择渲染器 → 更新场景
```

### 3. 要素级别控制
- 通过 `featureOverrides` 存储单点配置
- 渲染器读取覆盖配置并应用
- 支持 `visible`, `showLabel`, `labelOverride`, `styleOverride`

### 4. 资源管理
- PointRenderer 实例存储在 `pointRenderersRef`
- 图层删除时自动销毁对应渲染器
- 组件卸载时批量清理所有渲染器

---

## 下一步工作（Phase 3）

1. **属性表组件**: 批量编辑要素属性和标签显示
2. **要素列表**: 显示图层所有要素，支持单选/多选
3. **批量操作**: 批量设置可见性、标签显示
4. **查询功能**: 空间查询、属性查询
5. **性能优化**: 增量更新、缓存优化

---

## 注意事项

1. **GeoJSON 加载**: 必须设置 `pointRadius: 0` 禁用 Cesium 内置渲染
2. **渲染器清理**: 图层删除或组件卸载时必须调用 `destroy()`
3. **要素 ID**: 确保 GeoJSON 要素有唯一 `id` 字段
4. **图片大小**: 上传图标限制 5MB，避免性能问题
5. **标签字段**: `{fieldName}` 格式使用要素属性字段
