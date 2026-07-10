/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMapStore } from '../store/use-map-store';
import tiandtMapLogo from '../images/天地图.png';
import { BASEMAP_BRAND } from '../constants/brand';
import { isDarkBasemap } from '../constants/tianditu-presets';

/**
 * 计算比例尺（考虑纬度和屏幕 DPI）
 * 从 viewport.zoom（Cesium 高度）反推 MapLibre zoom level
 */
function computeScale(maplibreZoom: number, lat: number): number {
  const metersPerPixel =
    (40075016.686 / (256 * Math.pow(2, maplibreZoom))) *
    Math.cos((lat * Math.PI) / 180);
  // 标准 CSS 像素：1px = 0.0254/96 m (96 DPI)
  return Math.round(metersPerPixel / (0.0254 / 96));
}

export function BottomBar() {
  const viewport = useMapStore((state) => state.viewport);
  const basemap = useMapStore((state) => state.basemap);
  const dark = isDarkBasemap(basemap);
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

  // 从 viewport.zoom（高度值）反推 MapLibre zoom level
  const maplibreZoom = useMemo(
    () => Math.log2(40075016 / (viewport.zoom || 1)),
    [viewport.zoom],
  );

  // 比例尺
  const scaleDenominator = useMemo(() => {
    if (!mouseCoords) return 0;
    return computeScale(maplibreZoom, mouseCoords.lat);
  }, [maplibreZoom, mouseCoords?.lat]);

  return (
    <div className="flex items-center gap-4">
      <div className="figure-number flex items-center gap-1">
        <img
          src={tiandtMapLogo}
          alt={BASEMAP_BRAND.tianditu.name}
          className="h-5 w-auto"
        />
        <span
          className="text-[11px] leading-none whitespace-nowrap"
          style={{ color: dark ? '#ffffff' : '#1e293b' }}
        >
          {BASEMAP_BRAND.tianditu.license}
        </span>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border px-3 py-1 text-xs text-gray-600 flex items-center gap-4">
        <div className="flex items-center gap-1" title="缩放级别">
          <span className="font-mono">z: {viewport.zoom.toFixed(0)}</span>
        </div>

        {mouseCoords && (
          <div className="flex items-center gap-1 border-l pl-3 border-gray-300">
            <span className="font-mono">
              {mouseCoords.lon.toFixed(4)}, {mouseCoords.lat.toFixed(4)}
            </span>
          </div>
        )}

        {scaleDenominator > 0 && (
          <div
            className="flex items-center gap-1 border-l pl-3 border-gray-300"
            title="比例尺"
          >
            <span className="font-mono">
              1 : {scaleDenominator.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
