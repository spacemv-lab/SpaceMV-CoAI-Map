/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient } from '@txwx-monorepo/api-client';
import { fetchFeatureDetail } from './feature-api';

jest.mock('@txwx-monorepo/api-client', () => ({
  httpClient: {
    get: jest.fn(),
  },
}));

describe('fetchFeatureDetail', () => {
  const mockedHttpClient = jest.mocked(httpClient);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return feature detail on 200 response', async () => {
    const mockData = {
      featureId: '123',
      datasetId: 'ds-1',
      properties: { name: 'Test', area: 1000 },
    };
    mockedHttpClient.get.mockResolvedValue({
      data: {
        data: mockData,
      },
    } as Awaited<ReturnType<typeof httpClient.get>>);

    const result = await fetchFeatureDetail('ds-1', '123');
    expect(result).toEqual(mockData);
    expect(mockedHttpClient.get).toHaveBeenCalledWith(
      '/datasets/ds-1/features/123',
    );
  });

  it('should throw "要素未找到" on not found error', async () => {
    mockedHttpClient.get.mockRejectedValue(new Error('feature not found'));

    await expect(fetchFeatureDetail('ds-1', '999')).rejects.toThrow('要素未找到');
  });

  it('should throw "加载失败，请重试" on generic error', async () => {
    mockedHttpClient.get.mockRejectedValue(new Error('boom'));

    await expect(fetchFeatureDetail('ds-1', '123')).rejects.toThrow(
      '加载失败，请重试',
    );
  });
});
