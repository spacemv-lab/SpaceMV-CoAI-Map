/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { toast } from 'sonner';
import { useMapStore } from '../store/use-map-store';
import { v4 as uuidv4 } from 'uuid';
import { GeometryType, InteractionMode, LayerState } from '../types/map-state';
import { STYLE_CONFIGS } from '../constants/style-config';
import { createDatasetFeature } from '@/features/gis-data-manager/feature-api';

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
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);

  // 绘制状态 refs
  const pointsRef = useRef<[number, number][]>([]);
  const isDrawingRef = useRef(false);
  // 最近一次“加点”单击的像素坐标：用于在 dblclick 收尾时识别并去掉
  // 双击第二击产生的重复顶点（双击=两次同位 click + 一次 dblclick）
  const lastVertexPixelRef = useRef<{ x: number; y: number } | null>(null);

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

    // 清理临时图层，准备连续绘制下一个要素（不退出绘制模式；
    // 退出由“再点当前工具 / 点选择 / Esc”触发）
    clearDrawLayer(map);
    pointsRef.current = [];
    lastVertexPixelRef.current = null;
    isDrawingRef.current = false;
  }, [getMap]);

  // 落点：按目标图层类型分流 —— 已保存的 MVT/GeoJSON 图层写后端并重载瓦片；
  // 本地 Draw 图层（我的标注）累积到本地 data。
  // 注：从 useMapStore.getState() 取最新 activeLayerId/layers，避免 finishDrawing
  // 因 useCallback 记忆而持有过期闭包（否则会一直落到首次渲染时的图层）。
  const addToDrawLayer = useCallback(
    async (feature: GeoJSON.Feature, mode: InteractionMode) => {
      const geomType = (feature.geometry as { type: string }).type.toUpperCase() as GeometryType;
      const { activeLayerId: activeId, layers: currentLayers } = useMapStore.getState();

      // 有活跃编辑图层：按其类型分流
      if (activeId) {
        const targetLayer = currentLayers.find((l) => l.id === activeId);
        if (targetLayer) {
          // 已保存图层走 MVT 瓦片渲染，本地 data 不被读取 → 必须写后端 + 重载瓦片
          if (targetLayer.type === 'GeoJSON' && targetLayer.sourceId) {
            try {
              await createDatasetFeature(targetLayer.sourceId, {
                id: String(feature.id),
                geometry: feature.geometry as unknown as Record<string, unknown>,
                properties: (feature.properties as Record<string, unknown>) || {},
              });
              window.dispatchEvent(
                new CustomEvent('map:reload-mvt', { detail: { layerId: activeId } }),
              );
            } catch {
              toast.error('要素保存失败，请重试');
            }
            return;
          }

          // 本地 Draw 图层（我的标注）→ 累积到本地 data
          const localData = {
            type: 'FeatureCollection',
            features: [
              ...(targetLayer.data?.features || []),
              feature as { id: string; properties?: Record<string, unknown>; geometry: unknown },
            ],
          };
          updateLayer(activeId, { data: localData });
          return;
        }
      }

      // 无活动编辑图层 → 落到默认"我的标注"图层（本地）
      const modeToGeomType: Record<string, GeometryType> = {
        draw_point: 'POINT',
        draw_line: 'LINESTRING',
        draw_polygon: 'POLYGON',
      };
      const targetGeomType = modeToGeomType[mode] ?? geomType;

      const targetLayerId = DRAW_LAYER_IDS[targetGeomType as keyof typeof DRAW_LAYER_IDS];
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
    },
    [updateLayer],
  );

  // 处理绘制事件
  useEffect(() => {
    const map = getMap();
    if (!map || !viewerReady) return;

    // 非绘制模式时清理，并确保双击缩放恢复（浏览态需要）
    if (mode === 'default' || mode === 'select' || mode.startsWith('measure')) {
      clearDrawLayer(map);
      pointsRef.current = [];
      lastVertexPixelRef.current = null;
      isDrawingRef.current = false;
      map.doubleClickZoom.enable();
      return;
    }

    // 绘制开始时确保默认"我的标注"图层存在；编辑已保存图层时要素写后端，
    // 不需要、也不应创建默认绘制图层
    if (!useMapStore.getState().activeLayerId) {
      ensureDrawLayerExists(mode);
    }

    // 绘制模式禁用双击缩放：双击用于收尾，不应放大地图
    map.doubleClickZoom.disable();

    // 单击：点模式立即成要素；线/面模式只负责加顶点（收尾交给 dblclick）
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (mode === 'draw_point') {
        finishDrawing([coord], mode);
        return;
      }

      pointsRef.current.push(coord);
      lastVertexPixelRef.current = { x: e.point.x, y: e.point.y };
      isDrawingRef.current = true;
      updateDrawDisplay(pointsRef.current, mode);
    };

    // 双击：线/面收尾。双击会先触发两次 click（第二击与 dblclick 近乎同位，
    // 已把一个重复顶点 push 进去），此处按像素距离识别并去掉该重复顶点。
    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      if (mode !== 'draw_line' && mode !== 'draw_polygon') return;
      e.preventDefault();

      const last = lastVertexPixelRef.current;
      if (last) {
        const dist2 = (last.x - e.point.x) ** 2 + (last.y - e.point.y) ** 2;
        if (dist2 <= 9) {
          pointsRef.current.pop();
        }
      }
      lastVertexPixelRef.current = null;
      finishDrawing(pointsRef.current, mode);
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDrawingRef.current || mode === 'draw_point') return;

      // 实时更新最后一个点（浮动点）
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const points = [...pointsRef.current, coord];
      updateDrawDisplay(points, mode);
    };

    // Esc：放弃当前绘制并退出绘制模式
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      clearDrawLayer(map);
      pointsRef.current = [];
      lastVertexPixelRef.current = null;
      isDrawingRef.current = false;
      setInteractionMode('default');
    };

    // 添加事件监听
    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);
    map.on('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // 用 getMap() 取实时全局：导航离开时容器会先把 window.MAPLIBRE_MAP 置空、
      // 再 map.remove()，此时拿到 undefined 应整体跳过，避免对已销毁地图调用
      // getSource 崩溃（早期版本用 effect 开头捕获的 map，会指向已销毁对象）
      const currentMap = getMap();
      if (currentMap) {
        currentMap.doubleClickZoom.enable();
        currentMap.off('click', handleClick);
        currentMap.off('dblclick', handleDblClick);
        currentMap.off('mousemove', handleMouseMove);
        clearDrawLayer(currentMap);
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, viewerReady, getMap, updateDrawDisplay, finishDrawing, setInteractionMode]);

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