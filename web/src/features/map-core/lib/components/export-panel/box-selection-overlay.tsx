/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useMapStore } from '../../store/use-map-store';

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type HandleId = 'tl' | 'tr' | 'br' | 'bl';
type DragMode = 'idle' | 'drawing' | 'moving' | 'resizing';

interface DragSession {
  mode: Exclude<DragMode, 'idle'>;
  lastBox: SelectionBox;
  startPt?: { x: number; y: number }; // drawing: anchor corner
  origin?: SelectionBox; // moving/resizing: box snapshot at session start
  offset?: { x: number; y: number }; // moving: cursor - box origin at grab
  handle?: HandleId; // resizing: dragged corner
  fixed?: { x: number; y: number }; // resizing: anchor (opposite corner)
}

const DRAW_MIN = 100; // px: a fresh drag must clear this to commit
const RESIZE_MIN = 20; // px: hard floor while resizing so the box can't collapse

function normalize(b: SelectionBox): SelectionBox {
  return {
    startX: Math.min(b.startX, b.endX),
    endX: Math.max(b.startX, b.endX),
    startY: Math.min(b.startY, b.endY),
    endY: Math.max(b.startY, b.endY),
  };
}

// The corner that stays put while a given handle is dragged.
function fixedCornerFor(box: SelectionBox, handle: HandleId): { x: number; y: number } {
  switch (handle) {
    case 'tl': return { x: box.endX, y: box.endY };
    case 'tr': return { x: box.startX, y: box.endY };
    case 'br': return { x: box.startX, y: box.startY };
    case 'bl': return { x: box.endX, y: box.startY };
  }
}

// Fresh draw: anchored at startPt; under a locked ratio the off-axis is derived
// from the dominant drag axis (same feel as the original implementation).
function drawBox(start: { x: number; y: number }, x: number, y: number, ratio: number | null): SelectionBox {
  let endX = x;
  let endY = y;
  if (ratio && ratio > 0) {
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const h = Math.abs(dx) / ratio;
      endY = start.y + (dy < 0 ? -h : h);
    } else {
      const w = Math.abs(dy) * ratio;
      endX = start.x + (dx < 0 ? -w : w);
    }
  }
  return { startX: start.x, startY: start.y, endX, endY };
}

// Move: translate by the cursor delta, clamped to the container.
function moveBox(origin: SelectionBox, offset: { x: number; y: number }, x: number, y: number, w: number, h: number): SelectionBox {
  const boxW = origin.endX - origin.startX;
  const boxH = origin.endY - origin.startY;
  const startX = Math.max(0, Math.min(x - offset.x, Math.max(0, w - boxW)));
  const startY = Math.max(0, Math.min(y - offset.y, Math.max(0, h - boxH)));
  return { startX, startY, endX: startX + boxW, endY: startY + boxH };
}

// Resize: the opposite corner (fixed) stays put, the dragged corner follows the
// cursor. Under a locked ratio the off-axis is derived from the dominant axis.
function resizeBox(handle: HandleId, fixed: { x: number; y: number }, x: number, y: number, ratio: number | null, w: number, h: number): SelectionBox {
  const cx = Math.max(0, Math.min(x, w));
  const cy = Math.max(0, Math.min(y, h));
  let dx = cx - fixed.x;
  let dy = cy - fixed.y;
  if (ratio && ratio > 0) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      const cw = Math.abs(dx);
      const ch = cw / ratio;
      dx = (dx < 0 ? -1 : 1) * cw;
      dy = (dy < 0 ? -1 : 1) * ch;
    } else {
      const ch = Math.abs(dy);
      const cw = ch * ratio;
      dx = (dx < 0 ? -1 : 1) * cw;
      dy = (dy < 0 ? -1 : 1) * ch;
    }
  }
  const box = normalize({ startX: fixed.x, startY: fixed.y, endX: fixed.x + dx, endY: fixed.y + dy });
  return enforceResizeMin(box, handle);
}

// Keep the dragged edges from collapsing past the fixed corner.
function enforceResizeMin(box: SelectionBox, handle: HandleId): SelectionBox {
  const { startX, startY, endX, endY } = box;
  switch (handle) {
    case 'br': return { startX, startY, endX: Math.max(endX, startX + RESIZE_MIN), endY: Math.max(endY, startY + RESIZE_MIN) };
    case 'tl': return { startX: Math.min(startX, endX - RESIZE_MIN), startY: Math.min(startY, endY - RESIZE_MIN), endX, endY };
    case 'tr': return { startX, startY: Math.min(startY, endY - RESIZE_MIN), endX: Math.max(endX, startX + RESIZE_MIN), endY };
    case 'bl': return { startX: Math.min(startX, endX - RESIZE_MIN), startY, endX, endY: Math.max(endY, startY + RESIZE_MIN) };
  }
}

const HANDLE_CURSOR: Record<HandleId, string> = {
  tl: 'nwse-resize',
  br: 'nwse-resize',
  tr: 'nesw-resize',
  bl: 'nesw-resize',
};

function handleStyle(handle: HandleId): React.CSSProperties {
  const center: React.CSSProperties = { transform: 'translate(-50%, -50%)' };
  switch (handle) {
    case 'tl': return { left: 0, top: 0, ...center };
    case 'tr': return { left: '100%', top: 0, ...center };
    case 'br': return { left: '100%', top: '100%', ...center };
    case 'bl': return { left: 0, top: '100%', ...center };
  }
}

