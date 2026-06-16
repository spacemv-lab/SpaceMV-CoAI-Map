/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Feature detail API client
 * Used by FeaturePopup to fetch full element properties from backend
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { GeometryType } from '@prisma/client';

export interface FeatureDetailResponse {
  featureId: string;
  datasetId: string;
  properties: Record<string, unknown>;
}

/**
 * GeoJSON Feature with full geometry (for hover highlight)
 */
export interface FeatureGeoJSON {
  type: 'Feature';
  id: string;
  properties: Record<string, unknown>;
  geometry: Record<string, unknown> | null;
}

/**
 * Fetch full feature detail from backend
 * NOT from MVT tile (which only has clipped properties)
 */
export async function fetchFeatureDetail(
  datasetId: string,
  featureId: string,
): Promise<FeatureDetailResponse> {
  try {
    const response = await httpClient.get<ApiResponse<FeatureDetailResponse>>(
      `/datasets/${datasetId}/features/${featureId}`
    );
    return response.data.data!;
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error('要素未找到');
    }
    throw new Error('加载失败，请重试');
  }
}

/**
 * Fetch full GeoJSON feature geometry for hover highlight
 * Returns complete geometry, not just the clipped MVT tile fragment
 */
export async function fetchFeatureGeoJSON(
  datasetId: string,
  featureId: string,
  signal?: AbortSignal,
): Promise<FeatureGeoJSON | null> {
  try {
    const response = await httpClient.get<ApiResponse<FeatureGeoJSON>>(
      `/datasets/${datasetId}/features/${featureId}/geojson`,
      { signal }
    );
    return response.data.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Save edited feature geometry and properties to backend
 */
export async function saveFeatureGeometry(
  datasetId: string,
  featureId: string,
  geometry: Record<string, unknown>,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await httpClient.put(
      `/datasets/${datasetId}/features/${featureId}`,
      { geometry, properties }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error('要素未找到');
    }
    throw new Error(`保存失败`);
  }
}

/**
 * Delete feature from backend
 */
export async function deleteFeature(
  datasetId: string,
  featureId: string,
): Promise<void> {
  try {
    await httpClient.delete(`/datasets/${datasetId}/features/${featureId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new Error('要素未找到');
    }
    throw new Error(`删除失败`);
  }
}

// ============================================================================
// Dataset Style API
// ============================================================================

export interface CreateDatasetRequest {
  name: string;
  geometryType: GeometryType;
  projectId?: string;
  description?: string;
  style?: Record<string, unknown>;
  features: Array<{
    id: string;
    geometry: Record<string, unknown>;
    properties?: Record<string, unknown>;
  }>;
}

export interface CreateDatasetResponse {
  id: string;
  name: string;
  geometryType: GeometryType;
  style: Record<string, unknown>;
  routingMetadata: {
    datasetId: string;
    geometryType: GeometryType;
    bbox: [number, number, number, number];
    mvtUrlTemplate: string;
    recordCount: number;
  };
}

/**
 * Create dataset from drawn features
 */
export async function createDatasetWithFeatures(
  request: CreateDatasetRequest,
): Promise<CreateDatasetResponse> {
  try {
    const response = await httpClient.post<ApiResponse<CreateDatasetResponse>>(
      '/datasets',
      request,
    );
    return response.data.data!;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`创建数据集失败: ${error.message}`);
    }
    throw new Error('创建数据集失败');
  }
}

/**
 * Save dataset style configuration
 */
export async function saveDatasetStyle(
  datasetId: string,
  style: Record<string, unknown>,
): Promise<void> {
  try {
    await httpClient.put(`/datasets/${datasetId}/style`, style);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`样式保存失败: ${error.message}`);
    }
    throw new Error('样式保存失败');
  }
}

/**
 * Update dataset metadata (name, description, tags)
 */
export async function updateDataset(
  datasetId: string,
  data: { name?: string; description?: string; tags?: string[] },
): Promise<void> {
  await httpClient.put(`/datasets/${datasetId}`, data);
}

/**
 * Fetch dataset style configuration
 */
export async function fetchDatasetStyle(
  datasetId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await httpClient.get<ApiResponse<Record<string, unknown> | null>>(
      `/datasets/${datasetId}/style`,
    );
    return response.data.data ?? null;
  } catch {
    return null;
  }
}
