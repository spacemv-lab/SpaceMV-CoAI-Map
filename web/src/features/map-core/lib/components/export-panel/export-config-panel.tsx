/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState } from 'react';
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

type RatioMode = 'custom' | '1:1' | '4:3' | '16:9' | '3:2';

// Aspect-ratio presets (value = width / height). Selecting one links W/H and
// constrains the drag. 自定义 = no link (free W/H input), the default mode.
const RATIO_PRESETS: { id: RatioMode; label: string; value: number }[] = [
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '3:2', label: '3:2', value: 3 / 2 },
];

const PRESET_EPSILON = 0.001;

// Infer the chip mode from a stored ratio (initial state only; local `mode` is
// authoritative once the user clicks). null or any non-preset ratio → 自定义 (free).
function activeRatioId(ratio: number | null): RatioMode {
  if (ratio == null) return 'custom';
  const match = RATIO_PRESETS.find((p) => Math.abs(ratio - p.value) < PRESET_EPSILON);
  return match ? match.id : 'custom';
}

interface ElementConfigRowProps {
  label: string;
  elementKey: 'title' | 'northArrow' | 'scaleBar' | 'legend' | 'tianditu' | 'brand';
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

/**
 * Single numeric dimension input. Commits to the store on blur/Enter (not per keystroke)
 * so typing a full number doesn't collapse the selection box intermediate-digit by digit.
 */
function DimensionInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number | null;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value == null ? '' : String(value));
  }, [value, editing]);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        min={0}
        value={text}
        disabled={disabled}
        placeholder="—"
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onCommit(Math.max(0, Math.floor(Number(text) || 0)));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-20 px-2 py-1 text-xs border border-slate-200 rounded bg-white disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}

function SizeControls({
  aspectRatio,
  pixelSize,
  hasBox,
  onRatioChange,
  onResize,
}: {
  aspectRatio: number | null;
  pixelSize: { width: number; height: number } | null;
  hasBox: boolean;
  onRatioChange: (ratio: number | null) => void;
  onResize: (exportWidth: number, exportHeight: number) => void;
}) {
  // Local mode is authoritative for which chip is lit (initialized from the stored
  // ratio, which resets to null/custom whenever the panel reopens → component remounts).
  const [mode, setMode] = useState<RatioMode>(() => activeRatioId(aspectRatio));

  const handlePreset = (id: RatioMode, value: number) => {
    setMode(id);
    onRatioChange(value);
  };

  const handleCustom = () => {
    setMode('custom');
    onRatioChange(null); // 自定义 = free W/H input, no ratio lock
  };

  // Under a preset ratio, editing one dimension derives the other. Under 自定义 the
  // two are independent (so an exact arbitrary size like 900×383 can be typed directly).
  const commitWidth = (w: number) => {
    if (aspectRatio != null && aspectRatio > 0) onResize(w, Math.round(w / aspectRatio));
    else if (pixelSize) onResize(w, pixelSize.height);
  };

  const commitHeight = (h: number) => {
    if (aspectRatio != null && aspectRatio > 0) onResize(Math.round(h * aspectRatio), h);
    else if (pixelSize) onResize(pixelSize.width, h);
  };

  const chipClass = (active: boolean) =>
    `px-2 py-1 text-xs rounded border transition-colors ${
      active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
    }`;

  return (
    <div className="space-y-2">
      {/* Ratio chips: presets link W/H; 自定义 = free input */}
      <div className="text-xs font-medium text-slate-600">比例</div>
      <div className="flex flex-wrap gap-1">
        {RATIO_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePreset(p.id, p.value)}
            className={chipClass(mode === p.id)}
          >
            {p.label}
          </button>
        ))}
        <button onClick={handleCustom} className={chipClass(mode === 'custom')}>
          自定义
        </button>
      </div>

      {/* Numeric export dimensions */}
      <div className="flex items-center gap-2 pt-1">
        <DimensionInput
          label="宽"
          value={hasBox ? pixelSize?.width ?? null : null}
          disabled={!hasBox}
          onCommit={commitWidth}
        />
        <span className="text-xs text-slate-400">×</span>
        <DimensionInput
          label="高"
          value={hasBox ? pixelSize?.height ?? null : null}
          disabled={!hasBox}
          onCommit={commitHeight}
        />
        <span className="text-xs text-slate-400">px</span>
      </div>

      {hasBox && pixelSize && (
        <div className="text-xs text-slate-500">
          实际导出: <span className="font-mono text-slate-700">{pixelSize.width} × {pixelSize.height}</span> px
        </div>
      )}
    </div>
  );
}

export function ExportConfigPanel() {
  const selectionBox = useMapStore((state) => state.exportPanel.selectionBox);
  const pixelSize = useMapStore((state) => state.exportPanel.pixelSize);
  const aspectRatio = useMapStore((state) => state.exportPanel.aspectRatio);
  const setExportAspectRatio = useMapStore((state) => state.setExportAspectRatio);
  const resizeExportBox = useMapStore((state) => state.resizeExportBox);
  const closeExportPanel = useMapStore((state) => state.closeExportPanel);

  const hasBox = !!selectionBox;

  const handleExport = () => {
    // selectionBox/pixelSize are captured in the event detail so the export
    // compositor has them even though closeExportPanel() clears the store.
    window.dispatchEvent(new CustomEvent('map:export-image', {
      detail: { selectionBox, pixelSize }
    }));
    closeExportPanel();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="text-sm font-semibold text-slate-700">导出配置</span>
        <button
          onClick={closeExportPanel}
          className="p-1 rounded hover:bg-slate-100 text-slate-500"
          aria-label="退出导出"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Size + ratio controls — always visible (ratio can be pre-selected before drawing) */}
      <div className="px-4 py-3 border-b bg-slate-50 shrink-0">
        <SizeControls
          aspectRatio={aspectRatio}
          pixelSize={pixelSize}
          hasBox={hasBox}
          onRatioChange={setExportAspectRatio}
          onResize={resizeExportBox}
        />
      </div>

      {!hasBox ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm p-8 text-center gap-2">
          <Download className="w-8 h-8" />
          <div>请在地图上框选导出范围</div>
        </div>
      ) : (
        <>
          {/* Element configs - scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
            <ElementConfigRow label="标题" elementKey="title" showTextInput />
            <ElementConfigRow label="指北针" elementKey="northArrow" showStyleSelector />
            <ElementConfigRow label="比例尺" elementKey="scaleBar" />
            <ElementConfigRow label="图例" elementKey="legend" />
            <ElementConfigRow label="天地图" elementKey="tianditu" />
            <ElementConfigRow label="品牌" elementKey="brand" showTextInput />
          </div>

          {/* Export button */}
          <div className="px-4 py-3 border-t bg-slate-50 shrink-0">
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              导出 PNG
            </button>
          </div>
        </>
      )}
    </div>
  );
}
