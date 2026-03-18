/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useEffect, useMemo, useState } from 'react';
import { useMapStore } from '../../store/use-map-store';
import { AttributeTable } from './attribute-table';
import { FilterBar } from './filter-bar';
import { FieldsTable } from './fields-table';
import {
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Table,
  X,
} from 'lucide-react';

export function AttributePanel() {
  const layers = useMapStore((state) => state.layers);
  const attributePanel = useMapStore((state) => state.attributePanel);
  const closeAttributePanel = useMapStore((state) => state.closeAttributePanel);
  const setAttributePanelTab = useMapStore((state) => state.setAttributePanelTab);
  const setAttributePanelCollapsed = useMapStore(
    (state) => state.setAttributePanelCollapsed,
  );
  const setAttributePanelHeight = useMapStore(
    (state) => state.setAttributePanelHeight,
  );

  const [selectedFeatureIds, setSelectedFeatureIds] = useState<Set<string>>(new Set());
  const [filterFn, setFilterFn] = useState<((feature: any) => boolean) | null>(null);

  const currentLayer = useMemo(
    () => layers.find((layer) => layer.id === attributePanel.layerId) ?? null,
    [attributePanel.layerId, layers],
  );

  const featureCount = currentLayer?.data?.features?.length ?? 0;
  const fieldCount = currentLayer?.fields?.length ?? 0;

  useEffect(() => {
    setSelectedFeatureIds(new Set());
    setFilterFn(null);
  }, [attributePanel.layerId, attributePanel.tab]);

  if (!attributePanel.isOpen || !currentLayer) {
    return null;
  }

  const handleResizeStart = () => {
    const handleMouseMove = (event: MouseEvent) => {
      const nextHeight = window.innerHeight - event.clientY;
      setAttributePanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="border-t bg-white/95 backdrop-blur shadow-2xl transition-all duration-300 ease-out"
      style={{ height: attributePanel.isCollapsed ? 44 : attributePanel.height }}
    >
      <div
        className="flex h-3 cursor-row-resize items-center justify-center border-b bg-slate-50/80"
        onMouseDown={handleResizeStart}
      >
        <GripHorizontal className="h-4 w-4 text-slate-400" />
      </div>

      <div className="flex h-[calc(100%-12px)] flex-col">
        <div className="flex items-center justify-between border-b bg-slate-50/80 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Table className="h-4 w-4" />
              <span>属性表 - {currentLayer.name}</span>
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
              onClick={() =>
                setAttributePanelCollapsed(!attributePanel.isCollapsed)
              }
              title={attributePanel.isCollapsed ? '展开' : '折叠'}
            >
              {attributePanel.isCollapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <button
              className="rounded p-1 text-slate-500 hover:bg-slate-200"
              onClick={closeAttributePanel}
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!attributePanel.isCollapsed && (
          <div className="flex min-h-0 flex-1 flex-col">
            {attributePanel.tab === 'records' && (
              <>
                <FilterBar
                  layerId={currentLayer.id}
                  onFilterChange={(filter) => setFilterFn(() => filter)}
                />
                <div className="min-h-0 flex-1">
                  <AttributeTable
                    layerId={currentLayer.id}
                    selectedFeatureIds={selectedFeatureIds}
                    onSelectionChange={setSelectedFeatureIds}
                    filterFn={filterFn}
                  />
                </div>
              </>
            )}

            {attributePanel.tab === 'fields' && (
              <div className="min-h-0 flex-1">
                <FieldsTable layerId={currentLayer.id} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
