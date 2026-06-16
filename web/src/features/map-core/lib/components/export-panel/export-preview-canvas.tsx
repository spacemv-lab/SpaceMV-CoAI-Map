/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMapStore } from '../../store/use-map-store';
import { drawTitle, drawNorthArrow, drawScaleBar, drawLegend, drawTianditu, loadNorthArrowSvg, loadTiandituLogo } from '../../utils/map-elements';
import { NorthArrowStyle } from '../../types/export-state';

// Preload all north arrow SVG styles
const svgCache: Map<NorthArrowStyle, HTMLImageElement> = new Map();
let svgsLoaded = false;
let tiandituLogoCache: HTMLImageElement | null = null;

async function preloadSvgs(): Promise<void> {
  for (const style of [1, 2, 3, 4, 5] as NorthArrowStyle[]) {
    if (!svgCache.has(style)) {
      try {
        const img = await loadNorthArrowSvg(style);
        svgCache.set(style, img);
      } catch (err) {
        console.warn('[preview] Failed to preload SVG style', style);
      }
    }
  }
  // Preload Tianditu logo
  try {
    tiandituLogoCache = await loadTiandituLogo();
  } catch (err) {
    console.warn('[preview] Failed to preload Tianditu logo:', err);
  }
  svgsLoaded = true;
}

export function ExportPreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isOpen = useMapStore((state) => state.exportPanel.isOpen);
  const selectionBox = useMapStore((state) => state.exportPanel.selectionBox);
  const config = useMapStore((state) => state.exportPanel.config);
  const viewport = useMapStore((state) => state.viewport);
  const layers = useMapStore(
    useShallow((state) => state.layers.filter(l => l.visible))
  );
  const [svgReady, setSvgReady] = useState(svgsLoaded);

  // Preload SVGs on mount and trigger redraw when ready
  useEffect(() => {
    if (!svgsLoaded) {
      preloadSvgs().then(() => setSvgReady(true));
    }
  }, []);

  const drawElements = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const width = canvas.width / pixelRatio;
    const height = canvas.height / pixelRatio;

    // Save context and scale to CSS pixel space
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);

    // Clear canvas (in CSS pixel space)
    ctx.clearRect(0, 0, width, height);

    // Compute scale (same as export-compositor)
    // viewport.zoom is camera height (meters), convert to MapLibre zoom level
    const earthCircumference = 40075016.686;
    const tileSize = 256;
    const zoom = Math.log2(40075016 / (viewport.zoom || 1));
    const lat = viewport.center[1];
    const metersPerPixel = (earthCircumference / (tileSize * Math.pow(2, zoom))) * Math.cos((lat * Math.PI) / 180);

    // Draw title
    drawTitle(ctx, config.title.text || '标题', config.title, width, height);

    // Draw north arrow with cached SVG
    const northArrowImage = svgCache.get(config.northArrow.style);
    drawNorthArrow(ctx, config.northArrow, width, height, viewport.heading, northArrowImage);

    // Draw scale bar
    drawScaleBar(ctx, config.scaleBar, width, height, metersPerPixel);

    // Draw legend
    drawLegend(ctx, config.legend, width, height, layers);

    // Draw Tianditu attribution
    drawTianditu(ctx, config.tianditu, width, height, tiandituLogoCache);

    ctx.restore();
  }, [config, viewport, layers]);

  // Redraw on config/viewport change
  useEffect(() => {
    if (!isOpen || !selectionBox || !canvasRef.current) return;

    drawElements();
  }, [isOpen, selectionBox, config, viewport, drawElements, svgReady]);

  if (!isOpen || !selectionBox) return null;

  const pixelRatio = window.devicePixelRatio || 1;
  const boxWidthCSS = Math.abs(selectionBox.endX - selectionBox.startX);
  const boxHeightCSS = Math.abs(selectionBox.endY - selectionBox.startY);
  const boxLeft = Math.min(selectionBox.startX, selectionBox.endX);
  const boxTop = Math.min(selectionBox.startY, selectionBox.endY);

  return (
    <canvas
      ref={canvasRef}
      width={boxWidthCSS * pixelRatio}
      height={boxHeightCSS * pixelRatio}
      className="absolute pointer-events-none z-40"
      style={{ left: boxLeft, top: boxTop, width: boxWidthCSS, height: boxHeightCSS }}
    />
  );
}
