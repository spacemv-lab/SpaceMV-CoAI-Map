/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapStore } from '../store/use-map-store';
import { v4 as uuidv4 } from 'uuid';
import { GeometryType, InteractionMode, LayerState } from '../types/map-state';
import { STYLE_CONFIGS } from '../constants/style-config';

/**
 * 绘制图层 ID 常量
 */
const DRAW_SOURCE_ID = '__draw-temp__';
const DRAW_LAYER_IDS = {
  POINT: 'user-drawings-points',
  LINESTRING: 'user-drawings-lines',
  POLYGON: 'user-drawings-polygons',
} as const;

const DRAW_LAYER_NAMES = {
  POINT: '我的标注-点',
  LINESTRING: '我的标注-线',
  POLYGON: '我的标注-面',
} as const;

/**
 * 初始化绘制临时图层
 */
function initDrawLayer(map: maplibregl.Map) {
  if (map.getSource(DRAW_SOURCE_ID)) return;

  // 添加临时绘制源
  map.addSource(DRAW_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // 绘制过程中的点图层
  map.addLayer({
    id: DRAW_SOURCE_ID + '-point',
    type: 'circle',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 6,
      'circle-color': '#ef4444',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });

  // 绘制过程中的线图层
  map.addLayer({
    id: DRAW_SOURCE_ID + '-line',
    type: 'line',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': '#ef4444',
      'line-width': 3,
      'line-dasharray': [2, 2],
    },
  });

  // 绘制过程中的面图层
  map.addLayer({
    id: DRAW_SOURCE_ID + '-fill',
    type: 'fill',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': '#ef4444',
      'fill-opacity': 0.3,
    },
  });

  // 绘制过程中的面边框
  map.addLayer({
    id: DRAW_SOURCE_ID + '-outline',
    type: 'line',
    source: DRAW_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': '#ef4444',
      'line-width': 2,
    },
  });

  // 绘制节点（已确定的点）
  map.addLayer({
    id: DRAW_SOURCE_ID + '-nodes',
    type: 'circle',
    source: DRAW_SOURCE_ID,
    filter: ['has', 'isNode'],
    paint: {
      'circle-radius': 5,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#ef4444',
      'circle-stroke-width': 2,
    },
  });
}

/**
 * 清理绘制临时图层
 */
function clearDrawLayer(map: maplibregl.Map | undefined) {
  if (!map) return;
  const source = map.getSource(DRAW_SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData({ type: 'FeatureCollection', features: [] });
  }
}

/**
 * MapLibre 绘制渲染器
 * 替代 Cesium 版本的 DrawRenderer
 */
