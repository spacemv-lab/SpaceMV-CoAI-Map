/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useState, useEffect, useCallback, useRef } from 'react';
import { IngestStatus, IngestStatusInfo } from '../types';

interface UseIngestStatusOptions {
  versionId: string | null;
  pollInterval?: number;
  autoStart?: boolean;
  stopOnComplete?: boolean;
}

interface UseIngestStatusResult {
  status: IngestStatus | null;
  statusInfo: IngestStatusInfo | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void;
  isComplete: boolean;
  isFailed: boolean;
}

const terminalStatuses: IngestStatus[] = ['SUCCESS', 'FAILED'];

export function useIngestStatus(
  options: UseIngestStatusOptions
): UseIngestStatusResult {
  const {
    versionId,
    pollInterval = 2000,
    autoStart = true,
    stopOnComplete = true,
  } = options;

  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [statusInfo, setStatusInfo] = useState<IngestStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const stopRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (!versionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/datasets/versions/${versionId}/status`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: IngestStatusInfo = await response.json();
      setStatusInfo(data);
      setStatus(data.status);

      // Stop polling if complete
      if (stopOnComplete && terminalStatuses.includes(data.status)) {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch status'));
    } finally {
      setLoading(false);
    }
  }, [versionId, stopOnComplete]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    stopRef.current = false;

    // Fetch immediately
    fetchStatus();

    // Then poll at interval
    pollingRef.current = setInterval(() => {
      if (!stopRef.current) {
        fetchStatus();
      }
    }, pollInterval);
  }, [fetchStatus, pollInterval]);

  const stopPolling = useCallback(() => {
    stopRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (autoStart && versionId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [autoStart, versionId, startPolling, stopPolling]);

  const isComplete = status === 'SUCCESS';
  const isFailed = status === 'FAILED';

  return {
    status,
    statusInfo,
    loading,
    error,
    refresh,
    stopPolling,
    startPolling,
    isComplete,
    isFailed,
  };
}
