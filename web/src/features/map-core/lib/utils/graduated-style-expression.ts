/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * MapLibre GL 样式表达式生成器
 * 用于分级色彩渲染
 */

import { GraduatedConfig } from '../types/graduated-style';
import { getColorsForClasses } from '../constants/color-ramps';

/**
 * MapLibre GL 样式表达式类型
 */
type MapLibreExpression = unknown[];

/** 无数据（缺字段 / null / 空串）的单独配色，不并入任何色阶 */
export const NO_DATA_COLOR = '#cccccc';

/**
 * 构造“无数据”判定条件：字段缺失、值为 null、或值为空串都算无数据。
 * 非数字字符串（理论上不会出现在瓦片里）也会因不匹配任何分支落到 interpolate 报错回退，
 * 与历史行为一致，这里不额外处理。
 */
function buildNoDataCondition(field: string): MapLibreExpression {
  return [
    'any',
    ['!', ['has', field]],
    ['==', ['get', field], null],
    ['==', ['get', field], ''],
  ];
}

/**
 * 生成分级色彩的 case 表达式
 * 用于 circle-color, fill-color, line-color 等 paint property
 *
 * 结构：
 * [
 *   'case',
 *   <无数据条件>, NO_DATA_COLOR,                  // 缺字段/null/"" → 灰
 *   ['interpolate', ['linear'], ['get', field],   // 数字值 → 色阶插值
 *     断点1, 色1, 断点2, 色2, ...],
 * ]
 *
 * 旧实现用 coalesce(get,0) 把空值兜底成 0 → 落到最小色阶，会把“无数据”误读成
 * “最低值”。改成 case 后无数据要素单独灰色，区分清楚。
 */
export function generateGraduatedColorExpression(
  config: GraduatedConfig,
): MapLibreExpression | null {
  // 校验配置
  if (!config.field || !config.breakpoints || config.breakpoints.length < 2) {
    return null;
  }

  // 获取颜色序列
  const colors = getColorsForClasses(config.colorRamp, config.classes);
  if (colors.length === 0) {
    return null;
  }

  // 确保断点严格升序且去重
  const sortedBreakpoints = [...config.breakpoints].sort((a, b) => a - b);
  const breakpoints = sortedBreakpoints.filter(
    (bp, i) => i === 0 || bp > sortedBreakpoints[i - 1],
  );

  // 构建 interpolate（仅作用于有数值的要素）
  const interpolate: MapLibreExpression = [
    'interpolate',
    ['linear'],
    ['get', config.field],
  ];

  // classes = 5 时，有 5 个颜色，6 个断点（min, b1, b2, b3, b4, max）
  for (let i = 0; i < Math.min(colors.length, breakpoints.length - 1); i++) {
    interpolate.push(breakpoints[i], colors[i]);
  }
  const lastIndex = Math.min(colors.length - 1, breakpoints.length - 1);
  interpolate.push(breakpoints[breakpoints.length - 1], colors[lastIndex]);

  return ['case', buildNoDataCondition(config.field), NO_DATA_COLOR, interpolate];
}

/**
 * 生成分级大小的 case 表达式
 * 用于 circle-radius（点大小按数值变化）。无数据 → 最小尺寸（灰色、不抢眼）。
 */
export function generateGraduatedSizeExpression(
  config: GraduatedConfig,
  minSize: number = 4,
  maxSize: number = 20,
): MapLibreExpression | null {
  if (!config.field || !config.breakpoints || config.breakpoints.length < 2) {
    return null;
  }

  const breakpoints = config.breakpoints;
  const min = breakpoints[0];
  const max = breakpoints[breakpoints.length - 1];

  return [
    'case',
    buildNoDataCondition(config.field),
    minSize,
    ['interpolate', ['linear'], ['get', config.field], min, minSize, max, maxSize],
  ];
}

/**
 * 判断是否应该使用分级样式
 */
export function shouldUseGraduatedStyle(
  layerStyle: { renderingType?: string; graduatedConfig?: GraduatedConfig },
): boolean {
  return (
    layerStyle.renderingType === 'graduated' &&
    layerStyle.graduatedConfig?.field &&
    layerStyle.graduatedConfig?.breakpoints &&
    layerStyle.graduatedConfig?.breakpoints?.length >= 2
  );
}
