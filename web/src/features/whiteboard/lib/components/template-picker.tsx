/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 模板选择器：下拉列出内置模板，选中后在当前页按版式摆放要素。
 */
import { useState, useRef, useEffect } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { useWhiteboardStore } from '../store/use-whiteboard-store';
import { TEMPLATES } from '../templates/templates';

export function TemplatePicker() {
  // 叠加层是 <Tldraw> 的兄弟节点，不在其 context 内 → 从 store 读 editor
  const editor = useWhiteboardStore((s) => s.editor);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const apply = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl && editor) tpl.apply(editor);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        title="载入模板"
      >
        <LayoutTemplate className="w-4 h-4" />
        模板
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border py-1 z-[600]">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => apply(t.id)}
              className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
