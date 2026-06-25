/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { MapElementConfig, NorthArrowConfig, NorthArrowStyle, LegendConfig, TiandituConfig, BrandConfig } from '../types/export-state';
import { PROJECT_BRAND } from '../constants/brand';
// 审图号文字已移除（只保留 logo 图片），如需恢复取消下一行注释
// import { BASEMAP_BRAND } from '../constants/brand';

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
  layers: Array<{ name: string; geometryType?: string; style?: { color?: string } }>
): void {
  if (!config.enabled || layers.length === 0) return;

  ctx.save();

  const DEFAULT_COLOR = '#cccccc';
  const itemHeight = 20;
  const padding = 8;
  const iconSize = 12;
  const minWidth = 100;
  const maxWidth = 300;
  const titleHeight = 16; // Height for "图例" title

  // Calculate width based on longest layer name
  ctx.font = '11px sans-serif';
  const maxNameWidth = layers.reduce((max, layer) => {
    const w = ctx.measureText(layer.name).width;
    return Math.max(max, w);
  }, 0);

  // Legend width = padding + icon + gap + text + padding
  const legendWidth = Math.min(Math.max(minWidth, padding * 2 + iconSize + 4 + maxNameWidth), maxWidth);
  const legendHeight = Math.min(layers.length * itemHeight + padding * 2 + titleHeight, 200);

  const position = getElementPosition(config, canvasWidth, canvasHeight, legendWidth, legendHeight);

  // Draw background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(position.x, position.y, legendWidth, legendHeight);

  // Draw border
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.strokeRect(position.x, position.y, legendWidth, legendHeight);

  // Draw title
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('图例', position.x + padding, position.y + padding);

  // Draw layer items
  ctx.font = '11px sans-serif';
  const startY = position.y + padding + 16;

  layers.slice(0, Math.floor((legendHeight - padding * 2 - titleHeight) / itemHeight)).forEach((layer, i) => {
    const y = startY + i * itemHeight;
    const color = layer.style?.color || DEFAULT_COLOR;

    // Draw geometry icon
    const iconX = position.x + padding;
    const iconY = y + 4;

    switch (layer.geometryType) {
      case 'POINT':
        // Draw filled circle with border
        ctx.fillStyle = color;
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'LINESTRING':
        // Draw diagonal line (better visual distinction from polygon)
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(iconX + 1, iconY + iconSize - 2);
        ctx.lineTo(iconX + iconSize - 1, iconY + 2);
        ctx.stroke();
        break;
      case 'POLYGON':
        // Draw filled square with border
        ctx.fillStyle = color;
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.fillRect(iconX, iconY, iconSize, iconSize);
        ctx.strokeRect(iconX, iconY, iconSize, iconSize);
        break;
      default:
        // Draw filled square with border for unknown types
        ctx.fillStyle = color;
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.fillRect(iconX, iconY, iconSize, iconSize);
        ctx.strokeRect(iconX, iconY, iconSize, iconSize);
    }

    // Draw layer name (truncate if too long)
    const maxTextWidth = legendWidth - padding * 2 - iconSize - 4;
    let displayName = layer.name;
    const textX = iconX + iconSize + 4;
    ctx.fillStyle = '#1e293b';

    // Truncate text if needed
    while (ctx.measureText(displayName).width > maxTextWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== layer.name) {
      displayName = displayName.slice(0, -2) + '…';
    }

    ctx.fillText(displayName, textX, y + 4);
  });

  ctx.restore();
}

/**
 * Draw Tianditu attribution (logo + license number)
 */
export function drawTianditu(
  ctx: CanvasRenderingContext2D,
  config: TiandituConfig,
  canvasWidth: number,
  canvasHeight: number,
  logoImage: HTMLImageElement | null = null
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

  // 审图号文字已移除，只保留 logo 图片（如需恢复取消下方注释）
  // const fontSize = 10;
  // const gap = 4;
  // ctx.font = `${fontSize}px sans-serif`;
  // const licenseText = BASEMAP_BRAND.tianditu.license;
  // const textWidth = ctx.measureText(licenseText).width;
  // const elementWidth = logoWidth + gap + textWidth + padding * 2;

  const elementWidth = logoWidth + padding * 2;
  const elementHeight = logoHeight + padding * 2;

  const position = getElementPosition(config, canvasWidth, canvasHeight, elementWidth, elementHeight);

  // Draw background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillRect(position.x, position.y, elementWidth, elementHeight);

  // Draw logo
  if (logoImage) {
    ctx.drawImage(logoImage, position.x + padding, position.y + padding, logoWidth, logoHeight);
  }

  // Draw license text (审图号) — 已移除，只保留 logo
  // ctx.fillStyle = '#1e293b';
  // ctx.textAlign = 'left';
  // ctx.textBaseline = 'middle';
  // ctx.fillText(licenseText, position.x + padding + logoWidth + gap, position.y + elementHeight / 2);

  ctx.restore();
}
