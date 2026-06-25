/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { BoxSelectionOverlay } from './box-selection-overlay';
import { ExportPreviewCanvas } from './export-preview-canvas';

/**
 * Export panel container
 * Orchestrates the in-map pieces: box selection overlay + live preview canvas.
 * The config UI (要素控制面板) lives in the RightPanel "导出" tab — see
 * `ExportConfigPanel`, mounted by `RightPanel`'s export tab content.
 */
export function ExportPanel() {
  return (
    <>
      <BoxSelectionOverlay />
      <ExportPreviewCanvas />
    </>
  );
}
