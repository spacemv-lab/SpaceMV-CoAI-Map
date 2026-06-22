/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { MapArea, useMapStore } from '@/features/map-core';
import { httpClient, type ApiResponse } from '@txwx-monorepo/api-client';

/**
 * 公开分享页（只读地图）
 *
 * - 顶层路由（与 /login 同级，不受 ProtectedRoute 保护），匿名可访问
 * - 通过 token 解析单个项目的实时视图，写入 map store 后渲染只读 MapArea
 * - 强制 MapLibre；不渲染右侧面板 / 工具栏；不调用任何写入接口（无 PUT /projects/:id/state）
 */

interface PublicShareView {
  project: { id: string; name: string };
  state: {
    viewport: { center: [number, number]; zoom: number; heading?: number; pitch?: number };
    basemap: string;
    layers: Array<Record<string, unknown>>;
    updatedAt: string | null;
  };
}

type Status = 'loading' | 'ready' | 'unavailable';

export default function SharePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');

  const setExperimental = useMapStore((s) => s.setExperimental);
  const setReadOnly = useMapStore((s) => s.setReadOnly);
  const resetProjectUIState = useMapStore((s) => s.resetProjectUIState);
  const setCurrentProjectId = useMapStore((s) => s.setCurrentProjectId);
  const setCurrentProjectName = useMapStore((s) => s.setCurrentProjectName);
  const setViewport = useMapStore((s) => s.setViewport);
  const setBasemap = useMapStore((s) => s.setBasemap);
  const setLayers = useMapStore((s) => s.setLayers);

  useEffect(() => {
    // 强制 MapLibre：更轻量、对 iframe / WebView 友好，无 /cesium 静态资源依赖
    setExperimental({ useMaplibre: true });
    // 先 reset（其内部会把 readOnly 重置为 false），再置只读；
    // 顺序不能反——否则 reset 会把 readOnly 覆盖回 false，导致自动保存照常触发 401。
    resetProjectUIState();
    setReadOnly(true);

    let cancelled = false;
    (async () => {
      try {
        const res = await httpClient.get<ApiResponse<PublicShareView>>(
          `/public/share/${token}`,
        );
        if (cancelled) return;
        const view = res.data.data;
        setCurrentProjectId(view.project.id);
        setCurrentProjectName(view.project.name);
        if (view.state.viewport) setViewport(view.state.viewport);
        if (view.state.basemap) setBasemap(view.state.basemap);
        setLayers(normalizeLayers(view.state.layers));
        setStatus('ready');
      } catch {
        // 未知 / 已撤销 / 已过期 / 项目已删除 → 统一展示不可用，不泄露原因
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    token,
    setExperimental,
    setReadOnly,
    resetProjectUIState,
    setCurrentProjectId,
    setCurrentProjectName,
    setViewport,
    setBasemap,
    setLayers,
  ]);

  if (status === 'loading') {
    return <Centered>地图加载中…</Centered>;
  }

  if (status === 'unavailable') {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">此地图已不可用</p>
          <p className="text-sm text-gray-500 mt-1">
            分享链接可能已被撤销、过期或删除。
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      <MapArea readOnly />
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * 将 API 图层格式归一化为前端 store 格式。
 * 与 pages/home/Index.tsx 的映射保持一致，确保公开视图与编辑器视图同源。
 */
function normalizeLayers(layers: Array<Record<string, any>>) {
  return (layers || []).map((layer) => {
    const frontendType = (
      layer.type === 'dataset' || layer.type === 'GeoJSON'
        ? 'GeoJSON'
        : layer.type === 'draw' || layer.type === 'Draw'
        ? 'Draw'
        : 'Tile'
    ) as 'GeoJSON' | 'Draw' | 'Tile';
    const effectiveSourceId = layer.datasetId || layer.sourceId;
    const layerData =
      layer.data || layer.geojson || { type: 'FeatureCollection', features: [] };
    return {
      id: layer.id,
      name: layer.name,
      type: frontendType,
      visible: layer.visible,
      opacity: layer.opacity,
      style: layer.style || {},
      data: layerData,
      geometryType: layer.geometryType,
      sourceId: effectiveSourceId,
      routingMetadata: layer.routingMetadata,
      fields: layer.fields,
    };
  });
}
