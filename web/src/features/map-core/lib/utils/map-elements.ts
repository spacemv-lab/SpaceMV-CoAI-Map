/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { MapElementConfig, NorthArrowConfig, NorthArrowStyle, LegendConfig, TiandituConfig, BrandConfig } from '../types/export-state';
import { PROJECT_BRAND, BASEMAP_BRAND } from '../constants/brand';
import { createSymbolCanvas } from './symbol-canvas';
import { computeGraduatedLegendItems, type GraduatedLegendItem } from './graduated-legend';
import type { GraduatedConfig } from '../types/graduated-style';

// Import SVG files as raw strings (Vite feature)
import northArrowSvg1 from '../assets/north-arrow-1.svg?raw';
import northArrowSvg2 from '../assets/north-arrow-2.svg?raw';
import northArrowSvg3 from '../assets/north-arrow-3.svg?raw';
import northArrowSvg4 from '../assets/north-arrow-4.svg?raw';
import northArrowSvg5 from '../assets/north-arrow-5.svg?raw';

// SVG content map
const NORTH_ARROW_SVGS: Record<NorthArrowStyle, string> = {
  1: northArrowSvg1,
  2: northArrowSvg2,
  3: northArrowSvg3,
  4: northArrowSvg4,
  5: northArrowSvg5,
};

// Import Tianditu logo image
import tiandituLogoUrl from '../images/天地图.png';

// Cache for loaded SVG images
const svgImageCache: Map<NorthArrowStyle, HTMLImageElement> = new Map();

// Cache for Tianditu logo
let tiandituLogoImage: HTMLImageElement | null = null;

/**
 * Load north arrow SVG as Image (cached)
 */
export async function loadNorthArrowSvg(style: NorthArrowStyle): Promise<HTMLImageElement> {
  // Return cached image if available
  if (svgImageCache.has(style)) {
    return svgImageCache.get(style)!;
  }

  // Create blob URL from SVG content
  const svgContent = NORTH_ARROW_SVGS[style];
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(blob);

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load north arrow SVG: style ${style}`));
    image.src = svgUrl;
  });

  // Cache the loaded image
  svgImageCache.set(style, image);
  return image;
}

/**
 * Load Tianditu logo image (cached)
 */
export async function loadTiandituLogo(): Promise<HTMLImageElement> {
  if (tiandituLogoImage) return tiandituLogoImage;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load Tianditu logo'));
    image.src = tiandituLogoUrl;
  });
  // Fully decode before returning: onload only means the bytes were fetched. A
  // detached <img> that hasn't decoded yet can draw blank on a canvas — which is
  // why the logo appeared in the on-screen <img> but went missing in exports.
  await image.decode();

  tiandituLogoImage = image;
  return image;
}

/**
 * Calculate element position directly from offset values
 * offsetX/offsetY: -50 to +50
 * -50 = left/top edge, 0 = center, +50 = right/bottom edge
 */
export function getElementPosition(
  config: MapElementConfig,
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number
): { x: number; y: number } {
  const margin = 20;

  // Calculate position directly from offsets
  // offsetX = -50 → left edge (margin), offsetX = 0 → center, offsetX = +50 → right edge (margin)
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const halfWidth = (canvasWidth - 2 * margin) / 2;
  const halfHeight = (canvasHeight - 2 * margin) / 2;

  // Position calculation
  const x = centerX + (config.offsetX / 50) * halfWidth - elementWidth / 2;
  const y = centerY + (config.offsetY / 50) * halfHeight - elementHeight / 2;

  return { x, y };
}

/**
 * Draw title text
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  config: MapElementConfig & { text: string },
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!config.enabled) return;

  ctx.save();

  // Measure text for positioning
  ctx.font = 'bold 24px sans-serif';
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = 30; // Approximate height for 24px font

  const position = getElementPosition(config, canvasWidth, canvasHeight, textWidth, textHeight);

  // Draw background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  const padding = 8;
  ctx.fillRect(
    position.x - padding,
    position.y - padding,
    textWidth + 2 * padding,
    textHeight + 2 * padding
  );

  // Draw text
  ctx.fillStyle = '#1e293b';
  ctx.fillText(text, position.x, position.y + 20); // Baseline adjustment

  ctx.restore();
}

/**
 * Draw the SpaceMV-CoAI-Map brand watermark (text logo)
 */
export function drawBrand(
  ctx: CanvasRenderingContext2D,
  config: BrandConfig,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!config.enabled) return;

  ctx.save();

  const text = config.text || PROJECT_BRAND.name;
  const fontSize = 13;
  const padding = 6;

  ctx.font = `600 ${fontSize}px sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const elementWidth = textWidth + padding * 2;
  const elementHeight = fontSize + padding * 2;

  const position = getElementPosition(config, canvasWidth, canvasHeight, elementWidth, elementHeight);

  // Background pill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(position.x, position.y, elementWidth, elementHeight);

  // Text
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, position.x + padding, position.y + elementHeight / 2);

  ctx.restore();
}

