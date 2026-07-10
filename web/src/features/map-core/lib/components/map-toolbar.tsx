/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../store/use-map-store';
import { Maximize, Download, Plus, Minus, SwatchBook } from 'lucide-react';
import { toast } from 'sonner';
import maplibregl from 'maplibre-gl';

export function MapToolbar() {
  const legendVisible = useMapStore((state) => state.legendVisible);
  const setLegendVisible = useMapStore((state) => state.setLegendVisible);

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
    useMapStore.getState().openExportPanel();
  };

  // 缩放直接驱动 MapLibre 实例。store 的 viewport.zoom 实为相机高度（米），
  // 旧实现 ±1 米在 60 万米尺度下经 heightToZoomLevel 取整后无变化，故按钮无效。
  // map.zoomIn/zoomOut 原生遵守 minZoom/maxZoom；动画结束 moveend 会回写 store 保持同步。
  const handleZoomIn = () => {
    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
    if (!map) {
      toast.error('地图查看器未初始化');
      console.error('[MapToolbar.zoomIn] MAPLIBRE_MAP is undefined');
      return;
    }
    map.zoomIn();
  };

  const handleZoomOut = () => {
    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
    if (!map) {
      toast.error('地图查看器未初始化');
      console.error('[MapToolbar.zoomOut] MAPLIBRE_MAP is undefined');
      return;
    }
    map.zoomOut();
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
          onClick={() => setLegendVisible(!legendVisible)}
          className={`p-2 rounded transition-colors ${legendVisible ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
          title="图例"
        >
          <SwatchBook className="w-5 h-5" />
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
