/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { MappingProfile } from '../types';

interface MappingListResponse {
  items: MappingProfile[];
}

const DEFAULT_RESPONSE: MappingListResponse = { items: [] };

/**
 * Mapping API Service
 */
export const mappingApi = {
  /**
   * 获取映射配置列表
   */
  async list(datasetId: string): Promise<MappingListResponse> {
    const response = await httpClient.get<ApiResponse<MappingListResponse>>(
      `/mappings?datasetId=${datasetId}`
    );
    return response.data.data ?? DEFAULT_RESPONSE;
  },

  /**
   * 创建映射配置
   */
  async create(data: Omit<MappingProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<MappingProfile> {
    const response = await httpClient.post<ApiResponse<MappingProfile>>(
      '/mappings',
      data
    );
    if (!response.data.data) {
      throw new Error('创建映射配置失败');
    }
    return response.data.data;
  },

  /**
   * 更新映射配置
   */
  async update(id: string, data: Partial<MappingProfile>): Promise<MappingProfile> {
    const response = await httpClient.patch<ApiResponse<MappingProfile>>(
      `/mappings/${id}`,
      data
    );
    if (!response.data.data) {
      throw new Error('更新映射配置失败');
    }
    return response.data.data;
  },

  /**
   * 删除映射配置
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/mappings/${id}`);
  },
};

export default mappingApi;
