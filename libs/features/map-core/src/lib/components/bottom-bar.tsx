/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useEffect, useState } from 'react';
import { useMapStore } from '../store/use-map-store';
import { Ruler } from 'lucide-react';
import tiandtMapLogo from '../images/天地图.png';

export function BottomBar() {
  const zoom = useMapStore((state) => state.viewport.zoom);
  const [mouseCoords, setMouseCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  // Listen for mouse coordinates
  useEffect(() => {
    const handleMouseMove = (e: Event) => {
      const { lat, lon } = (e as CustomEvent).detail;
      setMouseCoords({ lat, lon });
    };

    window.addEventListener('map:mouse-move', handleMouseMove);
    return () => window.removeEventListener('map:mouse-move', handleMouseMove);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <div className="figure-number flex items-center gap-1">
        <img src={tiandtMapLogo} alt="天地图" />
        GS（2024）0568 号
      </div>

      <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border px-3 py-1 text-xs text-gray-600 flex items-center gap-4">
        <div className="flex items-center gap-1" title="缩放级别">
          <span className="font-mono">z: {zoom.toFixed(1)}</span>
        </div>

        {mouseCoords && (
          <div className="flex items-center gap-1 border-l pl-3 border-gray-300">
            <span className="font-mono">
              {mouseCoords.lon.toFixed(4)}, {mouseCoords.lat.toFixed(4)}
            </span>
          </div>
        )}

        <div
          className="flex items-center gap-1 border-l pl-3 border-gray-300"
          title="比例尺 (示例)"
        >
          <Ruler className="w-3 h-3" />
          <span>1 : {(50000000 / Math.pow(2, zoom)).toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
