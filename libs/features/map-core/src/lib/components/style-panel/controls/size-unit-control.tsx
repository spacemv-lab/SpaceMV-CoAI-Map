/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { SIZE_UNIT_OPTIONS } from '../../../constants/style-config';

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
        className="px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
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
