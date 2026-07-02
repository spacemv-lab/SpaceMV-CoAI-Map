/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 导出白板当前页为 PNG 并触发下载。
 * 用 editor.toImageDataUrl（含白底）；shapeIds 来自当前页。
 */
import type { Editor } from '@tldraw/tldraw';

export async function exportCurrentPagePng(editor: Editor): Promise<void> {
  const shapeIds = [...editor.getCurrentPageShapeIds()];
  const { url } = await editor.toImageDataUrl(shapeIds, { background: true });

  const link = document.createElement('a');
  link.download = `白板-${Date.now()}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
