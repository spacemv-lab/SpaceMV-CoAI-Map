/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapStore } from '../../store/use-map-store';
import { AttributeTable } from './attribute-table';
import { FieldsTable } from './fields-table';
import type { LayerState } from '../../types/map-state';
import { GripHorizontal, Table, X } from 'lucide-react';

/** 高度过渡时长 */
const PANEL_TRANSITION_MS = 300;

export function AttributePanel() {
  const layers = useMapStore((state) => state.layers);
  const attributePanel = useMapStore((state) => state.attributePanel);
  const closeAttributePanel = useMapStore((state) => state.closeAttributePanel);
  const setAttributePanelTab = useMapStore((state) => state.setAttributePanelTab);
  const setAttributePanelHeight = useMapStore(
    (state) => state.setAttributePanelHeight,
  );
  const setPanelResizing = useMapStore((state) => state.setPanelResizing);
  const isPanelResizing = useMapStore((state) => state.isPanelResizing);

  const currentLayer = useMemo(
    () => layers.find((layer) => layer.id === attributePanel.layerId) ?? null,
    [attributePanel.layerId, layers],
  );

  // 退出动画期间 store 已把 layerId 置空 → currentLayer 变 null。
  // 用 stableLayer 锁存“最近一次打开的图层”，让面板内容在收起时不闪空。
  const [stableLayer, setStableLayer] = useState<LayerState | null>(null);
  useEffect(() => {
    if (attributePanel.isOpen && currentLayer) {
      setStableLayer(currentLayer);
    }
  }, [attributePanel.isOpen, currentLayer]);

  const renderLayer =
    attributePanel.isOpen && currentLayer ? currentLayer : stableLayer;

  // ── 进/出动画状态机（高度 0 ↔ 目标高度）──────────────────────
  // mounted：DOM 外壳是否存在；expanded：是否展开到目标高度
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const nowOpen = attributePanel.isOpen && !!currentLayer;
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = nowOpen;

    if (nowOpen) {
      // 打开：挂载外壳（高度 0）→ 下一帧展开，过渡才会发生
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setMounted(true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // 关闭：收起到 0，过渡结束后卸载
    if (wasOpen) {
      setExpanded(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setMounted(false);
      }, PANEL_TRANSITION_MS);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [attributePanel.isOpen, currentLayer]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!mounted || !renderLayer) {
    return null;
  }

  const featureCount = renderLayer.data?.features?.length ?? 0;
  const fieldCount = renderLayer.fields?.length ?? 0;

  const handleResizeStart = () => {
    // 拖拽时关闭高度过渡（store 置位，map-area 的信息栏/图例据此跟手），松手恢复
    setPanelResizing(true);
    const handleMouseMove = (event: MouseEvent) => {
      // 面板贴底：高度 = 视口高度 - 鼠标 Y
      const nextHeight = window.innerHeight - event.clientY;
      setAttributePanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setPanelResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="overflow-hidden border-t bg-white/95 shadow-2xl backdrop-blur"
      style={{
        height: expanded ? attributePanel.height : 0,
        transition: isPanelResizing ? 'none' : 'height 300ms ease-out',
      }}
    >
      <div
        className="flex h-4 cursor-row-resize items-center justify-center border-b bg-slate-50/80 transition-colors hover:bg-slate-100"
        onMouseDown={handleResizeStart}
        title="拖动调整高度"
      >
        <GripHorizontal className="h-5 w-6 text-slate-400" />
      </div>

      <div className="flex h-[calc(100%-16px)] flex-col">
        <div className="flex items-center justify-between border-b bg-slate-50/80 px-4 py-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Table className="h-4 w-4" />
              <span>属性表 - {renderLayer.name}</span>
            </div>
            <span className="text-xs text-slate-500">
              {featureCount} 条记录 / {fieldCount} 个字段
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-md border bg-white p-1">
              <button
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  attributePanel.tab === 'records'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setAttributePanelTab('records')}
              >
                数据表
              </button>
              <button
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  attributePanel.tab === 'fields'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setAttributePanelTab('fields')}
              >
                表字段
              </button>
            </div>

            <button
              className="rounded p-1 text-slate-500 hover:bg-slate-200"
              onClick={closeAttributePanel}
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {attributePanel.tab === 'records' && (
            <div className="min-h-0 flex-1">
              <AttributeTable layerId={renderLayer.id} />
            </div>
          )}

          {attributePanel.tab === 'fields' && (
            <div className="min-h-0 flex-1">
              <FieldsTable layerId={renderLayer.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
