/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { Dataset, DatasetScope, DatasetVersion, IngestStatusInfo } from '../types';

interface DatasetListParams {
  projectId?: string | null;
  scope?: DatasetScope;
  keyword?: string;
  skip?: number;
  take?: number;
}

interface DatasetListResponse {
  items: Dataset[];
  total: number;
}

interface DatasetVersionsResponse {
  versions: DatasetVersion[];
}

interface UploadResult {
  datasetId: string;
  versionId: string;
  jobId: string;
  status: string;
  message: string;
}

const DEFAULT_LIST_RESPONSE: DatasetListResponse = { items: [], total: 0 };
const DEFAULT_VERSIONS_RESPONSE: DatasetVersionsResponse = { versions: [] };

/**
 * Dataset API Service
 */
export const datasetApi = {
  /**
   * 获取数据集列表
   */
  async list(params: DatasetListParams): Promise<DatasetListResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('skip', String(params.skip ?? 0));
    queryParams.append('take', String(params.take ?? 10));

    if (params.scope) {
      queryParams.append('scope', params.scope);
    }
    if (params.projectId) {
      queryParams.append('projectId', params.projectId);
    }
    if (params.keyword) {
      queryParams.append('keyword', params.keyword);
    }

    const response = await httpClient.get<ApiResponse<DatasetListResponse>>(
      `/datasets?${queryParams.toString()}`
    );
    return response.data.data ?? DEFAULT_LIST_RESPONSE;
  },

  /**
   * 删除数据集
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/datasets/${id}`);
  },

  /**
   * 获取外部数据源版本列表
   */
  async getExternalVersions(externalId: string): Promise<DatasetVersionsResponse> {
    const response = await httpClient.get<ApiResponse<DatasetVersionsResponse>>(
      `/datasets/external/${externalId}/versions`
    );
    return response.data.data ?? DEFAULT_VERSIONS_RESPONSE;
  },

  /**
   * 获取版本状态
   */
  async getVersionStatus(versionId: string): Promise<IngestStatusInfo> {
    const response = await httpClient.get<ApiResponse<IngestStatusInfo>>(
      `/datasets/versions/${versionId}/status`
    );
    if (!response.data.data) {
      throw new Error('版本状态不存在');
    }
    return response.data.data;
  },

  /**
   * 上传数据集
   */
  async upload(formData: FormData): Promise<UploadResult> {
    const response = await httpClient.post<ApiResponse<UploadResult>>(
      '/datasets/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    if (!response.data.data) {
      throw new Error('上传失败');
    }
    return response.data.data;
  },
};

export default datasetApi;
