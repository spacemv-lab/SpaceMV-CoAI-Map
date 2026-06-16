/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 分级样式类型定义
 */

/**
 * 分级方法类型
 */
export type ClassificationMethod =
  | 'equal-interval'  // 等间距
  | 'quantile'        // 分位数
  | 'natural-breaks'; // 自然间断 (Jenks)

/**
 * 渲染类型
 */
export type RenderingType = 'simple' | 'graduated';

/**
 * 分级色彩配置
 */
export interface GraduatedConfig {
  /** 分类字段（数值型） */
  field: string;
  /** 分级方法 */
  method: ClassificationMethod;
  /** 类数 (3-10) */
  classes: number;
  /** 色阶预设 ID */
  colorRamp: string;
  /** 断点值（前端计算或后端返回） */
  breakpoints?: number[];
  /** 字段统计信息（用于显示 min/max） */
  fieldStats?: {
    min: number;
    max: number;
    mean?: number;
  };
}

/**
 * 分级图例项
 */
export interface GraduatedLegendItem {
  color: string;
  minValue: number;
  maxValue: number;
  label: string;
}