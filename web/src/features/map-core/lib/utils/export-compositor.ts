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
 * Export map with box selection and map elements
 */
export async function exportMapImage(
  map: maplibregl.Map,
  selectionBox: NonNullable<ExportPanelState['selectionBox']>,
  config: ExportConfig,
  bearing: number
): Promise<void> {
  // Force render to ensure canvas has content
  map.triggerRepaint();

  // Wait for render to complete
  await new Promise<void>((resolve) => {
    map.once('render', () => resolve());
    // Timeout fallback in case render doesn't fire
    setTimeout(() => resolve(), 100);
  });

  // Get map canvas
  const mapCanvas = map.getCanvas();
  const mapWidth = mapCanvas.width;
  const mapHeight = mapCanvas.height;

  // Calculate selection in canvas coordinates (CSS to canvas pixel ratio)
  const pixelRatio = window.devicePixelRatio || 1;

  const canvasX1 = Math.round(selectionBox.startX * pixelRatio);
  const canvasY1 = Math.round(selectionBox.startY * pixelRatio);
  const canvasX2 = Math.round(selectionBox.endX * pixelRatio);
  const canvasY2 = Math.round(selectionBox.endY * pixelRatio);


  const exportWidth = canvasX2 - canvasX1;
  const exportHeight = canvasY2 - canvasY1;

  // Check size limits
  if (exportWidth > 4096 || exportHeight > 4096) {
    alert('导出尺寸超过限制（最大 4096×4096 像素），请缩小选择区域');
    return;
  }

  // Create export canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportWidth;
  exportCanvas.height = exportHeight;
  const ctx = exportCanvas.getContext('2d');

  if (!ctx) {
    console.error('Failed to get 2D context');
    return;
  }

  // Draw map region
  ctx.drawImage(
    mapCanvas,
    canvasX1,
    canvasY1,
    exportWidth,
    exportHeight,
    0,
    0,
    exportWidth,
    exportHeight
  );

  // Get current zoom and center for scale calculation
  const center = map.getCenter();
  const zoom = map.getZoom();
  const metersPerPixel = computeMetersPerPixel(zoom, center.lat);

  // Get visible layers for legend
  const layers = useMapStore.getState().layers.filter(l => l.visible);

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

  // Export to PNG
  const mimeType = 'image/png';
  const image = exportCanvas.toDataURL(mimeType, 1.0);

  // Download
  const link = document.createElement('a');
  link.download = `map-export-${Date.now()}.png`;
  link.href = image;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
