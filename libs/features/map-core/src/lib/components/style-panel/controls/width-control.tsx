/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


interface WidthControlProps {
  value: number;
  label?: string;
  onChange: (width: number) => void;
}

export function WidthControl({ value, label = '宽度', onChange }: WidthControlProps) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">{label}</label>
        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded">
          {value || 2}px
        </span>
      </div>
      <input
        type="range"
        min="1"
        max="20"
        step="1"
        value={value || 2}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600"
      />
    </div>
  );
}
