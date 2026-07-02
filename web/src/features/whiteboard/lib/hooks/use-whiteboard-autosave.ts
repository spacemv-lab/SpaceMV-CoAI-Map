/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 白板自动保存：订阅 editor.store 变更，5s 防抖后 PUT getSnapshot()。
 * 节奏对齐地图态自动保存。仅在 enabled（初始加载完成后）订阅，避免 loadSnapshot 触发空保存。
 */
import { useEffect, useRef } from 'react';
import type { Editor } from '@tldraw/tldraw';
import type { WhiteboardSaveState } from '../store/use-whiteboard-store';

const AUTOSAVE_DEBOUNCE_MS = 5000;

interface Options {
  enabled: boolean;
  setSaveState: (state: WhiteboardSaveState) => void;
}

export function useWhiteboardAutosave(
  editor: Editor | null,
  save: (document: unknown) => Promise<void>,
  { enabled, setSaveState }: Options
) {
  // 保持最新的 save/saveState，避免 effect 频繁重订阅
  const saveRef = useRef(save);
  saveRef.current = save;
  const setSaveStateRef = useRef(setSaveState);
  setSaveStateRef.current = setSaveState;

  useEffect(() => {
    if (!editor || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = editor.store.listen(() => {
      if (timer) clearTimeout(timer);
      setSaveStateRef.current('saving');
      timer = setTimeout(async () => {
        try {
          await saveRef.current(editor.getSnapshot());
          setSaveStateRef.current('saved');
        } catch {
          setSaveStateRef.current('error');
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    }, { source: 'user', scope: 'document' });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [editor, enabled]);
}
