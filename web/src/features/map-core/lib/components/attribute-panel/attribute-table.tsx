/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapStore } from '../../store/use-map-store';
import {
  CheckSquare,
  LocateFixed,
  PencilLine,
  Square,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  fetchFeaturesList,
  FeatureRow,
  FeaturesListResponse,
} from '../../api/dataset-api';

interface AttributeTableProps {
  layerId: string;
  selectedFeatureIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  filterFn?: ((feature: any) => boolean) | null;
}

interface EditingCell {
  featureId: string;
  fieldName: string;
  value: string;
}

interface ApiFetchState {
  rows: FeatureRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
}

export function AttributeTable({
  layerId,
  selectedFeatureIds,
  onSelectionChange,
  filterFn,
}: AttributeTableProps) {
  const layers = useMapStore((state) => state.layers);
  const selection = useMapStore((state) => state.selection);
  const setSelection = useMapStore((state) => state.setSelection);
  const updateLayerFeature = useMapStore((state) => state.updateLayerFeature);
  const deleteLayerFeatures = useMapStore((state) => state.deleteLayerFeatures);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // API 数据源状态（用于 MVT 瓦片图层）
  const [apiState, setApiState] = useState<ApiFetchState>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 50,
    totalPages: 0,
    isLoading: false,
    error: null,
  });

  const layer = layers.find((item) => item.id === layerId);
  const fields = layer?.fields || [];

  // 判断数据来源
  const hasLocalData = layer?.data?.features?.length > 0;
  const datasetId = layer?.sourceId;

  // 从 API 获取数据（MVT 瓦片图层）
  useEffect(() => {
    if (hasLocalData || !datasetId) return;

    setApiState((s) => ({ ...s, isLoading: true, error: null }));

    fetchFeaturesList(datasetId, apiState.page, apiState.pageSize)
      .then((result) => {
        setApiState({
          rows: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        setApiState((s) => ({
          ...s,
          isLoading: false,
          error: err.message,
        }));
      });
  }, [datasetId, hasLocalData, apiState.page, apiState.pageSize]);

  // 分页控制（仅 API 模式）
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= apiState.totalPages) {
      setApiState((s) => ({ ...s, page: newPage }));
    }
  };

  // 统一数据源（本地或 API）
  const displayFeatures = useMemo(() => {
    if (hasLocalData) {
      // 本地数据：应用搜索过滤
      const features = layer?.data?.features || [];
      const keyword = searchTerm.trim().toLowerCase();

      return features.filter((feature) => {
        if (filterFn && !filterFn(feature)) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return Object.values(feature.properties || {}).some((value) =>
          String(value ?? '').toLowerCase().includes(keyword),
        );
      });
    } else {
      // API 数据：直接使用（搜索需后端支持，暂未实现）
      return apiState.rows.map((row) => ({
        id: row.id,
        properties: row.properties,
        geometry: null,
      }));
    }
  }, [hasLocalData, layer?.data?.features, searchTerm, filterFn, apiState.rows]);

  const totalCount = hasLocalData
    ? (layer?.data?.features?.length || 0)
    : apiState.total;

  useEffect(() => {
    if (selection?.layerId !== layerId || !selection.featureId) {
      return;
    }

    rowRefs.current[selection.featureId]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [layerId, selection]);

  const handleToggleAll = () => {
    if (selectedFeatureIds.size === displayFeatures.length) {
      onSelectionChange(new Set());
      return;
    }

    onSelectionChange(new Set(displayFeatures.map((feature) => feature.id)));
  };

  const handleToggleFeature = (featureId: string) => {
    const next = new Set(selectedFeatureIds);
    if (next.has(featureId)) {
      next.delete(featureId);
    } else {
      next.add(featureId);
    }
    onSelectionChange(next);
  };

  const handleSaveCell = () => {
    if (!editingCell) {
      return;
    }

    updateLayerFeature(layerId, editingCell.featureId, {
      [editingCell.fieldName]: editingCell.value,
    });
    setEditingCell(null);
  };

  if (!layer) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
        <input
          type="text"
          placeholder="搜索属性值..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        {selectedFeatureIds.size > 0 && (
          <button
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
            onClick={() =>
              deleteLayerFeatures(layerId, Array.from(selectedFeatureIds))
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除选中
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <button onClick={handleToggleAll}>
                  {displayFeatures.length > 0 &&
                  selectedFeatureIds.size === displayFeatures.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="w-28 px-3 py-2">要素ID</th>
              {fields.map((field) => (
                <th key={field.name} className="min-w-[160px] px-3 py-2">
                  <div className="flex flex-col">
                    <span>{field.alias || field.name}</span>
                    <span className="normal-case text-[10px] text-slate-400">
                      {field.name}
                    </span>
                  </div>
                </th>
              ))}
              <th className="w-32 px-3 py-2">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {displayFeatures.map((feature) => {
              const isSelected = selectedFeatureIds.has(feature.id);
              const isFocused =
                selection?.layerId === layerId && selection.featureId === feature.id;

              return (
                <tr
                  key={feature.id}
                  ref={(node) => {
                    rowRefs.current[feature.id] = node;
                  }}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    isSelected ? 'bg-blue-50' : ''
                  } ${isFocused ? 'ring-2 ring-inset ring-emerald-500' : ''}`}
                  onClick={() =>
                    setSelection({
                      layerId,
                      featureId: feature.id,
                      properties: feature.properties || {},
                    })
                  }
                >
                  <td className="px-3 py-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleFeature(feature.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {feature.id.slice(0, 12)}
                  </td>

                  {fields.map((field) => {
                    const cellKey = `${feature.id}:${field.name}`;
                    const isEditing =
                      editingCell?.featureId === feature.id &&
                      editingCell.fieldName === field.name;

                    return (
                      <td
                        key={cellKey}
                        className="max-w-[240px] px-3 py-2 text-slate-700"
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setEditingCell({
                            featureId: feature.id,
                            fieldName: field.name,
                            value: String(feature.properties?.[field.name] ?? ''),
                          });
                        }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingCell.value}
                            onChange={(event) =>
                              setEditingCell({
                                ...editingCell,
                                value: event.target.value,
                              })
                            }
                            onBlur={handleSaveCell}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                handleSaveCell();
                              }
                              if (event.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                          />
                        ) : (
                          <button className="flex w-full items-center gap-1 truncate text-left hover:text-slate-950">
                            <PencilLine className="h-3 w-3 shrink-0 text-slate-300" />
                            <span className="truncate">
                              {String(feature.properties?.[field.name] ?? '') || '-'}
                            </span>
                          </button>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="定位到要素"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelection({
                            layerId,
                            featureId: feature.id,
                            properties: feature.properties || {},
                          });
                        }}
                      >
                        <LocateFixed className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-1 text-rose-500 hover:bg-rose-50"
                        title="删除要素"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteLayerFeatures(layerId, [feature.id]);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {displayFeatures.length === 0 && !apiState.isLoading && (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-400">
            {apiState.error ? `加载失败: ${apiState.error}` : '暂无匹配记录'}
          </div>
        )}

        {/* Loading 状态 */}
        {apiState.isLoading && (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-500">
            加载中...
          </div>
        )}
      </div>

      {/* 分页控制（仅 API 模式） */}
      {!hasLocalData && apiState.totalPages > 1 && (
        <div className="flex items-center justify-between border-t bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">
            第 {apiState.page} / {apiState.totalPages} 页，共 {apiState.total} 条
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handlePageChange(apiState.page - 1)}
              disabled={apiState.page <= 1}
              className="p-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(apiState.page + 1)}
              disabled={apiState.page >= apiState.totalPages}
              className="p-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 统计栏 */}
      <div className="flex items-center justify-between border-t bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>记录数 {totalCount}</span>
        <span>选中 {selectedFeatureIds.size}</span>
        <span>字段数 {fields.length}</span>
      </div>
    </div>
  );
}
