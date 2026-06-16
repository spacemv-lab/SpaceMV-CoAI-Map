/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

interface ClassesCountControlProps {
  value: number;
  onChange: (count: number) => void;
  min?: number;
  max?: number;
}

export function ClassesCountControl({
  value,
  onChange,
  min = 3,
  max = 10,
}: ClassesCountControlProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <label className="text-sm text-gray-600">类数</label>
        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded">
          {value || 5}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value || 5}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}