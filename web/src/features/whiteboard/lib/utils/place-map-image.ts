/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 把地图截图作为图片要素放入白板画布。
 * src 用 base64 dataURL（tldraw 原生支持），尺寸按地图画布像素并缩放到视口 80% 宽、居中。
 */
import type { Editor, TLAssetId } from '@tldraw/tldraw';
import type { PendingMapSnapshot } from './pending-snapshot';

export function placeMapImage(editor: Editor, snap: PendingMapSnapshot): void {
  const assetId = `asset:${crypto.randomUUID()}` as TLAssetId;

  editor.createAssets([
    {
      id: assetId,
      typeName: 'asset',
      type: 'image',
      props: {
        name: snap.name,
        src: snap.dataUrl,
        w: snap.w,
        h: snap.h,
        // 入板图经压缩为 JPEG；按 dataURL 前缀动态判定，兼容未压缩的 PNG
        mimeType: snap.dataUrl.match(/^data:([^;]+);/)?.[1] ?? 'image/png',
        isAnimated: false,
      },
      meta: {},
    },
  ]);

  // 缩放到视口 80% 宽（若地图更窄则原尺寸），居中放置
  const viewport = editor.getViewportPageBounds();
  const maxW = viewport.width * 0.8;
  const scale = snap.w > maxW ? maxW / snap.w : 1;
  const w = snap.w * scale;
  const h = snap.h * scale;
  const x = viewport.minX + (viewport.width - w) / 2;
  const y = viewport.minY + (viewport.height - h) / 2;

  editor.createShape({
    type: 'image',
    x,
    y,
    props: { assetId, w, h },
  });

  editor.selectNone();
}
