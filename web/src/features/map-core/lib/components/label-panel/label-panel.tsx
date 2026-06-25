/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../../store/use-map-store';
import { useState, useRef } from 'react';
import { X, Tag, ChevronDown } from 'lucide-react';
import { GeometryType, LayerFieldDefinition, LabelStyle } from '../../types/map-state';
import { getDefaultLabelPosition, DEFAULT_LABEL_ANCHOR_CANDIDATES, PointLabelPosition } from '../../types/label-position';
import { insertFieldToExpression } from '../../renderer/label-expression-parser';

/**
 * 标注面板主组件
 * 独立面板，与样式面板同级
 */
export function LabelPanel() {
  const labelPanel = useMapStore((state) => state.labelPanel);
  const layers = useMapStore((state) => state.layers);
  const closeLabelPanel = useMapStore((state) => state.closeLabelPanel);
  const updateLabelStyle = useMapStore((state) => state.updateLabelStyle);

  // 插入字段下拉状态
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const expressionInputRef = useRef<HTMLInputElement>(null);

  const layer = layers.find((l) => l.id === labelPanel.layerId);

  if (!labelPanel.isOpen || !layer) {
    return null;
  }

  const labelStyle = layer.style?.label || {};
  const geometryType = layer.geometryType;
  const fields = layer.fields || [];

  // 处理总开关
  const handleToggleEnabled = (enabled: boolean) => {
    updateLabelStyle(layer.id, { enabled });
  };

  // 处理标注内容变化
  const handleExpressionChange = (expression: string) => {
    updateLabelStyle(layer.id, { expression });
  };

  // 处理插入字段
  const handleInsertField = (fieldName: string) => {
    const currentExpression = labelStyle.expression || '';
    const cursorPosition = expressionInputRef.current?.selectionStart;
    const newExpression = insertFieldToExpression(currentExpression, fieldName, cursorPosition);
    handleExpressionChange(newExpression);
    setShowFieldDropdown(false);
    // Focus back to input
    expressionInputRef.current?.focus();
  };

  // 处理可见范围变化
  const handleMinZoomChange = (minZoom: number) => {
    updateLabelStyle(layer.id, { minZoom });
  };

  const handleMaxZoomChange = (maxZoom: number) => {
    updateLabelStyle(layer.id, { maxZoom });
  };

  // 处理字号变化
  const handleFontSizeChange = (fontSize: number) => {
    updateLabelStyle(layer.id, { fontSize });
  };

  // 处理颜色变化
  const handleFillColorChange = (fillColor: string) => {
    updateLabelStyle(layer.id, { fillColor });
  };

  // 处理位置变化
  const handlePositionChange = (position: string) => {
    updateLabelStyle(layer.id, { position: position as any });
  };

  // 处理偏移变化
  const handleOffsetXChange = (offsetX: number) => {
    updateLabelStyle(layer.id, { offsetX });
  };

  const handleOffsetYChange = (offsetY: number) => {
    updateLabelStyle(layer.id, { offsetY });
  };

  // 处理重复间隔变化
  const handleRepeatIntervalChange = (repeatInterval: number) => {
    updateLabelStyle(layer.id, { repeatInterval });
  };

  return (
    <div className="bg-transparent p-4 text-sm pointer-events-auto h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">标注设置</h3>
        </div>
        <button
          onClick={() => closeLabelPanel()}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Info */}
      <div className="mb-4 bg-blue-50 p-2 rounded border border-blue-100 flex items-center justify-between">
        <div className="font-medium text-blue-900 truncate" title={layer.name}>
          {layer.name}
        </div>
        {geometryType && (
          <div className="text-xs text-blue-400">
            {geometryType === 'POINT' && '点图层'}
            {geometryType === 'LINESTRING' && '线图层'}
            {geometryType === 'POLYGON' && '面图层'}
          </div>
        )}
      </div>

      {/* 面板内容 */}
      <div className="space-y-4">
        {/* 总开关 */}
        <div
          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
            labelStyle.enabled
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
          onClick={() => handleToggleEnabled(!labelStyle.enabled)}
        >
          <span className="font-medium">启用标注</span>
          <div
            className={`w-10 h-5 rounded-full relative transition-colors ${
              labelStyle.enabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-all ${
                labelStyle.enabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </div>
        </div>

        {/* 标注内容 */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-600 font-medium">标注内容</label>
          <input
            ref={expressionInputRef}
            type="text"
            value={labelStyle.expression || ''}
            onChange={(e) => handleExpressionChange(e.target.value)}
            placeholder="输入字段表达式..."
            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 relative">
            <button
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50 text-gray-600 flex items-center gap-1"
              onClick={() => setShowFieldDropdown(!showFieldDropdown)}
            >
              + 插入字段
              <ChevronDown className="w-3 h-3" />
            </button>
            {/* 字段下拉列表 */}
            {showFieldDropdown && fields.length > 0 && (
              <div className="absolute left-0 top-full mt-1 bg-white border rounded shadow-md z-10 min-w-[120px] max-h-[200px] overflow-auto">
                {fields.map((field: LayerFieldDefinition) => (
                  <button
                    key={field.name}
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => handleInsertField(field.name)}
                  >
                    <span>{field.alias || field.name}</span>
                    <span className="text-gray-400 text-[10px]">{field.type}</span>
                  </button>
                ))}
              </div>
            )}
            {/* 无字段提示 */}
            {showFieldDropdown && fields.length === 0 && (
              <div className="absolute left-0 top-full mt-1 bg-white border rounded shadow-md z-10 p-2 text-xs text-gray-400">
                该图层无可用字段
              </div>
            )}
            <span className="text-xs text-gray-400">支持: {'{name}'} - {'{type}'}</span>
          </div>
        </div>

        {/* 可见范围 */}
        <div className="p-3 bg-gray-50 rounded-lg space-y-2">
          <label className="text-xs text-gray-600 font-medium">可见范围（缩放层级）</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={labelStyle.minZoom ?? 10}
              onChange={(e) => handleMinZoomChange(Number(e.target.value))}
              min={0}
              max={22}
              className="w-12 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              value={labelStyle.maxZoom ?? 18}
              onChange={(e) => handleMaxZoomChange(Number(e.target.value))}
              min={0}
              max={22}
              className="w-12 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">级可见</span>
          </div>

          {/* 标注间距 */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
            <span className="text-xs text-gray-600">标注间距</span>
            <input
              type="number"
              value={labelStyle.padding ?? 2}
              onChange={(e) => updateLabelStyle(layer.id, { padding: Number(e.target.value) })}
              min={0}
              max={50}
              className="w-12 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">px</span>
            <span className="text-xs text-gray-400 ml-auto">控制标注间最小距离</span>
          </div>
        </div>

        {/* 标注位置（按几何类型动态渲染） */}
        <div className="space-y-1.5">
          <label className="text-xs text-gray-600 font-medium">标注位置</label>
          {geometryType === 'POLYGON' ? (
            <PolygonLabelPlacement
              labelStyle={labelStyle}
              onUpdate={(patch) => updateLabelStyle(layer.id, patch)}
            />
          ) : (
            <LabelPositionControl
              geometryType={geometryType}
              position={labelStyle.position}
              repeatInterval={labelStyle.repeatInterval}
              offsetX={labelStyle.offsetX}
              offsetY={labelStyle.offsetY}
              onPositionChange={handlePositionChange}
              onRepeatIntervalChange={handleRepeatIntervalChange}
              onOffsetXChange={handleOffsetXChange}
              onOffsetYChange={handleOffsetYChange}
            />
          )}
        </div>

        {/* 文本符号 */}
        <div className="border-t pt-3 space-y-2">
          <label className="text-xs text-gray-600 font-medium">文本符号</label>

          {/* 字号和颜色放在同一行 */}
          <div className="flex items-center gap-4">
            {/* 字号 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">字号</span>
              <input
                type="number"
                value={labelStyle.fontSize ?? 14}
                onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                min={8}
                max={48}
                className="w-12 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>

            {/* 颜色 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">颜色</span>
              <input
                type="color"
                value={labelStyle.fillColor ?? '#333333'}
                onChange={(e) => handleFillColorChange(e.target.value)}
                className="w-6 h-6 border rounded cursor-pointer"
              />
              <span className="text-xs text-gray-500">{labelStyle.fillColor ?? '#333333'}</span>
            </div>
          </div>

          {/* 字体 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8">字体</span>
            <select
              value={labelStyle.font ?? 'Microsoft YaHei'}
              onChange={(e) => updateLabelStyle(layer.id, { font: e.target.value })}
              className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimHei">黑体</option>
              <option value="SimSun">宋体</option>
              <option value="Arial">Arial</option>
              <option value="Arial Unicode MS Regular">Arial Unicode MS</option>
            </select>
          </div>

          {/* 描边颜色和宽度放在同一行 */}
          <div className="flex items-center gap-4">
            {/* 描边颜色 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-8">描边</span>
              <input
                type="color"
                value={labelStyle.outlineColor ?? '#ffffff'}
                onChange={(e) => updateLabelStyle(layer.id, { outlineColor: e.target.value })}
                className="w-6 h-6 border rounded cursor-pointer"
              />
            </div>

            {/* 描边宽度 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">宽度</span>
              <input
                type="number"
                value={labelStyle.outlineWidth ?? 1}
                onChange={(e) => updateLabelStyle(layer.id, { outlineWidth: Number(e.target.value) })}
                min={0}
                max={5}
                step={0.5}
                className="w-10 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 九宫格锚点选择器
 * - 自动寻位：多选候选锚点（selected = anchorCandidates）
 * - 固定锚点：单选（selected = [position]）
 */
const NINE_GRID: { pos: PointLabelPosition; icon: string }[] = [
  { pos: 'top-left', icon: '↖' }, { pos: 'top', icon: '↑' }, { pos: 'top-right', icon: '↗' },
  { pos: 'left', icon: '←' }, { pos: 'center', icon: '●' }, { pos: 'right', icon: '→' },
  { pos: 'bottom-left', icon: '↙' }, { pos: 'bottom', icon: '↓' }, { pos: 'bottom-right', icon: '↘' },
];

function NineGridAnchor({
  selected,
  onSelect,
}: {
  selected: PointLabelPosition[];
  onSelect: (pos: PointLabelPosition) => void;
}) {
  return (
    <div className="inline-grid grid-cols-3 gap-1 w-fit">
      {NINE_GRID.map(({ pos, icon }) => {
        const on = selected.includes(pos);
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onSelect(pos)}
            className={`w-9 h-9 flex items-center justify-center text-sm rounded border ${
              on ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-400'
            }`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

function LabelRangeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="text-gray-500">{value} px</span>
      </div>
      <input
        type="range"
        min={-50}
        max={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
      />
    </div>
  );
}

/**
 * 面要素标注放置：自动寻位 / 固定锚点 + 避让
 * 替代 LabelPositionControl 的 POLYGON 分支
 */
function PolygonLabelPlacement({
  labelStyle,
  onUpdate,
}: {
  labelStyle: LabelStyle;
  onUpdate: (patch: Partial<LabelStyle>) => void;
}) {
  const placementMode = (labelStyle.placementMode ?? 'auto') as 'auto' | 'fixed';
  const allowOverlap = labelStyle.allowOverlap ?? false;

  // 自动寻位候选锚点（缺省=九宫格全选）
  const candidates: PointLabelPosition[] =
    labelStyle.anchorCandidates && labelStyle.anchorCandidates.length > 0
      ? labelStyle.anchorCandidates
      : DEFAULT_LABEL_ANCHOR_CANDIDATES;

  const toggleCandidate = (pos: PointLabelPosition) => {
    const set = new Set(candidates);
    if (set.has(pos)) {
      if (set.size > 1) set.delete(pos); // 至少保留 1 个候选
    } else {
      set.add(pos);
    }
    onUpdate({ anchorCandidates: Array.from(set) });
  };

  return (
    <div className="space-y-3">
      {/* 放置模式 */}
      <div className="flex gap-2">
        {(['auto', 'fixed'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onUpdate({ placementMode: mode })}
            className={`flex-1 p-2 rounded text-xs border ${
              placementMode === mode
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}
          >
            {mode === 'auto' ? '自动寻位' : '固定锚点'}
          </button>
        ))}
      </div>

      {placementMode === 'auto' ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">候选锚点（重叠时引擎按序尝试）</div>
          <NineGridAnchor selected={candidates} onSelect={toggleCandidate} />
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 w-16">偏移半径</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={labelStyle.radialOffset ?? 1}
              onChange={(e) => onUpdate({ radialOffset: Number(e.target.value) })}
              className="w-14 px-1.5 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">em</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">锚点</div>
          <NineGridAnchor
            selected={[(labelStyle.position as PointLabelPosition) ?? 'center']}
            onSelect={(pos) => onUpdate({ position: pos })}
          />
          <div className="space-y-2 pt-1">
            <LabelRangeSlider label="左右偏移" value={labelStyle.offsetX ?? 0} onChange={(v) => onUpdate({ offsetX: v })} />
            <LabelRangeSlider label="上下偏移" value={labelStyle.offsetY ?? 0} onChange={(v) => onUpdate({ offsetY: v })} />
          </div>
        </div>
      )}

      {/* 避让（padding 间距沿用「可见范围」里的「标注间距」） */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-600 font-medium">避让</div>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="radio" checked={!allowOverlap} onChange={() => onUpdate({ allowOverlap: false })} />
            <span>自动避让（重叠标注自动隐藏）</span>
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="radio" checked={allowOverlap} onChange={() => onUpdate({ allowOverlap: true })} />
            <span>显示全部（允许重叠）</span>
          </label>
        </div>
      </div>
    </div>
  );
}

