/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


interface SizeControlProps {
  value: number;
  unit?: 'pixels' | 'meters';
  onChange: (size: number) => void;
}

export function SizeControl({ value, unit = 'pixels', onChange }: SizeControlProps) {
  // 根据单位决定范围和显示
  const range = unit === 'meters'
    ? { min: 50, max: 5000, step: 50, suffix: 'm' }
    : { min: 4, max: 30, step: 1, suffix: 'px' };

  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">大小</label>
        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded">
          {value || 10}{range.suffix}
        </span>
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value || 10}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600"
      />
    </div>
  );
}
