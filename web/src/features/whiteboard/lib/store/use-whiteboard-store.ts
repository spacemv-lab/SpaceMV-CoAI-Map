/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { create } from 'zustand';
import type { Editor } from '@tldraw/tldraw';

export type WhiteboardSaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * 白板 UI 状态（跨组件共享：editor 实例 + 保存状态）。
 * editor 由 <Tldraw onMount> 写入；保存状态由自动保存 hook 驱动，供工具栏展示。
 */
interface WhiteboardStore {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  saveState: WhiteboardSaveState;
  setSaveState: (state: WhiteboardSaveState) => void;
}

export const useWhiteboardStore = create<WhiteboardStore>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  saveState: 'idle',
  setSaveState: (saveState) => set({ saveState }),
}));
