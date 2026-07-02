/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 白板模板：用 editor API 在当前页直接摆放要素（标题/地图占位框/图例）。
 *
 * 不用 loadSnapshot（要手写脆弱的快照 JSON + asset/page id），改用代码构图——
 * 复用已验证的 createShape API，简单可靠。
 * 选中模板 → 在当前页中心按版式摆放；不覆盖已有要素。
 */
import type { Editor } from '@tldraw/tldraw';
import { PRO_RECT_DEFAULTS } from '../shapes/pro-rectangle-util';

export interface WhiteboardTemplate {
  id: string;
  name: string;
  /** 在当前页中心摆放该模板的要素 */
  apply: (editor: Editor) => void;
}

/** 在当前视口中心区域放一个文本形状 */
function placeText(
  editor: Editor,
  text: string,
  x: number,
  y: number,
  w: number,
  size: 'l' | 'xl' = 'l'
) {
  editor.createShape({
    type: 'text',
    x,
    y,
    props: { text, w, autoSize: false, size, font: 'sans', align: 'middle' },
  } as any);
}

/** 在 (x,y) 放一个 pro-rectangle（默认圆角纯色） */
function placeRect(
  editor: Editor,
  x: number,
  y: number,
  w: number,
  h: number,
  overrides: Partial<typeof PRO_RECT_DEFAULTS> = {}
) {
  editor.createShape({
    type: 'pro-rectangle',
    x,
    y,
    props: { ...PRO_RECT_DEFAULTS, w, h, ...overrides },
  } as any);
}

export const TEMPLATES: WhiteboardTemplate[] = [
  {
    id: 'single-map-title',
    name: '单地图 + 标题',
    apply: (editor) => {
      const v = editor.getViewportPageBounds();
      const cx = v.minX + v.width / 2;
      const mapW = Math.min(640, v.width * 0.7);
      const mapH = mapW * 0.6;
      placeText(editor, '地图标题', cx - mapW / 2, v.minY + v.height * 0.1, mapW, 'xl');
      placeRect(
        editor,
        cx - mapW / 2,
        v.minY + v.height * 0.2,
        mapW,
        mapH,
        { fillType: 'solid', fillColor: '#e0e7ff', strokeColor: '#6366f1', strokeWidth: 2 }
      );
    },
  },
  {
    id: 'dual-map-compare',
    name: '双图对比',
    apply: (editor) => {
      const v = editor.getViewportPageBounds();
      const gap = 40;
      const mapW = Math.min(320, (v.width - gap) * 0.4);
      const mapH = mapW * 0.7;
      const top = v.minY + v.height * 0.2;
      const leftX = v.minX + v.width / 2 - mapW - gap / 2;
      const rightX = v.minX + v.width / 2 + gap / 2;
      placeText(editor, '对比 A', leftX, top - 40, mapW);
      placeText(editor, '对比 B', rightX, top - 40, mapW);
      placeRect(editor, leftX, top, mapW, mapH, { fillColor: '#dbeafe', strokeColor: '#3b82f6' });
      placeRect(editor, rightX, top, mapW, mapH, { fillColor: '#dcfce7', strokeColor: '#22c55e' });
    },
  },
  {
    id: 'map-legend',
    name: '地图 + 图例',
    apply: (editor) => {
      const v = editor.getViewportPageBounds();
      const mapW = Math.min(560, v.width * 0.6);
      const mapH = mapW * 0.6;
      const mapX = v.minX + v.width * 0.15;
      const mapY = v.minY + v.height * 0.2;
      placeText(editor, '地图标题', mapX, mapY - 40, mapW, 'xl');
      placeRect(editor, mapX, mapY, mapW, mapH, { fillColor: '#f1f5f9', strokeColor: '#64748b' });
      // 图例框
      const legX = mapX + mapW + 24;
      const legY = mapY;
      const legW = 160;
      const legH = 140;
      placeRect(editor, legX, legY, legW, legH, {
        radius: 8, fillColor: '#ffffff', strokeColor: '#94a3b8', strokeWidth: 1,
      });
      placeText(editor, '图例', legX + 12, legY + 12, legW - 24, 'l');
    },
  },
];
