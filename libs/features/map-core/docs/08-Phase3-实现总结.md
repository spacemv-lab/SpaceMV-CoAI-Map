# Phase 3 实现总结 - 属性表与批量操作

## 已完成内容

### 1. AttributeTable 组件

**文件**: `components/attribute-panel/attribute-table.tsx`

**功能**: 显示图层所有要素列表，支持单选/多选

**特性**:
- 复选框选择（单个/全选）
- 搜索功能（按属性值过滤）
- 字段显示控制（默认显示前 5 个字段）
- 要素可见性状态指示（隐藏要素半透明显示）
- 选中状态高亮
- 批量操作栏（选中后自动显示）

**批量操作支持**:
- 显示/隐藏选中要素
- 显示/隐藏选中要素的标签

**使用示例**:
```tsx
<AttributeTable
  layerId={layerId}
  selectedFeatureIds={selectedFeatureIds}
  onSelectionChange={setSelectedFeatureIds}
/>
```

---

### 2. BatchActions 组件

**文件**: `components/attribute-panel/batch-actions.tsx`

**功能**: 对选中要素进行批量设置

**特性**:
- 下拉菜单设计
- 可见性批量设置（显示/隐藏）
- 标签显示批量设置（显示/隐藏）
- 标签文字批量设置（支持 `{字段名}` 格式）
- 清除所有覆盖配置

**使用示例**:
```tsx
<BatchActions
  layerId={layerId}
  selectedFeatureIds={Array.from(selectedFeatureIds)}
  onBatchComplete={() => setSelectedFeatureIds(new Set())}
/>
```

---

### 3. FilterBar 组件

**文件**: `components/attribute-panel/filter-bar.tsx`

**功能**: 属性查询和过滤

**特性**:
- 多条件过滤
- 逻辑运算符（且/或）
- 支持 5 种运算符：
  - `equals`: 等于
  - `contains`: 包含
  - `greater`: 大于
  - `less`: 小于
  - `in`: 属于（逗号分隔的多个值）
- 动态添加/删除条件
- 字段自动从要素属性获取
- 清除过滤

**使用示例**:
```tsx
<FilterBar
  layerId={layerId}
  onFilterChange={(filterFn) => setFilterFn(() => filterFn)}
/>
```

---

### 4. AttributePanel 主组件

**文件**: `components/attribute-panel/attribute-panel.tsx`

**功能**: 整合属性表、批量操作、过滤等功能

**特性**:
- 折叠/展开设计（默认展开高度 320px，折叠后 40px）
- 自动绑定当前活动图层
- 状态联动（图层变化时清空选择）
- 子组件整合

**使用示例**:
```tsx
// 在 map-viewer.tsx 中
<div className="absolute bottom-0 left-0 right-0 z-20">
  <AttributePanel />
</div>
```

---

### 5. 目录结构

```
components/attribute-panel/
├── attribute-table.tsx      # 属性表组件
├── batch-actions.tsx        # 批量操作组件
├── filter-bar.tsx           # 过滤栏组件
├── attribute-panel.tsx      # 主组件
└── index.ts                 # 导出文件
```

---

## 功能演示

### 1. 要素选择

**单选**: 点击要素行即可选中/取消选中

**全选**: 点击表头复选框，选中当前过滤条件下的所有要素

**显示状态**:
- 选中行：蓝色背景高亮
- 隐藏要素：半透明显示

### 2. 搜索要素

在搜索框输入关键词，自动按属性值过滤要素

```
搜索 "张三" → 显示所有属性值包含"张三"的要素
```

### 3. 多条件过滤

1. 点击"添加条件"
2. 选择字段（如 `name`）
3. 选择运算符（如 `contains`）
4. 输入值（如 `学校`）
5. 再次点击"添加条件"添加更多条件
6. 选择逻辑关系（且/或）
7. 点击"应用过滤"

**示例**:
```
条件 1: name 包含 学校
条件 2: AND 面积 大于 1000
条件 3: OR 类型 属于 教育，医疗，政府
```

### 4. 批量操作

选中多个要素后，批量操作栏自动显示：

**可见性操作**:
- 显示：将所有选中要素设为可见
- 隐藏：将所有选中要素设为隐藏

