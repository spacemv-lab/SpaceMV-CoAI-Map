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
} from 'lucide-react';

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

  const layer = layers.find((item) => item.id === layerId);
  const fields = layer?.fields || [];

  const filteredFeatures = useMemo(() => {
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
  }, [filterFn, layer?.data?.features, searchTerm]);

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
    if (selectedFeatureIds.size === filteredFeatures.length) {
      onSelectionChange(new Set());
      return;
    }

    onSelectionChange(new Set(filteredFeatures.map((feature) => feature.id)));
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
                  {filteredFeatures.length > 0 &&
                  selectedFeatureIds.size === filteredFeatures.length ? (
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
            {filteredFeatures.map((feature) => {
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

        {filteredFeatures.length === 0 && (
          <div className="flex h-full min-h-40 items-center justify-center text-sm text-slate-400">
            暂无匹配记录
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>记录数 {filteredFeatures.length}</span>
        <span>选中 {selectedFeatureIds.size}</span>
        <span>字段数 {fields.length}</span>
      </div>
    </div>
  );
}
