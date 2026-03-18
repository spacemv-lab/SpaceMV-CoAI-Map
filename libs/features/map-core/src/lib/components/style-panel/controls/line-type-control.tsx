/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { LINE_TYPE_OPTIONS } from '../../../constants/style-config';

interface LineTypeControlProps {
  value: string;
  onChange: (lineType: string) => void;
}

export function LineTypeControl({ value, onChange }: LineTypeControlProps) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">线型</label>
      <select
        value={value || 'solid'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm bg-white hover:border-gray-300 focus:border-blue-500 focus:outline-none"
      >
        {LINE_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
