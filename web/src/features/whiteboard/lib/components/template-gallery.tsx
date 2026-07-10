/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 模板库弹层（替换 template-picker 的朴素下拉）。
 *
 * - 保存当前白板为模板：捕获页内要素 + 生成缩略图（复用"发布预览图"机制，maxDim 480）。
 * - 卡片网格：内置版式（占位图标，点击走 tpl.apply）+ 用户模板（缩略图，点击 getById+apply）。
 * - owner 可在卡片上删除自己的模板（后端 owner 校验兜底）。
 */
import { useEffect, useRef, useState } from 'react';
import { LayoutTemplate, Save, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWhiteboardStore } from '../store/use-whiteboard-store';
import { useUser } from '@/store/useAuthStore';
import { TEMPLATES } from '../templates/templates';
import { templateApi, type TemplateSummary } from '../api/template.api';
import {
  captureTemplateSnapshot,
  applyTemplateSnapshot,
} from '../utils/template-snapshot';
import { compressImageDataUrl } from '../utils/compress-preview';

export function TemplateGallery() {
  const editor = useWhiteboardStore((s) => s.editor);
  const user = useUser();
  const currentUserId = user?.userId; // 后端 ownerId 是 String；比较时两边都 stringify

  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // 外部点击关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // 打开时拉列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    templateApi
      .list()
      .then((r) => !cancelled && setTemplates(r))
      .catch(() => !cancelled && setTemplates([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const refresh = () =>
    templateApi
      .list()
      .then(setTemplates)
      .catch(() => {});

  const handleSaveCurrent = async () => {
    if (!editor || saving) return;
    if (editor.getCurrentPageShapeIds().size === 0) {
      toast.error('画布为空，无法保存模板');
      return;
    }
    const name = window.prompt('模板名称', '我的模板');
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const content = captureTemplateSnapshot(editor);
      const shapeIds = [...editor.getCurrentPageShapeIds()];
      // 缩略图复用"发布预览图"管线（toImageDataUrl + 压缩），卡片用更小的 480px
      const { url } = await editor.toImageDataUrl(shapeIds, { background: true });
      const { dataUrl: thumbnail } = await compressImageDataUrl(url, {
        maxDim: 480,
        quality: 0.8,
      });
      await templateApi.create({ name: name.trim(), content, thumbnailUrl: thumbnail });
      await refresh();
      toast.success('模板已保存');
    } catch (err) {
      console.error('[TemplateGallery] save failed', err);
      toast.error('保存模板失败');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyUserTemplate = async (id: string, name: string) => {
    if (!editor || busyId) return;
    setBusyId(id);
    try {
      const full = await templateApi.getById(id);
      applyTemplateSnapshot(editor, full.content);
      setOpen(false);
      toast.success(`已应用模板「${name}」`);
    } catch (err) {
      console.error('[TemplateGallery] apply failed', err);
      toast.error('应用模板失败');
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyBuiltin = (id: string) => {
    if (!editor) return;
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      tpl.apply(editor);
      setOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该模板？')) return;
    try {
      await templateApi.remove(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('已删除');
    } catch {
      toast.error('删除失败（可能非本人模板）');
    }
  };

  const isOwner = (t: TemplateSummary) =>
    currentUserId !== undefined && String(t.ownerId) === String(currentUserId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        title="模板库"
      >
        <LayoutTemplate className="w-4 h-4" />
        模板
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[560px] max-w-[92vw] max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-lg border p-3 z-[600] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">模板库</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleSaveCurrent}
            disabled={saving}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存当前为模板
          </button>

          {loading ? (
            <div className="text-xs text-gray-400 py-4 text-center">加载中…</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {/* 内置版式模板：占位图标 */}
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleApplyBuiltin(t.id)}
                  className="group border rounded-lg p-2 hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center gap-1 aspect-[4/3] justify-center"
                  title={t.name}
                >
                  <LayoutTemplate className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-600 text-center line-clamp-2">{t.name}</span>
                </button>
              ))}

              {/* 用户模板：缩略图 */}
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="group relative border rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                >
                  <button
                    onClick={() => handleApplyUserTemplate(t.id, t.name)}
                    disabled={busyId === t.id}
                    className="block w-full aspect-[4/3] bg-gray-50 relative"
                    title={t.name}
                  >
                    {t.hasThumbnail ? (
                      <img
                        src={templateApi.thumbnailUrl(t.id)}
                        alt={t.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LayoutTemplate className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    {busyId === t.id && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      </div>
                    )}
                  </button>
                  <div className="p-1.5">
                    <span className="text-xs text-gray-600 block truncate">{t.name}</span>
                  </div>
                  {isOwner(t) && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="absolute top-1 right-1 p-0.5 rounded bg-white/80 text-gray-500 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && templates.length === 0 && (
            <div className="text-xs text-gray-400 text-center py-2">
              还没有用户模板，点上方按钮保存当前画板
            </div>
          )}
        </div>
      )}
    </div>
  );
}
