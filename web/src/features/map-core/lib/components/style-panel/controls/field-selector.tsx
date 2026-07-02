/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useRef } from 'react';
import { LayerState } from '../../../types/map-state';

interface FieldSelectorProps {
  layer: LayerState;
  value: string;
  onChange: (field: string) => void;
}

export function FieldSelector({ layer, value, onChange }: FieldSelectorProps) {
  // 直接使用 layer.fields[].type（来自后端 DatasetField）
  const numericFields = useMemo(() => {
    if (!layer.fields) return [];

    return layer.fields
      .filter((f) => f.type === 'number')
      .map((f) => ({
        value: f.name,
        label: f.alias || f.name,
      }));
  }, [layer]);

  // onChange 每次父组件渲染都是新引用，用 ref 稳定，避免进 useEffect 依赖触发循环。
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // value 为空时自动选中首个数值字段。
  // 切到「分级」时 graduatedConfig.field 被初始化为 ''，旧实现 select 用
  // `value || numericFields[0]` 回退【显示】首项，但 state 里的 field 仍是 ''，
  // 而 GraduatedColorsPanel 用 `{field && ...}` 把分类方法/类数/色阶/图例全挡在后面 → 面板空白。
  // 更要命的是：手绘点图层通常只有【一个】数值字段，下拉里就这一项，用户重选它
  // = 值未变 = 不触发 onChange → field 永远是 '' → 永远空白（即「选了也没出现后续配置」）。
  // 这里把首项真正写进 state，后续配置项随即出现，行为与已选过字段的面图层一致。
  useEffect(() => {
    if (!value && numericFields.length > 0) {
      onChangeRef.current(numericFields[0].value);
    }
  }, [value, numericFields]);

  if (numericFields.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        无可用数值字段，请先在「属性表」新增 number 类型字段
      </div>
    );
  }

  return (
    <div className="mb-3">
      <label className="text-sm text-gray-600 block mb-1">分类字段</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        {/* 占位项：未选时显示，与数值字段区分，确保从占位切到任意字段都触发 onChange */}
        <option value="" disabled>
          请选择数值字段
        </option>
        {numericFields.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