/**
 * 标注位置控制组件
 * 根据几何类型动态渲染不同的选项
 */
function LabelPositionControl({
  geometryType,
  position,
  repeatInterval,
  offsetX,
  offsetY,
  onPositionChange,
  onRepeatIntervalChange,
  onOffsetXChange,
  onOffsetYChange,
}: {
  geometryType?: GeometryType;
  position?: string;
  repeatInterval?: number;
  offsetX?: number;
  offsetY?: number;
  onPositionChange: (position: string) => void;
  onRepeatIntervalChange: (interval: number) => void;
  onOffsetXChange: (offsetX: number) => void;
  onOffsetYChange: (offsetY: number) => void;
}) {
  const currentPosition = position || getDefaultLabelPosition(geometryType);

  // 点要素：两个滑轨控制偏移量
  if (geometryType === 'POINT') {
    return (
      <div className="space-y-3">
        {/* X轴偏移滑轨 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>左右偏移</span>
            <span className="text-gray-500">{offsetX ?? 0} px</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={offsetX ?? 0}
            onChange={(e) => onOffsetXChange(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>← 左</span>
            <span>右 →</span>
          </div>
        </div>

        {/* Y轴偏移滑轨 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>上下偏移</span>
            <span className="text-gray-500">{offsetY ?? 0} px</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={offsetY ?? 0}
            onChange={(e) => onOffsetYChange(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>↑ 上</span>
            <span>下 ↓</span>
          </div>
        </div>
      </div>
    );
  }

  // 线要素：下拉选项 + 重复间隔
  if (geometryType === 'LINESTRING') {
    const linePositions = [
      { label: '沿线标注', value: 'along' },
      { label: '起点标注', value: 'start' },
      { label: '终点标注', value: 'end' },
      { label: '中点标注', value: 'middle' },
    ];

    return (
      <div className="space-y-2">
        <div className="flex flex-col gap-1">
          {linePositions.map((pos) => (
            <button
              key={pos.value}
              className={`p-2 rounded text-xs border text-left ${
                currentPosition === pos.value
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => onPositionChange(pos.value)}
            >
              {pos.label}
              {currentPosition === pos.value && (
                <span className="ml-2 text-orange-500">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* 沿线标注时显示重复间隔设置 */}
        {currentPosition === 'along' && (
          <div className="p-2 bg-orange-50 rounded border border-orange-200">
            <div className="text-xs text-orange-600 mb-1">沿线标注设置</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">重复间隔</span>
              <input
                type="number"
                value={repeatInterval ?? 250}
                onChange={(e) => onRepeatIntervalChange(Number(e.target.value))}
                min={50}
                className="w-16 px-1.5 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <span className="text-xs text-gray-500">米</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 默认：未知类型，显示提示
  return (
    <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
      图层几何类型未知，无法选择标注位置
    </div>
  );
}