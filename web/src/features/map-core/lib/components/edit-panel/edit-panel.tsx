/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../../store/use-map-store';
import { Pencil, X, Trash2, Save, Undo2, Loader2, Check, AlertCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  saveFeatureGeometry,
  deleteFeature,
} from '@/features/gis-data-manager/feature-api';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export function EditPanel() {
  const layers = useMapStore((state) => state.layers);
  const editPanel = useMapStore((state) => state.editPanel);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const editFeature = useMapStore((state) => state.edit.editFeature);
  const selectedFeature = useMapStore((state) => state.edit.selectedFeature);
  const undoStack = useMapStore((state) => state.edit.undoStack);
  const closeEditPanel = useMapStore((state) => state.closeEditPanel);
  const setEditFeature = useMapStore((state) => state.setEditFeature);
  const setHasUnsavedChanges = useMapStore((state) => state.setHasUnsavedChanges);
  const setActiveLayer = useMapStore((state) => state.setActiveLayer);
  const clearEditState = useMapStore((state) => state.clearEditState);

  // Loading states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Save status for UI indicator
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const layer = useMemo(() => {
    if (!activeLayerId) return null;
    return layers.find((l) => l.id === activeLayerId);
  }, [activeLayerId, layers]);

  const properties = useMemo(() => {
    if (!editFeature?.properties) return {};
    return editFeature.properties as Record<string, unknown>;
  }, [editFeature?.properties]);

  if (!editPanel.isOpen || !layer || !editFeature) return null;

  const geometryType = (editFeature.geometry as { type?: string })?.type ?? 'Unknown';

  const handlePropertyChange = (key: string, value: unknown) => {
    const updated = {
      ...editFeature,
      properties: {
        ...(editFeature.properties as Record<string, unknown>),
        [key]: value,
      },
    };
    setEditFeature(updated);
    setHasUnsavedChanges(true);
    // Reset save status when user makes new changes
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    if (!selectedFeature?.featureId || !layer.sourceId) return;
    if (isSaving) return; // Prevent double-click

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await saveFeatureGeometry(
        layer.sourceId,
        selectedFeature.featureId,
        editFeature.geometry as Record<string, unknown>,
        editFeature.properties as Record<string, unknown>,
      );
      // 强制 MapLibre 重新加载 MVT 瓦片
      window.dispatchEvent(
        new CustomEvent('map:reload-mvt', { detail: { layerId: activeLayerId } })
      );
      // 保存成功后继续编辑态，只清除未保存标记
      setHasUnsavedChanges(false);
      setSaveStatus('saved');
      // 3秒后自动清除"已保存"提示
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('[EditPanel] Failed to save:', err);
      setSaveStatus('failed');
      toast.error('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = () => {
    const prev = useMapStore.getState().undoEdit();
    if (prev) {
      setEditFeature(prev);
      setHasUnsavedChanges(true);
      setSaveStatus('idle');
    }
  };

  const handleDelete = async () => {
    if (!selectedFeature?.featureId || !layer.sourceId) return;
    if (isDeleting) return; // Prevent double-click

    if (!confirm('确定删除该要素吗？')) return;

    setIsDeleting(true);
    try {
      await deleteFeature(layer.sourceId, selectedFeature.featureId);
      // 强制 MapLibre 重新加载 MVT 瓦片，否则被删要素要等下次进页面才消失
      window.dispatchEvent(
        new CustomEvent('map:reload-mvt', { detail: { layerId: activeLayerId } })
      );
      setActiveLayer(null);
      clearEditState();
      closeEditPanel();
      toast.success('删除成功');
    } catch (err) {
      console.error('[EditPanel] Failed to delete:', err);
      toast.error('删除失败，请稍后重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    const hasChanges = useMapStore.getState().edit.hasUnsavedChanges;
    if (hasChanges && !confirm('有未保存的修改，是否放弃？')) return;
    setActiveLayer(null);
    clearEditState();
    closeEditPanel();
  };

  // Save status indicator component
  const SaveStatusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-blue-600">
            <Loader2 className="w-3 h-3 animate-spin" />
            正在保存...
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="w-3 h-3" />
            已保存
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="w-3 h-3" />
            保存失败
          </span>
        );
      default:
        return null;
    }
  };

  // 优先按字段 schema 渲染（空值也显示，新增字段可见）；schema 为空时退回原始 properties
  const fieldList = layer.fields ?? [];
  const propRows: Array<{ key: string; label: string; value: unknown }> =
    fieldList.length > 0
      ? fieldList.map((field) => ({
          key: field.name,
          label: field.alias || field.name,
          value: properties[field.name],
        }))
      : Object.entries(properties).map(([key, value]) => ({
          key,
          label: key,
          value,
        }));

  return (
    <div className="flex flex-col h-full text-sm pointer-events-auto">
      {/* Header - fixed */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">编辑要素</h3>
          <SaveStatusIndicator />
        </div>
        <button
          onClick={handleClose}
          disabled={isSaving || isDeleting}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Info - fixed */}
      <div className="p-3 border-b bg-blue-50 shrink-0">
        <div className="font-medium text-blue-900 truncate">{layer.name}</div>
        <div className="text-xs text-blue-400 mt-1">
          {geometryType === 'Point' && '点图层'}
          {geometryType === 'LineString' && '线图层'}
          {geometryType === 'Polygon' && '面图层'}
          {!['Point', 'LineString', 'Polygon'].includes(geometryType) && geometryType}
          {' · ID: ' + (selectedFeature?.featureId ?? '-')}
        </div>
      </div>

      {/* Properties - fills remaining space */}
      <div className="flex-1 flex flex-col min-h-0 p-3 border-b overflow-hidden">
        <h4 className="font-medium text-gray-700 mb-2 shrink-0">属性</h4>
        {propRows.length === 0 ? (
          <div className="text-xs text-gray-400">无属性数据</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {propRows.map((row) => (
              <div key={row.key} className="flex items-start gap-2 text-xs">
                <span className="text-gray-500 font-medium w-24 shrink-0 truncate" title={row.key}>
                  {row.label}
                </span>
                <input
                  type="text"
                  defaultValue={typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value ?? '-')}
                  onBlur={(e) => handlePropertyChange(row.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  disabled={isSaving || isDeleting}
                  className="flex-1 bg-transparent border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none px-1 py-0.5 rounded disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions - fixed at bottom */}
      <div className="p-3 space-y-2 shrink-0">
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isSaving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0 || isSaving || isDeleting}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
            撤销
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={isSaving || isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {isDeleting ? '删除中...' : '删除'}
          </button>
          <button
            onClick={handleClose}
            disabled={isSaving || isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            放弃编辑
          </button>
        </div>
      </div>
    </div>
  );
}
