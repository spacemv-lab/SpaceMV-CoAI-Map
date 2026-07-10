/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * MapLibre GL 业务图层渲染器
 * 使用 MVT (Mapbox Vector Tiles) 加载图层，替代 Cesium 的 GeoJSON 加载
 *
 * 功能：
 * - syncMvtLayers: 同步 store.layers 到 MapLibre map
 * - addMvtLayer: 添加矢量瓦片图层 (vector source + circle/line/fill layer)
 * - updateMapLibreLayerVisibility: 更新图层可见性
 * - updateMapLibreLayerStyle: 更新图层样式（含虚线）
 * - 点击交互: queryRenderedFeatures 获取要素属性
 */

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapStore } from '../store/use-map-store';
import { LayerState, LabelStyle } from '../types/map-state';
import { fetchFeatureGeoJSON } from '@/features/gis-data-manager/feature-api';
import {
  generateGraduatedColorExpression,
  generateGraduatedSizeExpression,
  shouldUseGraduatedStyle,
} from '../utils/graduated-style-expression';
import { parseLabelExpression } from './label-expression-parser';
import { getLabelAnchor, getDefaultLabelPosition, DEFAULT_LABEL_ANCHOR_CANDIDATES, PointLabelPosition, PolygonLabelPlacementMode } from '../types/label-position';
import { createSymbolCanvas } from '../utils/symbol-canvas';

// MapLibre paint properties 类型（使用 Record 避免 strict typing）
type PaintProperties = Record<string, unknown>;

/**
 * 检查 map 是否处于可用状态
 * 在 map 销毁或样式切换期间，getLayer/getSource 可能返回 true 但内部状态无效
 */
function isMapValid(map: maplibregl.Map | undefined): boolean {
  if (!map) return false;
  try {
    // 尝试获取一个基本属性来判断 map 是否可用
    return map.isMoving() !== undefined;
  } catch {
    return false;
  }
}

/**
 * 安全地设置 paint property，捕获可能的异常
 */
function safeSetPaintProperty(
  map: maplibregl.Map,
  layerId: string,
  property: string,
  value: unknown,
): void {
  try {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, property, value);
    }
  } catch (e) {
    // 忽略 map 销毁期间的错误
  }
}

/**
 * 安全地设置 layout property
 */
function safeSetLayoutProperty(
  map: maplibregl.Map,
  layerId: string,
  property: string,
  value: unknown,
): void {
  try {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, property, value);
    }
  } catch (e) {
    // 忽略 map 销毁期间的错误
  }
}

// ============================================
// Point Symbol / Icon Support (symbol layer type)
// ============================================

const POINT_ICON_BASE_SIZE = 64;

/**
 * 判断点图层是否需要使用 symbol 图层类型（形状/图标）
 */
function shouldUsePointSymbol(style: LayerState['style']): boolean {
  if (style.pointImageUri) return true;
  if (style.pointSymbol && style.pointSymbol !== 'circle') return true;
  return false;
}

/**
 * 获取在 MapLibre 中注册的图标名称
 */
function getPointIconName(layerId: string): string {
  return `${layerId}-point-icon`;
}

/**
 * 在 MapLibre map 上注册点图标图片
 * 返回图标名称，失败返回 null
 */
function registerPointIcon(map: maplibregl.Map, layer: LayerState): string | null {
  const iconName = getPointIconName(layer.id);
  if (map.hasImage(iconName)) {
    try { map.removeImage(iconName); } catch { /* ignore */ }
  }

  const { style } = layer;
  let imageData: ImageData | null = null;

  if (style.pointImageUri) {
    const img = new Image();
    img.src = style.pointImageUri;

    const drawToImageData = (): ImageData | null => {
      if (!img.width || !img.height) return null;
      const canvas = document.createElement('canvas');
      canvas.width = POINT_ICON_BASE_SIZE;
      canvas.height = POINT_ICON_BASE_SIZE;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.min(POINT_ICON_BASE_SIZE / img.width, POINT_ICON_BASE_SIZE / img.height);
      const ox = (POINT_ICON_BASE_SIZE - img.width * scale) / 2;
      const oy = (POINT_ICON_BASE_SIZE - img.height * scale) / 2;
      ctx.drawImage(img, ox, oy, img.width * scale, img.height * scale);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    if (img.complete) {
      imageData = drawToImageData();
    } else {
      // 异步加载：等待图片解码后注册
      img.onload = () => {
        const data = drawToImageData();
        if (data) {
          try {
            if (map.hasImage(iconName)) map.removeImage(iconName);
            map.addImage(iconName, data);
            safeSetLayoutProperty(map, `${layer.id}-point`, 'icon-image', iconName);
          } catch (e) {
            console.warn(`[MapLibreLayerRenderer] Failed to async register point icon:`, e);
          }
        }
      };
      img.onerror = () => {
        console.warn(`[MapLibreLayerRenderer] Failed to load custom icon image`);
      };
    }
  } else if (style.pointSymbol && style.pointSymbol !== 'circle') {
    const canvas = createSymbolCanvas(style.pointSymbol, style.color ?? '#3388ff', POINT_ICON_BASE_SIZE);
    const ctx = canvas.getContext('2d')!;
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  if (imageData) {
    try {
      map.addImage(iconName, imageData);
      return iconName;
    } catch (e) {
      console.warn(`[MapLibreLayerRenderer] Failed to register point icon:`, e);
      return null;
    }
  }

  return null;
}

/**
 * 移除在 MapLibre map 上注册的点图标
 */
function removePointIcon(map: maplibregl.Map, layerId: string) {
  const iconName = getPointIconName(layerId);
  try {
    if (map.hasImage(iconName)) {
      map.removeImage(iconName);
    }
  } catch {
    // 忽略 map 销毁时的错误
  }
}

/**
 * 从显示的 pointSize 计算 icon-size 倍率
 */
function pointSizeToIconRatio(pointSize: number): number {
  return pointSize / POINT_ICON_BASE_SIZE;
}

// ============================================
// Edit Layer
// ============================================

const EDIT_SOURCE_ID = '__edit-feature__';

/**
 * 初始化编辑图层（GeoJSON source + fill/outline）
 */
function initEditLayer(map: maplibregl.Map) {
  if (map.getSource(EDIT_SOURCE_ID)) return;

  map.addSource(EDIT_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // fill 层（编辑中的多边形/多面要素）
  map.addLayer({
    id: EDIT_SOURCE_ID + '-fill',
    type: 'fill',
    source: EDIT_SOURCE_ID,
    paint: {
      'fill-color': '#3b82f6',
      'fill-opacity': 0.4,
    },
    // 用表达式 match（MapLibre v5 filter 按表达式解析；旧版可变参数 `in` 会报 "Expected 2 arguments, but found 3"）
    filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
  });

  // outline 层（线 + 多边形/多面边框，排除 Point 节点）
  map.addLayer({
    id: EDIT_SOURCE_ID + '-outline',
    type: 'line',
    source: EDIT_SOURCE_ID,
    filter: ['!=', ['geometry-type'], 'Point'],
    paint: {
      'line-color': '#1d4ed8',
      'line-width': 3,
    },
  });

  // 节点手柄层（仅线/面要素的顶点）
  map.addLayer({
    id: EDIT_SOURCE_ID + '-nodes',
    type: 'circle',
    source: EDIT_SOURCE_ID,
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        10, // 选中时 10px
        ['boolean', ['feature-state', 'hovered'], false],
        10, // hover 时 10px
        7, // 默认 7px
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#ef4444', // 选中时红色
        ['boolean', ['feature-state', 'hovered'], false],
        '#fbbf24', // hover 时黄色
        '#ffffff', // 默认白色
      ],
      'circle-stroke-color': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        '#dc2626', // 选中时深红描边
        ['boolean', ['feature-state', 'hovered'], false],
        '#f59e0b', // hover 时深橙色描边
        '#1d4ed8', // 默认蓝色描边
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        3, // 选中时加粗
        ['boolean', ['feature-state', 'hovered'], false],
        3, // hover 时加粗
        2, // 默认描边
      ],
    },
    filter: ['has', 'isNode'],
  });

  // 不可见的点击热图层 — 用较大的圆扩大点击范围
  map.addLayer({
    id: EDIT_SOURCE_ID + '-nodes-hitarea',
    type: 'circle',
    source: EDIT_SOURCE_ID,
    paint: {
      'circle-radius': 15,
      'circle-opacity': 0,
    },
    filter: ['has', 'isNode'],
  });
}

/**
 * 设置 MVT filter：隐藏正在编辑的要素
 */
function applyMvtHideFilter(
  map: maplibregl.Map,
  layerId: string,
  featureId: string | null,
) {
  const layerIds = [
    `${layerId}-point`,
    `${layerId}-line`,
    `${layerId}-fill`,
    `${layerId}-outline`,
  ];

  for (const lid of layerIds) {
    if (!map.getLayer(lid)) continue;
    if (featureId) {
      map.setFilter(lid, ['!=', ['get', 'feature_id'], featureId]);
    } else {
      map.setFilter(lid, null);
    }
  }
}

/**
 * 从 GeoJSON geometry 提取所有顶点坐标
 */
function extractVertices(geometry: { type: string; coordinates: unknown }): number[][] {
  const coords = geometry?.coordinates;
  if (!coords) return [];

  if (geometry.type === 'Point') return [coords as number[]];
  if (geometry.type === 'MultiPoint') return coords as number[][];
  if (geometry.type === 'LineString') return coords as number[][];
  if (geometry.type === 'MultiLineString') {
    return (coords as number[][][]).flat();
  }
  if (geometry.type === 'Polygon') {
    const ring = (coords as number[][][])[0] || [];
    return ring.length > 0 ? ring.slice(0, -1) : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return (coords as number[][][][]).flatMap(poly => {
      const ring = poly[0] || [];
      return ring.length > 0 ? ring.slice(0, -1) : [];
    });
  }
  return [];
}

// ============================================
// AIS/ADS-B 动态图标支持
// ============================================

/**
 * 检测图层是否为 AIS/ADS-B 类型
 */
function isAisAdsbLayer(layer: LayerState): boolean {
  const tags = layer.tags || [];
  const name = layer.name || '';
  return tags.includes('ais') || tags.includes('ads-b') ||
         name.toLowerCase().includes('ais') || name.toLowerCase().includes('ads-b');
}

/**
 * 检测图层是否需要航向旋转（AIS/ADS-B）
 */
function isHeadingRotatedLayer(layer: LayerState): boolean {
  return isAisAdsbLayer(layer);
}

/**
 * 获取航向属性名
 */
function getHeadingProperty(layer: LayerState): string {
  const tags = layer.tags || [];
  if (tags.includes('ais') || (layer.name?.toLowerCase().includes('ais'))) {
    return 'cog';  // Course Over Ground
  }
  if (tags.includes('ads-b') || (layer.name?.toLowerCase().includes('ads-b'))) {
    return 'track';
  }
  return 'heading';
}

/**
 * 根据属性值选择图标名称（ADS-B 动态颜色）
 */
function getIconNameExpression(layer: LayerState): string | unknown[] {
  const tags = layer.tags || [];
  const name = layer.name || '';

  // 飞机（ADS-B）：根据垂直率选择颜色
  if (tags.includes('ads-b') || name.toLowerCase().includes('ads-b')) {
    return [
      'case',
      ['>', ['coalesce', ['get', 'verticalRate'], 0], 5], 'plane-green',      // 爬升
      ['<', ['coalesce', ['get', 'verticalRate'], 0], -5], 'plane-orange',    // 下降
      ['==', ['coalesce', ['get', 'onGround'], false], true], 'plane-gray',   // 地面
      'plane-blue'                                            // 默认
    ];
  }

  // 船舶（AIS）：固定图标
  if (tags.includes('ais') || name.toLowerCase().includes('ais')) {
    return 'ship';
  }

  // 其他：返回空（不使用图标）
  return '';
}