/**
 * Draw north arrow using SVG image
 */
export function drawNorthArrow(
  ctx: CanvasRenderingContext2D,
  config: NorthArrowConfig,
  canvasWidth: number,
  canvasHeight: number,
  bearing: number = 0,
  svgImage: HTMLImageElement | null = null
): void {
  if (!config.enabled) return;

  ctx.save();

  const arrowSize = 40;
  const position = getElementPosition(config, canvasWidth, canvasHeight, arrowSize, arrowSize);

  // Translate to center of arrow position
  ctx.translate(position.x + arrowSize / 2, position.y + arrowSize / 2);

  // Apply bearing rotation (rotate around center)
  ctx.rotate((bearing * Math.PI) / 180);

  if (svgImage) {
    // Draw SVG image centered
    ctx.drawImage(svgImage, -arrowSize / 2, -arrowSize / 2, arrowSize, arrowSize);
  } else {
    // Fallback: draw simple arrow shape
    ctx.fillStyle = '#1296db';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Simple arrow pointing up
    ctx.beginPath();
    ctx.moveTo(0, -arrowSize / 2 + 2);
    ctx.lineTo(-arrowSize / 4, arrowSize / 4);
    ctx.lineTo(0, arrowSize / 8);
    ctx.lineTo(arrowSize / 4, arrowSize / 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // N label
    ctx.rotate((-bearing * Math.PI) / 180);
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -arrowSize / 4);
  }

  ctx.restore();
}

/**
 * Draw scale bar
 */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  config: MapElementConfig,
  canvasWidth: number,
  canvasHeight: number,
  metersPerPixel: number
): void {
  if (!config.enabled) return;

  ctx.save();

  // Fixed anchor width for positioning stability
  const anchorWidth = 120;
  const anchorHeight = 40;

  const position = getElementPosition(config, canvasWidth, canvasHeight, anchorWidth, anchorHeight);

  // Calculate scale bar length (target ~80-100px for readable scale)
  const maxBarLength = 100;

  // Calculate what ground distance the max bar length represents
  const maxGroundDistanceMeters = maxBarLength * metersPerPixel;
  const maxGroundDistanceKm = maxGroundDistanceMeters / 1000;

  // Snap to a round "nice" value (1-2-5 series) so the bar reads as a clean
  // reference, not a precise measurement — a scale bar should never show
  // "353.1652... km". Covers ~10 m up to ~10000 km: past the useful range of a
  // 100 px bar even at a full-globe (zoom 0) view, so the raw fallback never
  // leaks an unrounded distance.
  const niceValues = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const displayDistance = niceValues.find((v) => v >= maxGroundDistanceKm * 0.5) || maxGroundDistanceKm;

  // Calculate actual pixel length for this display distance
  const pixelLength = Math.min(displayDistance * 1000 / metersPerPixel, maxBarLength);

  // Center the scale bar within the anchor area
  const barX = position.x + (anchorWidth - pixelLength) / 2;
  const barY = position.y + 8;
  const barHeight = 6;

  // Draw background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(position.x - 4, position.y - 4, anchorWidth + 8, anchorHeight + 8);

  // Draw scale bar with alternating segments
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(barX, barY, pixelLength, barHeight);

  // Draw alternating white segments
  ctx.fillStyle = '#fff';
  const segmentCount = 4;
  const segmentWidth = pixelLength / segmentCount;
  for (let i = 1; i < segmentCount; i += 2) {
    ctx.fillRect(barX + i * segmentWidth, barY, segmentWidth, barHeight);
  }

  // Draw border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, pixelLength, barHeight);

  // Draw label
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';

  const label = displayDistance < 1
    ? `${Math.round(displayDistance * 1000)} m`
    : `${displayDistance} km`;
  ctx.fillText(label, barX + pixelLength / 2, barY + barHeight + 14);

  ctx.restore();
}

