/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 预览面板（轻量版）：常驻入口，显示当前最新预览的公开 URL（复制/查看）+ 发布/重新发布。
 * 解决「发布预览链接一次性、过后看不到」的痛点。不存历史（历史见完整版）。
 */
import { useEffect, useRef, useState } from 'react';
import { Share2, ExternalLink, Copy, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useWhiteboardStore } from '../store/use-whiteboard-store';
import { whiteboardApi } from '../api/whiteboard.api';
import { compressPreview } from '../utils/compress-preview';

export function PreviewPanel({ projectId }: { projectId: string }) {
  const editor = useWhiteboardStore((s) => s.editor);
  const [open, setOpen] = useState(false);
  const [hasPreview, setHasPreview] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const imageUrl = `${window.location.origin}/api/projects/${projectId}/whiteboard/image`;

  // 打开时拉取最新状态（每次打开都刷新）
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setHasPreview(null);
    whiteboardApi
      .getPreviewStatus(projectId)
      .then((r) => !cancelled && setHasPreview(r.hasPreview))
      .catch(() => !cancelled && setHasPreview(false));
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // 点外部关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handlePublish = async () => {
    if (!editor || publishing) return;
    setPublishing(true);
    try {
      const shapeIds = [...editor.getCurrentPageShapeIds()];
      const { url } = await editor.toImageDataUrl(shapeIds, { background: true });
      const compressed = await compressPreview(url); // 十几MB → 几百KB
      await whiteboardApi.publishPreview(projectId, compressed);
      setHasPreview(true);
      toast.success('预览图已发布');
    } catch (err) {
      console.error('[PreviewPanel] publish failed', err);
      toast.error('发布预览图失败');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(imageUrl).catch(() => {});
    toast.success('已复制到剪贴板');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        title="预览图：查看/复制公开链接、重新发布"
      >
        <Share2 className="w-4 h-4" />
        预览
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[380px] max-w-[92vw] bg-white rounded-lg shadow-lg border p-3 flex flex-col gap-2 z-[600]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">预览图</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {hasPreview === null ? (
            <div className="text-xs text-gray-400 py-2">加载中…</div>
          ) : hasPreview ? (
            <>
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check className="w-3.5 h-3.5" />
                已发布（公开 URL，永远指向最新一次发布）
              </span>
              <div className="flex items-center gap-1">
                <input
                  readOnly
                  value={imageUrl}
                  className="flex-1 min-w-0 text-xs border rounded px-2 py-1 bg-gray-50 text-gray-600"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  <Copy className="w-3.5 h-3.5" />
                  复制
                </button>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1 rounded text-sm text-white bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  查看预览
                </a>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1 px-3 py-1 rounded text-sm text-gray-700 border hover:bg-gray-50 disabled:opacity-50"
                >
                  {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  重新发布
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-500">尚未发布预览图</span>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                发布当前页为预览图
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