export function MapLibreDrawRenderer() {
  const mode = useMapStore((state) => state.interaction.mode);
  const viewerReady = useMapStore((state) => state.viewerReady);
  const addLayer = useMapStore((state) => state.addLayer);
  const updateLayer = useMapStore((state) => state.updateLayer);
  const layers = useMapStore((state) => state.layers);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);

  // 绘制状态 refs
  const pointsRef = useRef<[number, number][]>([]);
  const isDrawingRef = useRef(false);

  // 获取 MapLibre map 实例
  const getMap = useCallback(() => {
    return (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
  }, []);

  // 初始化绘制图层
  useEffect(() => {
    const map = getMap();
    if (!map || !viewerReady) return;

    initDrawLayer(map);
  }, [viewerReady, getMap]);

  // 更新临时绘制显示
  const updateDrawDisplay = useCallback((coords: [number, number][], mode: InteractionMode) => {
    const map = getMap();
    if (!map) return;

    const source = map.getSource(DRAW_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: GeoJSON.Feature[] = [];

    // 添加已确定的节点
    coords.forEach((coord, idx) => {
      features.push({
        type: 'Feature',
        id: `node-${idx}`,
        properties: { isNode: true, nodeIndex: idx },
        geometry: { type: 'Point', coordinates: coord },
      });
    });

    // 添加动态几何（线/面）
    if (coords.length > 0) {
      if (mode === 'draw_line' && coords.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { isDrawing: true },
          geometry: { type: 'LineString', coordinates: coords },
        });
      } else if (mode === 'draw_polygon' && coords.length >= 3) {
        // 面需要闭合
        const closedCoords = [...coords, coords[0]];
        features.push({
          type: 'Feature',
          properties: { isDrawing: true },
          geometry: { type: 'Polygon', coordinates: [closedCoords] },
        });
      }
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [getMap]);

  // 完成绘制
  const finishDrawing = useCallback((coords: [number, number][], mode: InteractionMode) => {
    const map = getMap();
    if (!map) return;

    let feature: GeoJSON.Feature | undefined;

    if (mode === 'draw_point' && coords.length === 1) {
      feature = {
        type: 'Feature',
        id: uuidv4(),
        properties: { name: '新标注点' },
        geometry: { type: 'Point', coordinates: coords[0] },
      };
    } else if (mode === 'draw_line' && coords.length >= 2) {
      feature = {
        type: 'Feature',
        id: uuidv4(),
        properties: { name: '新标注线' },
        geometry: { type: 'LineString', coordinates: coords },
      };
    } else if (mode === 'draw_polygon' && coords.length >= 3) {
      // 闭合多边形
      const closedCoords = [...coords, coords[0]];
      feature = {
        type: 'Feature',
        id: uuidv4(),
        properties: { name: '新标注面' },
        geometry: { type: 'Polygon', coordinates: [closedCoords] },
      };
    }

    if (feature) {
      addToDrawLayer(feature, mode);
    }

    // 清理临时图层
    clearDrawLayer(map);
    pointsRef.current = [];
    isDrawingRef.current = false;
    setInteractionMode('default');
  }, [getMap, setInteractionMode]);

  // 添加到 Draw 图层
  const addToDrawLayer = useCallback((feature: GeoJSON.Feature, mode: InteractionMode) => {
    const geomType = (feature.geometry as { type: string }).type.toUpperCase() as GeometryType;

    // 如果有活跃编辑图层，添加到该图层
    if (activeLayerId) {
      const targetLayer = layers.find((l) => l.id === activeLayerId);
      if (targetLayer) {
        const newData = {
          type: 'FeatureCollection',
          features: [
            ...(targetLayer.data?.features || []),
            feature as { id: string; properties?: Record<string, unknown>; geometry: unknown },
          ],
        };
        updateLayer(activeLayerId, { data: newData });
        return;
      }
    }

    // 添加到默认绘制图层
    const modeToGeomType: Record<string, GeometryType> = {
      draw_point: 'POINT',
      draw_line: 'LINESTRING',
      draw_polygon: 'POLYGON',
    };
    const targetGeomType = modeToGeomType[mode] ?? geomType;

    const targetLayerId = DRAW_LAYER_IDS[targetGeomType as keyof typeof DRAW_LAYER_IDS];

    // 直接更新 store（图层已在 ensureDrawLayerExists 中创建）
    const currentLayers = useMapStore.getState().layers;
    const targetLayer = currentLayers.find((l) => l.id === targetLayerId);
    if (targetLayer) {
      const newData = {
        type: 'FeatureCollection',
        features: [
          ...(targetLayer.data?.features || []),
          feature as { id: string; properties?: Record<string, unknown>; geometry: unknown },
        ],
      };
      updateLayer(targetLayerId, { data: newData });
    } else {
      console.warn('[MapLibreDrawRenderer] Target layer not found:', targetLayerId);
    }
  }, [activeLayerId, layers, updateLayer]);

  // 处理绘制事件
  useEffect(() => {
    const map = getMap();
    if (!map || !viewerReady) return;

    // 非绘制模式时清理
    if (mode === 'default' || mode === 'select' || mode.startsWith('measure')) {
      clearDrawLayer(map);
      pointsRef.current = [];
      isDrawingRef.current = false;
      return;
    }

    // 绘制开始时确保目标图层存在
    ensureDrawLayerExists(mode);

    // 单击计时器（用于区分单击和双击）
    let clickTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingClick: [number, number] | null = null;

    // 绘制模式
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (mode === 'draw_point') {
        // 点模式：立即完成（不需要等待双击）
        finishDrawing([coord], mode);
        return;
      }

      // 线/面模式：延迟处理单击，等待可能的第二次点击（双击）
      if (clickTimeout) {
        // 已有待处理的单击，清除计时器（这构成双击序列）
        clearTimeout(clickTimeout);
        clickTimeout = null;
        pendingClick = null;

        // 双击完成绘制
        finishDrawing(pointsRef.current, mode);
        return;
      }

      // 首次单击：添加点并设置计时器
      pointsRef.current.push(coord);
      isDrawingRef.current = true;
      updateDrawDisplay(pointsRef.current, mode);

      // 记录待处理的点（如果300ms内没有第二次点击，就确认这个点）
      pendingClick = coord;
      clickTimeout = setTimeout(() => {
        // 单击确认（不是双击的一部分）
        clickTimeout = null;
        pendingClick = null;
        // 点已经在 pointsRef 中了，不需要额外处理
      }, 300);
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawingRef.current || mode === 'draw_point') return;

      // 实时更新最后一个点（浮动点）
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const points = [...pointsRef.current, coord];
      updateDrawDisplay(points, mode);
    };

    // 添加事件监听
    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      // Check if map is still valid before cleanup
      const currentMap = getMap();
      if (currentMap) {
        currentMap.off('click', handleClick);
        currentMap.off('mousemove', handleMouseMove);
      }
      if (clickTimeout) clearTimeout(clickTimeout);
      clearDrawLayer(currentMap);
    };
  }, [mode, viewerReady, getMap, updateDrawDisplay, finishDrawing]);

  // 确保 Draw 图层存在
  const ensureDrawLayerExists = useCallback((mode: InteractionMode) => {
    const modeToGeomType: Record<string, GeometryType> = {
      draw_point: 'POINT',
      draw_line: 'LINESTRING',
      draw_polygon: 'POLYGON',
    };
    const targetGeomType = modeToGeomType[mode];
    if (!targetGeomType) return;

    const targetLayerId = DRAW_LAYER_IDS[targetGeomType];
    const targetLayerName = DRAW_LAYER_NAMES[targetGeomType];

    // 检查是否已存在
    const existingLayer = layers.find((l) => l.id === targetLayerId);
    if (existingLayer) return;

    // 创建图层
    const styleConfig = STYLE_CONFIGS[targetGeomType as keyof typeof STYLE_CONFIGS];
    const defaultStyle = styleConfig?.defaultStyle || { color: '#ef4444' };
    addLayer({
      id: targetLayerId,
      name: targetLayerName,
      type: 'Draw',
      visible: true,
      opacity: 1,
      geometryType: targetGeomType,
      style: defaultStyle,
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });
  }, [layers, addLayer]);

  return null;
}