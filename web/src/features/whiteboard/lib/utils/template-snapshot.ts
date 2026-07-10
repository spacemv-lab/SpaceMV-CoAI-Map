/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 白板模板快照：页级 { assets, shapes }。
 *
 * 不用 loadSnapshot（跨画板的 page/asset/shape id 冲突 + schema 版本风险，见 templates.ts 注释）。
 * 改成"捕获页内要素 + 引用的 asset"→ 应用时 id 全重映射为新 UUID + createAssets/createShapes。
 * image 的 dataURL 在 asset.props.src 里 → 载荷自包含 JSON，无外部存储依赖。
 */
import type { Editor, TLAsset, TLShape, TLShapeId, TLAssetId } from '@tldraw/tldraw';

export interface TemplateSnapshot {
  assets: TLAsset[];
  shapes: TLShape[];
}

/** 从 shape props 里取 assetId（image/bookmark 等引用 asset 的形状）；无则 undefined */
function getAssetId(shape: TLShape): string | undefined {
  const props = shape.props as Record<string, unknown> | undefined;
  const a = props?.assetId;
  return typeof a === 'string' ? a : undefined;
}

/**
 * 捕获当前页要素 + 引用的 asset 作为模板内容。
 * 不采 page/bookmark/camera/binding（应用时按当前页重摆、id 重映射）。
 * 空画板 → shapes=[]（调用方自行拦截）。
 */
export function captureTemplateSnapshot(editor: Editor): TemplateSnapshot {
  const store = editor.getSnapshot().document.store as Record<string, unknown>;
  const pageShapeIds = editor.getCurrentPageShapeIds();

  const shapes: TLShape[] = [];
  const assetIds = new Set<string>();
  for (const id of pageShapeIds) {
    const rec = store[id] as { typeName?: string } | undefined;
    if (!rec || rec.typeName !== 'shape') continue;
    const shape = rec as unknown as TLShape;
    shapes.push(shape);
    const aid = getAssetId(shape);
    if (aid) assetIds.add(aid);
  }

  const assets: TLAsset[] = [];
  for (const aid of assetIds) {
    const rec = store[aid] as { typeName?: string } | undefined;
    if (rec && rec.typeName === 'asset') {
      assets.push(rec as unknown as TLAsset);
    }
  }
  return { assets, shapes };
}

/**
 * 把模板内容应用到当前白板页（非破坏性）。
 *
 * - id 全重映射为新 UUID → 永不与已有要素冲突，不覆盖。
 * - 顶层 shape 的 parentId 指向当前页；子要素指向重映射后的父。
 * - image 的 assetId 经 assetMap 重映射。
 * - 整体平移到当前视口中心。
 * - **直接** createAssets/createShapes/nudgeShapes（不包 mergeRemoteChanges）——
 *   autosave 监听 source:'user'，直接调用才会触发持久化。
 */
export function applyTemplateSnapshot(editor: Editor, payload: TemplateSnapshot): void {
  if (!payload.shapes.length) return;
  const currentPageId = editor.getCurrentPageId();

  // 1. asset 重映射 oldAssetId → 新 UUID
  const assetMap = new Map<string, TLAssetId>();
  const newAssets: TLAsset[] = payload.assets.map((a) => {
    const newId = `asset:${crypto.randomUUID()}` as TLAssetId;
    assetMap.set(a.id, newId);
    return { ...a, id: newId };
  });

  // 2. shape 重映射 oldShapeId → 新 UUID；修正 parentId / props.assetId
  const shapeMap = new Map<string, TLShapeId>();
  for (const s of payload.shapes) {
    shapeMap.set(s.id, `shape:${crypto.randomUUID()}` as TLShapeId);
  }
  const newShapes: TLShape[] = payload.shapes.map((s) => {
    const newId = shapeMap.get(s.id)!;
    let parentId = s.parentId;
    if (parentId.startsWith('page:')) {
      parentId = currentPageId;
    } else if (shapeMap.has(parentId)) {
      parentId = shapeMap.get(parentId)!;
    }
    const props = { ...(s.props as Record<string, unknown>) };
    if (typeof props.assetId === 'string' && assetMap.has(props.assetId)) {
      props.assetId = assetMap.get(props.assetId);
    }
    return { ...s, id: newId, parentId, props } as unknown as TLShape;
  });

  // 3. 入板（user-source 事件 → 触发 autosave）
  if (newAssets.length) editor.createAssets(newAssets);
  editor.createShapes(newShapes);

  // 4. 整体平移到视口中心（非破坏性放置）
  const newIds = newShapes.map((s) => s.id);
  const bounds = editor.getShapesPageBounds(newIds);
  if (bounds) {
    const vp = editor.getViewportPageBounds();
    const dx = vp.midX - bounds.midX;
    const dy = vp.midY - bounds.midY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      editor.nudgeShapes(newIds, { x: dx, y: dy });
    }
  }

  // 5. 选中刚应用的要素组
  editor.setSelectedShapes(newIds);
}
