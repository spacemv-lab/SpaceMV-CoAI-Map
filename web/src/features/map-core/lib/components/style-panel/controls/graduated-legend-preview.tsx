/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMemo } from 'react';
import { GraduatedConfig } from '../../../types/graduated-style';
import { getColorsForClasses } from '../../../constants/color-ramps';

interface GraduatedLegendPreviewProps {
  config: GraduatedConfig;
}

/**
 * 格式化数字显示
 */
function formatValue(value: number | undefined): string {
  if (value === undefined || value === null) return '-';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Math.abs(value) < 0.01) return '0';
  return value.toFixed(1);
}

export function GraduatedLegendPreview({ config }: GraduatedLegendPreviewProps) {
  const { classes, colorRamp, breakpoints, fieldStats } = config;

  const legendItems = useMemo(() => {
    const colors = getColorsForClasses(colorRamp || 'blues', classes || 5);

    // 如果有断点且长度正确，使用断点
    if (breakpoints && breakpoints.length === classes + 1) {
      return colors.map((color, i) => ({
        color,
        min: breakpoints[i],
        max: breakpoints[i + 1],
        label: `${formatValue(breakpoints[i])} - ${formatValue(breakpoints[i + 1])}`,
      }));
    }

    // 使用 fieldStats 的 min/max 等分
    if (fieldStats) {
      const { min, max } = fieldStats;
      const step = (max - min) / classes;
      return colors.map((color, i) => ({
        color,
        min: min + i * step,
        max: min + (i + 1) * step,
        label: `${formatValue(min + i * step)} - ${formatValue(min + (i + 1) * step)}`,
      }));
    }

    // 无数据时显示占位
    return colors.map((color, i) => ({
      color,
      min: 0,
      max: 0,
      label: `类别 ${i + 1}`,
    }));
  }, [classes, colorRamp, breakpoints, fieldStats]);

  return (
    <div className="mt-4">
      <div className="text-sm text-gray-600 mb-2">图例预览</div>
      <div className="bg-gray-50 rounded p-2 border border-gray-100">
        {legendItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <div
              className="w-4 h-4 rounded border border-gray-200"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}