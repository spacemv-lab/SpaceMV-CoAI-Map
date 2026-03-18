/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


interface OpacityControlProps {
  value: number;
  onChange: (opacity: number) => void;
}

export function OpacityControl({ value, onChange }: OpacityControlProps) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">不透明度</label>
        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded">
          {Math.round((value ?? 1) * 100)}%
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600"
      />
    </div>
  );
}
