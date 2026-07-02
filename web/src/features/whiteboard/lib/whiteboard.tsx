/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Whiteboard feature —— 一站式配图（tldraw 无限画布）。
 *
 * 流程：
 * 1. <Tldraw onMount> 拿到 editor，写入 store。
 * 2. useWhiteboardDoc 异步加载已存文档；editor 与文档就绪后 loadSnapshot（仅一次），随后开启自动保存。
 * 3. useWhiteboardAutosave 订阅 store 变更，5s 防抖 PUT getSnapshot()。
 *
 * 地图作为截图要素在 /map 采集后放入（task#64）；导出 PNG/PDF 在工具栏（task#65）。
 */
import '@tldraw/tldraw/tldraw.css';
import { useEffect, useRef, useState } from 'react';
import { Tldraw, type Editor } from '@tldraw/tldraw';
import { useWhiteboardStore } from './store/use-whiteboard-store';
import { useWhiteboardDoc } from './hooks/use-whiteboard-doc';
import { useWhiteboardAutosave } from './hooks/use-whiteboard-autosave';
import {
  getPendingMapSnapshot,
  clearPendingMapSnapshot,
} from './utils/pending-snapshot';
import { placeMapImage } from './utils/place-map-image';
import { WhiteboardToolbar } from './components/whiteboard-toolbar';
import { ProRectanglePanel } from './components/pro-rectangle-panel';
import { CustomToolbar } from './components/custom-toolbar';
import { ProRectangleUtil } from './shapes/pro-rectangle-util';
import { ProRectangleTool } from './shapes/pro-rectangle-tool';

export interface WhiteboardProps {
  projectId: string;
}

export function Whiteboard({ projectId }: WhiteboardProps) {
  const editor = useWhiteboardStore((s) => s.editor);
  const setEditor = useWhiteboardStore((s) => s.setEditor);
  const setSaveState = useWhiteboardStore((s) => s.setSaveState);

  const { doc, isLoading, error, load, save } = useWhiteboardDoc(projectId);

  // 初始加载完成后才开启自动保存，避免 loadSnapshot 触发一次空保存
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const appliedRef = useRef(false);

  // projectId 变化时重新加载
  useEffect(() => {
    appliedRef.current = false;
    setAutosaveEnabled(false);
    load();
  }, [projectId, load]);

  // editor + 文档就绪：套用已存快照（仅一次），再放入待处理的地图截图，随后开启自动保存
  useEffect(() => {
    if (!editor || !doc || appliedRef.current) return;
    appliedRef.current = true;
    if (doc.document) {
      // 文档来自后端 getSnapshot()，按 loadSnapshot 入参类型还原
      editor.loadSnapshot(
        doc.document as Parameters<Editor['loadSnapshot']>[0]
      );
    }
    // 来自 /map「加入白板」的截图：放在已加载内容之上
    const pending = getPendingMapSnapshot();
    if (pending) {
      placeMapImage(editor, pending);
      clearPendingMapSnapshot();
    }
    setSaveState('idle');
    setAutosaveEnabled(true);
  }, [editor, doc, setSaveState]);

  useWhiteboardAutosave(editor, save, {
    enabled: autosaveEnabled,
    setSaveState,
  });

  // 注册自定义绘图工具：每个 editor 实例注册一次（WeakSet 防 strict-mode 重复 + 跨项目重挂载）
  const handleMount = (next: Editor) => {
    setEditor(next);
    if (!registeredEditors.has(next)) {
      try {
        next.root.addChild(ProRectangleTool);
      } catch (e) {
        // 已注册或注册失败（非致命：工具按钮会无效，但不崩）
        console.warn('[whiteboard] register ProRectangleTool failed', e);
      }
      registeredEditors.add(next);
    }
  };

  return (
    <div className="relative h-full w-full" data-project-id={projectId}>
      <Tldraw
        onMount={handleMount}
        shapeUtils={[ProRectangleUtil]}
        components={{ Toolbar: CustomToolbar }}
        // tldraw 生产 license key：构建期经 VITE_TLDRAW_LICENSE_KEY 注入。
        // 未配置时为 undefined → 维持水印（dev/无 key 的构建照常可用）。
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined}
      />
      <WhiteboardToolbar projectId={projectId} />
      <ProRectanglePanel />
    </div>
  );
}

const registeredEditors = new WeakSet<Editor>();
