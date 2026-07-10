/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 分级图例共享计算（浮动图例 legend-panel + 导出/预览 drawLegend 共用，避免两端漂移）。
 */
import { getColorsForClasses } from '../constants/color-ramps';
import type { GraduatedConfig } from '../types/graduated-style';
import { NO_DATA_COLOR } from './graduated-style-expression';

export interface GraduatedLegendItem {
  color: string;
  min?: number;
  max?: number;
  label: string;
}

/** 格式化分级数值显示 */
export function formatLegendValue(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Math.abs(value) < 0.01) return '0';
  return value.toFixed(1);
}

/**
 * 计算分级图例条目：优先用断点，其次 fieldStats 等分，无数据时占位「类别 N」。
 * 末尾追加一行「无数据」灰块，与渲染端 NO_DATA_COLOR 配色对应。
 */
export function computeGraduatedLegendItems(config: GraduatedConfig): GraduatedLegendItem[] {
  const classes = config.classes || 5;
  const colors = getColorsForClasses(config.colorRamp || 'blues', classes);
  const { breakpoints, fieldStats } = config;

  let items: GraduatedLegendItem[];
  if (breakpoints && breakpoints.length === classes + 1) {
    items = colors.map((color, i) => ({
      color,
      min: breakpoints[i],
      max: breakpoints[i + 1],
      label: `${formatLegendValue(breakpoints[i])} - ${formatLegendValue(breakpoints[i + 1])}`,
    }));
  } else if (fieldStats) {
    const { min, max } = fieldStats;
    const step = (max - min) / classes;
    items = colors.map((color, i) => ({
      color,
      min: min + i * step,
      max: min + (i + 1) * step,
      label: `${formatLegendValue(min + i * step)} - ${formatLegendValue(min + (i + 1) * step)}`,
    }));
  } else {
    // 断点尚未从后端拉回时用占位，避免空白
    items = colors.map((color, i) => ({ color, label: `类别 ${i + 1}` }));
  }

  // 无数据单独灰（缺字段/null/空串要素在地图上即此色）
  items.push({ color: NO_DATA_COLOR, label: '无数据' });
  return items;
}
