/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 图像压缩工具：把高清 PNG dataURL 重新编码为更小的 JPEG dataURL。
 *
 * 白板里的地图截图（整页 ×2 像素比的 PNG 动辄几～十几 MB）若原样塞进 tldraw 文档，
 * 会导致 PUT /whiteboard 体积过大（撞上代理 body 限制 → 413）且保存慢、DB 行膨胀。
 * 地图截图不透明、无透明度需求 → 用 JPEG；最长边 cap、质量可调，可把几 MB 压到几百 KB。
 *
 * - compressImageDataUrl：可参数化（maxDim/quality），返回压缩后 dataURL 与新尺寸。
 * - compressPreview：发布预览图用的固定预设（薄封装，保持旧签名）。
 */
const MAX_DIM = 1600;
const QUALITY = 0.85;

export interface CompressOptions {
  /** 最长边像素上限（短边按比例缩放），默认 1600。 */
  maxDim?: number;
  /** JPEG 编码质量 0–1，默认 0.85。 */
  quality?: number;
}

export interface CompressedImage {
  dataUrl: string;
  w: number;
  h: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 压缩 dataURL 图像为 JPEG，返回新 dataURL 与压缩后尺寸。
 * 任何环节失败均降级返回原图（尺寸取原图自然尺寸；图片加载失败则 0）。
 */
export async function compressImageDataUrl(
  dataUrl: string,
  { maxDim = MAX_DIM, quality = QUALITY }: CompressOptions = {},
): Promise<CompressedImage> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch (err) {
    console.warn('[compressImageDataUrl] image load failed, returning original', err);
    return { dataUrl, w: 0, h: 0 };
  }

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl, w: srcW, h: srcH }; // 降级：拿不到 2D 上下文
    ctx.drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/jpeg', quality), w, h };
  } catch (err) {
    console.warn('[compressImageDataUrl] canvas encode failed, returning original', err);
    return { dataUrl, w: srcW, h: srcH }; // 降级
  }
}

/** 发布预览图压缩（固定预设，返回 dataURL）。 */
export async function compressPreview(dataUrl: string): Promise<string> {
  return (await compressImageDataUrl(dataUrl)).dataUrl;
}