/**
 * 更新编辑 source 数据（含节点手柄）
 */
function updateEditSource(map: maplibregl.Map, feature: import('geojson').Feature | null) {
  let source = map.getSource(EDIT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) {
    // 没有要素要显示就不必创建 source（避免只读分享页无谓创建）
    if (!feature) return;
    // source 可能因底图切换被 map.setStyle() 清掉（initEditLayer 只在 viewerReady 时调一次，
    // 不会重跑）。进编辑时按需重建，否则编辑要素画不出来、"mvt 消失但编辑要素不出现"。
    initEditLayer(map);
    source = map.getSource(EDIT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  }
  if (!source) return;

  if (!feature) {
    source.setData({ type: 'FeatureCollection' as const, features: [] });
    return;
  }

  const features: import('geojson').Feature[] = [feature];

  // 添加节点手柄
  const vertices = extractVertices(feature.geometry as { type: string; coordinates: unknown });
  for (let i = 0; i < vertices.length; i++) {
    const coord = vertices[i];
    features.push({
      type: 'Feature',
      id: i + 10000, // numeric ID for setFeatureState compatibility
      properties: { isNode: true, nodeIndex: i, featureId: `node-${i}` },
      geometry: { type: 'Point', coordinates: coord },
    } as import('geojson').Feature);
  }

  source.setData({ type: 'FeatureCollection' as const, features });
}

/**
 * 清空编辑 source
 */
function clearEditSource(map: maplibregl.Map) {
  const source = map.getSource(EDIT_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData({ type: 'FeatureCollection' as const, features: [] });
  }
  // 清理 hover state (由调用方在退出编辑时处理)
}

/**
 * 删除 geometry 中指定索引的顶点
 */
function deleteNodeAt(
  geometry: { type: string; coordinates: unknown },
  nodeIdx: number,
): { type: string; coordinates: unknown } {
  if (geometry.type === 'LineString') {
    const coords = [...(geometry.coordinates as number[][])];
    coords.splice(nodeIdx, 1);
    return { ...geometry, coordinates: coords };
  }
  if (geometry.type === 'MultiLineString') {
    const coords = (geometry.coordinates as number[][][]).map(line => [...line]);
    let acc = 0;
    for (let i = 0; i < coords.length; i++) {
      if (nodeIdx < acc + coords[i].length) {
        coords[i].splice(nodeIdx - acc, 1);
        break;
      }
      acc += coords[i].length;
    }
    return { ...geometry, coordinates: coords };
  }
  if (geometry.type === 'Polygon') {
    const coords = [...(geometry.coordinates as number[][][])];
    const ring = [...coords[0]];
    ring.splice(nodeIdx, 1);
    // 保证首尾闭合
    if (ring.length > 0) {
      ring[ring.length - 1] = [...ring[0]];
    }
    coords[0] = ring;
    return { ...geometry, coordinates: coords };
  }
  if (geometry.type === 'MultiPolygon') {
    const coords = (geometry.coordinates as number[][][][]).map(poly =>
      poly.map(ring => [...ring])
    );
    let acc = 0;
    for (let i = 0; i < coords.length; i++) {
      const ring = coords[i][0];
      if (ring && nodeIdx < acc + ring.length - 1) {
        ring.splice(nodeIdx - acc, 1);
        if (ring.length > 0) ring[ring.length - 1] = [...ring[0]];
        break;
      }
      acc += (ring ? ring.length - 1 : 0);
    }
    return { ...geometry, coordinates: coords };
  }
  // Point/MultiPoint 不支持节点删除
  return geometry;
}

/**
 * 平移 GeoJSON geometry 的所有坐标
 */
function translateGeometry(
  geometry: { type: string; coordinates: unknown },
  dx: number,
  dy: number,
): { type: string; coordinates: unknown } {
  const translateCoord = (coord: number[]): number[] => [coord[0] + dx, coord[1] + dy];

  if (geometry.type === 'Point') {
    return {
      ...geometry,
      coordinates: translateCoord(geometry.coordinates as number[]),
    };
  }
  if (geometry.type === 'MultiPoint') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][]).map(translateCoord),
    };
  }
  if (geometry.type === 'LineString') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][]).map(translateCoord),
    };
  }
  if (geometry.type === 'MultiLineString') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][]).map((line) =>
        line.map(translateCoord),
      ),
    };
  }
  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][]).map((ring) =>
        ring.map(translateCoord),
      ),
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][][]).map((poly) =>
        poly.map((ring) => ring.map(translateCoord)),
      ),
    };
  }
  return geometry;
}

/**
 * 将 lngLat 坐标投影到屏幕像素
 */
function lngLatToPixel(
  map: maplibregl.Map,
  lng: number,
  lat: number,
): { x: number; y: number } {
  const point = map.project([lng, lat]);
  return { x: point.x, y: point.y };
}

/**
 * 计算两点间像素距离
 */
function pixelDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/**
 * 检测是否点击了顶点（像素距离 < threshold）
 * 返回最近节点的索引，未命中返回 -1
 */
function hitTestNode(
  map: maplibregl.Map,
  screenX: number,
  screenY: number,
  vertices: number[][],
  threshold = 30,
): number {
  let closestIdx = -1;
  let closestDist = threshold;
  for (let i = 0; i < vertices.length; i++) {
    const { x, y } = lngLatToPixel(map, vertices[i][0], vertices[i][1]);
    const dist = pixelDistance(screenX, screenY, x, y);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

// ============================================
// Layer Operations
// ============================================

/**
 * 添加 MVT 图层到 MapLibre map
 */
function addMvtLayer(map: maplibregl.Map, layer: LayerState) {
  // 只处理 GeoJSON 类型（有 sourceId 的图层）
  if (layer.type !== 'GeoJSON' || !layer.sourceId) {
    return;
  }

  // 构建 MVT URL template - 必须使用完整 URL
  // MapLibre vector source 不支持相对路径
  const origin = window.location.origin;
  const mvtUrlTemplate =
    layer.routingMetadata?.mvtUrlTemplate
      ? `${origin}${layer.routingMetadata.mvtUrlTemplate}`
      : `${origin}/api/datasets/${layer.sourceId}/mvt/{z}/{x}/{y}`;

  // 添加 vector source
  if (map.getSource(layer.id)) {
  } else {
    map.addSource(layer.id, {
      type: 'vector',
      tiles: [mvtUrlTemplate],
      minzoom: 1,
      maxzoom: 18,
    });
  }

  // 根据 geometryType 分别添加图层
  const visibility = layer.visible ? 'visible' : 'none';

  if (layer.geometryType === 'POINT') {
    // AIS/ADS-B 使用 symbol 图层（图标 + 航向旋转）
    if (isAisAdsbLayer(layer)) {
      const hasHeading = isHeadingRotatedLayer(layer);
      const iconExpression = getIconNameExpression(layer);

      // 获取 map 实例检查图标是否加载
      const mapInstance = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
      if (mapInstance) {
      }


      map.addLayer({
        id: `${layer.id}-point`,
        type: 'symbol',
        source: layer.id,
        'source-layer': 'features',
        layout: {
          visibility,
          // 动态选择图标（expression 或 string）
          'icon-image': iconExpression as any,
          // 图标大小 - 根据状态动态调整
          'icon-size': [
            'case',
            ['>', ['coalesce', ['get', 'verticalRate'], 0], 5], 0.6,      // 爬升稍大
            ['<', ['coalesce', ['get', 'verticalRate'], 0], -5], 0.6,      // 下降稍大
            ['==', ['coalesce', ['get', 'onGround'], false], true], 0.4,   // 地面稍小
            0.5                                                            // 默认
          ],
          // 关键：航向旋转
          'icon-rotate': hasHeading
            ? ['coalesce', ['get', getHeadingProperty(layer)], 0]
            : 0,
          'icon-rotation-alignment': 'map',  // 旋转跟随地图方向
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': layer.style.opacity ?? 1,
        },
      });


      // 强制刷新图层样式
      setTimeout(() => {
        if (map.getLayer(`${layer.id}-point`)) {
          map.setLayoutProperty(`${layer.id}-point`, 'icon-image', iconExpression);
          map.setLayoutProperty(`${layer.id}-point`, 'icon-size', [
            'case',
            ['>', ['coalesce', ['get', 'verticalRate'], 0], 5], 0.6,
            ['<', ['coalesce', ['get', 'verticalRate'], 0], -5], 0.6,
            ['==', ['coalesce', ['get', 'onGround'], false], true], 0.4,
            0.5
          ]);
        }
      }, 100);

      // 添加调试：检查瓦片加载后的属性
      map.on('sourcedata', (e) => {
        if (e.sourceId === layer.id && e.isSourceLoaded) {
          const features = map.querySourceFeatures(layer.id, { sourceLayer: 'features' });
          if (features.length > 0) {

            // 统计不同状态的飞机数量
            let climbing = 0, descending = 0, ground = 0, cruising = 0;
            features.forEach(f => {
              const vr = f.properties.verticalRate ?? 0;
              const onGround = f.properties.onGround;
              if (vr > 5) climbing++;
              else if (vr < -5) descending++;
              else if (onGround === true) ground++;
              else cruising++;
            });
          }
        }
      });
    } else if (shouldUsePointSymbol(layer.style)) {
      // 普通点：使用 symbol 类型（形状/自定义图标）
      const iconName = registerPointIcon(map, layer);
      map.addLayer({
        id: `${layer.id}-point`,
        type: 'symbol',
        source: layer.id,
        'source-layer': 'features',
        layout: {
          visibility,
          'icon-image': iconName ?? '',
          'icon-size': pointSizeToIconRatio(layer.style.pointSize ?? 10),
          'icon-rotate': layer.style.pointRotation ?? 0,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': layer.style.opacity ?? 1,
        },
      });
    } else {
      // 普通 POINT 图层使用 circle
      map.addLayer({
        id: `${layer.id}-point`,
        type: 'circle',
        source: layer.id,
        'source-layer': 'features',
        layout: { visibility },
        paint: {
          'circle-radius': layer.style.pointSize ?? 6,
          'circle-color': layer.style.color ?? '#3388ff',
          'circle-opacity': layer.style.opacity ?? 0.5,
          'circle-stroke-color': layer.style.outlineColor ?? '#ffffff',
          'circle-stroke-width': layer.style.pointOutlineWidth ?? 1,
        },
      });
    }
  } else if (layer.geometryType === 'LINESTRING') {
    const color = layer.style.color ?? '#3388ff';
    map.addLayer({
      id: `${layer.id}-line`,
      type: 'line',
      source: layer.id,
      'source-layer': 'features',
      layout: { visibility },
      paint: {
        'line-color': color,
        'line-width': layer.style.width ?? 2,
        'line-opacity': layer.style.opacity ?? 0.5,
        'line-dasharray': getLineDashArray(layer.style.lineType ?? 'solid'),
      },
    });
  } else if (layer.geometryType === 'POLYGON') {
    const color = layer.style.color ?? '#3388ff';

    // fill 图层
    map.addLayer({
      id: `${layer.id}-fill`,
      type: 'fill',
      source: layer.id,
      'source-layer': 'features',
      layout: { visibility },
      paint: {
        'fill-color': color,
        'fill-opacity': layer.style.opacity ?? 0.5,
      },
    });

    // outline 图层
    map.addLayer({
      id: `${layer.id}-outline`,
      type: 'line',
      source: layer.id,
      'source-layer': 'features',
      layout: { visibility },
      paint: {
        'line-color': layer.style.outlineColor ?? color,
        'line-width': layer.style.outlineWidth ?? 1,
        'line-opacity': layer.style.opacity ?? 0.5,
      },
    });
  } else {
    // 默认添加 circle 图层（未知类型）
    map.addLayer({
      id: `${layer.id}-point`,
      type: 'circle',
      source: layer.id,
      'source-layer': 'features',
      layout: { visibility },
      paint: {
        'circle-radius': 6,
        'circle-color': layer.style.color ?? '#3388ff',
        'circle-opacity': layer.style.opacity ?? 0.5,
      },
    });
  }

  // 触发图层加载完成事件（供 benchmark 等外部消费者监听）
  window.dispatchEvent(
    new CustomEvent('map:layer-loaded', {
      detail: { layerId: layer.id, name: layer.name },
    }),
  );
}

/**
 * 获取线型对应的 dasharray
 */
function getLineDashArray(lineType: string): number[] {
  switch (lineType) {
    case 'dashed':
      return [8, 4];
    case 'dotted':
      return [1, 3];
    case 'solid':
    default:
      return [1, 0];
  }
}

/**
 * 移除 MapLibre 图层
 */
function removeMapLibreLayer(map: maplibregl.Map, layerId: string) {
  const source = map.getSource(layerId);
  if (!source) return;

  // 移除注册的点图标
  removePointIcon(map, layerId);

  // 移除所有关联的图层（包括标注图层）
  const layersToRemove = [
    `${layerId}-point`,
    `${layerId}-line`,
    `${layerId}-fill`,
    `${layerId}-outline`,
    `${layerId}-label`, // 标注图层
  ];

  for (const layerIdToRemove of layersToRemove) {
    if (map.getLayer(layerIdToRemove)) {
      map.removeLayer(layerIdToRemove);
    }
  }

  // 移除标注边界专用的 source（如果存在）
  const labelBoundarySourceId = `${layerId}-label-boundary`;
  if (map.getSource(labelBoundarySourceId)) {
    if (map.getLayer(`${labelBoundarySourceId}-line`)) {
      map.removeLayer(`${labelBoundarySourceId}-line`);
    }
    map.removeSource(labelBoundarySourceId);
  }

  // 移除 source
  map.removeSource(layerId);

}

// ============================================
// Label Layer Operations
// ============================================

/**
 * 根据缩放层级计算每像素对应的米数
 * 公式: metersPerPixel = 40075016.686 * cos(lat) / (2^zoom * 256)
 */
function getMetersPerPixelAtZoom(zoom: number, latitude: number = 30): number {
  const earthCircumference = 40075016.686; // 米
  const tileSize = 256;
  return earthCircumference * Math.cos(latitude * Math.PI / 180) / (Math.pow(2, zoom) * tileSize);
}

/**
 * 将重复间隔（米）转换为像素
 */
function metersToPixels(meters: number, zoom: number): number {
  return meters / getMetersPerPixelAtZoom(zoom);
}

/**
 * 从 GeoJSON 数据中提取线要素的起点/终点/中点坐标
 * 用于线要素的起点标注、终点标注、中点标注
 */
function extractLinePointFeatures(
  data: { type: string; features: any[] },
  position: 'start' | 'end' | 'middle'
): GeoJSON.Feature[] {
  const pointFeatures: GeoJSON.Feature[] = [];

  for (const feature of data.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    // 处理 LineString 和 MultiLineString
    const lineStrings: number[][][] = [];

    if (geom.type === 'LineString') {
      lineStrings.push(geom.coordinates);
    } else if (geom.type === 'MultiLineString') {
      lineStrings.push(...geom.coordinates);
    }

    for (const coords of lineStrings) {
      if (coords.length < 2) continue;

      let targetCoord: number[];

      if (position === 'start') {
        targetCoord = coords[0];
      } else if (position === 'end') {
        targetCoord = coords[coords.length - 1];
      } else if (position === 'middle') {
        // 计算线的中点（基于坐标索引）
        const midIndex = Math.floor(coords.length / 2);
        targetCoord = coords[midIndex];
      } else {
        continue;
      }

      // 创建点 Feature，保留原始属性用于标注
      pointFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: targetCoord,
        },
        properties: feature.properties || {},
        id: feature.id,
      });
    }
  }

  return pointFeatures;
}

