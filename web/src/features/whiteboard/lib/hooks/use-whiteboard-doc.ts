/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 白板文档 加载/保存 Hook（手写 useState+useEffect，无 react-query，镜像 useProjectState）。
 */
import { useState, useCallback } from 'react';
import { whiteboardApi, type WhiteboardDocResponse } from '../api/whiteboard.api';

export function useWhiteboardDoc(projectId: string | null) {
  const [doc, setDoc] = useState<WhiteboardDocResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setDoc(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await whiteboardApi.get(projectId);
      setDoc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const save = useCallback(
    async (document: unknown) => {
      if (!projectId) return;
      await whiteboardApi.save(projectId, document);
    },
    [projectId]
  );

  return { doc, isLoading, error, load, save };
}
