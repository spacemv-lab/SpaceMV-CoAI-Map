/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useMapStore } from '../../store/use-map-store';
import {
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  ListChecks,
  Loader2,
  LocateFixed,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchFeaturesList, FeatureRow } from '../../api/dataset-api';
import {
  fetchFeatureGeoJSON,
  updateFeatureProperties,
  uploadDatasetImage,
} from '@/features/gis-data-manager/feature-api';
import { flyToGeometry } from '../../utils/fly-to-feature';
import { FilterBar } from './filter-bar';
import { PropertyValueRenderer } from '../property-value-renderer';

interface AttributeTableProps {
  layerId: string;
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

type SortDirection = 'asc' | 'desc';
interface SortState {
  field: string | null; // '__id' 表示按要素ID排序
  direction: SortDirection;
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === '';

/** 数值按数值比、其余按字符串 localeCompare；调用方负责把空值挪到末尾 */
function compareValues(a: unknown, b: unknown): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }
  return String(a).localeCompare(String(b));
}

/** 单要素排序比较：空值恒在末尾，再按方向正/反 */
function compareFeatures(
  a: { id: string; properties?: Record<string, unknown> },
  b: { id: string; properties?: Record<string, unknown> },
  sort: { field: string; direction: SortDirection },
): number {
  const av = sort.field === '__id' ? a.id : a.properties?.[sort.field];
  const bv = sort.field === '__id' ? b.id : b.properties?.[sort.field];
  const aEmpty = isEmpty(av);
  const bEmpty = isEmpty(bv);
  if (aEmpty !== bEmpty) {
    return aEmpty ? 1 : -1; // 空值始终排末尾，不受升降序影响
  }
  const base = compareValues(av, bv);
  return sort.direction === 'asc' ? base : -base;
}