/**
 * 从 GeoJSON 数据中提取面要素的外环边界作为 LineString
 * 用于面要素的边界标注
 */
function extractPolygonBoundaryFeatures(
  data: { type: string; features: any[] }
): GeoJSON.Feature[] {
  const boundaryFeatures: GeoJSON.Feature[] = [];

  for (const feature of data.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    // 处理 Polygon 和 MultiPolygon
    const polygons: number[][][] = [];

    if (geom.type === 'Polygon') {
      polygons.push(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const polyCoords of geom.coordinates) {
        polygons.push(polyCoords as number[][][]);
      }
    }

    for (const polyCoords of polygons) {
      // 提取外环（第一个环）
      if (polyCoords.length > 0 && polyCoords[0].length >= 2) {
        const exteriorRing = polyCoords[0];

        // 创建 LineString Feature，保留原始属性用于标注
        boundaryFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: exteriorRing,
          },
          properties: feature.properties || {},
          id: feature.id,
        });
      }
    }
  }

  return boundaryFeatures;
}

/**
 * 更新或添加标注图层
 * 根据 layer.style.label 配置添加 symbol layer
 */
function updateLabelLayer(map: maplibregl.Map, layer: LayerState) {
  const labelStyle = layer.style?.label;

  // 如果标注未启用，移除现有标注图层
  if (!labelStyle?.enabled) {
    const labelLayerId = `${layer.id}-label`;
    if (map.getLayer(labelLayerId)) {
      map.removeLayer(labelLayerId);
    }
    // 移除线要素起点/终点/中点标注专用 source
    const linePointSourceId = `${layer.id}-label-point`;
    if (map.getSource(linePointSourceId)) {
      map.removeSource(linePointSourceId);
    }
    // 移除边界标注专用 source 和 layer
    const boundarySourceId = `${layer.id}-label-boundary`;
    const boundaryLayerId = `${boundarySourceId}-label`;
    if (map.getLayer(boundaryLayerId)) {
      map.removeLayer(boundaryLayerId);
    }
    if (map.getSource(boundarySourceId)) {
      map.removeSource(boundarySourceId);
    }
    return;
  }

  // 没有表达式或文本，不渲染标注
  if (!labelStyle.expression && !labelStyle.text) {
    return;
  }

  // 解析表达式
  const textField = parseLabelExpression(labelStyle.expression || labelStyle.text || '');

  // 获取标注位置
  const position = labelStyle.position || getDefaultLabelPosition(layer.geometryType);
  // 点要素使用中心锚点，偏移通过 slider 控制
  const anchor = layer.geometryType === 'POINT' ? 'center' : getLabelAnchor(position);

  // 缩放范围
  const minZoom = labelStyle.minZoom ?? 10;
  const maxZoom = labelStyle.maxZoom ?? 18;

  // 字号和颜色
  const fontSize = labelStyle.fontSize ?? 14;
  const textColor = labelStyle.fillColor ?? '#333333';

  // 计算文本偏移量（点要素和面要素专用）
  // text-offset 格式: [x, y] 单位为 em（相对于字号）
  // x: 正值右，负值左；y: 正值下，负值上
  let textOffset: [number, number] = [0, 0];

  if (layer.geometryType === 'POINT' || layer.geometryType === 'POLYGON') {
    // 从用户自定义偏移获取值（单位为像素，转换为 em）
    const customOffsetX = labelStyle.offsetX ?? 0;
    const customOffsetY = labelStyle.offsetY ?? 0;

    // 将像素偏移转换为 em（假设 1em ≈ fontSize 像素）
    const pixelToEm = 1 / fontSize;
    textOffset = [
      customOffsetX * pixelToEm,
      customOffsetY * pixelToEm,
    ];
  }

  // 面要素标注放置模式（仅 POLYGON；缺省视为 'auto'）
  const polygonPlacement: PolygonLabelPlacementMode | null =
    layer.geometryType === 'POLYGON' ? (labelStyle.placementMode ?? 'auto') : null;
  const isPolygonAuto = polygonPlacement === 'auto';
  const isPolygonFixed = polygonPlacement === 'fixed';

  // 是否允许标注重叠（默认 false；重叠时引擎自动隐藏低优先级标注）
  const allowOverlap = labelStyle.allowOverlap ?? false;

  // auto 模式候选锚点（text-variable-anchor）
  const variableAnchorCandidates: PointLabelPosition[] =
    labelStyle.anchorCandidates && labelStyle.anchorCandidates.length > 0
      ? labelStyle.anchorCandidates
      : DEFAULT_LABEL_ANCHOR_CANDIDATES;

  // 线要素沿线标注的特殊处理
  const isLineAlong = layer.geometryType === 'LINESTRING' && position === 'along';
  const isLinePointLabel = layer.geometryType === 'LINESTRING' && ['start', 'end', 'middle'].includes(position);
  const symbolPlacement = isLineAlong ? 'line' : 'point';

  // 计算沿线重复间隔（像素）
  const symbolSpacing = isLineAlong && labelStyle.repeatInterval
    ? metersToPixels(labelStyle.repeatInterval, map.getZoom())
    : 250; // 默认像素间隔

  // 线要素起点/终点/中点标注：需要创建单独的点 GeoJSON source
  let linePointSourceId: string | null = null;
  if (isLinePointLabel && layer.data) {
    linePointSourceId = `${layer.id}-label-point`;
    const pointPosition = position as 'start' | 'end' | 'middle';
    const pointFeatures = extractLinePointFeatures(layer.data, pointPosition);

    if (map.getSource(linePointSourceId)) {
      (map.getSource(linePointSourceId) as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: pointFeatures,
      });
    } else {
      map.addSource(linePointSourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pointFeatures,
        },
      });
    }
  }

  const labelLayerId = `${layer.id}-label`;

  // 检查标注图层是否已存在
  if (map.getLayer(labelLayerId)) {
    // 检查 source 是否需要改变（线要素起点/终点/中点标注需要使用独立的点 source）
    const currentLayer = map.getLayer(labelLayerId) as any;
    const currentSource = currentLayer?.source;
    const expectedSource = linePointSourceId || layer.id;

    // source 不匹配，或面要素标注（放置模式/variable-anchor 切换需重建）
    if (currentSource !== expectedSource || layer.geometryType === 'POLYGON') {
      map.removeLayer(labelLayerId);
      // 继续执行后面的添加逻辑
    } else {
      // 更新现有标注图层
      try {
        map.setLayoutProperty(labelLayerId, 'text-field', textField as any);
        map.setLayoutProperty(labelLayerId, 'text-font', [labelStyle.font ?? 'Arial Unicode MS Regular']);
        map.setLayoutProperty(labelLayerId, 'text-size', fontSize);
        map.setLayoutProperty(labelLayerId, 'text-anchor', anchor);
        map.setLayoutProperty(labelLayerId, 'text-padding', labelStyle.padding ?? 2);
        map.setPaintProperty(labelLayerId, 'text-color', textColor);
        map.setPaintProperty(labelLayerId, 'text-halo-color', labelStyle.outlineColor ?? '#ffffff');
        map.setPaintProperty(labelLayerId, 'text-halo-width', labelStyle.outlineWidth ?? 1);
        map.setLayerZoomRange(labelLayerId, minZoom, maxZoom);

        // 点要素设置偏移量（面要素标注走重建路径，不在此就地更新）
        if (layer.geometryType === 'POINT') {
          map.setLayoutProperty(labelLayerId, 'text-offset', textOffset);
        }

        if (isLineAlong) {
          map.setLayoutProperty(labelLayerId, 'symbol-placement', 'line');
          map.setLayoutProperty(labelLayerId, 'symbol-spacing', symbolSpacing);
          map.setLayoutProperty(labelLayerId, 'text-rotation-alignment', 'map');
        } else {
          map.setLayoutProperty(labelLayerId, 'symbol-placement', 'point');
        }
      } catch (e) {
        console.warn(`[MapLibreLayerRenderer] Failed to update label layer: ${e}`);
      }
      return;
    }
  }

  // 添加新的标注图层
  // 对于 MVT 瓦片图层，使用相同的 source 和 source-layer
  // 对于 Draw 图层，使用相同的 GeoJSON source
  const sourceType = map.getSource(layer.id)?.type;

  const labelLayerConfig: maplibregl.SymbolLayerSpecification = {
    id: labelLayerId,
    type: 'symbol',
    // 线要素起点/终点/中点标注使用单独的点 source
    source: linePointSourceId || layer.id,
    layout: {
      'text-field': textField as any,
      'text-font': [labelStyle.font ?? 'Arial Unicode MS Regular'],
      'text-size': fontSize,
      'text-allow-overlap': allowOverlap,
      'text-padding': labelStyle.padding ?? 2,
      'symbol-placement': symbolPlacement,
      'symbol-spacing': symbolSpacing,
      'text-rotation-alignment': isLineAlong ? 'map' : 'viewport',
      // text-anchor：auto 面要素不设（由 variable-anchor 决定），其余沿用计算值
      ...(!isPolygonAuto && { 'text-anchor': anchor as any }),
      // text-offset：仅 POINT 与 固定锚点面要素
      ...((layer.geometryType === 'POINT' || isPolygonFixed) && { 'text-offset': textOffset }),
      // 面要素自动寻位：候选锚点 + 径向偏移
      ...(isPolygonAuto && {
        'text-variable-anchor': variableAnchorCandidates,
        'text-radial-offset': labelStyle.radialOffset ?? 1,
      }),
    },
    paint: {
      'text-color': textColor,
      'text-halo-color': labelStyle.outlineColor ?? '#ffffff',
      'text-halo-width': labelStyle.outlineWidth ?? 1,
    },
    minzoom: minZoom,
    maxzoom: maxZoom,
  };

  // MVT 瓦片图层需要 source-layer
  if (sourceType === 'vector') {
    (labelLayerConfig as any)['source-layer'] = 'features';
  }

  // 添加标注图层
  try {
    map.addLayer(labelLayerConfig);
  } catch (e) {
    console.warn(`[MapLibreLayerRenderer] Failed to add label layer: ${e}`);
  }

  // 处理面要素边界标注
  // 如果位置不是 boundary，清理旧的边界标注
  if (layer.geometryType === 'POLYGON' && position !== 'boundary') {
    const boundarySourceId = `${layer.id}-label-boundary`;
    const boundaryLayerId = `${boundarySourceId}-label`;
    if (map.getLayer(boundaryLayerId)) {
      map.removeLayer(boundaryLayerId);
    }
    if (map.getSource(boundarySourceId)) {
      map.removeSource(boundarySourceId);
    }
  }

  // 处理面要素边界标注
  if (layer.geometryType === 'POLYGON' && position === 'boundary' && layer.data) {
    const boundarySourceId = `${layer.id}-label-boundary`;
    const boundaryFeatures = extractPolygonBoundaryFeatures(layer.data);

    if (boundaryFeatures.length > 0) {
      // 添加或更新边界线 source
      if (map.getSource(boundarySourceId)) {
        (map.getSource(boundarySourceId) as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: boundaryFeatures,
        });
      } else {
        map.addSource(boundarySourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: boundaryFeatures,
          },
        });
      }

      // 添加边界标注图层
      const boundaryLayerId = `${boundarySourceId}-label`;
      if (!map.getLayer(boundaryLayerId)) {
        map.addLayer({
          id: boundaryLayerId,
          type: 'symbol',
          source: boundarySourceId,
          layout: {
            'text-field': textField as any,
            'text-font': [labelStyle.font ?? 'Arial Unicode MS Regular'],
            'text-size': fontSize,
            'text-anchor': 'center',
            'text-allow-overlap': false,
            'text-padding': labelStyle.padding ?? 2,
            'symbol-placement': 'line',
            'symbol-spacing': 250,
            'text-rotation-alignment': 'map',
          },
          paint: {
            'text-color': textColor,
            'text-halo-color': labelStyle.outlineColor ?? '#ffffff',
            'text-halo-width': labelStyle.outlineWidth ?? 1,
          },
          minzoom: minZoom,
          maxzoom: maxZoom,
        });
      }
    }
  } else if (layer.geometryType === 'POLYGON' && position === 'boundary') {
    // 无 GeoJSON 数据，无法实现边界标注
  }
}

