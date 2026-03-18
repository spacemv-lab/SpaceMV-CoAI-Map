/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../store/use-map-store';
import { MapPin, Activity, Square, MousePointer2 } from 'lucide-react';
import { InteractionMode } from '../types/map-state';
import { ElementType } from 'react';

export function DrawToolbar() {
  const mode = useMapStore((state) => state.interaction.mode);
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);

  const tools: { id: InteractionMode; icon: ElementType; label: string }[] = [
    { id: 'default', icon: MousePointer2, label: '选择' },
    { id: 'draw_point', icon: MapPin, label: '标点' },
    { id: 'draw_line', icon: Activity, label: '标线' },
    { id: 'draw_polygon', icon: Square, label: '标面' },
  ];

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
