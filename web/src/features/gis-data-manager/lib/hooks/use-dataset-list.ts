/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useEffect, useCallback } from 'react';
import { Dataset, DatasetScope } from '../types';
import { datasetApi } from '../api/dataset.api';

interface UseDatasetListOptions {
  projectId?: string | null;
  scope?: DatasetScope;
  keyword?: string;
  skip?: number;
  take?: number;
  autoFetch?: boolean;
}

interface UseDatasetListResult {
  datasets: Dataset[];
  total: number;
  loading: boolean;
  error: Error | null;
  fetchDatasets: () => Promise<void>;
}

export function useDatasetList(
  options: UseDatasetListOptions = {}
): UseDatasetListResult {
  const {
    projectId,
    scope,
    keyword,
    skip = 0,
    take = 10,
    autoFetch = true,
  } = options;

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await datasetApi.list({
        projectId,
        scope,
        keyword,
        skip,
        take,
      });
      setDatasets(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [projectId, scope, keyword, skip, take]);

  useEffect(() => {
    if (autoFetch) {
      fetchDatasets();
    }
  }, [autoFetch, fetchDatasets]);

  return {
    datasets,
    total,
    loading,
    error,
    fetchDatasets,
  };
}