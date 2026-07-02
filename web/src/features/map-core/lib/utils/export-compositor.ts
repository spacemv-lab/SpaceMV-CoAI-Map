/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import maplibregl from 'maplibre-gl';
import { ExportConfig, ExportPanelState } from '../types/export-state';
import { drawTitle, drawNorthArrow, drawScaleBar, drawLegend, drawTianditu, drawBrand, loadNorthArrowSvg, loadTiandituLogo } from './map-elements';
import { useMapStore } from '../store/use-map-store';

/**
 * Compute meters per pixel at current zoom and latitude
 * This is the ground distance (in meters) that each screen pixel represents
 */
function computeMetersPerPixel(zoom: number, lat: number): number {
  // Earth circumference in meters (Web Mercator)
  const earthCircumference = 40075016.686;
  // Standard tile size in pixels
  const tileSize = 256;
  // Meters per pixel at equator for this zoom level
  const equatorMetersPerPixel = earthCircumference / (tileSize * Math.pow(2, zoom));
  // Latitude correction (Web Mercator projection)
  return equatorMetersPerPixel * Math.cos((lat * Math.PI) / 180);
}

/**
 * 合成导出图（选区裁剪 + 叠加要素：标题/指北针/比例尺/图例/天地图/品牌）。
 * 返回 { dataUrl, w, h }；尺寸超限或拿不到 ctx 返回 null（由调用方决定提示）。
 * 不触发下载——供「导出 PNG」（下载）与「导出到白板」（送白板）共用。
 */
export async function composeMapImage(
  map: maplibregl.Map,
  selectionBox: NonNullable<ExportPanelState['selectionBox']>,
  config: ExportConfig,
  bearing: number
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  // Force render to ensure canvas has content
  map.triggerRepaint();

  // Wait for render to complete
  await new Promise<void>((resolve) => {
    map.once('render', () => resolve());
    setTimeout(() => resolve(), 100);
  });

  const mapCanvas = map.getCanvas();

  // Calculate selection in canvas coordinates (CSS to canvas pixel ratio)
  const pixelRatio = window.devicePixelRatio || 1;
  const canvasX1 = Math.round(selectionBox.startX * pixelRatio);
  const canvasY1 = Math.round(selectionBox.startY * pixelRatio);
  const canvasX2 = Math.round(selectionBox.endX * pixelRatio);
  const canvasY2 = Math.round(selectionBox.endY * pixelRatio);
  const exportWidth = canvasX2 - canvasX1;
  const exportHeight = canvasY2 - canvasY1;

  if (exportWidth > 4096 || exportHeight > 4096) {
    return null;
  }

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportWidth;
  exportCanvas.height = exportHeight;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  // Draw map region
  ctx.drawImage(mapCanvas, canvasX1, canvasY1, exportWidth, exportHeight, 0, 0, exportWidth, exportHeight);

  // Scale + legend
  const center = map.getCenter();
  const zoom = map.getZoom();
  const metersPerPixel = computeMetersPerPixel(zoom, center.lat);
  const layers = useMapStore.getState().layers.filter((l) => l.visible);

  // Preload north arrow SVG if enabled
  let northArrowImage: HTMLImageElement | null = null;
  if (config.northArrow.enabled) {
    try {
      northArrowImage = await loadNorthArrowSvg(config.northArrow.style);
    } catch (err) {
      console.warn('[export] Failed to load north arrow SVG, using fallback:', err);
    }
  }

  // Preload Tianditu logo if enabled
  let tiandituLogoImage: HTMLImageElement | null = null;
  if (config.tianditu.enabled) {
    try {
      tiandituLogoImage = await loadTiandituLogo();
    } catch (err) {
      console.warn('[export] Failed to load Tianditu logo:', err);
    }
  }

  // Draw map elements
  drawTitle(ctx, config.title.text, config.title, exportWidth, exportHeight);
  drawNorthArrow(ctx, config.northArrow, exportWidth, exportHeight, bearing, northArrowImage);
  drawScaleBar(ctx, config.scaleBar, exportWidth, exportHeight, metersPerPixel);
  drawLegend(ctx, config.legend, exportWidth, exportHeight, layers);
  drawTianditu(ctx, config.tianditu, exportWidth, exportHeight, tiandituLogoImage);
  drawBrand(ctx, config.brand, exportWidth, exportHeight);

  return { dataUrl: exportCanvas.toDataURL('image/png', 1.0), w: exportWidth, h: exportHeight };
}

/**
 * Export map with box selection and map elements → 下载 PNG。
 * 行为不变：合成（composeMapImage）+ 触发下载；超限弹窗提示。
 */
export async function exportMapImage(
  map: maplibregl.Map,
  selectionBox: NonNullable<ExportPanelState['selectionBox']>,
  config: ExportConfig,
  bearing: number
): Promise<void> {
  const result = await composeMapImage(map, selectionBox, config, bearing);
  if (!result) {
    alert('导出尺寸超过限制（最大 4096×4096 像素），请缩小选择区域');
    return;
  }
  const link = document.createElement('a');
  link.download = `map-export-${Date.now()}.png`;
  link.href = result.dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
