/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { RENDERING_TYPE_OPTIONS } from '../../../constants/color-ramps';
import { RenderingType } from '../../../types/graduated-style';

interface RenderingTypeSelectorProps {
  value: RenderingType;
  onChange: (type: RenderingType) => void;
}

export function RenderingTypeSelector({ value, onChange }: RenderingTypeSelectorProps) {
  return (
    <div className="mb-4">
      <label className="text-sm text-gray-600 block mb-1">渲染类型</label>
      <select
        value={value || 'simple'}
        onChange={(e) => onChange(e.target.value as RenderingType)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        {RENDERING_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}