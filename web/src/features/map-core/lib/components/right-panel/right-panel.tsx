/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { MessageSquare, FileText, Palette, Tag, Download } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useMapStore } from '../../store/use-map-store';
import { RightPanelTab } from '../../types/map-state';
import { StylePanel } from '../style-panel';
import { EditPanel } from '../edit-panel';
import { ExportConfigPanel } from '../export-panel/export-config-panel';
import { AiTabContent } from './ai-tab';
import { LabelPanel } from '../label-panel';

const ALL_TABS: { id: RightPanelTab; icon: typeof MessageSquare; label: string }[] = [
  { id: 'ai', icon: MessageSquare, label: 'AI' },
  { id: 'attributes', icon: FileText, label: '属性' },
  { id: 'style', icon: Palette, label: '样式' },
  { id: 'label', icon: Tag, label: '标注' },
  { id: 'export', icon: Download, label: '导出' },
];

/**
 * RightPanel is a fixed sidebar with tabs at bottom.
 * AI tab is always visible. Attributes/Style/Label/Export tabs only appear when triggered.
 * Panels can coexist - user can edit attributes while viewing/adjusting style.
 */
export function RightPanel() {
  const activeTab = useMapStore((s) => s.rightPanelActiveTab);
  const setRightPanelActiveTab = useMapStore((s) => s.setRightPanelActiveTab);
  const stylePanelOpen = useMapStore((s) => s.stylePanel.isOpen);
  const editPanelOpen = useMapStore((s) => s.editPanel.isOpen);
  const labelPanelOpen = useMapStore((s) => s.labelPanel.isOpen);
  const exportPanelOpen = useMapStore((s) => s.exportPanel.isOpen);

  // Track previous states to detect "just opened" transitions
  const prevEditPanelOpen = useRef(editPanelOpen);
  const prevStylePanelOpen = useRef(stylePanelOpen);
  const prevLabelPanelOpen = useRef(labelPanelOpen);
  const prevExportPanelOpen = useRef(exportPanelOpen);

  // Auto-switch tab only when panel JUST opens (transition from false to true)
  useEffect(() => {
    const editJustOpened = editPanelOpen && !prevEditPanelOpen.current;
    const styleJustOpened = stylePanelOpen && !prevStylePanelOpen.current;
    const labelJustOpened = labelPanelOpen && !prevLabelPanelOpen.current;
    const exportJustOpened = exportPanelOpen && !prevExportPanelOpen.current;

    // Update refs for next render
    prevEditPanelOpen.current = editPanelOpen;
    prevStylePanelOpen.current = stylePanelOpen;
    prevLabelPanelOpen.current = labelPanelOpen;
    prevExportPanelOpen.current = exportPanelOpen;

    // Only auto-switch on "just opened" event, not on every render
    if (editJustOpened) {
      setRightPanelActiveTab('attributes');
    } else if (styleJustOpened) {
      setRightPanelActiveTab('style');
    } else if (labelJustOpened) {
      setRightPanelActiveTab('label');
    } else if (exportJustOpened) {
      setRightPanelActiveTab('export');
    }
  }, [editPanelOpen, stylePanelOpen, labelPanelOpen, exportPanelOpen, setRightPanelActiveTab]);

  // Dynamic tabs: AI always visible, attributes/style/label/export only when triggered
  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab.id === 'ai') return true; // Always visible
    if (tab.id === 'attributes') return editPanelOpen;
    if (tab.id === 'style') return stylePanelOpen;
    if (tab.id === 'label') return labelPanelOpen;
    if (tab.id === 'export') return exportPanelOpen;
    return false;
  });

  // If current tab is no longer visible, switch to AI
  useEffect(() => {
    if (activeTab !== 'ai' && !visibleTabs.find((t) => t.id === activeTab)) {
      setRightPanelActiveTab('ai');
    }
  }, [visibleTabs, activeTab, setRightPanelActiveTab]);

  return (
    <div className="flex flex-col h-full bg-white/90 backdrop-blur">
      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'ai' && <AiTabContent />}
        {activeTab === 'attributes' && <AttributesTabContent />}
        {activeTab === 'style' && <StyleTabContent />}
        {activeTab === 'label' && <LabelTabContent />}
        {activeTab === 'export' && <ExportConfigPanel />}
      </div>

      {/* Tabs at bottom */}
      <div className="flex items-center border-t shrink-0">
        {visibleTabs.map(({ id, icon: Icon, label }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              onClick={() => setRightPanelActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'text-blue-600 border-t-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AttributesTabContent() {
  const editPanelOpen = useMapStore((s) => s.editPanel.isOpen);
  const activeLayerId = useMapStore((s) => s.activeLayerId);
  const layers = useMapStore((s) => s.layers);
  const layer = layers.find((l) => l.id === activeLayerId);

  if (editPanelOpen) {
    return <EditPanel />;
  }

  if (!layer) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-8 text-center">
        <FileText className="w-8 h-8 mb-2" />
        <div>选择图层以查看属性</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      <div className="bg-blue-50 p-3 rounded border border-blue-100">
        <div className="font-medium text-blue-900 truncate">{layer.name}</div>
        <div className="text-xs text-blue-400 mt-1">
          类型: {layer.type} · 可见: {layer.visible ? '是' : '否'}
        </div>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div>要素数量: {layer.data?.features?.length ?? '-'}</div>
        <div>字段数量: {layer.fields?.length ?? '-'}</div>
      </div>
      <button
        onClick={() => {
          useMapStore.getState().openAttributePanel(layer.id, 'records');
        }}
        className="w-full text-xs py-1.5 px-3 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
      >
        查看详细属性表
      </button>
    </div>
  );
}

function StyleTabContent() {
  return <StylePanel />;
}

function LabelTabContent() {
  return <LabelPanel />;
}
