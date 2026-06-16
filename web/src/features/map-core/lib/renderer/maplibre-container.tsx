/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * MapLibre GL 主容器
 * 用于替代 Cesium.Viewer，作为 MapLibre 迁移的核心入口
 *
 * 功能：
 * - 天地图 WMTS 底图加载 (vec/img/ter)
 * - 视口状态双向绑定 (map ↔ store.viewport)
 * - viewerReady 状态信号
 * - 鼠标位置追踪
 */

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../store/use-map-store';
import { TIANDITU_TOKEN } from '../constants/map-token';
import { startPerformanceSpan } from '../monitoring/performance-monitor';
import { MapLibreLayerRenderer } from './maplibre-layer-renderer';
import { MapLibreDrawRenderer } from './maplibre-draw-renderer';
import { FeaturePopup } from '../components/feature-popup';
import { ExportPanel } from '../components/export-panel';
import { exportMapImage } from '../utils/export-compositor';

/**
 * 天地图 WMTS 服务节点 (负载均衡)
 */
const TIANDITU_SERVERS = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];

/**
 * 天地图 WMTS URL 构造器
 * MapLibre 要求 URL 包含 {z}, {x}, {y} 占位符
 */
function buildTiandituWmtsUrl(layer: string, token: string): string {
  // 随机选择服务节点
  const server = TIANDITU_SERVERS[Math.floor(Math.random() * TIANDITU_SERVERS.length)];
  return `https://${server}.tianditu.gov.cn/${layer}_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layer}&tileMatrixSet=w&TileMatrix={z}&TileRow={y}&TileCol={x}&style=default&format=tiles&tk=${token}`;
}

/**
 * 天地图底图配置
 */
