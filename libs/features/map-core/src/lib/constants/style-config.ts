/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * 样式配置定义
 * 采用配置驱动设计，支持点/线/面三种几何类型
 */

import { GeometryType, LayerStyle } from '../types/map-state';

/**
 * 样式控件类型枚举
 */
export type ControlType =
  | 'color' // 颜色选择器
  | 'opacity' // 透明度滑块
  | 'sizeUnit' // 尺寸单位下拉 (点)
  | 'size' // 大小滑块 (点)
  | 'symbol' // 符号下拉 (点)
  | 'renderMode' // 渲染模式切换 (点)
  | 'rotation' // 旋转角度 (点)
  | 'labelText' // 标注文字 (点)
  | 'imageUpload' // 图片上传 (点)
  | 'width' // 线宽滑块 (线/面)
  | 'lineType' // 线型下拉 (线)
  | 'outline'; // 边框控制组 (面)

/**
 * 预设样式项
 */
export interface StylePreset {
  id: string;
  name: string;
  style: LayerStyle;
}

/**
 * 几何类型样式配置
 */
export interface GeometryStyleConfig {
  type: GeometryType;
  presets: StylePreset[];
  customControls: ControlType[];
  defaultStyle: LayerStyle;
}

/**
 * 点图层预设
 */
const POINT_PRESETS: StylePreset[] = [
  {
    id: 'point-blue-circle',
    name: '蓝色圆点',
    style: {
      color: '#3b82f6',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'circle',
      pointRenderMode: 'billboard',
    },
  },
  {
    id: 'point-red-marker',
    name: '红色标记',
    style: {
      color: '#ef4444',
      pointSize: 12,
      opacity: 1,
      pointSymbol: 'circle',
      pointRenderMode: 'billboard',
    },
  },
  {
    id: 'point-green-square',
    name: '绿色方块',
    style: {
      color: '#22c55e',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'square',
      pointRenderMode: 'billboard',
    },
  },
  {
    id: 'point-yellow-star',
    name: '黄色星标',
    style: {
      color: '#eab308',
      pointSize: 14,
      opacity: 1,
      pointSymbol: 'star',
      pointRenderMode: 'billboard',
    },
  },
  {
    id: 'point-purple-diamond',
    name: '紫色菱形',
    style: {
      color: '#a855f7',
      pointSize: 10,
      opacity: 1,
      pointSymbol: 'diamond',
      pointRenderMode: 'billboard',
    },
  },
  {
    id: 'point-simple-blue',
    name: '蓝色简单点',
    style: {
      color: '#3b82f6',
      pointSize: 10,
      opacity: 1,
      pointRenderMode: 'point',
      pointOutlineColor: '#ffffff',
      pointOutlineWidth: 2,
    },
  },
];

/**
 * 线图层预设
 */
const LINE_PRESETS: StylePreset[] = [
  {
    id: 'line-solid-blue',
    name: '蓝色实线',
    style: {
      color: '#3b82f6',
      width: 2,
      opacity: 1,
      lineType: 'solid',
    },
  },
  {
    id: 'line-dashed-red',
    name: '红色虚线',
    style: {
      color: '#ef4444',
      width: 2,
      opacity: 1,
      lineType: 'dashed',
      dashPattern: [5, 5],
    },
  },
  {
    id: 'line-bold-green',
    name: '绿色粗线',
    style: {
      color: '#22c55e',
      width: 5,
      opacity: 1,
      lineType: 'solid',
    },
  },
  {
    id: 'line-gray-dotted',
    name: '灰色点线',
    style: {
      color: '#6b7280',
      width: 1,
      opacity: 1,
      lineType: 'dotted',
    },
  },
];

/**
 * 面图层预设
 */
const POLYGON_PRESETS: StylePreset[] = [
  {
    id: 'polygon-blue-fill',
    name: '蓝色填充',
    style: {
      color: '#3b82f6',
      opacity: 0.3,
      outlineColor: '#3b82f6',
      outlineWidth: 2,
    },
  },
  {
    id: 'polygon-red-fill',
    name: '红色填充',
    style: {
      color: '#ef4444',
      opacity: 0.3,
      outlineColor: '#ef4444',
      outlineWidth: 2,
    },
  },
  {
    id: 'polygon-transparent',
    name: '半透明填充',
    style: {
      color: '#6b7280',
      opacity: 0.1,
      outlineColor: '#6b7280',
      outlineWidth: 1,
    },
  },
  {
    id: 'polygon-green-light',
    name: '浅绿填充',
    style: {
      color: '#22c55e',
      opacity: 0.2,
      outlineColor: '#22c55e',
      outlineWidth: 1,
    },
  },
];

/**
 * 三种几何类型的样式配置
 */
export const STYLE_CONFIGS: Record<GeometryType, GeometryStyleConfig> = {
  POINT: {
    type: 'POINT',
    presets: POINT_PRESETS,
    customControls: [
      'renderMode',
      'color',
      'opacity',
      'sizeUnit',
      'size',
      'symbol',
      'rotation',
      'labelText',
      'imageUpload',
    ],
    defaultStyle: {
      color: '#3b82f6',
      pointSize: 10,
      pointSizeUnit: 'pixels',
      opacity: 1,
      pointSymbol: 'circle',
      pointRenderMode: 'billboard',
      pointOutlineColor: '#ffffff',
      pointOutlineWidth: 0,
    },
  },
  LINESTRING: {
    type: 'LINESTRING',
    presets: LINE_PRESETS,
    customControls: ['color', 'opacity', 'width', 'lineType'],
    defaultStyle: {
      color: '#3b82f6',
      width: 2,
      opacity: 1,
      lineType: 'solid',
    },
  },
  POLYGON: {
    type: 'POLYGON',
    presets: POLYGON_PRESETS,
    customControls: ['color', 'opacity', 'outline'],
    defaultStyle: {
      color: '#3b82f6',
      opacity: 0.3,
      outlineColor: '#3b82f6',
      outlineWidth: 1,
    },
  },
  MULTI_POLYGON: {
    type: 'Polygon',
    presets: POLYGON_PRESETS,
    customControls: ['color', 'opacity', 'outline'],
    defaultStyle: {
      color: '#3b82f6',
      opacity: 0.3,
      outlineColor: '#3b82f6',
      outlineWidth: 1,
    },
  },
};

/**
 * 根据几何类型获取配置
 */
export function getStyleConfig(
  geometryType: GeometryType,
): GeometryStyleConfig {
  return STYLE_CONFIGS[geometryType];
}

/**
 * 尺寸单位选项
 */
export const SIZE_UNIT_OPTIONS = [
  { value: 'pixels', label: '像素' },
  { value: 'meters', label: '米' },
] as const;

/**
 * 点符号形状选项
 */
export const POINT_SYMBOL_OPTIONS = [
  { value: 'circle', label: '圆形' },
  { value: 'square', label: '方形' },
  { value: 'triangle', label: '三角形' },
  { value: 'star', label: '五角星' },
  { value: 'diamond', label: '菱形' },
  { value: 'cross', label: '十字形' },
] as const;

/**
 * 渲染模式选项
 */
export const POINT_RENDER_MODE_OPTIONS = [
  { value: 'point', label: '2D 点' },
  { value: 'billboard', label: '3D 广告牌' },
] as const;

/**
 * 线型选项
 */
export const LINE_TYPE_OPTIONS = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
] as const;
