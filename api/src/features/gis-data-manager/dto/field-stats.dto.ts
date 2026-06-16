/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 字段统计 DTO
 * 用于分级色彩渲染的字段统计 API
 */

/**
 * 分级方法类型（与前端 GraduatedConfig.method 保持一致）
 */
export type ClassificationMethod =
  | 'equal-interval'  // 等间距
  | 'quantile'        // 分位数
  | 'natural-breaks'; // 自然间断 (Jenks)

/**
 * 字段统计请求
 */
export class FieldStatsRequest {
  /** 字段名 */
  field: string;

  /** 分级方法 */
  method: ClassificationMethod;

  /** 类数 */
  classes: number;
}

/**
 * 字段统计响应
 */
export interface FieldStatsResponse {
  /** 字段名 */
  field: string;

  /** 最小值 */
  min: number;

  /** 最大值 */
  max: number;

  /** 平均值 */
  mean: number;

  /** 断点值（n+1 个点，包含 min 和 max） */
  breakpoints: number[];

  /** 统计时间（用于缓存判断） */
  computedAt: string;
}

/**
 * Redis 缓存键格式
 */
export function getFieldStatsCacheKey(
  datasetId: string,
  field: string,
  method: string,
  classes: number,
): string {
  return `field-stats:${datasetId}:${field}:${method}:${classes}`;
}