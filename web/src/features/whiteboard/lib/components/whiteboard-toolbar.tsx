/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 白板工具栏（叠在 tldraw UI 上）：导出 PNG / 导出 PDF + 预览 + 保存状态指示。
 */
import { Download, FileText, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWhiteboardStore, type WhiteboardSaveState } from '../store/use-whiteboard-store';
import { exportCurrentPagePng } from '../utils/export-page-png';
import { exportAllPagesPdf } from '../utils/export-pages-pdf';
import { TemplateGallery } from './template-gallery';
import { PreviewPanel } from './preview-panel';

function SaveStateBadge({ state }: { state: WhiteboardSaveState }) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 px-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        保存中…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 px-2">
        <Check className="w-3.5 h-3.5" />
        已保存
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 px-2">
        <AlertCircle className="w-3.5 h-3.5" />
        保存失败
      </span>
    );
  }
  return null;
}

export function WhiteboardToolbar({ projectId }: { projectId: string }) {
  const editor = useWhiteboardStore((s) => s.editor);
  const saveState = useWhiteboardStore((s) => s.saveState);

  const handlePng = async () => {
    if (!editor) return;
    try {
      await exportCurrentPagePng(editor);
    } catch (err) {
      console.error('[WhiteboardToolbar] export PNG failed', err);
      toast.error('导出 PNG 失败');
    }
  };

  const handlePdf = async () => {
    if (!editor) return;
    try {
      await exportAllPagesPdf(editor);
      toast.success('PDF 已导出');
    } catch (err) {
      console.error('[WhiteboardToolbar] export PDF failed', err);
      toast.error('导出 PDF 失败');
    }
  };

  return (
    <>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow-lg border px-2 py-1 pointer-events-auto">
        <TemplateGallery />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={handlePng}
          className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          title="导出当前页为 PNG"
        >
          <Download className="w-4 h-4" />
          PNG
        </button>
        <button
          onClick={handlePdf}
          className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          title="导出全部页为 PDF"
        >
          <FileText className="w-4 h-4" />
          PDF
        </button>
        <PreviewPanel projectId={projectId} />
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <SaveStateBadge state={saveState} />
      </div>
    </>
  );
}
