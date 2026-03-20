/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { ChangeEvent } from 'react';

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
        <div className="relative w-6 h-6 rounded overflow-hidden border border-gray-200 shadow-sm">
          <input
            type="color"
            value={value || '#cccccc'}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            className="absolute -top-1 -left-1 w-10 h-10 p-0 border-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
