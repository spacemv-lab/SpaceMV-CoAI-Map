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

/**
 * 往已有数据集当前版本新增单个要素（绘制入已保存/MVT 图层）。
 * 成功后由调用方触发 MVT 瓦片重载以即时显示。
 */
export async function createDatasetFeature(
  datasetId: string,
  feature: {
    id: string;
    geometry: Record<string, unknown>;
    properties?: Record<string, unknown>;
  },
): Promise<{ featureId: string }> {
  const response = await httpClient.post<ApiResponse<{ featureId: string }>>(
    `/datasets/${datasetId}/features`,
    {
      id: feature.id,
      geometry: feature.geometry,
      properties: feature.properties,
    },
  );
  return response.data.data!;
}

/**
 * 仅更新要素属性（不动几何），整份 properties 替换。
 * 供属性表单元格编辑：传入合并后的完整 properties。
 */
export async function updateFeatureProperties(
  datasetId: string,
  featureId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  await httpClient.patch(
    `/datasets/${datasetId}/features/${featureId}/properties`,
    { properties },
  );
}

/**
 * 上传要素属性图片 → 存 MinIO → 返回 objectKey 与下载代理 URL。
 * properties[imageFieldName] 存 objectKey；渲染时用 url 直接 <img src>。
 */
export async function uploadDatasetImage(
  datasetId: string,
  file: File,
): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const response = await httpClient.post<ApiResponse<{ key: string; url: string }>>(
    `/datasets/${datasetId}/images`,
    form,
    {
      // httpClient 默认 Content-Type: application/json，浏览器会尊重该显式头、
      // 不为 FormData 自动改 multipart → multer 不解析、file 没到 → 400。
      // 显式设 multipart（同 dataset.api.upload / tile-source.api.uploadCog 的做法）。
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  return response.data.data!;
}

export interface DatasetFieldInput {
  name: string;
  alias?: string;
  type?: string;
  nullable?: boolean;
  defaultValue?: unknown;
}

/** 新增数据集字段（写 schema + 给现有要素补默认值） */
export async function addDatasetField(
  datasetId: string,
  field: DatasetFieldInput,
): Promise<void> {
  await httpClient.post(`/datasets/${datasetId}/fields`, field);
}

/** 更新数据集字段（别名/类型/可空；改名会同步要素 properties 的 key） */
export async function updateDatasetField(
  datasetId: string,
  fieldName: string,
  updates: {
    name?: string;
    alias?: string;
    type?: string;
    nullable?: boolean;
  },
): Promise<void> {
  await httpClient.patch(
    `/datasets/${datasetId}/fields/${encodeURIComponent(fieldName)}`,
    updates,
  );
}

/** 删除数据集字段（删 schema + 移除要素 properties 的 key） */
export async function removeDatasetField(
  datasetId: string,
  fieldName: string,
): Promise<void> {
  await httpClient.delete(
    `/datasets/${datasetId}/fields/${encodeURIComponent(fieldName)}`,
  );
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
  // 路由字段由后端 buildDatasetRoutingSummary 平铺在响应顶层（非 routingMetadata 嵌套）
  datasetId: string;
  bbox: [number, number, number, number];
  mvtUrlTemplate: string;
  recordCount: number;
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
