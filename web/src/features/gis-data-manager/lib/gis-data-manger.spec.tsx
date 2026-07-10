/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import GisDataManger from './gis-data-manger';

vi.mock('./hooks/use-dataset-list', () => ({
  useDatasetList: () => ({
    datasets: [],
    total: 0,
    loading: false,
    error: null,
    fetchDatasets: vi.fn(),
  }),
}));

vi.mock('./api', () => ({
  statsApi: {
    getStorage: vi.fn().mockResolvedValue({
      totalSpace: 100,
      usedSpace: 0,
      usagePercent: 0,
      datasetCount: 0,
      featureCount: 0,
      fileStats: {
        totalFiles: 0,
        totalSize: 0,
      },
    }),
  },
  datasetApi: {
    delete: vi.fn(),
    getExternalVersions: vi.fn(),
  },
  tileSourceApi: {
    getCredential: vi.fn().mockResolvedValue({ token: null }),
    setCredential: vi.fn().mockResolvedValue(undefined),
    clearCredential: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./components/external-data-section', () => ({
  ExternalDataSection: () => null,
}));

describe('GisDataManger', () => {
  it('should render successfully', async () => {
    const { baseElement } = render(<GisDataManger />);
    expect(baseElement).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('全局数据广场')).toBeTruthy();
    });
  });
});
