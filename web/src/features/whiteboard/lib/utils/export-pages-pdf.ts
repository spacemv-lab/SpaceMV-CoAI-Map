/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 导出白板所有页为多页 PDF 并触发下载。
 * 逐页 setCurrentPage → toImageDataUrl（PNG，白底）→ jspdf addImage/addPage。
 * 导出后还原原当前页，避免副作用。
 */
import { jsPDF } from 'jspdf';
import type { Editor } from '@tldraw/tldraw';

export async function exportAllPagesPdf(editor: Editor): Promise<void> {
  const pages = editor.getPages();
  const originalPageId = editor.getCurrentPageId();

  let pdf: jsPDF | null = null;

  for (const page of pages) {
    editor.setCurrentPage(page.id);
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    const { url, width, height } = await editor.toImageDataUrl(shapeIds, {
      background: true,
    });
    const orientation = width >= height ? 'landscape' : 'portrait';
    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'px', format: [width, height] });
    } else {
      pdf.addPage([width, height], orientation);
    }
    pdf.addImage(url, 'PNG', 0, 0, width, height);
  }

  // 还原当前页
  editor.setCurrentPage(originalPageId);

  if (!pdf) return;
  pdf.save(`白板-${Date.now()}.pdf`);
}