// ============================================
// Draw Layer Operations (GeoJSON source)
// ============================================

/**
 * 添加 Draw 图层（使用 GeoJSON source）
 * Draw 图层存储完整 GeoJSON 数据，非 MVT 瓦片
 */
function addDrawLayer(map: maplibregl.Map, layer: LayerState) {
  if (layer.type !== 'Draw') return;

  // 添加 GeoJSON source
  if (map.getSource(layer.id)) {
  } else {
    map.addSource(layer.id, {
      type: 'geojson',
      data: layer.data || { type: 'FeatureCollection' as const, features: [] },
    });
  }

  const visibility = layer.visible ? 'visible' : 'none';

  // 根据几何类型添加图层
  if (layer.geometryType === 'POINT') {
    if (shouldUsePointSymbol(layer.style)) {
      const iconName = registerPointIcon(map, layer);
      map.addLayer({
        id: `${layer.id}-point`,
        type: 'symbol',
        source: layer.id,
        layout: {
          visibility,
          'icon-image': iconName ?? '',
          'icon-size': pointSizeToIconRatio(layer.style.pointSize ?? 10),
          'icon-rotate': layer.style.pointRotation ?? 0,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': layer.style.opacity ?? 0.8,
        },
      });
    } else {
      map.addLayer({
        id: `${layer.id}-point`,
        type: 'circle',
        source: layer.id,
        layout: { visibility },
        paint: {
          'circle-radius': layer.style.pointSize ?? 6,
          'circle-color': layer.style.color ?? '#ef4444',
          'circle-opacity': layer.style.opacity ?? 0.8,
          'circle-stroke-color': layer.style.outlineColor ?? '#ffffff',
          'circle-stroke-width': layer.style.pointOutlineWidth ?? 2,
        },
      });
    }
  } else if (layer.geometryType === 'LINESTRING') {
    map.addLayer({
      id: `${layer.id}-line`,
      type: 'line',
      source: layer.id,
      layout: { visibility },
      paint: {
        'line-color': layer.style.color ?? '#ef4444',
        'line-width': layer.style.width ?? 3,
        'line-opacity': layer.style.opacity ?? 0.8,
        'line-dasharray': getLineDashArray(layer.style.lineType ?? 'solid'),
      },
    });
  } else if (layer.geometryType === 'POLYGON') {
    map.addLayer({
      id: `${layer.id}-fill`,
      type: 'fill',
      source: layer.id,
      layout: { visibility },
      paint: {
        'fill-color': layer.style.color ?? '#ef4444',
        'fill-opacity': layer.style.opacity ?? 0.4,
      },
    });
    map.addLayer({
      id: `${layer.id}-outline`,
      type: 'line',
      source: layer.id,
      layout: { visibility },
      paint: {
        'line-color': layer.style.outlineColor ?? layer.style.color ?? '#ef4444',
        'line-width': layer.style.outlineWidth ?? 2,
        'line-opacity': layer.style.opacity ?? 0.8,
      },
    });
  }
}

/**
 * 更新 Draw 图层的 GeoJSON 数据
 */
function updateDrawLayerData(map: maplibregl.Map, layer: LayerState) {
  const source = map.getSource(layer.id) as maplibregl.GeoJSONSource;
  if (!source) return;

  source.setData((layer.data || { type: 'FeatureCollection' as const, features: [] }) as any);
}

/**
 * 更新 Draw 图层样式
 * 将 store 中的样式同步到 MapLibre paint properties
 */