**标签操作**:
- 显示标签：显示所有选中要素的标签
- 隐藏标签：隐藏所有选中要素的标签
- 批量设置标签文字：统一设置标签内容

---

## 技术实现

### 1. 状态管理

```typescript
// 选中的要素 ID
const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());

// 过滤函数
const [filterFn, setFilterFn] = useState<((feature: any) => boolean) | null>(null);

// 活动图层
const activeLayer = useMapStore((state) => state.layers.find(l => l.id === activeLayerId));
```

### 2. 要素过滤逻辑

```typescript
const filteredFeatures = useMemo(() => {
  if (!layer?.data?.features) return [];
  if (!searchTerm) return layer.data.features;

  const term = searchTerm.toLowerCase();
  return layer.data.features.filter((feature) => {
    const props = feature.properties || {};
    return Object.values(props).some((value) =>
      String(value).toLowerCase().includes(term)
    );
  });
}, [layer, searchTerm]);
```

### 3. 多条件过滤应用

```typescript
const applyFilter = () => {
  const filterFn = (feature: any) => {
    const props = feature.properties || {};

    const results = conditions.map((condition) => {
      const propValue = props[condition.field];
      const compareValue = condition.value;

      switch (condition.operator) {
        case 'equals': return String(propValue) === compareValue;
        case 'contains': return String(propValue).includes(compareValue);
        case 'greater': return Number(propValue) > Number(compareValue);
        case 'less': return Number(propValue) < Number(compareValue);
        case 'in': return compareValue.split(',').includes(String(propValue));
      }
    });

    return logicOperator === 'and'
      ? results.every((r) => r)
      : results.some((r) => r);
  };

  onFilterChange?.(filterFn);
};
```

### 4. 批量覆盖设置

```typescript
const handleSetVisible = (visible: boolean) => {
  const overrides: Record<string, { visible: boolean }> = {};
  selectedFeatureIds.forEach((id) => {
    overrides[id] = { visible };
  });
  batchSetFeatureOverrides(layerId, overrides);
};
```

---

## 快速开始

### 1. 打开属性表

1. 在图层管理器中点击"开启编辑"
2. 属性表自动显示在底部
3. 点击头部可折叠/展开

### 2. 选择要素

```typescript
// 单选：点击行
// 全选：点击表头复选框
```

### 3. 搜索要素

```
在搜索框输入关键词即可实时过滤
```

### 4. 添加过滤条件

1. 点击"添加条件"
2. 选择字段、运算符、输入值
3. 点击"应用过滤"

### 5. 批量操作

1. 选中多个要素
2. 批量操作栏自动显示
3. 选择操作类型（显示/隐藏/标签）
4. 点击执行

---

## 与 Store 集成

### 使用的 Actions

```typescript
// 批量设置覆盖
batchSetFeatureOverrides: (
  layerId: string,
  overrides: Record<string, Partial<FeatureOverride>>
) => void;

// 单个设置覆盖
setFeatureOverride: (
  layerId: string,
  featureId: string,
  override: Partial<FeatureOverride>
) => void;
```

### 数据流向

```
用户操作 → 组件内部处理 → Store Action → 更新 LayerState
                                    ↓
                          featureOverrides 更新
                                    ↓
                          PointRenderer 读取并应用
                                    ↓
                          场景更新
```

---

## 下一步工作

### 1. 增强功能

- [ ] 字段类型识别（数值/日期/枚举）
- [ ] 高级数值运算符（介于、百分比）
- [ ] 日期选择器
- [ ] 排序功能（点击字段头排序）
- [ ] 导出选中要素（GeoJSON/CSV）

### 2. 性能优化

- [ ] 虚拟滚动（大数据量）
- [ ] 分页加载
- [ ] 防抖搜索

### 3. 用户体验

- [ ] 右键菜单
- [ ] 键盘快捷键
- [ ] 列宽调整
- [ ] 字段固定（冻结列）
- [ ] 自定义字段显示顺序

---

## 注意事项

1. **要素 ID**: 确保 GeoJSON 要素有唯一 `id` 字段
2. **大数据量**: 超过 1000 个要素时建议启用分页
3. **搜索性能**: 搜索时使用防抖避免频繁计算
4. **过滤持久化**: 切换图层时过滤条件会重置
5. **批量操作**: 大量要素（1000+）批量操作时可能有延迟