const TIANDITU_STYLES: Record<string, maplibregl.StyleSpecification> = {
  // 矢量底图 + 注记
  'tianditu-vec': {
    version: 8,
    sources: {
      'tianditu-vec': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('vec', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
      'tianditu-cva': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('cva', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: 'tianditu-vec-layer',
        type: 'raster',
        source: 'tianditu-vec',
        minzoom: 1,
        maxzoom: 18,
      },
      {
        id: 'tianditu-cva-layer',
        type: 'raster',
        source: 'tianditu-cva',
        minzoom: 1,
        maxzoom: 18,
      },
    ],
  },

  // 影像底图 + 注记
  'tianditu-img': {
    version: 8,
    sources: {
      'tianditu-img': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('img', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
      'tianditu-cia': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('cia', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: 'tianditu-img-layer',
        type: 'raster',
        source: 'tianditu-img',
        minzoom: 1,
        maxzoom: 18,
      },
      {
        id: 'tianditu-cia-layer',
        type: 'raster',
        source: 'tianditu-cia',
        minzoom: 1,
        maxzoom: 18,
      },
    ],
  },

  // 地形底图 + 注记
  'tianditu-ter': {
    version: 8,
    sources: {
      'tianditu-ter': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('ter', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
      'tianditu-cta': {
        type: 'raster',
        tiles: [buildTiandituWmtsUrl('cta', TIANDITU_TOKEN)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 18,
      },
    },
    layers: [
      {
        id: 'tianditu-ter-layer',
        type: 'raster',
        source: 'tianditu-ter',
        minzoom: 1,
        maxzoom: 18,
      },
      {
        id: 'tianditu-cta-layer',
        type: 'raster',
        source: 'tianditu-cta',
        minzoom: 1,
        maxzoom: 18,
      },
    ],
  },
};

/**
 * Cesium zoom (高度米) 转 MapLibre zoom level
 * 大致关系: zoom ≈ log2(40075016 / height) - 1
 */
function heightToZoomLevel(height: number): number {
  // Cesium 的 zoom 是相机高度（米）
  // MapLibre 的 zoom 是瓦片层级 (0-18)
  // 经验公式: level ≈ log2(EarthCircumference / height)
  const earthCircumference = 40075016; // 米
  const level = Math.log2(earthCircumference / height);
  return Math.max(1, Math.min(18, Math.round(level)));
}

/**
 * MapLibre zoom level 转 Cesium zoom (高度米)
 */
function zoomLevelToHeight(zoom: number): number {
  const earthCircumference = 40075016;
  return earthCircumference / Math.pow(2, zoom);
}

export function MapLibreContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const prevBasemapRef = useRef<string | null>(null); // 追踪上一个底图
  const [isReady, setIsReady] = useState(false);

  const setViewport = useMapStore((state) => state.setViewport);
  const viewport = useMapStore((state) => state.viewport);
  const basemap = useMapStore((state) => state.basemap);
  const setViewerReady = useMapStore((state) => state.setViewerReady);
  const selection = useMapStore((state) => state.selection);
  const activeLayerId = useMapStore((state) => state.activeLayerId);

  // 初始化 MapLibre Map
  useEffect(() => {
    if (!containerRef.current) return;

    const endMapInitialize = startPerformanceSpan({
      name: 'maplibre.initialize',
      sceneType: 'browse',
    });

    // 从 store 获取恢复的视口
    const restoredViewport = useMapStore.getState().viewport;
    const initialZoom = heightToZoomLevel(restoredViewport.zoom);

    // 创建 MapLibre Map
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TIANDITU_STYLES[basemap] || TIANDITU_STYLES['tianditu-vec'],
      center: [restoredViewport.center[0], restoredViewport.center[1]],
      zoom: initialZoom,
      bearing: restoredViewport.heading,
      pitch: 0, // MapLibre pitch 对应 Cesium pitch，但范围不同
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
      // @ts-expect-error preserveDrawingBuffer is valid WebGL option but not in MapLibre types
      preserveDrawingBuffer: true, // 保留canvas内容供导出使用
    });

    // 全局引用 (兼容现有代码)
    (window as unknown as { MAPLIBRE_MAP: maplibregl.Map }).MAPLIBRE_MAP = map;
    window.dispatchEvent(new Event('maplibre:map-ready'));

    // 视口变化监听 (Map → Store)
    const onMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();

      setViewport({
        center: [center.lng, center.lat],
        zoom: zoomLevelToHeight(zoom),
        heading: bearing,
        pitch: -90, // MapLibre 2D 模式 pitch 固定为 -90 (俯视)
      });
    };

    map.on('moveend', onMoveEnd);

    // 鼠标移动监听
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      window.dispatchEvent(
        new CustomEvent('map:mouse-move', {
          detail: { lat: e.lngLat.lat, lon: e.lngLat.lng },
        })
      );
    };

    map.on('mousemove', onMouseMove);

    // 加载 AIS/ADS-B 图标
    const loadIcons = async () => {
      const iconConfigs = [
        { name: 'plane-blue', path: '/plane-blue.png' },
        { name: 'plane-green', path: '/plane-green.png' },
        { name: 'plane-orange', path: '/plane-orange.png' },
        { name: 'plane-gray', path: '/plane-gray.png' },
        { name: 'ship', path: '/ship.png' },
      ];

      for (const { name, path } of iconConfigs) {
        if (!map.hasImage(name)) {
          try {
            const image = await map.loadImage(path);
            if (image.data) {
              map.addImage(name, image.data);
            }
          } catch (err) {
            console.warn(`[MapLibreContainer] Icon ${name} load failed:`, err);
          }
        }
      }
    };

    // 等待地图加载完成
    map.on('load', async () => {
      // 先加载 AIS/ADS-B 图标，再设置 ready 状态
      await loadIcons();

      setIsReady(true);
      setViewerReady(true);
      prevBasemapRef.current = basemap;
      endMapInitialize({
        basemap,
        initialZoom,
      });
    });

    mapRef.current = map;

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('mousemove', onMouseMove);
      setViewerReady(false);

      // 清理全局引用
      const current = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
      if (current === map) {
        (window as unknown as { MAPLIBRE_MAP: maplibregl.Map | undefined }).MAPLIBRE_MAP = undefined;
      }

      map.remove();
      mapRef.current = null;
    };
  }, [setViewerReady, setViewport]);

  // 底图切换
  useEffect(() => {
    if (!isReady || !mapRef.current) return;

    const map = mapRef.current;
    const style = TIANDITU_STYLES[basemap];

    // 只在 basemap 真正变化时才切换（避免初始化时触发）
    const isBasemapChanged = prevBasemapRef.current !== null && prevBasemapRef.current !== basemap;
    prevBasemapRef.current = basemap;

    if (style && isBasemapChanged) {
      map.setStyle(style);
      // 通知 LayerRenderer style 变化，需要重新添加图层
      window.dispatchEvent(new Event('maplibre:style-changed'));
    }
  }, [basemap, isReady]);

  // 视口同步 (Store → Map)
  useEffect(() => {
    if (!isReady || !mapRef.current) return;

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();

    const targetZoom = heightToZoomLevel(viewport.zoom);
    const centerDiff =
      Math.abs(currentCenter.lng - viewport.center[0]) +
      Math.abs(currentCenter.lat - viewport.center[1]);
    const zoomDiff = Math.abs(currentZoom - targetZoom);

    // 只在有显著差异时更新，避免循环
    if (centerDiff > 0.01 || zoomDiff > 0.5) {
      map.jumpTo({
        center: [viewport.center[0], viewport.center[1]],
        zoom: targetZoom,
        bearing: viewport.heading,
      });
    }
  }, [viewport.center[0], viewport.center[1], viewport.zoom, viewport.heading, isReady]);

  // Handle Export Image
  useEffect(() => {
    if (!isReady) return;

    const handleExportImage = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const map = mapRef.current;

      if (!map || !detail?.selectionBox) return;

      const config = useMapStore.getState().exportPanel.config;
      const bearing = map.getBearing();

      await exportMapImage(map, detail.selectionBox, config, bearing);
    };

    window.addEventListener('map:export-image', handleExportImage);
    return () => window.removeEventListener('map:export-image', handleExportImage);
  }, [isReady]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-0 flex-1 relative">
      {/* MapLibre renders here */}
      {/* Business layer renderer - MVT tiles */}
      {isReady && <MapLibreLayerRenderer />}
      {/* Draw renderer - 绘制工具 */}
      {isReady && <MapLibreDrawRenderer />}
      {/* Feature detail popup — 编辑模式下不显示 */}
      {isReady && mapRef.current && !activeLayerId && selection && (
        <FeaturePopup selection={selection} map={mapRef.current} />
      )}
      {/* Export panel */}
      <ExportPanel />
    </div>
  );
}
