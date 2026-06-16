/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { StorageStats } from '../types';

const DEFAULT_STATS: StorageStats = {
  totalSpace: 100 * 1024 * 1024,
  usedSpace: 0,
  usagePercent: 0,
  datasetCount: 0,
  featureCount: 0,
  fileStats: {
    totalFiles: 0,
    totalSize: 0,
  },
};

/**
 * Stats API Service
 */
export const statsApi = {
  /**
   * 获取存储统计
   */
  async getStorage(): Promise<StorageStats> {
    const response = await httpClient.get<ApiResponse<StorageStats>>('/stats/storage');
    return response.data.data ?? DEFAULT_STATS;
  },
};

export default statsApi;