function updateDrawLayerStyle(map: maplibregl.Map, layer: LayerState) {
  if (!isMapValid(map)) return;
  if (layer.type !== 'Draw') return;

  const sourceId = layer.id;
  if (!map.getSource(sourceId)) return;

  const geomType = layer.geometryType;

  if (geomType === 'POINT') {
    const pointLayerId = sourceId + '-point';
    const layerObj = map.getLayer(pointLayerId);
    const useSymbol = shouldUsePointSymbol(layer.style);

    if (useSymbol) {
      // 当前是 circle → 移除重建为 symbol
      if (layerObj && (layerObj.type as string) !== 'symbol') {
        removePointIcon(map, sourceId);
        map.removeLayer(pointLayerId);
        addDrawLayer(map, layer);
        return;
      }
      const iconName = registerPointIcon(map, layer);
      safeSetLayoutProperty(map, pointLayerId, 'icon-image', iconName ?? '');
      safeSetLayoutProperty(map, pointLayerId, 'icon-size', pointSizeToIconRatio(layer.style.pointSize ?? 10));
      safeSetLayoutProperty(map, pointLayerId, 'icon-rotate', layer.style.pointRotation ?? 0);
      safeSetPaintProperty(map, pointLayerId, 'icon-opacity', layer.style.opacity ?? 0.8);
    } else {
      // 当前是 symbol → 移除重建为 circle
      if (layerObj && layerObj.type === 'symbol') {
        removePointIcon(map, sourceId);
        map.removeLayer(pointLayerId);
        addDrawLayer(map, layer);
        return;
      }
      safeSetPaintProperty(map, pointLayerId, 'circle-radius', layer.style.pointSize ?? 6);
      safeSetPaintProperty(map, pointLayerId, 'circle-color', layer.style.color ?? '#3388ff');
      safeSetPaintProperty(map, pointLayerId, 'circle-opacity', layer.style.opacity ?? 0.5);
      safeSetPaintProperty(map, pointLayerId, 'circle-stroke-color', layer.style.outlineColor ?? '#ffffff');
      safeSetPaintProperty(map, pointLayerId, 'circle-stroke-width', layer.style.pointOutlineWidth ?? 1);
    }
  }

  if (geomType === 'LINESTRING') {
    const lineLayerId = sourceId + '-line';
    safeSetPaintProperty(map, lineLayerId, 'line-color', layer.style.color ?? '#3388ff');
    safeSetPaintProperty(map, lineLayerId, 'line-width', layer.style.width ?? 2);
    safeSetPaintProperty(map, lineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
    const lineType = layer.style.lineType ?? 'solid';
    const dashArray = lineType === 'solid' ? [1, 0] : lineType === 'dashed' ? [5, 5] : [2, 2];
    safeSetPaintProperty(map, lineLayerId, 'line-dasharray', dashArray);
  }

  if (geomType === 'POLYGON') {
    const fillLayerId = sourceId + '-fill';
    const outlineLayerId = sourceId + '-outline';
    const color = layer.style.color ?? '#3388ff';

    safeSetPaintProperty(map, fillLayerId, 'fill-color', color);
    safeSetPaintProperty(map, fillLayerId, 'fill-opacity', layer.style.opacity ?? 0.5);
    safeSetPaintProperty(map, outlineLayerId, 'line-color', layer.style.outlineColor ?? color);
    safeSetPaintProperty(map, outlineLayerId, 'line-width', layer.style.outlineWidth ?? 1);
    safeSetPaintProperty(map, outlineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
  }

}

/**
 * 更新 Draw 图层可见性
 */
function updateDrawLayerVisibility(map: maplibregl.Map, layer: LayerState) {
  const visibility = layer.visible ? 'visible' : 'none';
  const layerIds = [`${layer.id}-point`, `${layer.id}-line`, `${layer.id}-fill`, `${layer.id}-outline`];
  for (const lid of layerIds) {
    if (map.getLayer(lid)) {
      map.setLayoutProperty(lid, 'visibility', visibility);
    }
  }
}

/**
 * 更新图层可见性
 */
function updateMapLibreLayerVisibility(
  map: maplibregl.Map,
  layer: LayerState,
) {
  const visibility = layer.visible ? 'visible' : 'none';

  if (layer.geometryType === 'POINT') {
    const pointLayerId = `${layer.id}-point`;
    if (map.getLayer(pointLayerId)) {
      map.setLayoutProperty(pointLayerId, 'visibility', visibility);
    }
  } else if (layer.geometryType === 'LINESTRING') {
    const lineLayerId = `${layer.id}-line`;
    if (map.getLayer(lineLayerId)) {
      map.setLayoutProperty(lineLayerId, 'visibility', visibility);
    }
  } else if (layer.geometryType === 'POLYGON') {
    const fillLayerId = `${layer.id}-fill`;
    const outlineLayerId = `${layer.id}-outline`;
    if (map.getLayer(fillLayerId)) {
      map.setLayoutProperty(fillLayerId, 'visibility', visibility);
    }
    if (map.getLayer(outlineLayerId)) {
      map.setLayoutProperty(outlineLayerId, 'visibility', visibility);
    }
  }
}

/**
 * 更新图层样式
 */
function updateMapLibreLayerStyle(
  map: maplibregl.Map,
  layer: LayerState,
) {
  if (!isMapValid(map)) return;

  // 检查是否使用分级样式
  const useGraduated = shouldUseGraduatedStyle(layer.style);

  if (useGraduated && layer.style.graduatedConfig) {
    // 分级色彩样式
    const colorExpression = generateGraduatedColorExpression(layer.style.graduatedConfig);

    if (colorExpression) {
      if (layer.geometryType === 'POINT') {
        const pointLayerId = `${layer.id}-point`;
        const layerObj = map.getLayer(pointLayerId);
        // 分级样式只支持 circle 类型；如果当前是 symbol，降级重建为 circle
        if (layerObj && (layerObj.type as string) === 'symbol') {
          removePointIcon(map, layer.id);
          map.removeLayer(pointLayerId);
          addMvtLayer(map, layer);
          return;
        }
        safeSetPaintProperty(map, pointLayerId, 'circle-color', colorExpression);
        safeSetPaintProperty(map, pointLayerId, 'circle-opacity', layer.style.opacity ?? 0.5);
        safeSetPaintProperty(map, pointLayerId, 'circle-stroke-color', layer.style.outlineColor ?? '#ffffff');
        safeSetPaintProperty(map, pointLayerId, 'circle-stroke-width', layer.style.pointOutlineWidth ?? 1);
        // 可选：分级大小
        if (layer.style.graduatedConfig.classes >= 3) {
          const sizeExpression = generateGraduatedSizeExpression(layer.style.graduatedConfig);
          if (sizeExpression) {
            safeSetPaintProperty(map, pointLayerId, 'circle-radius', sizeExpression);
          }
        }
      } else if (layer.geometryType === 'LINESTRING') {
        const lineLayerId = `${layer.id}-line`;
        safeSetPaintProperty(map, lineLayerId, 'line-color', colorExpression);
        safeSetPaintProperty(map, lineLayerId, 'line-width', layer.style.width ?? 2);
        safeSetPaintProperty(map, lineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
        safeSetPaintProperty(map, lineLayerId, 'line-dasharray', getLineDashArray(layer.style.lineType ?? 'solid'));
      } else if (layer.geometryType === 'POLYGON') {
        const fillLayerId = `${layer.id}-fill`;
        const outlineLayerId = `${layer.id}-outline`;
        safeSetPaintProperty(map, fillLayerId, 'fill-color', colorExpression);
        safeSetPaintProperty(map, fillLayerId, 'fill-opacity', layer.style.opacity ?? 0.5);
        safeSetPaintProperty(map, outlineLayerId, 'line-color', colorExpression);
        safeSetPaintProperty(map, outlineLayerId, 'line-width', layer.style.outlineWidth ?? 1);
        safeSetPaintProperty(map, outlineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
      }

      return;
    }
  }

  // 简单样式
  if (layer.geometryType === 'POINT') {
    const pointLayerId = `${layer.id}-point`;
    const layerObj = map.getLayer(pointLayerId);
    const useSymbol = shouldUsePointSymbol(layer.style);

    if (useSymbol) {
      // 当前是 circle 类型 → 移除重建
      if (layerObj && (layerObj.type as string) !== 'symbol') {
        removePointIcon(map, layer.id);
        map.removeLayer(pointLayerId);
        addMvtLayer(map, layer);
        return;
      }
      // symbol 类型：更新大小、旋转、透明度
      const iconName = registerPointIcon(map, layer);
      safeSetLayoutProperty(map, pointLayerId, 'icon-image', iconName ?? '');
      safeSetLayoutProperty(map, pointLayerId, 'icon-size', pointSizeToIconRatio(layer.style.pointSize ?? 10));
      safeSetLayoutProperty(map, pointLayerId, 'icon-rotate', layer.style.pointRotation ?? 0);
      safeSetPaintProperty(map, pointLayerId, 'icon-opacity', layer.style.opacity ?? 1);
    } else {
      // 当前是 symbol 类型 → 移除重建
      if (layerObj && layerObj.type === 'symbol') {
        removePointIcon(map, layer.id);
        map.removeLayer(pointLayerId);
        addMvtLayer(map, layer);
        return;
      }
      // circle 类型：更新原有属性
      safeSetPaintProperty(map, pointLayerId, 'circle-radius', layer.style.pointSize ?? 6);
      safeSetPaintProperty(map, pointLayerId, 'circle-color', layer.style.color ?? '#3388ff');
      safeSetPaintProperty(map, pointLayerId, 'circle-opacity', layer.style.opacity ?? 0.5);
      safeSetPaintProperty(map, pointLayerId, 'circle-stroke-color', layer.style.outlineColor ?? '#ffffff');
      safeSetPaintProperty(map, pointLayerId, 'circle-stroke-width', layer.style.pointOutlineWidth ?? 1);
    }
  } else if (layer.geometryType === 'LINESTRING') {
    const lineLayerId = `${layer.id}-line`;
    safeSetPaintProperty(map, lineLayerId, 'line-color', layer.style.color ?? '#3388ff');
    safeSetPaintProperty(map, lineLayerId, 'line-width', layer.style.width ?? 2);
    safeSetPaintProperty(map, lineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
    safeSetPaintProperty(map, lineLayerId, 'line-dasharray', getLineDashArray(layer.style.lineType ?? 'solid'));
  } else if (layer.geometryType === 'POLYGON') {
    const fillLayerId = `${layer.id}-fill`;
    const outlineLayerId = `${layer.id}-outline`;

    safeSetPaintProperty(map, fillLayerId, 'fill-color', layer.style.color ?? '#3388ff');
    safeSetPaintProperty(map, fillLayerId, 'fill-opacity', layer.style.opacity ?? 0.5);
    safeSetPaintProperty(map, outlineLayerId, 'line-color', layer.style.outlineColor ?? layer.style.color ?? '#3388ff');
    safeSetPaintProperty(map, outlineLayerId, 'line-width', layer.style.outlineWidth ?? 1);
    safeSetPaintProperty(map, outlineLayerId, 'line-opacity', layer.style.opacity ?? 0.5);
  }
}

// ============================================
// Sync Logic
// ============================================

/**
 * 同步图层状态到 MapLibre map
 */
function syncMvtLayers(
  map: maplibregl.Map,
  layers: LayerState[],
  addedLayers: Set<string>,
) {
  if (!isMapValid(map)) return;

  const validLayerIds = new Set(
    layers.filter((l) => l.type === 'GeoJSON' && l.sourceId).map((l) => l.id),
  );

  // 1. 移除孤立图层（不在 store 中）
  for (const id of addedLayers) {
    if (!validLayerIds.has(id)) {
      removeMapLibreLayer(map, id);
      addedLayers.delete(id);
    }
  }

  // 2. 检查 setStyle() 是否清除了所有 source（底图切换后）
  for (const id of addedLayers) {
    if (!map.getSource(id)) {
      addedLayers.delete(id);
    }
  }

  // 3. 添加或更新图层
  for (const layer of layers) {
    if (layer.type !== 'GeoJSON' || !layer.sourceId) {
      continue;
    }

    if (!addedLayers.has(layer.id)) {
      addMvtLayer(map, layer);
      addedLayers.add(layer.id);
      // 添加后立即应用正确的样式（支持分级色彩等）
      updateMapLibreLayerStyle(map, layer);
      // 添加标注图层
      updateLabelLayer(map, layer);
    } else {
      updateMapLibreLayerVisibility(map, layer);
      updateMapLibreLayerStyle(map, layer);
      // 更新标注图层
      updateLabelLayer(map, layer);
    }
  }
}

/**
 * 同步 Draw 图层状态到 MapLibre map
 */
function syncDrawLayers(
  map: maplibregl.Map,
  layers: LayerState[],
  addedDrawLayers: Set<string>,
) {
  if (!isMapValid(map)) return;

  const drawLayers = layers.filter((l) => l.type === 'Draw');
  const validDrawLayerIds = new Set(drawLayers.map((l) => l.id));

  // 1. 移除孤立的 Draw 图层
  for (const id of addedDrawLayers) {
    if (!validDrawLayerIds.has(id)) {
      removeMapLibreLayer(map, id);
      addedDrawLayers.delete(id);
    }
  }

  // 2. 添加或更新 Draw 图层
  for (const layer of drawLayers) {
    if (!addedDrawLayers.has(layer.id)) {
      addDrawLayer(map, layer);
      addedDrawLayers.add(layer.id);
      // 添加标注图层
      updateLabelLayer(map, layer);
    } else {
      // 更新可见性
      updateDrawLayerVisibility(map, layer);
      // 更新样式
      updateDrawLayerStyle(map, layer);
      // 更新数据（如果 layer.data 变化）
      updateDrawLayerData(map, layer);
      // 更新标注图层
      updateLabelLayer(map, layer);
    }
  }
}

/**
 * 添加栅格瓦片图层(COG/XYZ):raster source + raster layer。
 * urlTemplate 取自 layer.style.tileUrlTemplate(来自 TileSource.config.urlTemplate)。
 */
function addRasterLayer(map: maplibregl.Map, layer: LayerState) {
  const url = layer.style?.tileUrlTemplate as string | undefined;
  if (!url) return;
  const rasterLayerId = `${layer.id}-raster`;

  if (!map.getSource(layer.id)) {
    map.addSource(layer.id, {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
    });
  }
  if (!map.getLayer(rasterLayerId)) {
    map.addLayer({
      id: rasterLayerId,
      type: 'raster',
      source: layer.id,
      layout: { visibility: layer.visible ? 'visible' : 'none' },
      paint: { 'raster-opacity': layer.opacity ?? 1 },
    });
  }
}

/** 移除栅格瓦片图层 */
function removeRasterLayer(map: maplibregl.Map, layerId: string) {
  const rasterLayerId = `${layerId}-raster`;
  if (map.getLayer(rasterLayerId)) map.removeLayer(rasterLayerId);
  if (map.getSource(layerId)) map.removeSource(layerId);
}

/**
 * 同步栅格瓦片图层(type='Tile' 且带 style.tileUrlTemplate)。
 * 增删 + 可见性/透明度更新。
 */
function syncRasterLayers(
  map: maplibregl.Map,
  layers: LayerState[],
  addedRaster: Set<string>,
) {
  if (!isMapValid(map)) return;

  const validIds = new Set(
    layers
      .filter(
        (l) =>
          l.type === 'Tile' &&
          (l.style?.tileUrlTemplate as string | undefined),
      )
      .map((l) => l.id),
  );

  // 1. 移除孤立栅格图层
  for (const id of addedRaster) {
    if (!validIds.has(id)) {
      removeRasterLayer(map, id);
      addedRaster.delete(id);
    }
  }

  // 2. setStyle()（底图切换）后 source 可能被清空
  for (const id of addedRaster) {
    if (!map.getSource(id)) {
      addedRaster.delete(id);
    }
  }

  // 3. 添加或更新
  for (const layer of layers) {
    if (layer.type !== 'Tile') continue;
    const url = layer.style?.tileUrlTemplate as string | undefined;
    if (!url) continue;

    if (!addedRaster.has(layer.id)) {
      addRasterLayer(map, layer);
      addedRaster.add(layer.id);
    } else {
      const rasterLayerId = `${layer.id}-raster`;
      if (map.getLayer(rasterLayerId)) {
        map.setLayoutProperty(
          rasterLayerId,
          'visibility',
          layer.visible ? 'visible' : 'none',
        );
        map.setPaintProperty(rasterLayerId, 'raster-opacity', layer.opacity ?? 1);
      }
    }
  }
}

// ============================================
// Component
// ============================================

/**
 * MapLibre 业务图层渲染器组件
 */
export function MapLibreLayerRenderer() {
  const viewerReady = useMapStore((state) => state.viewerReady);
  const layers = useMapStore((state) => state.layers);
  const setSelection = useMapStore((state) => state.setSelection);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const setSelectedFeature = useMapStore((state) => state.setSelectedFeature);
  const setEditFeature = useMapStore((state) => state.setEditFeature);
  const pushUndo = useMapStore((state) => state.pushUndo);
  const clearEditState = useMapStore((state) => state.clearEditState);
  const setActiveLayer = useMapStore((state) => state.setActiveLayer);
  const openEditPanel = useMapStore((state) => state.openEditPanel);

  // 跟踪已添加的图层 ID
  const addedLayersRef = useRef<Set<string>>(new Set());
  const addedDrawLayersRef = useRef<Set<string>>(new Set()); // Draw 图层跟踪
  const addedRasterLayersRef = useRef<Set<string>>(new Set()); // 栅格瓦片(Tile/COG)图层跟踪
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<[number, number] | null>(null);
  const dragStartScreenRef = useRef<[number, number] | null>(null); // 起始屏幕坐标
  const draggedNodeIdxRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const hoveredNodeIdxRef = useRef<number | null>(null);
  const selectedNodeIdxRef = useRef<number | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickTimeRef = useRef(0); // 用于检测双击序列

  // 同步图层
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) {
      console.warn('[MapLibreLayerRenderer] MAPLIBRE_MAP not found');
      return;
    }

    syncMvtLayers(map, layers, addedLayersRef.current);
    syncRasterLayers(map, layers, addedRasterLayersRef.current);
    syncDrawLayers(map, layers, addedDrawLayersRef.current);
  }, [layers, viewerReady]);

  // 监听底图切换事件，清空追踪 Set 并重新同步图层
  useEffect(() => {
    const handleStyleChanged = () => {
      const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;

      // 先移除编辑临时图层（必须先移除 layer 再移除 source）
      if (map) {
        const editLayers = [
          EDIT_SOURCE_ID + '-nodes-hitarea',
          EDIT_SOURCE_ID + '-nodes',
          EDIT_SOURCE_ID + '-outline',
          EDIT_SOURCE_ID + '-fill',
        ];
        for (const layerId of editLayers) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
        }
        if (map.getSource(EDIT_SOURCE_ID)) {
          map.removeSource(EDIT_SOURCE_ID);
        }
      }

      // 清空追踪 Set
      addedLayersRef.current.clear();
      addedRasterLayersRef.current.clear();
      addedDrawLayersRef.current.clear();

      // 重新同步图层
      if (!map) return;

      // 如果 style 已经 loaded，立即同步；否则等待 styledata 事件
      if (map.isStyleLoaded?.()) {
        syncMvtLayers(map, layers, addedLayersRef.current);
        syncRasterLayers(map, layers, addedRasterLayersRef.current);
        syncDrawLayers(map, layers, addedDrawLayersRef.current);
      } else {
        // 使用 styledata 事件（MapLibre 正确的事件名，不是 style.load）
        map.once('styledata', () => {
          syncMvtLayers(map, layers, addedLayersRef.current);
          syncRasterLayers(map, layers, addedRasterLayersRef.current);
          syncDrawLayers(map, layers, addedDrawLayersRef.current);
        });
      }
    };

    window.addEventListener('maplibre:style-changed', handleStyleChanged);
    return () => {
      window.removeEventListener('maplibre:style-changed', handleStyleChanged);
    };
  }, [layers]);

  // 点击交互
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      // 记录 click 时间，用于检测双击序列
      lastClickTimeRef.current = Date.now();

      // 拖拽后的 click 不处理
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }

      // 记录点击位置
      const clickPoint = { x: e.point.x, y: e.point.y };
      const clickLngLat = [e.lngLat.lng, e.lngLat.lat] as [number, number];

      // 编辑会话内：单击即切要素，立即处理（编辑会话无弹框，无需为 dblclick 让路延迟）
      const clickState = useMapStore.getState();
      if (clickState.activeLayerId && clickState.edit.editFeature) {
        handleClickAction(clickPoint, clickLngLat);
        return;
      }

      // 浏览态：延迟处理 click，等待 dblclick 取消（单击弹框 / 双击进编辑）
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        handleClickAction(clickPoint, clickLngLat);
        clickTimerRef.current = null;
      }, 250);
    };

    const handleClickAction = async (point: { x: number; y: number }, lngLat: [number, number]) => {
      const currentMap = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
        .MAPLIBRE_MAP;
      if (!currentMap) return;

      const currentState = useMapStore.getState();

      // 编辑模式下的点击处理
      if (currentState.activeLayerId && currentState.edit.editFeature) {
        const vertices = extractVertices(
          currentState.edit.editFeature.geometry as { type: string; coordinates: unknown }
        );
        const nodeIdx = hitTestNode(currentMap, point.x, point.y, vertices);
        if (nodeIdx >= 0) {
          // 点击节点 → 选中节点
          const prev = selectedNodeIdxRef.current;
          if (prev !== null) {
            try {
              currentMap.setFeatureState(
                { source: EDIT_SOURCE_ID, id: prev + 10000 },
                { selected: false }
              );
            } catch { /* source may be gone */ }
          }
          selectedNodeIdxRef.current = nodeIdx;
          currentMap.setFeatureState(
            { source: EDIT_SOURCE_ID, id: nodeIdx + 10000 },
            { selected: true }
          );
          return;
        } else if (selectedNodeIdxRef.current !== null) {
          const prev = selectedNodeIdxRef.current;
          try {
            currentMap.setFeatureState(
              { source: EDIT_SOURCE_ID, id: prev + 10000 },
              { selected: false }
            );
          } catch { /* source may be gone */ }
          selectedNodeIdxRef.current = null;
        }

        // 检测是否点中编辑要素本体 → 不做操作
        // 先检查编辑图层是否存在（style changed 后可能已被清空）
        const editFillLayer = currentMap.getLayer(EDIT_SOURCE_ID + '-fill');
        const editOutlineLayer = currentMap.getLayer(EDIT_SOURCE_ID + '-outline');
        if (editFillLayer || editOutlineLayer) {
          const editHit = currentMap.queryRenderedFeatures(point as any, {
            layers: [EDIT_SOURCE_ID + '-fill', EDIT_SOURCE_ID + '-outline'].filter(id => currentMap.getLayer(id)),
          });
          if (editHit.length > 0) {
            return;
          }
        }

        // 检测是否点击了其他 MVT 要素 → 切换编辑
        // 用 bbox 命中盒绕开 queryRenderedFeatures(point) 对 vector/fill“返回整片瓦片要素”
        // 的 bug；只保留数据集图层 source（store 图层 id 集合），自动排除底图/标注/编辑叠加层；
        // 按 feature_id 跨瓦片去重；几何无关（点/线/面均可用）。
        const datasetSourceIds = new Set(
          useMapStore.getState().layers.filter((l) => l.type === 'GeoJSON').map((l) => l.id),
        );
        const switchHitbox: [number, number, number, number] = [
          point.x - 1,
          point.y - 1,
          point.x + 1,
          point.y + 1,
        ];
        const mvtFeatures = [
          ...new Map(
            currentMap
              .queryRenderedFeatures(switchHitbox as any)
              .filter((f) => datasetSourceIds.has(f.layer?.source as string))
              .map((f) => [f.properties?.feature_id ?? f.properties?.id, f]),
          ).values(),
        ];
        if (mvtFeatures.length > 0) {
          const mvtFeature = mvtFeatures[0];
          const layerId = mvtFeature.layer?.source;
          const featureId = mvtFeature.properties?.feature_id?.toString() ?? mvtFeature.properties?.id?.toString() ?? null;

          // 检查是否是当前正在编辑的要素（避免重复切换）
          const currentEditLayerId = currentState.activeLayerId;
          const currentEditFeatureId = currentState.edit.selectedFeature?.featureId;
          if (layerId === currentEditLayerId && featureId === currentEditFeatureId) {
            return;
          }

          if (layerId && featureId) {
            // 退出当前编辑
            setSelectedFeature(null);
            setEditFeature(null);
            clearEditState();
            clearEditSource(currentMap);

            // 进入新要素编辑
            const storeLayer = useMapStore.getState().layers.find((l) => l.id === layerId);
            const datasetId = storeLayer?.sourceId ?? null;
            const properties = mvtFeature.properties ?? {};

            setActiveLayer(layerId);
            setSelectedFeature({ layerId, featureId, properties });

            if (datasetId) {
              try {
                const geojson = await fetchFeatureGeoJSON(datasetId, featureId);
                if (geojson) {
                  pushUndo({
                    type: 'Feature',
                    id: geojson.id ?? featureId,
                    properties: geojson.properties,
                    geometry: geojson.geometry,
                  } as any);
                  setEditFeature({
                    type: 'Feature',
                    id: geojson.id ?? featureId,
                    properties: geojson.properties,
                    geometry: geojson.geometry,
                  } as any);
                  openEditPanel(featureId);
                }
              } catch (err) {
                console.error('[ClickAction] Failed to load new feature:', err);
              }
            }
            return;
          }
        }

        // 点击空白 → 不做操作（不退出编辑态）
        return;
      }

      // 非编辑模式：正常查询 MVT 要素

      // 只查询 fill 层，避免 outline 层的线被误点击（线有更大的点击容差）
      // 过滤掉不存在的图层（style changed 后可能已被清空）
      const queryLayerIds = useMapStore.getState().layers
        .filter(l => l.visible && l.type === 'GeoJSON')
        .map(l => `${l.id}-fill`)
        .filter(layerId => currentMap.getLayer(layerId));

      // 如果没有可查询的图层，直接返回
      if (queryLayerIds.length === 0) {
        return;
      }

      // 使用 bbox 查询代替点查询
      // MapLibre queryRenderedFeatures(point) 对于 vector tile source 的 fill 层有 bug
      // 会返回所有当前加载瓦片中的要素，而不是只返回点击位置的要素
      // 使用小范围 bbox 查询可以正确工作
      const hitbox: [number, number, number, number] = [
        point.x - 1,
        point.y - 1,
        point.x + 1,
        point.y + 1,
      ];

      const fillFeatures = currentMap.queryRenderedFeatures(hitbox as any, {
        layers: queryLayerIds,
      });

      // MVT 瓦片边界去重：同一 feature_id 可能出现在相邻瓦片中
      const uniqueFeatures = [...new Map(
        fillFeatures.map(f => [f.properties?.feature_id ?? f.properties?.id, f])
      ).values()];

      const features = uniqueFeatures;

      if (features.length > 0) {
        const feature = features[0];
        const layerId = feature.layer?.source;

        if (layerId) {
          const featureId =
            feature.properties?.feature_id?.toString() ??
            feature.properties?.id?.toString() ??
            null;
          const properties = feature.properties ?? {};

          const storeLayer = useMapStore.getState().layers.find((l) => l.id === layerId);
          const datasetId = storeLayer?.sourceId ?? null;

          // 非编辑模式下：弹出详情弹窗（双击进入编辑）
          setSelection({
            layerId,
            featureId,
            properties,
            datasetId,
            lngLat,
          });
        }
      } else {
        // 空白点击：清除 selection
        setSelection({ layerId: null, featureId: null, properties: null, datasetId: null, lngLat: undefined });
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, [setSelection, setSelectedFeature, setEditFeature, pushUndo, openEditPanel, viewerReady]);

  // Selector 双击进入编辑模式
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) return;

    const handleDoubleClick = async (e: maplibregl.MapMouseEvent) => {
      const state = useMapStore.getState();
      if (state.interaction.mode !== 'default') return;

      // 取消待执行的 click，防止先弹出属性框
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      // 阻止 MapLibre 默认双击缩放
      e.preventDefault();

      const features = map.queryRenderedFeatures(e.point);

      // 编辑模式下双击空白区域 → 退出编辑态
      if (state.activeLayerId && state.edit.editFeature) {
        if (features.length === 0) {
          // 取消待执行的 click timer，防止退出后触发 setSelection
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
          }

          // 获取当前编辑的图层 ID，用于后续刷新瓦片
          const editLayerId = state.activeLayerId;

          setSelectedFeature(null);
          setEditFeature(null);
          clearEditState();
          setActiveLayer(null);
          clearEditSource(map);

          // 触发 MVT 瓦片重新加载（与保存后的逻辑一致）
          window.dispatchEvent(
            new CustomEvent('map:reload-mvt', { detail: { layerId: editLayerId } })
          );
          return;
        }
        // 编辑模式下双击要素 → 不做特殊处理（让单击切换逻辑处理）
        return;
      }

      // 非编辑模式下双击要素 → 进入编辑态
      if (features.length === 0) return;

      const feature = features[0];
      const layerId = feature.layer?.source;
      const featureId =
        feature.properties?.feature_id?.toString() ??
        feature.properties?.id?.toString() ??
        null;

      if (!layerId || !featureId) return;

      const storeLayer = state.layers.find((l) => l.id === layerId);
      const datasetId = storeLayer?.sourceId ?? null;
      const properties = feature.properties ?? {};

      if (datasetId) {
        try {
          const geojson = await fetchFeatureGeoJSON(datasetId, featureId);
          if (geojson) {
            // 仅在获取到 GeoJSON 后才进入编辑态，避免异步间隙导致要素先消失后出现
            setActiveLayer(layerId);
            setSelectedFeature({ layerId, featureId, properties });
            pushUndo({
              type: 'Feature',
              id: geojson.id ?? featureId,
              properties: geojson.properties,
              geometry: geojson.geometry,
            } as any);
            setEditFeature({
              type: 'Feature',
              id: geojson.id ?? featureId,
              properties: geojson.properties,
              geometry: geojson.geometry,
            } as any);
            openEditPanel(featureId);
          }
        } catch (err) {
          console.error('[Edit] Failed to load feature via selector:', err);
        }
      }

      // 重置拖拽状态，防止 dblclick 的第二次 mousedown 触发的拖拽影响后续 click
      isDraggingRef.current = false;
      dragStartRef.current = null;
      dragStartScreenRef.current = null;
      didDragRef.current = false;
      draggedNodeIdxRef.current = null;
    };

    map.on('dblclick', handleDoubleClick);

    return () => {
      map.off('dblclick', handleDoubleClick);
    };
  }, [viewerReady, setActiveLayer, setSelectedFeature, setEditFeature, pushUndo, openEditPanel]);

  // 鼠标样式：hover 要素时 pointer，编辑模式下 hover 编辑要素时 move
  // 同时追踪 hover 节点并设置 feature state
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) return;

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      const state = useMapStore.getState();
      if (state.activeLayerId && state.edit.editFeature) {
        // 编辑模式：检查是否 hover 到编辑要素
        // 先检查编辑图层是否存在（style changed 后可能已被清空）
        const editLayerIds = [
          EDIT_SOURCE_ID + '-fill',
          EDIT_SOURCE_ID + '-outline',
          EDIT_SOURCE_ID + '-nodes',
          EDIT_SOURCE_ID + '-nodes-hitarea',
        ].filter(id => map.getLayer(id));

        const editFeatures = editLayerIds.length > 0
          ? map.queryRenderedFeatures(e.point, { layers: editLayerIds })
          : [];

        // 检测 hover 节点
        const editFeature = state.edit.editFeature;
        const vertices = editFeature
          ? extractVertices(editFeature.geometry as { type: string; coordinates: unknown })
          : [];

        let newHoveredIdx: number | null = null;
        if (vertices.length > 0) {
          for (let i = 0; i < vertices.length; i++) {
            const { x, y } = lngLatToPixel(map, vertices[i][0], vertices[i][1]);
            if (pixelDistance(e.point.x, e.point.y, x, y) <= 15) {
              newHoveredIdx = i;
              break;
            }
          }
        }

        // 更新 hover state。编辑 source 可能因底图切换被 setStyle 清空，
        // setFeatureState 前必须判存在，否则抛 "The source '__edit-feature__' does not exist"
        const editSourceExists = !!map.getSource(EDIT_SOURCE_ID);
        const prevIdx = hoveredNodeIdxRef.current;
        if (newHoveredIdx !== prevIdx) {
          if (editSourceExists && prevIdx !== null) {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: prevIdx + 10000 },
              { hovered: false }
            );
          }
          if (editSourceExists && newHoveredIdx !== null) {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: newHoveredIdx + 10000 },
              { hovered: true }
            );
          }
          hoveredNodeIdxRef.current = newHoveredIdx;
        }

        const isOnNode = newHoveredIdx !== null;
        const isOnEditFeature = editFeatures.some(
          (f) => !f.properties?.isNode
        );
        map.getCanvas().style.cursor = isOnNode ? 'pointer' : isOnEditFeature ? 'move' : 'pointer';
      } else {
        // 清除 hover state
        if (hoveredNodeIdxRef.current !== null) {
          if (map.getSource(EDIT_SOURCE_ID)) {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: hoveredNodeIdxRef.current + 10000 },
              { hovered: false }
            );
          }
          hoveredNodeIdxRef.current = null;
        }
        const features = map.queryRenderedFeatures(e.point);
        map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : 'default';
      }
    };

    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('mousemove', handleMouseMove);
      // 清除 hover state
      if (hoveredNodeIdxRef.current !== null && map.getSource(EDIT_SOURCE_ID)) {
        map.setFeatureState(
          { source: EDIT_SOURCE_ID, id: hoveredNodeIdxRef.current + 10000 },
          { hovered: false }
        );
        hoveredNodeIdxRef.current = null;
      }
    };
  }, [viewerReady]);

  // 编辑图层初始化 + 状态订阅 + dragPan 控制
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) return;

    // 只读模式（公开分享页）不编辑要素，跳过编辑图层初始化（4 个 __edit-feature__ 层都用不到）
    if (!useMapStore.getState().readOnly) {
      initEditLayer(map);
    }

    // 订阅 store 编辑状态变化
    const unsubscribe = useMapStore.subscribe((state, prevState) => {
      // 更新编辑 source
      if (state.edit.editFeature !== prevState.edit.editFeature) {
        updateEditSource(map, state.edit.editFeature);
      }

      // MVT filter: 隐藏正在编辑的要素
      const sel = state.edit.selectedFeature;
      const prevSel = prevState.edit.selectedFeature;
      if (sel?.layerId !== prevSel?.layerId || sel?.featureId !== prevSel?.featureId) {
        const allLayers = useMapStore.getState().layers;
        for (const layer of allLayers) {
          if (layer.type !== 'GeoJSON' || !layer.sourceId) continue;
          if (sel?.layerId === layer.id) {
            applyMvtHideFilter(map, layer.id, sel?.featureId ?? null);
          } else {
            applyMvtHideFilter(map, layer.id, null);
          }
        }
      }

      // 编辑模式：不再全局禁用 dragPan，而是在 mousedown 中按需拦截
      // 空白处点击可以正常平移地图
      const isEditing = !!state.activeLayerId;
      const wasEditing = !!prevState.activeLayerId;
      if (isEditing && !wasEditing) {
        map.getCanvas().style.cursor = 'pointer';
      } else if (!isEditing && wasEditing) {
        map.dragPan.enable();
        map.getCanvas().style.cursor = 'default';
        // 清理 hover state
        if (hoveredNodeIdxRef.current !== null) {
          try {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: hoveredNodeIdxRef.current + 10000 },
              { hovered: false }
            );
          } catch { /* source may be gone */ }
          hoveredNodeIdxRef.current = null;
        }
        // 清理 selected node state
        if (selectedNodeIdxRef.current !== null) {
          try {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: selectedNodeIdxRef.current + 10000 },
              { selected: false }
            );
          } catch { /* source may be gone */ }
          selectedNodeIdxRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      map.dragPan.enable();
    };
  }, [viewerReady]);

  // 编辑拖拽 + 节点编辑 + 键盘快捷键
  useEffect(() => {
    if (!viewerReady) return;

    const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
      .MAPLIBRE_MAP;
    if (!map) return;

    // 如果不在编辑模式，只返回清理函数（不注册新监听）
    if (!activeLayerId) {
      return () => {
        // 清理可能残留的状态
        isDraggingRef.current = false;
        dragStartRef.current = null;
        dragStartScreenRef.current = null;
        didDragRef.current = false;
        draggedNodeIdxRef.current = null;
      };
    }

    /**
     * 检测是否点击了要素（基于 bbox 扩展）
     */
    function hitTestFeature(
      screenX: number,
      screenY: number,
      geometry: { type: string; coordinates: unknown },
      threshold = 30,
    ): boolean {
      const vertices = extractVertices(geometry);
      if (vertices.length === 0) return false;

      // Point: 直接距离检测
      if (geometry.type === 'Point' && vertices.length === 1) {
        const { x, y } = lngLatToPixel(map!, vertices[0][0], vertices[0][1]);
        return pixelDistance(screenX, screenY, x, y) <= threshold;
      }

      // LineString / Polygon: bbox 扩展检测
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [lng, lat] of vertices) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }

      const tl = lngLatToPixel(map, minLng, maxLat);
      const br = lngLatToPixel(map, maxLng, minLat);
      return (
        screenX >= tl.x - threshold &&
        screenX <= br.x + threshold &&
        screenY >= tl.y - threshold &&
        screenY <= br.y + threshold
      );
    }

    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      // 检测是否是双击序列的第二次点击（短时间内有 click）
      const timeSinceLastClick = Date.now() - lastClickTimeRef.current;
      const isDoubleClickSequence = timeSinceLastClick < 400;

      // 双击序列中跳过拖拽逻辑，防止第二次 click 被误判为拖拽
      if (isDoubleClickSequence) {
        return;
      }

      // 中键（滚轮按下）不拦截，允许地图平移
      if (e.originalEvent.button === 1) return;

      const state = useMapStore.getState();
      const editFeature = state.edit.editFeature;
      if (!editFeature) return;

      const geometry = editFeature.geometry as { type: string; coordinates: unknown };
      const vertices = extractVertices(geometry);

      // 优先通过 hit-area layer 检测节点点击
      // 先检查图层是否存在
      if (map.getLayer(EDIT_SOURCE_ID + '-nodes-hitarea')) {
        const hitAreaFeatures = map.queryRenderedFeatures(e.point, {
          layers: [EDIT_SOURCE_ID + '-nodes-hitarea'],
        });
        if (hitAreaFeatures.length > 0 && vertices.length > 0) {
          // 在 hit-area 内，找最近的节点
          const nodeIdx = hitTestNode(map, e.point.x, e.point.y, vertices);
          if (nodeIdx >= 0) {
            map.dragPan.disable();
            draggedNodeIdxRef.current = nodeIdx;
            isDraggingRef.current = true;
            dragStartRef.current = [e.lngLat.lng, e.lngLat.lat];
            dragStartScreenRef.current = [e.point.x, e.point.y];
            didDragRef.current = false;
            e.preventDefault();
            return;
          }
        }
      }

      // 检测是否点击了要素范围（整体拖拽）- 使用 queryRenderedFeatures 精确检测
      const dragLayerIds = [EDIT_SOURCE_ID + '-fill', EDIT_SOURCE_ID + '-outline'].filter(id => map.getLayer(id));
      if (dragLayerIds.length > 0) {
        const featureHit = map.queryRenderedFeatures(e.point, { layers: dragLayerIds });
        if (featureHit.length > 0) {
        map.dragPan.disable();
        isDraggingRef.current = true;
        dragStartRef.current = [e.lngLat.lng, e.lngLat.lat];
        dragStartScreenRef.current = [e.point.x, e.point.y];
        didDragRef.current = false;
        e.preventDefault();
        return;
      }
      }
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current) return;

      // 只有屏幕距离 > 5px 才算拖拽（避免轻微移动误判）
      const screenDist = Math.sqrt(
        Math.pow(e.point.x - (dragStartScreenRef.current?.[0] ?? 0), 2) +
        Math.pow(e.point.y - (dragStartScreenRef.current?.[1] ?? 0), 2)
      );
      if (screenDist > 5) {
        didDragRef.current = true;
      }
      e.preventDefault();

      const state = useMapStore.getState();
      const editFeature = state.edit.editFeature;
      if (!editFeature) return;

      const dx = e.lngLat.lng - dragStartRef.current[0];
      const dy = e.lngLat.lat - dragStartRef.current[1];

      const geometry = editFeature.geometry as { type: string; coordinates: unknown };

      let newGeometry: { type: string; coordinates: unknown };

      if (draggedNodeIdxRef.current !== null) {
        // 节点拖拽
        const vertices = extractVertices(geometry);
        const targetVertex = vertices[draggedNodeIdxRef.current];
        if (!targetVertex) return;

        const newCoord = [targetVertex[0] + dx, targetVertex[1] + dy];

        if (geometry.type === 'Point') {
          newGeometry = { ...geometry, coordinates: newCoord };
        } else if (geometry.type === 'MultiPoint') {
          const coords = [...(geometry.coordinates as number[][])];
          coords[draggedNodeIdxRef.current] = [...newCoord];
          newGeometry = { ...geometry, coordinates: coords };
        } else if (geometry.type === 'LineString') {
          const coords = [...(geometry.coordinates as number[][])];
          coords[draggedNodeIdxRef.current] = [...newCoord];
          newGeometry = { ...geometry, coordinates: coords };
        } else if (geometry.type === 'Polygon') {
          const coords = [...(geometry.coordinates as number[][][])];
          const ring = [...coords[0]];
          ring[draggedNodeIdxRef.current] = [...newCoord];
          ring[ring.length - 1] = [...ring[0]];
          coords[0] = ring;
          newGeometry = { ...geometry, coordinates: coords };
        } else {
          // MultiLineString/MultiPolygon: 节点拖拽较复杂，暂时跳过
          return;
        }
      } else {
        // 要素整体拖拽
        newGeometry = translateGeometry(geometry, dx, dy);
      }

      const updatedFeature = { ...editFeature, geometry: newGeometry };
      setEditFeature(updatedFeature);
      updateEditSource(map, updatedFeature);

      dragStartRef.current = [e.lngLat.lng, e.lngLat.lat];
    };

    const handleMouseUp = async () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      draggedNodeIdxRef.current = null;
      dragStartRef.current = null;
      map.dragPan.enable();

      const state = useMapStore.getState();
      const editFeature = state.edit.editFeature;
      const selected = state.edit.selectedFeature;

      if (!editFeature || !selected?.layerId || !selected.featureId) return;

      pushUndo({
        type: 'Feature',
        id: editFeature.id ?? selected.featureId,
        properties: editFeature.properties,
        geometry: editFeature.geometry,
      } as import('geojson').Feature);

      const storeLayer = state.layers.find((l) => l.id === selected.layerId);
      const datasetId = storeLayer?.sourceId ?? null;

      if (datasetId) {
        try {
          const { saveFeatureGeometry } = await import(
            '@/features/gis-data-manager/feature-api'
          );
          await saveFeatureGeometry(
            datasetId,
            selected.featureId,
            editFeature.geometry as Record<string, unknown>,
            editFeature.properties as Record<string, unknown>,
          );
        } catch (err) {
          console.error('[Edit] Failed to save:', err);
        }
      }
    };

    // 键盘快捷键
    const handleKeyDown = async (e: KeyboardEvent) => {
      const state = useMapStore.getState();
      if (!state.activeLayerId || !state.edit.editFeature) return;

      if (e.key === 'Escape') {
        setSelectedFeature(null);
        setEditFeature(null);
        clearEditState();
        setActiveLayer(null);
        // 清除 MVT filter
        const allLayers = state.layers;
        for (const layer of allLayers) {
          if (layer.type !== 'GeoJSON' || !layer.sourceId) continue;
          if (map.getLayer(`${layer.id}-point`)) applyMvtHideFilter(map, layer.id, null);
          if (map.getLayer(`${layer.id}-line`)) applyMvtHideFilter(map, layer.id, null);
          if (map.getLayer(`${layer.id}-fill`)) applyMvtHideFilter(map, layer.id, null);
          if (map.getLayer(`${layer.id}-outline`)) applyMvtHideFilter(map, layer.id, null);
        }
        clearEditSource(map);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        const prev = useMapStore.getState().undoEdit();
        if (prev) {
          updateEditSource(map, prev);
          // 撤销后同步到服务器
          const sel = useMapStore.getState().edit.selectedFeature;
          const storeLayer = state.layers.find((l) => l.id === sel?.layerId);
          if (storeLayer?.sourceId && sel?.featureId) {
            try {
              const { saveFeatureGeometry } = await import(
                '@/features/gis-data-manager/feature-api'
              );
              await saveFeatureGeometry(
                storeLayer.sourceId,
                sel.featureId,
                prev.geometry as Record<string, unknown>,
                prev.properties as Record<string, unknown>,
              );
            } catch (err) {
              console.error('[Edit] Failed to save undo:', err);
            }
          }
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();

        const editFeature = state.edit.editFeature;
        if (!editFeature) return;

        const selNodeIdx = selectedNodeIdxRef.current;

        if (selNodeIdx !== null) {
          // 有选中节点：删除该节点
          const geometry = editFeature.geometry as { type: string; coordinates: unknown };
          const vertices = extractVertices(geometry);
          if (vertices.length <= 3) {
            // 节点太少不允许删除
            console.warn('[Edit] Too few nodes to delete');
            return;
          }
          const newGeometry = deleteNodeAt(geometry, selNodeIdx);
          const updated = { ...editFeature, geometry: newGeometry };
          pushUndo({
            type: 'Feature',
            id: editFeature.id ?? '',
            properties: editFeature.properties,
            geometry: editFeature.geometry,
          } as import('geojson').Feature);
          setEditFeature(updated);
          updateEditSource(map, updated);
          // 清除节点选中状态
          try {
            map.setFeatureState(
              { source: EDIT_SOURCE_ID, id: selNodeIdx + 10000 },
              { selected: false }
            );
          } catch { /* source may be gone */ }
          selectedNodeIdxRef.current = null;
        } else {
          // 无选中节点：删除整个要素
          if (!confirm('确定删除该要素吗？')) return;
          const sel = useMapStore.getState().edit.selectedFeature;
          if (!sel) return;

          const storeLayer = state.layers.find((l) => l.id === sel.layerId);
          const datasetId = storeLayer?.sourceId ?? null;

          if (datasetId) {
            try {
              const { deleteFeature: deleteFeatureApi } = await import(
                '@/features/gis-data-manager/feature-api'
              );
              await deleteFeatureApi(datasetId, sel.featureId);
              applyMvtHideFilter(map, sel.layerId, null);
              setSelectedFeature(null);
              setEditFeature(null);
              clearEditSource(map);
            } catch (err) {
              console.error('[Edit] Failed to delete:', err);
            }
          }
        }
      }
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerReady, activeLayerId, setEditFeature, pushUndo, setSelectedFeature]);

  // 清理：组件卸载时移除所有图层
  useEffect(() => {
    return () => {
      const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
        .MAPLIBRE_MAP;
      if (!map) return;

      // Map 可能已经被销毁，检查 style 是否存在
      try {
        for (const layerId of addedLayersRef.current) {
          removeMapLibreLayer(map, layerId);
        }
        addedLayersRef.current.clear();

        // 清理编辑图层
        for (const id of [
          EDIT_SOURCE_ID + '-fill',
          EDIT_SOURCE_ID + '-outline',
          EDIT_SOURCE_ID + '-nodes',
          EDIT_SOURCE_ID + '-nodes-hitarea',
        ]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        if (map.getSource(EDIT_SOURCE_ID)) map.removeSource(EDIT_SOURCE_ID);
      } catch {
        // Map 可能已经被销毁或 style 已清空，忽略错误
      }
    };
  }, []);

  // 保存后重新加载 MVT 瓦片（加时间戳跳过浏览器缓存）
  useEffect(() => {
  const handleReload = (e: Event) => {
      const detail = (e as CustomEvent<{ layerId?: string }>).detail;

      const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map })
        .MAPLIBRE_MAP;
      if (!map) return;

      const layerIds = detail?.layerId ? [detail.layerId] : [...addedLayersRef.current];

      for (const layerId of layerIds) {
        const source = map.getSource(layerId);
        if (!source || source.type !== 'vector') continue;
        const tiles = (source as { tiles?: string[] }).tiles;
        if (tiles?.[0]) {
          const originalUrl = tiles[0].split('?_t=')[0];
          const newUrl = `${originalUrl}?_t=${Date.now()}`;
          // MapLibre VectorTileSource 没有 clearTiles API
          // 移除旧 source + layers，重建以清除所有缓存瓦片
          const renderLayers = map.getStyle().layers.filter(
            (l) => l.source === layerId
          );
          renderLayers.forEach((l) => {
            if (map.getLayer(l.id)) map.removeLayer(l.id);
          });
          if (map.getSource(layerId)) map.removeSource(layerId);
          map.addSource(layerId, {
            type: 'vector',
            tiles: [newUrl],
            minzoom: 1,
            maxzoom: 18,
          });
          const storeLayer = useMapStore.getState().layers.find((l) => l.id === layerId);
          if (storeLayer) {
            addMvtLayer(map, storeLayer);
            addedLayersRef.current.add(layerId);

            // 重新应用 MVT hide filter（如果正在编辑该图层）
            const sel = useMapStore.getState().edit.selectedFeature;
            if (sel?.layerId === layerId && sel?.featureId) {
              applyMvtHideFilter(map, layerId, sel.featureId);
            }
          }
        }
      }
    };

    window.addEventListener('map:reload-mvt', handleReload);
    return () => {
      window.removeEventListener('map:reload-mvt', handleReload);
    };
  }, []);

  return null;
}
