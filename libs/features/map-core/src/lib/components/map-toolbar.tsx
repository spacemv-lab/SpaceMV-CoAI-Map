/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../store/use-map-store';
import { Maximize, Download, Map as MapIcon, Plus, Minus } from 'lucide-react';

export function MapToolbar() {
  const zoom = useMapStore((state) => state.viewport.zoom);
  const setViewport = useMapStore((state) => state.setViewport);
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleSaveImage = () => {
    window.dispatchEvent(new CustomEvent('map:save-image'));
  };

  const handleZoomIn = () => {
    setViewport({ zoom: zoom + 1 });
  };

  const handleZoomOut = () => {
    setViewport({ zoom: zoom - 1 });
  };

  const cycleBasemap = () => {
    const basemaps = [
      'tianditu-vec',
      'tianditu-img',
      'tianditu-ter',
      'tianditu-ibo',
    ];
    const currentIndex = basemaps.indexOf(basemap);
    const nextIndex = (currentIndex + 1) % basemaps.length;
    setBasemap(basemaps[nextIndex]);
  };

  return (
    <div className="flex flex-col gap-2 items-end pointer-events-auto">
      {/* Main Toolbar */}
      <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border flex flex-col p-1 gap-1">
        <button
          onClick={handleFullscreen}
          className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
          title="全屏"
        >
          <Maximize className="w-5 h-5" />
        </button>

        <button
          onClick={handleSaveImage}
          className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
          title="保存图片"
        >
          <Download className="w-5 h-5" />
        </button>

        <button
          onClick={cycleBasemap}
          className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600 relative group"
          title={`切换底图 (${basemap})`}
        >
          <MapIcon className="w-5 h-5" />
          <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            {basemap === 'tianditu'
              ? '天地图'
              : basemap === 'osm'
                ? 'OSM'
                : '卫星图'}
          </span>
        </button>

        <div className="h-px bg-gray-200 my-1" />

        <button
          onClick={handleZoomIn}
          className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
          title="放大"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={handleZoomOut}
          className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
          title="缩小"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