/**
 * Draw legend showing visible layers
 */
export function drawLegend(
  ctx: CanvasRenderingContext2D,
  config: LegendConfig,
  canvasWidth: number,
  canvasHeight: number,
  layers: Array<{
    name: string;
    geometryType?: string;
    style?: {
      color?: string;
      opacity?: number;
      pointSymbol?: string;
      pointImageUri?: string;
      renderingType?: string;
      graduatedConfig?: GraduatedConfig;
    };
  }>,
): void {
  if (!config.enabled || layers.length === 0) return;

  ctx.save();

  const DEFAULT_COLOR = '#cccccc';
  const itemHeight = 18;
  const padding = 8;
  const iconSize = 12;
  const minWidth = 100;
  const maxWidth = 300;
  const titleHeight = 16; // Height for "图例" title
  const maxLegendHeight = 260;

  ctx.font = '11px sans-serif';

  // 预解析每层：分级展开成多个类别条目，单色保持一条（与浮动图例 legend-panel 规则一致）
  const resolved = layers.map((layer) => {
    const style = layer.style;
    const color = style?.color || DEFAULT_COLOR;
    const isGraduated = style?.renderingType === 'graduated' && !!style?.graduatedConfig;
    const items: GraduatedLegendItem[] = isGraduated
      ? computeGraduatedLegendItems(style!.graduatedConfig!)
      : [];
    return { layer, color, isGraduated, items };
  });

  // 总行数：分级 = 1(层名) + N(类别)；单色 = 1
  const rowCount = resolved.reduce((n, r) => n + (r.isGraduated ? 1 + r.items.length : 1), 0);

  // 宽度取层名与分级区间 label 的最长者
  const maxTextWidth = resolved.reduce((max, r) => {
    let w = ctx.measureText(r.layer.name).width;
    for (const it of r.items) w = Math.max(w, ctx.measureText(it.label).width);
    return Math.max(max, w);
  }, 0);

  const legendWidth = Math.min(Math.max(minWidth, padding * 2 + iconSize + 6 + maxTextWidth), maxWidth);
  const legendHeight = Math.min(rowCount * itemHeight + padding * 2 + titleHeight, maxLegendHeight);

  const position = getElementPosition(config, canvasWidth, canvasHeight, legendWidth, legendHeight);

  // 背景 + 边框
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(position.x, position.y, legendWidth, legendHeight);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.strokeRect(position.x, position.y, legendWidth, legendHeight);

  // 标题
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('图例', position.x + padding, position.y + padding);

  // 条目
  const textMaxWidth = legendWidth - padding * 2 - iconSize - 6;
  const iconX = position.x + padding;
  const classIconX = position.x + padding + 2;
  let y = position.y + padding + titleHeight;
  const bottomLimit = position.y + legendHeight - padding;

  const drawLabel = (text: string, x: number, font: string) => {
    ctx.font = font;
    let name = text;
    while (name.length > 0 && ctx.measureText(name).width > textMaxWidth) {
      name = name.slice(0, -1);
    }
    if (name.length === 0) name = text.slice(0, 1);
    if (name !== text) name = name.slice(0, -1) + '…';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(name, x, y);
  };

  for (const r of resolved) {
    if (y + itemHeight > bottomLimit) break; // 超高截断

    if (r.isGraduated) {
      // 分级：层名（加粗，无图标）+ 各类别小色块 + 区间
      drawLabel(r.layer.name, iconX, 'bold 11px sans-serif');
      y += itemHeight;
      for (const it of r.items) {
        if (y + itemHeight > bottomLimit) break;
        drawClassIcon(ctx, it.color, r.layer.geometryType, classIconX, y + 3, iconSize);
        drawLabel(it.label, iconX + iconSize + 6, '11px sans-serif');
        y += itemHeight;
      }
    } else {
      // 单色：按几何/点形状画图标 + 层名
      drawSimpleIcon(ctx, r.layer, r.color, iconX, y + 3, iconSize);
      drawLabel(r.layer.name, iconX + iconSize + 6, '11px sans-serif');
      y += itemHeight;
    }
  }

  ctx.restore();
}

