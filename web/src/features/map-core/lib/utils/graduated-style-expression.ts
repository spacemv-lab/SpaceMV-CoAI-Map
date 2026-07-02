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

/**
 * 生成分级色彩的 interpolate 表达式
 * 用于 circle-color, fill-color, line-color 等 paint property
 *
 * 表达式格式：
 * [
 *   'interpolate',
 *   ['linear'],           // 插值方法
 *   ['get', 'fieldName'], // 属性访问表达式
 *   breakpoint1, color1,  // 断点-颜色对
 *   breakpoint2, color2,
 *   ...
 * ]
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

  // 构建 interpolate 表达式
  // 新增字段对存量要素默认为 null；interpolate 直接吃 ['get', field] 遇到 null 会抛
  // "Expected value to be of type number, but found null"，且报错的要素会被 MapLibre 当
  // 越界值处理而回退成最大色（看起来"全是最大值颜色"）。用 coalesce 把 null 兜底为 0，
  // 落到最小色，点/线/面通用。
  const expression: MapLibreExpression = [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', config.field], 0],
  ];

  // 确保断点严格升序且去重
  const sortedBreakpoints = [...config.breakpoints].sort((a, b) => a - b);
  const uniqueBreakpoints = sortedBreakpoints.filter(
    (bp, i) => i === 0 || bp > sortedBreakpoints[i - 1],
  );

  // 添加断点-颜色对
  // interpolate 需要至少两个断点-颜色对
  const breakpoints = uniqueBreakpoints;

  // 确保 colors 数量与断点区间匹配
  // classes = 5 时，有 5 个颜色，6 个断点（min, b1, b2, b3, b4, max）
  for (let i = 0; i < Math.min(colors.length, breakpoints.length - 1); i++) {
    // 每个区间的颜色应用于该区间起点
    // 例如：值 < breakpoints[1] 显示 colors[0]
    //       值 < breakpoints[2] 显示 colors[1]（插值过渡）
    expression.push(breakpoints[i], colors[i]);
  }

  // 添加最后一个断点和颜色（最大值）
  const lastIndex = Math.min(colors.length - 1, breakpoints.length - 1);
  expression.push(breakpoints[breakpoints.length - 1], colors[lastIndex]);

  return expression;
}

/**
 * 生成分级大小的 interpolate 表达式
 * 用于 circle-radius（点大小按数值变化）
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

  // 线性映射：field 值 → size（同色阶表达式，null 兜底为 0 避免报错/越界）
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', config.field], 0],
    min, minSize,
    max, maxSize,
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