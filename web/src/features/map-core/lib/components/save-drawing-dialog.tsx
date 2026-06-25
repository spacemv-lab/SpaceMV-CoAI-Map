/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMapStore } from '../store/use-map-store';
import { createDatasetWithFeatures } from '@/features/gis-data-manager/feature-api';
import { GeometryType as PrismaGeometryType } from '@prisma/client';
import type { GeometryType, LayerRoutingMetadata } from '../types/map-state';
import { toast } from 'sonner';
import { Save, X, Loader2 } from 'lucide-react';

interface SaveDrawingDialogProps {
  layerId: string;
  onClose: () => void;
}

export function SaveDrawingDialog({ layerId, onClose }: SaveDrawingDialogProps) {
  const layers = useMapStore((state) => state.layers);
  const currentProjectId = useMapStore((state) => state.currentProjectId);
  const addLayer = useMapStore((state) => state.addLayer);
  const removeLayer = useMapStore((state) => state.removeLayer);
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);

  const layer = layers.find((l) => l.id === layerId);
  const [name, setName] = useState(layer?.name || '');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!layer || !layer.data?.features?.length) {
    return null;
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入数据集名称');
      return;
    }

    setIsSaving(true);

    try {
      const geometryType = layer.geometryType as PrismaGeometryType;

      const result = await createDatasetWithFeatures({
        name: name.trim(),
        geometryType,
        projectId: currentProjectId,
        description: description.trim() || undefined,
        style: layer.style || {},
        features: layer.data.features.map((f) => ({
          id: (f as any).id || '',
          geometry: f.geometry as Record<string, unknown>,
          properties: (f as any).properties || {},
        })),
      });

      // 删除旧的 Draw 图层
      removeLayer(layerId);

      // 将 Prisma GeometryType 转换为前端 GeometryType (只支持简单类型)
      const frontendGeometryType = result.geometryType as GeometryType;

      // 构造 routingMetadata：后端 buildDatasetRoutingSummary 把路由字段
      // (datasetId/geometryType/bbox/mvtUrlTemplate/recordCount)平铺在响应顶层，
      // 不在 routingMetadata 嵌套对象里
      const routingMetadata: LayerRoutingMetadata = {
        datasetId: result.datasetId,
        geometryType: result.geometryType as GeometryType,
        bbox: result.bbox as [number, number, number, number],
        mvtUrlTemplate: result.mvtUrlTemplate,
        recordCount: result.recordCount,
      };

      // 创建新的 GeoJSON 图层
      addLayer({
        id: result.id,
        name: result.name,
        type: 'GeoJSON',
        sourceId: result.id,
        visible: true,
        opacity: 1,
        geometryType: frontendGeometryType,
        style: result.style || layer.style,
        routingMetadata,
        data: undefined,  // MVT 模式不常驻 data
      });

      toast.success(`数据集 "${name}" 已保存`);
      // 保存即结束本轮绘制：退出绘制模式（旧 Draw 图层已被 removeLayer 删除，
      // 继续留在绘制态会画进不存在的图层）
      setInteractionMode('default');
      onClose();
    } catch (err) {
      console.error('[SaveDrawing] Failed:', err);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">保存标注到项目</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">数据集名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入名称"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入描述"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg resize-none"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div className="flex justify-between">
              <span>要素数量:</span>
              <span className="font-medium">{layer.data.features.length}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>几何类型:</span>
              <span className="font-medium">
                {layer.geometryType === 'POINT' ? '点' : layer.geometryType === 'LINESTRING' ? '线' : '面'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" disabled={isSaving}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />保存中...</> : '确认保存'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}