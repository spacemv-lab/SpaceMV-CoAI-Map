/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Field Stats API client for map-core
 * Provides functions to fetch field statistics for graduated colors rendering
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { ClassificationMethod } from '../types/graduated-style';

/**
 * 字段统计请求
 */
export interface FieldStatsRequest {
  field: string;
  method: ClassificationMethod;
  classes: number;
}

/**
 * 字段统计响应
 */
export interface FieldStatsResponse {
  field: string;
  min: number;
  max: number;
  mean: number;
  breakpoints: number[];
  computedAt: string;
}

/**
 * 调用后端字段统计 API
 * 使用 httpClient 自动携带认证信息
 */
export async function fetchFieldStats(
  datasetId: string,
  request: FieldStatsRequest,
): Promise<FieldStatsResponse> {
  try {
    const response = await httpClient.post<ApiResponse<FieldStatsResponse>>(
      `/datasets/${datasetId}/field-stats`,
      request,
    );
    return response.data.data!;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`字段统计失败: ${error.message}`);
    }
    throw new Error('字段统计失败，请稍后重试');
  }
}