/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 自定义底部工具条：在原生工具后追加「矩形」按钮，激活 pro-rectangle 绘图工具（拖拽创建）。
 * components.Toolbar 槽位替换；<DefaultToolbar> 内放 <DefaultToolbarContent/>（保留原生按钮）+ 我们的按钮。
 * 本组件在 <Tldraw> 内部渲染，可用 useEditor。
 */
import { DefaultToolbar, DefaultToolbarContent, useEditor } from '@tldraw/tldraw';
import { Square } from 'lucide-react';

export function CustomToolbar() {
  const editor = useEditor();
  const isActive = editor?.getCurrentToolId() === 'pro-rectangle';

  const handlePick = () => {
    editor?.setCurrentTool('pro-rectangle');
  };

  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <button
        onClick={handlePick}
        className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${
          isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
        }`}
        title="矩形（可调圆角/渐变，拖拽绘制）"
      >
        <Square className="w-4 h-4" />
      </button>
    </DefaultToolbar>
  );
}
