/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import maplibregl from 'maplibre-gl';
import { toast } from 'sonner';

/**
 * 飞镜头到单个要素 / 几何（MapLibre）。
 *
 * 镜头实例沿用 layer-manager 的访问方式：`window.MAPLIBRE_MAP`
 * （由 maplibre-container 挂载）。本项目渲染器只有 MapLibre（Cesium 已废弃）。
 * 不走 setViewport——它在容器里是 jumpTo 瞬切无动画。
 */

type GeoJsonGeometry = {
  type: string;
  coordinates?: unknown;
  geometries?: unknown[];
};

/** 把任意 GeoJSON geometry 的所有坐标递归展平为 [lng, lat, height?] 叶子数组 */
function flattenGeometryCoords(geometry: GeoJsonGeometry): number[][] {
  const out: number[][] = [];

  if (geometry.type === 'GeometryCollection') {
    if (Array.isArray(geometry.geometries)) {
      for (const g of geometry.geometries) {
        out.push(...flattenGeometryCoords(g as GeoJsonGeometry));
      }
    }
    return out;
  }

  const visit = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    // 叶子节点：[lng, lat, (height)]
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      out.push(arr as number[]);
      return;
    }
    for (const item of arr) visit(item);
  };

  visit(geometry.coordinates);
  return out;
}

/**
 * 飞到给定几何。返回是否成功触发飞行。
 * geometry 为 null/空 → toast 提示并返回 false。
 */
export function flyToGeometry(geometry: unknown): boolean {
  if (!geometry || typeof geometry !== 'object') {
    toast.warning('该要素无几何信息，无法定位');
    return false;
  }

  const coords = flattenGeometryCoords(geometry as GeoJsonGeometry);
  if (coords.length === 0) {
    toast.warning('该要素无几何信息，无法定位');
    return false;
  }

  const map = (
    window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }
  ).MAPLIBRE_MAP;
  if (!map) {
    toast.error('地图查看器未初始化');
    return false;
  }

  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // 单点：fitBounds 退化（零范围）→ 直接 flyTo 到点并放大
  if (minLng === maxLng && minLat === maxLat) {
    map.flyTo({
      center: [minLng, minLat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 1200,
    });
    return true;
  }

  map.fitBounds([minLng, minLat, maxLng, maxLat], {
    padding: 60,
    duration: 1200,
  });
  return true;
}