/**
 * 单色图标：POINT 按 pointSymbol 出形状（复用 createSymbolCanvas，与地图渲染一致）；
 * LINESTRING 斜线；POLYGON/默认方块。自定义点图未预加载，暂以圆兜底。
 */
function drawSimpleIcon(
  ctx: CanvasRenderingContext2D,
  layer: { geometryType?: string; style?: { pointSymbol?: string; pointImageUri?: string; opacity?: number } },
  color: string,
  x: number,
  y: number,
  size: number,
): void {
  const opacity = layer.style?.opacity;
  if (opacity !== undefined) ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  if (layer.geometryType === 'POINT') {
    const sym = layer.style?.pointSymbol && layer.style.pointSymbol !== 'custom' ? layer.style.pointSymbol : 'circle';
    const symCanvas = createSymbolCanvas(sym, color, size * 2);
    ctx.drawImage(symCanvas, x, y, size, size);
  } else if (layer.geometryType === 'LINESTRING') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + size - 2);
    ctx.lineTo(x + size - 1, y + 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x, y, size, size);
  }

  ctx.globalAlpha = 1;
}

/** 分级类别小标：LINESTRING 斜线、POINT 圆、其他方块 */
function drawClassIcon(
  ctx: CanvasRenderingContext2D,
  color: string,
  geometryType: string | undefined,
  x: number,
  y: number,
  size: number,
): void {
  if (geometryType === 'LINESTRING') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + size - 2);
    ctx.lineTo(x + size - 1, y + 2);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  if (geometryType === 'POINT') {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(x, y, size, size);
    ctx.strokeRect(x, y, size, size);
  }
}

/**
 * Draw Tianditu attribution (logo + license number)
 */
export function drawTianditu(
  ctx: CanvasRenderingContext2D,
  config: TiandituConfig,
  canvasWidth: number,
  canvasHeight: number,
  logoImage: HTMLImageElement | null = null,
  dark = false,
): void {
  if (!config.enabled) return;

  ctx.save();

  const logoHeight = 20;
  // naturalWidth/Height give the intrinsic dims reliably for a detached <img>;
  // the .width/.height IDL attrs are unreliable (0 in some engines) for images
  // that aren't being rendered.
  const logoWidth = logoImage && logoImage.naturalHeight
    ? (logoImage.naturalWidth / logoImage.naturalHeight) * logoHeight
    : 20;
  const padding = 6;

  // 审图号文字宽度（measureText 须在设 font 之后）
  const fontSize = 10;
  const gap = 4;
  ctx.font = `${fontSize}px sans-serif`;
  const licenseText = BASEMAP_BRAND.tianditu.license;
  const textWidth = ctx.measureText(licenseText).width;

  const elementWidth = logoWidth + gap + textWidth + padding * 2;
  const elementHeight = logoHeight + padding * 2;

  const position = getElementPosition(config, canvasWidth, canvasHeight, elementWidth, elementHeight);

  // 不画白底板——logo PNG 自带透明背景；审图号靠明暗自适应配色保证可读（与屏幕左下角一致）。
  // Draw logo
  if (logoImage) {
    ctx.drawImage(logoImage, position.x + padding, position.y + padding, logoWidth, logoHeight);
  }

  // Draw license text (审图号) — 暗底图白字，亮底图黑字
  ctx.fillStyle = dark ? '#ffffff' : '#1e293b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(licenseText, position.x + padding + logoWidth + gap, position.y + elementHeight / 2);

  ctx.restore();
}
