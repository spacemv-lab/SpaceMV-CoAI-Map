/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMemo } from 'react';
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

  if (numericFields.length === 0) {
    return (
      <div className="text-xs text-gray-400 py-2">
        无可用数值字段
      </div>
    );
  }

  return (
    <div className="mb-3">
      <label className="text-sm text-gray-600 block mb-1">分类字段</label>
      <select
        value={value || numericFields[0].value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        {numericFields.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}