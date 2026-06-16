/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState, useCallback } from 'react';
import { useMapStore } from '../../store/use-map-store';

interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function BoxSelectionOverlay() {
  const isOpen = useMapStore((state) => state.exportPanel.isOpen);
  const setExportSelectionBox = useMapStore((state) => state.setExportSelectionBox);
  const closeExportPanel = useMapStore((state) => state.closeExportPanel);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentBox, setCurrentBox] = useState<SelectionBox | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isOpen) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Clear previous selection when starting new draw
    setExportSelectionBox(null);
    setStartPoint({ x, y });
    setIsDrawing(true);
    setCurrentBox({ startX: x, startY: y, endX: x, endY: y });
  }, [isOpen, setExportSelectionBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentBox({
      startX: startPoint.x,
      startY: startPoint.y,
      endX: x,
      endY: y,
    });
  }, [isDrawing, startPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentBox) return;

    setIsDrawing(false);

    // Ensure box has minimum size (at least 100x100 pixels)
    const width = Math.abs(currentBox.endX - currentBox.startX);
    const height = Math.abs(currentBox.endY - currentBox.startY);

    if (width > 100 && height > 100) {
      // Normalize box (start should be top-left)
      const normalizedBox = {
        startX: Math.min(currentBox.startX, currentBox.endX),
        startY: Math.min(currentBox.startY, currentBox.endY),
        endX: Math.max(currentBox.startX, currentBox.endX),
        endY: Math.max(currentBox.startY, currentBox.endY),
      };
      setExportSelectionBox(normalizedBox);
    } else {
      // Box too small, cancel
      setCurrentBox(null);
      setStartPoint(null);
    }
  }, [isDrawing, currentBox, setExportSelectionBox]);

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

  // Clear internal state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setIsDrawing(false);
      setCurrentBox(null);
      setStartPoint(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 cursor-crosshair z-50"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Selection box */}
      {currentBox && (
        <div
          className="absolute border-2 border-white bg-white/10 pointer-events-none"
          style={{
            left: Math.min(currentBox.startX, currentBox.endX),
            top: Math.min(currentBox.startY, currentBox.endY),
            width: Math.abs(currentBox.endX - currentBox.startX),
            height: Math.abs(currentBox.endY - currentBox.startY),
          }}
        >
          {/* Size label */}
          <div className="absolute -top-6 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {Math.abs(currentBox.endX - currentBox.startX)} × {Math.abs(currentBox.endY - currentBox.startY)} px
          </div>
        </div>
      )}

      {/* Instructions */}
      {!currentBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded">
          拖拽选择导出区域，按 Esc 取消
        </div>
      )}
    </div>
  );
}