export function BoxSelectionOverlay() {
  const isOpen = useMapStore((state) => state.exportPanel.isOpen);
  const aspectRatio = useMapStore((state) => state.exportPanel.aspectRatio);
  const selectionBox = useMapStore((state) => state.exportPanel.selectionBox);
  const setExportSelectionBox = useMapStore((state) => state.setExportSelectionBox);
  const setExportContainerSize = useMapStore((state) => state.setExportContainerSize);
  const closeExportPanel = useMapStore((state) => state.closeExportPanel);

  const [mode, setMode] = useState<DragMode>('idle');
  const [liveBox, setLiveBox] = useState<SelectionBox | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const pointFromEvent = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const containerSize = useCallback(() => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }, []);

  // --- session starters (fresh mousedown) ---

  const beginDraw = useCallback((e: React.MouseEvent) => {
    if (!isOpen) return;
    const p = pointFromEvent(e);
    setExportSelectionBox(null); // a new drag replaces the current selection
    sessionRef.current = { mode: 'drawing', lastBox: { startX: p.x, startY: p.y, endX: p.x, endY: p.y }, startPt: p };
    setLiveBox(sessionRef.current.lastBox);
    setMode('drawing');
  }, [isOpen, pointFromEvent, setExportSelectionBox]);

  const beginMove = useCallback((e: React.MouseEvent) => {
    if (!selectionBox) return;
    e.stopPropagation();
    const p = pointFromEvent(e);
    sessionRef.current = {
      mode: 'moving',
      lastBox: selectionBox,
      origin: selectionBox,
      offset: { x: p.x - selectionBox.startX, y: p.y - selectionBox.startY },
    };
    setLiveBox(selectionBox);
    setMode('moving');
  }, [selectionBox, pointFromEvent]);

  const beginResize = useCallback((e: React.MouseEvent, handle: HandleId) => {
    if (!selectionBox) return;
    e.stopPropagation();
    sessionRef.current = {
      mode: 'resizing',
      lastBox: selectionBox,
      origin: selectionBox,
      handle,
      fixed: fixedCornerFor(selectionBox, handle),
    };
    setLiveBox(selectionBox);
    setMode('resizing');
  }, [selectionBox]);

  // --- drag loop: window listeners while a session is active ---
  useEffect(() => {
    if (mode === 'idle') return;

    const onMove = (e: MouseEvent) => {
      const s = sessionRef.current;
      if (!s) return;
      const p = pointFromEvent(e);
      const { w, h } = containerSize();
      let next: SelectionBox;
      if (s.mode === 'drawing' && s.startPt) {
        next = drawBox(s.startPt, p.x, p.y, aspectRatio);
      } else if (s.mode === 'moving' && s.origin && s.offset) {
        next = moveBox(s.origin, s.offset, p.x, p.y, w, h);
      } else if (s.mode === 'resizing' && s.handle && s.fixed) {
        next = resizeBox(s.handle, s.fixed, p.x, p.y, aspectRatio, w, h);
      } else {
        return;
      }
      s.lastBox = next;
      setLiveBox(next);
    };

    const onUp = () => {
      const s = sessionRef.current;
      if (s) {
        const b = normalize(s.lastBox);
        const bw = b.endX - b.startX;
        const bh = b.endY - b.startY;
        // A fresh draw must clear the size gate; move/resize always commit.
        if (s.mode !== 'drawing' || (bw > DRAW_MIN && bh > DRAW_MIN)) {
          setExportSelectionBox(b);
        }
      }
      sessionRef.current = null;
      setMode('idle');
      setLiveBox(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [mode, aspectRatio, pointFromEvent, containerSize, setExportSelectionBox]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeExportPanel();
    }
  }, [closeExportPanel]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Report the map container size so the store can clamp/reshape the selection box.
  useEffect(() => {
    if (!isOpen) return;
    const el = overlayRef.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      setExportContainerSize({ width: r.width, height: r.height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, setExportContainerSize]);

  // Clear internal state when panel closes
  useEffect(() => {
    if (!isOpen) {
      sessionRef.current = null;
      setMode('idle');
      setLiveBox(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // While dragging, show the live local box; otherwise reflect the committed store
  // box, so ratio/size edits made in the panel visibly reshape the selection.
  const displayBox = mode === 'idle' ? selectionBox : liveBox;

  const boxW = displayBox ? Math.abs(displayBox.endX - displayBox.startX) : 0;
  const boxH = displayBox ? Math.abs(displayBox.endY - displayBox.startY) : 0;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair z-50"
      onMouseDown={beginDraw}
    >
      {/* Selection box: its box-shadow's 9999px spread IS the "outside-only" mask
          (clipped to the map viewport by the container's overflow-hidden). Box bg
          is transparent so the map shows through cleanly inside. The first, soft
          layer gives the floating photo-frame lift; the second fills the outside. */}
      {displayBox && (
        <div
          className="absolute border-2 border-white pointer-events-auto cursor-move"
          style={{
            left: Math.min(displayBox.startX, displayBox.endX),
            top: Math.min(displayBox.startY, displayBox.endY),
            width: boxW,
            height: boxH,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 0 9999px rgba(0,0,0,0.45)',
          }}
          onMouseDown={beginMove}
        >
          {/* Size label */}
          <div className="absolute -top-6 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
            {Math.round(boxW)} × {Math.round(boxH)} px
          </div>

          {/* Corner resize handles (hidden while a fresh draw is in progress) */}
          {mode !== 'drawing' &&
            (['tl', 'tr', 'br', 'bl'] as HandleId[]).map((h) => (
              <div
                key={h}
                onMouseDown={(e) => beginResize(e, h)}
                className="absolute w-3 h-3 bg-white border border-slate-500 rounded-sm shadow pointer-events-auto"
                style={{ ...handleStyle(h), cursor: HANDLE_CURSOR[h] }}
              />
            ))}
        </div>
      )}

      {/* Instructions */}
      {!displayBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded">
          拖拽选择导出区域，按 Esc 取消
        </div>
      )}
    </div>
  );
}
