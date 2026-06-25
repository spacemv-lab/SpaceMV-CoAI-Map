/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { X } from 'lucide-react';
import { useMapStore } from '../store/use-map-store';

const DEFAULT_COLOR = '#cccccc';

/** 带颜色的几何形状图标 */
function ColorIcon({ color, geometryType }: { color: string; geometryType?: string }) {
  switch (geometryType) {
    case 'POINT':
      return (
        <span
          className="inline-block shrink-0 rounded-full"
          style={{ width: 12, height: 12, backgroundColor: color }}
        />
      );
    case 'LINESTRING':
      return (
        <span
          className="inline-block shrink-0 rounded-sm"
          style={{ width: 16, height: 2, backgroundColor: color }}
        />
      );
    case 'POLYGON':
      return (
        <span
          className="inline-block shrink-0"
          style={{ width: 12, height: 12, backgroundColor: color }}
        />
      );
    default:
      return (
        <span
          className="inline-block shrink-0"
          style={{ width: 12, height: 12, backgroundColor: color }}
        />
      );
  }
}

export function LegendPanel() {
  const legendVisible = useMapStore((s) => s.legendVisible);
  const layers = useMapStore((s) => s.layers);
  const setLegendVisible = useMapStore((s) => s.setLegendVisible);

  // 图例显隐由侧边栏工具栏的图例按钮统一控制；隐藏时不渲染浮动入口。
  if (!legendVisible) return null;

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-4 text-sm relative min-w-40 max-w-64">
      <button
        onClick={() => setLegendVisible(false)}
        className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="隐藏图例"
      >
        <X className="w-3 h-3" />
      </button>
      <h4 className="font-medium mb-3 text-gray-800">图例</h4>
      {layers.length === 0 ? (
        <p className="text-gray-400 text-xs">暂无图层，请添加数据</p>
      ) : (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
          {layers.map((layer) => {
            const color = layer.style?.color || DEFAULT_COLOR;
            return (
              <div key={layer.id} className="flex items-center gap-2">
                <ColorIcon color={color} geometryType={layer.geometryType} />
                <span className="text-gray-700 flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{layer.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
