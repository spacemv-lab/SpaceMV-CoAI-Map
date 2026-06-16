/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 项目状态管理 Hook
 *
 * 所有状态存储在数据库中，不使用 localStorage 缓存
 * 状态加载/保存通过 API 完成
 */
import { useState, useCallback } from 'react';
import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';

/**
 * API 层面的视口状态类型（与 map-core ViewportState 字段一致）
 */
interface ViewportState {
  center: [number, number];
  zoom: number;
  heading?: number;
  pitch?: number;
}

/**
 * Routing metadata for MVT/GeoJSON loading
 */
interface RoutingMetadata {
  datasetId: string;
  geometryType: string;
  geojsonUrl?: string;
  mvtUrlTemplate?: string;
  recordCount?: number;
  fileSize?: number;
  complexityLevel?: string;
  complexityScore?: number;
  bbox?: [number, number, number, number] | null;
}

interface LayerState {
  id: string;
  name: string;
  type: 'dataset' | 'draw' | 'basemap';
  visible: boolean;
  opacity: number;
  order: number;
  datasetId?: string; // 关联后端 Dataset ID (API字段名)
  geometryType?: 'POINT' | 'LINESTRING' | 'POLYGON' | 'MULTI_POINT' | 'MULTI_LINESTRING' | 'MULTI_POLYGON';
  geojson?: object;   // legacy field for draw layers
  data?: object;      // draw layer GeoJSON data
  style?: {
    color?: string;
    weight?: number;
    fillOpacity?: number;
  };
  routingMetadata?: RoutingMetadata; // MVT tile loading metadata
  fields?: Array<{
    name: string;
    type: string;
    alias?: string;
  }>; // 字段定义
}

interface ProjectState {
  viewport: ViewportState;
  basemap: string;
  layers: LayerState[];
  updatedAt: string | null;
}

export function useProjectState(projectId: string | null) {
  const [state, setState] = useState<ProjectState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear state when projectId changes to prevent stale data
  const clearState = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  const loadState = useCallback(async () => {
    if (!projectId) {
      setState(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await httpClient.get<ApiResponse<ProjectState>>(`/projects/${projectId}/state`);
      const data: ProjectState = response.data.data;
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const saveState = useCallback(async (newState: ProjectState) => {
    if (!projectId) return;

    try {
      await httpClient.put(`/projects/${projectId}/state`, newState);
    } catch (err) {
      console.warn('DB save failed:', err);
    }
  }, [projectId]);

  return { state, isLoading, error, loadState, saveState, clearState };
}
