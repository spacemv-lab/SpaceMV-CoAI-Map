/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../store/use-map-store';
import { MapPin, Activity, Square, MousePointer2 } from 'lucide-react';
import { InteractionMode } from '../types/map-state';
import { ElementType } from 'react';

const GEOMETRY_TYPE_MAP: Record<string, InteractionMode> = {
  POINT: 'draw_point',
  LINESTRING: 'draw_line',
  POLYGON: 'draw_polygon',
} as const;

export function DrawToolbar() {
  const mode = useMapStore((state) => state.interaction.mode);
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const layers = useMapStore((state) => state.layers);

  // 获取编辑图层的几何类型
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const activeGeometryType = activeLayer?.geometryType;

  const allTools: {
    id: InteractionMode;
    icon: ElementType;
    label: string;
    geomType?: string;
  }[] = [
    { id: 'default', icon: MousePointer2, label: '选择' },
    { id: 'draw_point', icon: MapPin, label: '标点', geomType: 'POINT' },
    { id: 'draw_line', icon: Activity, label: '标线', geomType: 'LINESTRING' },
    { id: 'draw_polygon', icon: Square, label: '标面', geomType: 'POLYGON' },
  ];

  // 根据编辑图层类型过滤工具
  const tools = activeGeometryType
    ? allTools.filter(
        (t) => t.id === 'default' || t.geomType === activeGeometryType,
      )
    : allTools;

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border flex flex-col items-end p-1 gap-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setInteractionMode(tool.id)}
          className={`p-2 rounded hover:bg-gray-100 transition-colors ${
            mode === tool.id ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          }`}
          title={tool.label}
        >
          <tool.icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}
