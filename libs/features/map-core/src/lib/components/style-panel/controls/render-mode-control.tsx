/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Layers, Image } from 'lucide-react';
import { PointRenderMode, POINT_RENDER_MODE_OPTIONS } from '../../../constants/style-config';

interface RenderModeControlProps {
  value: PointRenderMode;
  onChange: (mode: PointRenderMode) => void;
}

export function RenderModeControl({ value, onChange }: RenderModeControlProps) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-2">渲染模式</label>
      <div className="flex gap-2">
        {POINT_RENDER_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-3 py-2 rounded border text-sm transition-all ${
              value === opt.value
                ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center mb-1">
              {opt.value === 'point' ? (
                <Layers className="w-4 h-4" />
              ) : (
                <Image className="w-4 h-4" />
              )}
            </div>
            <div>{opt.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {opt.value === 'point' ? '高性能' : '高表现力'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
