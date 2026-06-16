/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../../store/use-map-store';
import { ElementPresetPosition, NorthArrowStyle } from '../../types/export-state';
import { Download, X } from 'lucide-react';

// Import SVG files as URLs for preview thumbnails
import northArrowImg1 from '../../assets/north-arrow-1.svg';
import northArrowImg2 from '../../assets/north-arrow-2.svg';
import northArrowImg3 from '../../assets/north-arrow-3.svg';
import northArrowImg4 from '../../assets/north-arrow-4.svg';
import northArrowImg5 from '../../assets/north-arrow-5.svg';

const NORTH_ARROW_IMAGES: Record<NorthArrowStyle, string> = {
  1: northArrowImg1,
  2: northArrowImg2,
  3: northArrowImg3,
  4: northArrowImg4,
  5: northArrowImg5,
};

const PRESET_OPTIONS: { value: ElementPresetPosition; label: string }[] = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '上中' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '下中' },
  { value: 'bottom-right', label: '右下' },
];

interface ElementConfigRowProps {
  label: string;
  elementKey: 'title' | 'northArrow' | 'scaleBar' | 'legend' | 'tianditu';
  showTextInput?: boolean;
  showStyleSelector?: boolean;
}

function ElementConfigRow({ label, elementKey, showTextInput, showStyleSelector }: ElementConfigRowProps) {
  const config = useMapStore((state) => state.exportPanel.config[elementKey]);
  const updateExportElement = useMapStore((state) => state.updateExportElement);

  return (
    <div className="space-y-2 border-b border-slate-200 pb-3">
      {/* Enable checkbox + label */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => updateExportElement(elementKey, { enabled: e.target.checked })}
          className="w-4 h-4 rounded border-slate-300"
        />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>

      {config.enabled && (
        <div className="pl-6 space-y-2">
          {/* Title text input (if applicable) */}
          {showTextInput && (
            <input
              type="text"
              value={(config as any).text || ''}
              onChange={(e) => updateExportElement(elementKey, { text: e.target.value })}
              placeholder="输入标题"
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded"
            />
          )}

          {/* North arrow style selector */}
          {showStyleSelector && (
            <div className="space-y-2">
              <span className="text-xs text-slate-500">样式:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateExportElement(elementKey, { style: s as NorthArrowStyle })}
                    className={`w-8 h-8 rounded border-2 flex items-center justify-center bg-white hover:bg-slate-50 transition-all ${
                      (config as any).style === s
                        ? 'border-blue-500 ring-1 ring-blue-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <img
                      src={NORTH_ARROW_IMAGES[s as NorthArrowStyle]}
                      alt={`样式${s}`}
                      className="w-6 h-6 object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preset position select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">位置:</span>
            <select
              value={config.preset}
              onChange={(e) => updateExportElement(elementKey, { preset: e.target.value as ElementPresetPosition })}
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Offset sliders - percentage based (-50 to +50) */}
          <div className="space-y-2 touch-none">
            {/* Horizontal offset */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">水平偏移</span>
                <span className="text-xs text-slate-600 font-mono">{config.offsetX}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={config.offsetX}
                onChange={(e) => updateExportElement(elementKey, { offsetX: Number(e.target.value) })}
                className="w-full h-1"
              />
            </div>
            {/* Vertical offset */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">垂直偏移</span>
                <span className="text-xs text-slate-600 font-mono">{config.offsetY}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={config.offsetY}
                onChange={(e) => updateExportElement(elementKey, { offsetY: Number(e.target.value) })}
                className="w-full h-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExportConfigPanel() {
  const isOpen = useMapStore((state) => state.exportPanel.isOpen);
  const selectionBox = useMapStore((state) => state.exportPanel.selectionBox);
  const pixelSize = useMapStore((state) => state.exportPanel.pixelSize);
  const closeExportPanel = useMapStore((state) => state.closeExportPanel);

  // Only show when selection is complete
  if (!isOpen || !selectionBox) return null;

  const handleExport = async () => {
    // Trigger export (will be implemented in Task 6)
    window.dispatchEvent(new CustomEvent('map:export-image', {
      detail: { selectionBox, pixelSize }
    }));
    closeExportPanel();
  };

  // Calculate panel position (right side of selection box)
  const panelWidth = 200;
  const panelLeft = selectionBox.endX + 10;

  // Ensure panel doesn't go off-screen
  const adjustedLeft = Math.min(panelLeft, window.innerWidth - panelWidth - 20);

  // Calculate panel height and scroll area height
  const boxHeight = Math.abs(selectionBox.endY - selectionBox.startY);
  const headerHeight = 42; // header + size display
  const footerHeight = 48; // export button
  const scrollAreaHeight = boxHeight - headerHeight - footerHeight - 20; // padding

  return (
    <div
      className="absolute z-50 bg-white/95 backdrop-blur shadow-lg border rounded-lg w-[200px] flex flex-col"
      style={{
        left: adjustedLeft,
        top: selectionBox.startY,
        height: boxHeight,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 rounded-t-lg shrink-0">
        <span className="text-sm font-semibold text-slate-700">导出配置</span>
        <button
          onClick={closeExportPanel}
          className="p-1 rounded hover:bg-slate-200 text-slate-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Size display */}
      <div className="px-3 py-2 border-b bg-slate-50 shrink-0">
        <div className="text-xs text-slate-500">
          尺寸: <span className="font-mono text-slate-700">{pixelSize?.width} x {pixelSize?.height}</span> px
        </div>
      </div>

      {/* Element configs - scrollable */}
      <div
        className="px-3 py-3 space-y-3 overflow-y-auto shrink-0"
        style={{ height: Math.max(scrollAreaHeight, 100) }}
      >
        <ElementConfigRow label="标题" elementKey="title" showTextInput />
        <ElementConfigRow label="指北针" elementKey="northArrow" showStyleSelector />
        <ElementConfigRow label="比例尺" elementKey="scaleBar" />
        <ElementConfigRow label="图例" elementKey="legend" />
        <ElementConfigRow label="天地图" elementKey="tianditu" />
      </div>

      {/* Export button */}
      <div className="px-3 py-2 border-t bg-slate-50 rounded-b-lg shrink-0 mt-auto">
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
        >
          <Download className="w-4 h-4" />
          导出 PNG
        </button>
      </div>
    </div>
  );
}
