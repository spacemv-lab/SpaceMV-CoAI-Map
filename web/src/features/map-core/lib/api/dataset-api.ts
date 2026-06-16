/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Dataset API client for map-core
 * Provides functions to fetch dataset metadata and features list
 */

import { httpClient } from '@txwx-monorepo/api-client';

export interface FeatureRow {
  id: string;
  properties: Record<string, unknown>;
}

export interface FeaturesListResponse {
  items: FeatureRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 从后端获取要素列表（用于 MVT 瓦片图层的属性表）
 * 使用 httpClient 自动携带认证信息
 */
export async function fetchFeaturesList(
  datasetId: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<FeaturesListResponse> {
  const response = await httpClient.get(`/datasets/${datasetId}/features`, {
    params: { page, pageSize },
  });

  // httpClient 返回的数据格式是 { code, data, msg }
  return response.data.data;
}