/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * Canvas 符号生成工具
 * 用于生成点图层所需的符号图片
 */

import { PointSymbolShape } from '../types/map-state';

/**
 * 根据符号类型生成 Canvas
 * @param symbol 符号类型
 * @param color 颜色（CSS 颜色字符串）
 * @param size Canvas 尺寸（像素）
 * @returns HTMLCanvasElement
 */
export function createSymbolCanvas(
  symbol: PointSymbolShape | string,
  color: string,
  size: number = 64
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 清空画布
  ctx.clearRect(0, 0, size, size);

  // 填充颜色
  ctx.fillStyle = color;
  ctx.beginPath();

  const center = size / 2;

  switch (symbol) {
    case 'circle':
      drawCircle(ctx, center, center, size / 2 - 2);
      break;

    case 'square':
      drawSquare(ctx, center, size - 4);
      break;

    case 'triangle':
      drawTriangle(ctx, center, center, size / 2 - 2);
      break;

    case 'diamond':
      drawDiamond(ctx, center, center, size / 2 - 2);
      break;

    case 'star':
      drawStar(ctx, center, center, 5, size / 2 - 2, size / 4);
      break;

    case 'cross':
      drawCross(ctx, center, center, size);
      break;

    default:
      drawCircle(ctx, center, center, size / 2 - 2);
  }

  ctx.fill();

  // 添加白色描边（增强对比度）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

/**
 * 绘制圆形
 */
function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number
) {
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

/**
 * 绘制正方形
 */
function drawSquare(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  size: number
) {
  const half = size / 2;
  ctx.rect(centerX - half, centerX - half, size, size);
}

/**
 * 绘制等边三角形
 */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
) {
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX + radius, centerY + radius);
  ctx.lineTo(centerX - radius, centerY + radius);
  ctx.closePath();
}

/**
 * 绘制菱形
 */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
) {
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX + radius, centerY);
  ctx.lineTo(centerX, centerY + radius);
  ctx.lineTo(centerX - radius, centerY);
  ctx.closePath();
}

/**
 * 绘制五角星
 */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }

  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * 绘制十字形
 */
function drawCross(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number
) {
  const w = size / 5;
  const half = size / 2 - 2;

  // 竖条
  ctx.rect(centerX - w / 2, centerY - half, w, size - 4);
  // 横条
  ctx.rect(centerX - half, centerY - w / 2, size - 4, w);
}

/**
 * 将 Canvas 转换为 DataURL
 * @param canvas Canvas 元素
 * @param format 图片格式（默认 PNG）
 * @returns DataURL 字符串
 */
export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  format: string = 'image/png'
): string {
  return canvas.toDataURL(format);
}

/**
 * 预生成所有符号的 DataURL 缓存
 * @param color 颜色
 * @param size 尺寸
 * @returns 符号映射表
 */
export function generateSymbolCache(
  color: string = '#ffffff',
  size: number = 64
): Record<PointSymbolShape, string> {
  const symbols: PointSymbolShape[] = [
    'circle',
    'square',
    'triangle',
    'star',
    'diamond',
    'cross',
  ];

  const cache: Record<PointSymbolShape, string> = {} as any;

  for (const symbol of symbols) {
    const canvas = createSymbolCanvas(symbol, color, size);
    cache[symbol] = canvas.toDataURL('image/png');
  }

  return cache;
}