export function AttributeTable({ layerId }: AttributeTableProps) {
  const layers = useMapStore((state) => state.layers);
  const selection = useMapStore((state) => state.selection);
  const setSelection = useMapStore((state) => state.setSelection);
  const updateLayerFeature = useMapStore((state) => state.updateLayerFeature);
  const deleteLayerFeatures = useMapStore((state) => state.deleteLayerFeatures);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [uploadingCell, setUploadingCell] = useState<string | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [filterFn, setFilterFn] = useState<((feature: any) => boolean) | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState<SortState>({ field: null, direction: 'asc' });
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageRef = useRef<{ featureId: string; fieldName: string } | null>(null);

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

  // 切图层时重置本地态
  useEffect(() => {
    setSelectedFeatureIds(new Set());
    setFilterFn(null);
    setFilterOpen(false);
    setEditingCell(null);
    setSort({ field: null, direction: 'asc' });
    setShowSelectedOnly(false);
  }, [layerId]);

  // 选中清空时自动关闭"仅显示选中"，避免显示空表
  useEffect(() => {
    if (selectedFeatureIds.size === 0) {
      setShowSelectedOnly(false);
    }
  }, [selectedFeatureIds]);

  // 统一数据源（本地或 API），仅显示选中 / 筛选 / 搜索 / 排序 一视同仁
  // 注：API/MVT 图层为分页加载，这些操作作用于“当前已加载页”，全量需服务端支持
  const displayFeatures = useMemo(() => {
    // 本地 = 图层要素（带几何）；API/MVT = 当前页 rows（无几何）
    const sourceRows = hasLocalData
      ? (layer?.data?.features ?? [])
      : apiState.rows.map((row) => ({
          id: row.id,
          properties: row.properties,
          geometry: null,
        }));

    const keyword = searchTerm.trim().toLowerCase();

    const filtered = sourceRows.filter((feature) => {
      if (showSelectedOnly && !selectedFeatureIds.has(feature.id)) {
        return false;
      }
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

    if (!sort.field) {
      return filtered;
    }
    return [...filtered].sort((a, b) =>
      compareFeatures(a, b, { field: sort.field, direction: sort.direction }),
    );
  }, [
    hasLocalData,
    layer?.data?.features,
    apiState.rows,
    searchTerm,
    filterFn,
    showSelectedOnly,
    selectedFeatureIds,
    sort,
  ]);

  const totalCount = hasLocalData
    ? layer?.data?.features?.length || 0
    : apiState.total;

  const filterActive = filterFn !== null;
  const isFiltering =
    filterActive || searchTerm.trim().length > 0 || showSelectedOnly;

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
      setSelectedFeatureIds(new Set());
      return;
    }
    setSelectedFeatureIds(new Set(displayFeatures.map((feature) => feature.id)));
  };

  const handleToggleFeature = (featureId: string) => {
    setSelectedFeatureIds((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      return next;
    });
  };

  const handleSaveCell = async () => {
    const cell = editingCell;
    if (!cell) {
      return;
    }
    // 立即清空，避免 Enter + blur 双触发重复保存
    setEditingCell(null);

    const { featureId, fieldName, value } = cell;
    if (datasetId) {
      // API/MVT 图层：合并单元格进整份 properties → 写后端 → 更新本地页数据
      const row = apiState.rows.find((item) => item.id === featureId);
      const merged = { ...(row?.properties || {}), [fieldName]: value };
      try {
        await updateFeatureProperties(datasetId, featureId, merged);
        setApiState((s) => ({
          ...s,
          rows: s.rows.map((item) =>
            item.id === featureId ? { ...item, properties: merged } : item,
          ),
        }));
      } catch {
        toast.error('保存失败，请重试');
      }
    } else {
      // 本地图层：直接改 store
      updateLayerFeature(layerId, featureId, { [fieldName]: value });
    }
  };

  // image 字段：上传图片到 MinIO → objectKey 写进该要素 properties（复用保存链路）
  const handleUploadImage = async (featureId: string, fieldName: string, file: File) => {
    if (!datasetId) {
      toast.error('该图层无数据源，无法上传');
      return;
    }
    setUploadingCell(`${featureId}:${fieldName}`);
    try {
      const { key } = await uploadDatasetImage(datasetId, file);
      if (hasLocalData) {
        updateLayerFeature(layerId, featureId, { [fieldName]: key });
      } else {
        const row = apiState.rows.find((item) => item.id === featureId);
        const merged = { ...(row?.properties || {}), [fieldName]: key };
        await updateFeatureProperties(datasetId, featureId, merged);
        setApiState((s) => ({
          ...s,
          rows: s.rows.map((item) =>
            item.id === featureId ? { ...item, properties: merged } : item,
          ),
        }));
      }
      toast.success('图片已上传');
    } catch {
      toast.error('上传失败');
    } finally {
      setUploadingCell(null);
    }
  };

  // 共用一个隐藏 file input：双击 image 单元格时记下目标，选完文件触发上传
  const handleFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingImageRef.current;
    pendingImageRef.current = null;
    e.target.value = '';
    if (!file || !pending) return;
    await handleUploadImage(pending.featureId, pending.fieldName, file);
  };

  // 点表头切换排序：同列升降序切换，换列从升序开始
  const handleSortClick = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
  };

  // 把 filter 函数正确地存进 state（避免 React 把它当 updater 调用）；null 表示无筛选
  const handleFilterChange = (fn: ((feature: any) => boolean) | null) => {
    setFilterFn(fn === null ? null : () => fn);
  };

  // 定位到要素：本地有几何直接飞；API/MVT 行无几何 → 按 featureId 向后端取完整几何再飞
  const handleLocate = (feature: {
    id: string;
    properties?: Record<string, unknown>;
    geometry?: unknown;
  }) => {
    setSelection({
      layerId,
      featureId: feature.id,
      properties: feature.properties || {},
    });
    if (feature.geometry) {
      flyToGeometry(feature.geometry);
      return;
    }
    if (!datasetId) {
      toast.warning('该要素无几何信息，无法定位');
      return;
    }
    fetchFeatureGeoJSON(datasetId, feature.id)
      .then((geo) => {
        if (geo?.geometry) {
          flyToGeometry(geo.geometry);
        } else {
          toast.warning('该要素无几何信息，无法定位');
        }
      })
      .catch(() => toast.warning('该要素无几何信息，无法定位'));
  };

  if (!layer) {
    return null;
  }

  const allSelected =
    displayFeatures.length > 0 && selectedFeatureIds.size === displayFeatures.length;

  const renderSortIcon = (field: string) =>
    sort.field === field &&
    (sort.direction === 'asc' ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    ));

  return (
    <div className="flex h-full flex-col">
      {/* 单一工具条：搜索 + 筛选 popover + 仅显示选中 + 选中删除 */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索属性值..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((value) => !value)}
            className={`relative inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              filterActive
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="结构化筛选"
          >
            <Filter className="h-3.5 w-3.5" />
            筛选
            {filterActive && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white bg-blue-500" />
            )}
          </button>

          {filterOpen && (
            <>
              {/* 点击外部关闭 */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setFilterOpen(false)}
              />
              <div className="absolute bottom-full right-0 z-40 mb-2 max-h-[60vh] w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                <FilterBar
                  layerId={layerId}
                  onFilterChange={handleFilterChange}
                  onApplied={() => setFilterOpen(false)}
                />
              </div>
            </>
          )}
        </div>

        {selectedFeatureIds.size > 0 && (
          <button
            type="button"
            onClick={() => setShowSelectedOnly((value) => !value)}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
              showSelectedOnly
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="仅显示选中的要素"
          >
            <ListChecks className="h-3.5 w-3.5" />
            仅显示选中
          </button>
        )}

        {selectedFeatureIds.size > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1.5 text-xs text-rose-600 transition-colors hover:bg-rose-50"
            onClick={() =>
              deleteLayerFeatures(layerId, Array.from(selectedFeatureIds))
            }
            title="删除选中要素"
          >
            <Trash2 className="h-3.5 w-3.5" />
            删除选中({selectedFeatureIds.size})
          </button>
        )}
      </div>

      {/* image 字段共用的隐藏文件选择器（双击 image 单元格触发） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFilePicked}
      />

      {/* 表格 */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="w-20 px-3 py-2">
                <button type="button" onClick={handleToggleAll} title="全选/取消">
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-slate-600" />
                  ) : (
                    <Square className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </th>
              <th className="w-24 px-3 py-2 font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  onClick={() => handleSortClick('__id')}
                >
                  要素ID
                  {renderSortIcon('__id')}
                </button>
              </th>
              {fields.map((field) => (
                <th key={field.name} className="min-w-[140px] px-3 py-2 font-medium">
                  <button
                    type="button"
                    className="flex flex-col text-left hover:text-slate-900"
                    onClick={() => handleSortClick(field.name)}
                  >
                    <span className="flex items-center gap-1 text-slate-600">
                      {field.alias || field.name}
                      {renderSortIcon(field.name)}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      {field.name}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
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
                  className={`cursor-pointer ${
                    isFocused ? 'ring-2 ring-inset ring-emerald-500' : ''
                  } ${
                    isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() =>
                    setSelection({
                      layerId,
                      featureId: feature.id,
                      properties: feature.properties || {},
                    })
                  }
                >
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleFeature(feature.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        title="定位到要素"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleLocate(feature);
                        }}
                      >
                        <LocateFixed className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-400">
                    {feature.id.slice(0, 8)}
                  </td>

                  {fields.map((field) => {
                    const cellKey = `${feature.id}:${field.name}`;
                    const isEditing =
                      editingCell?.featureId === feature.id &&
                      editingCell.fieldName === field.name;
                    const isImage = field.type === 'image';
                    const isUploading = uploadingCell === cellKey;
                    const rawValue = feature.properties?.[field.name];

                    return (
                      <td
                        key={cellKey}
                        title={isImage ? '双击上传图片' : '双击编辑'}
                        className="max-w-[220px] cursor-text px-3 py-1.5 text-slate-700"
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          if (isImage) {
                            // image 字段双击 → 触发共用文件选择器（不经文本编辑态）
                            pendingImageRef.current = {
                              featureId: feature.id,
                              fieldName: field.name,
                            };
                            fileInputRef.current?.click();
                            return;
                          }
                          setEditingCell({
                            featureId: feature.id,
                            fieldName: field.name,
                            value: String(rawValue ?? ''),
                          });
                        }}
                      >
                        {isImage ? (
                          isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          ) : isEmpty(rawValue) ? (
                            <span className="text-slate-300">双击上传</span>
                          ) : datasetId ? (
                            <PropertyValueRenderer
                              value={rawValue}
                              type="image"
                              datasetId={datasetId}
                              imgClassName="h-6 w-6 object-cover rounded"
                            />
                          ) : (
                            <span className="block truncate">{String(rawValue)}</span>
                          )
                        ) : isEditing ? (
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
                            className="w-full rounded border border-slate-300 px-2 py-0.5 text-sm outline-none focus:border-slate-500"
                          />
                        ) : (
                          <span className="block truncate">
                            {String(rawValue ?? '') || '-'}
                          </span>
                        )}
                      </td>
                    );
                  })}

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

        {apiState.isLoading && (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-500">
            加载中...
          </div>
        )}
      </div>

      {/* 分页控制（仅 API 模式） */}
      {!hasLocalData && apiState.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2">
          <span className="text-xs text-slate-500">
            第 {apiState.page} / {apiState.totalPages} 页，共 {apiState.total} 条
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(apiState.page - 1)}
              disabled={apiState.page <= 1}
              className="rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(apiState.page + 1)}
              disabled={apiState.page >= apiState.totalPages}
              className="rounded border p-1 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 仅在搜索/筛选/仅显示选中时显示命中状态（否则记录/字段数已在面板头，避免重复） */}
      {isFiltering && (
        <div className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          命中 {displayFeatures.length} / 共 {totalCount} 条 · 选中 {selectedFeatureIds.size}
        </div>
      )}
    </div>
  );
}
