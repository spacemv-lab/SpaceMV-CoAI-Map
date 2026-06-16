/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';

interface ExternalSource {
  id: string;
  name: string;
  type: 'ADS-B' | 'AIS';
  description: string;
  icon: 'plane' | 'ship';
  tag: string;
  externalId: string;
}

interface ExternalSourcesResponse {
  items: ExternalSource[];
}

const DEFAULT_RESPONSE: ExternalSourcesResponse = { items: [] };

/**
 * External Data API Service
 */
export const externalApi = {
  /**
   * 获取外部数据源列表
   */
  async listSources(): Promise<ExternalSourcesResponse> {
    const response = await httpClient.get<ApiResponse<ExternalSourcesResponse>>(
      '/datasets/external/sources'
    );
    return response.data.data ?? DEFAULT_RESPONSE;
  },
};

export default externalApi;
