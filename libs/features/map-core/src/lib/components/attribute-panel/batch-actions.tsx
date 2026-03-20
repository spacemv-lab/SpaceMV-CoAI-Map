/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * 批量操作组件
 * 对选中要素进行批量设置
 */

import { useMapStore } from '../../store/use-map-store';
import { Eye, EyeOff, Tag, RotateCcw, Check } from 'lucide-react';
import { useState } from 'react';

interface BatchActionsProps {
  layerId: string;
  selectedFeatureIds: string[];
  onBatchComplete?: () => void;
}

export function BatchActions({ layerId, selectedFeatureIds, onBatchComplete }: BatchActionsProps) {
  const layers = useMapStore((state) => state.layers);
  const setFeatureOverride = useMapStore((state) => state.setFeatureOverride);
  const batchSetFeatureOverrides = useMapStore((state) => state.batchSetFeatureOverrides);

  const [showMenu, setShowMenu] = useState(false);
  const [labelText, setLabelText] = useState('');

  const layer = layers.find((l) => l.id === layerId);

  // 批量设置可见性
  const handleSetVisible = (visible: boolean) => {
    const overrides: Record<string, { visible: boolean }> = {};
    selectedFeatureIds.forEach((id) => {
      overrides[id] = { visible };
    });
    batchSetFeatureOverrides(layerId, overrides);
    setShowMenu(false);
    onBatchComplete?.();
  };

  // 批量设置标签显示
  const handleSetLabelVisible = (showLabel: boolean) => {
    const overrides: Record<string, { showLabel: boolean }> = {};
    selectedFeatureIds.forEach((id) => {
      overrides[id] = { showLabel };
    });
    batchSetFeatureOverrides(layerId, overrides);
    setShowMenu(false);
    onBatchComplete?.();
  };

  // 批量设置标签文字
  const handleSetLabelText = () => {
    if (!labelText) return;
    const overrides: Record<string, { showLabel: boolean; labelOverride: { text: string } }> = {};
    selectedFeatureIds.forEach((id) => {
      overrides[id] = {
        showLabel: true,
        labelOverride: { text: labelText },
      };
    });
    batchSetFeatureOverrides(layerId, overrides);
    setLabelText('');
    setShowMenu(false);
    onBatchComplete?.();
  };

  // 批量清除覆盖
  const handleClearOverrides = () => {
    selectedFeatureIds.forEach((id) => {
      // 需要逐个清除
    });
    setShowMenu(false);
    onBatchComplete?.();
  };

  if (selectedFeatureIds.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* 触发按钮 */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-sm text-blue-700"
      >
        <span>批量操作 ({selectedFeatureIds.length})</span>
        <Check className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {showMenu && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border shadow-lg rounded z-50 overflow-hidden">
          {/* 可见性操作 */}
          <div className="p-2 border-b">
            <div className="text-xs text-gray-500 mb-1">可见性</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSetVisible(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                <Eye className="w-3 h-3" /> 显示
              </button>
              <button
                onClick={() => handleSetVisible(false)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                <EyeOff className="w-3 h-3" /> 隐藏
              </button>
            </div>
          </div>

          {/* 标签操作 */}
          <div className="p-2 border-b">
            <div className="text-xs text-gray-500 mb-1">标签显示</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSetLabelVisible(true)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                <Tag className="w-3 h-3" /> 显示
              </button>
              <button
                onClick={() => handleSetLabelVisible(false)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
              >
                <Tag className="w-3 h-3" /> 隐藏
              </button>
            </div>
          </div>

          {/* 标签文字设置 */}
          <div className="p-2">
            <div className="text-xs text-gray-500 mb-1">批量设置标签文字</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value)}
                placeholder="输入标签文字或使用 {字段名}"
                className="flex-1 px-2 py-1.5 border rounded text-xs focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSetLabelText}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                应用
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              使用 {'{'}字段名{'}'} 格式显示要素属性，如 {'{'}name{'}'}
            </div>
          </div>

          {/* 清除操作 */}
          <div className="p-2 border-t bg-gray-50">
            <button
              onClick={handleClearOverrides}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs border rounded text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="w-3 h-3" /> 清除所有覆盖
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
