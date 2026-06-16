/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 色阶预设定义
 */

/**
 * 色阶类型
 */
export type ColorRampType = 'sequential' | 'diverging' | 'qualitative';

/**
 * 色阶预设定义
 */
export interface ColorRampPreset {
  id: string;
  name: string;
  type: ColorRampType;
  colors: string[]; // 从低到高的颜色序列
}

/**
 * 顺序色阶（单色调渐变，适合数值从小到大）
 */
const SEQUENTIAL_RAMPS: ColorRampPreset[] = [
  {
    id: 'blues',
    name: '蓝色渐变',
    type: 'sequential',
    colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  },
  {
    id: 'greens',
    name: '绿色渐变',
    type: 'sequential',
    colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  },
  {
    id: 'reds',
    name: '红色渐变',
    type: 'sequential',
    colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15', '#67000d'],
  },
  {
    id: 'oranges',
    name: '橙色渐变',
    type: 'sequential',
    colors: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
  },
  {
    id: 'purples',
    name: '紫色渐变',
    type: 'sequential',
    colors: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
  },
];

/**
 * 双向色阶（两种色调，适合有中心点的数据）
 */
const DIVERGING_RAMPS: ColorRampPreset[] = [
  {
    id: 'rdylbu',
    name: '红黄蓝',
    type: 'diverging',
    colors: ['#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
  },
  {
    id: 'rdylgn',
    name: '红黄绿',
    type: 'diverging',
    colors: ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850'],
  },
  {
    id: 'spectral',
    name: '光谱',
    type: 'diverging',
    colors: ['#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd'],
  },
];

/**
 * 分类色阶（离散颜色，适合分类数据）
 */
const QUALITATIVE_RAMPS: ColorRampPreset[] = [
  {
    id: 'set1',
    name: 'Set1',
    type: 'qualitative',
    colors: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'],
  },
  {
    id: 'set2',
    name: 'Set2',
    type: 'qualitative',
    colors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
  },
  {
    id: 'set3',
    name: 'Set3',
    type: 'qualitative',
    colors: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9'],
  },
];

/**
 * 所有色阶预设
 */
export const COLOR_RAMPS: ColorRampPreset[] = [
  ...SEQUENTIAL_RAMPS,
  ...DIVERGING_RAMPS,
  ...QUALITATIVE_RAMPS,
];

/**
 * 根据类数从色阶中取色
 * @param rampId 色阶 ID
 * @param classes 类数
 */
export function getColorsForClasses(rampId: string, classes: number): string[] {
  const ramp = COLOR_RAMPS.find((r) => r.id === rampId);
  if (!ramp) return ['#cccccc'];

  const colors = ramp.colors;
  if (colors.length <= classes) return colors;

  // 等间隔采样
  const result: string[] = [];
  const step = (colors.length - 1) / (classes - 1);
  for (let i = 0; i < classes; i++) {
    result.push(colors[Math.round(i * step)]);
  }
  return result;
}

/**
 * 渲染类型选项
 */
export const RENDERING_TYPE_OPTIONS = [
  { value: 'simple', label: '简单样式' },
  { value: 'graduated', label: '分级色彩' },
] as const;

/**
 * 分级方法选项
 */
export const CLASSIFICATION_METHOD_OPTIONS = [
  { value: 'equal-interval', label: '等间距' },
  { value: 'quantile', label: '分位数' },
  { value: 'natural-breaks', label: '自然间断' },
] as const;