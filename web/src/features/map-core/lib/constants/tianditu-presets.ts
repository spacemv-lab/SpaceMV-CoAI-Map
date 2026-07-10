/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 天地图底图预设（单选）。
 *
 * 每个预设是一组有序 WMTS 图层码（底图 + 可选注记），渲染时按序叠加（后者画在上层）。
 * vec/img/ter 各含「无注记」变体；ibo 为单层全球境界。
 *
 * 消费方：
 * - maplibre-container.buildTiandituStyle —— 按 layers[] 构建 MapLibre style
 * - AddLayerModal「底图/瓦片」tab —— 列出 7 个单选项
 */
export const TIANDITU_PRESETS: Record<string, { label: string; layers: string[] }> = {
  'tianditu-vec':    { label: '天地图矢量',      layers: ['vec', 'cva'] },
  'tianditu-vec-na': { label: '天地图矢量无注记', layers: ['vec'] },
  'tianditu-img':    { label: '天地图影像',      layers: ['img', 'cia'] },
  'tianditu-img-na': { label: '天地图影像无注记', layers: ['img'] },
  'tianditu-ter':    { label: '天地图地形',      layers: ['ter', 'cta'] },
  'tianditu-ter-na': { label: '天地图地形无注记', layers: ['ter'] },
  'tianditu-ibo':    { label: '天地图全球境界',   layers: ['ibo'] },
};

/**
 * 是否暗色底图（决定审图号/叠放文字配色：暗→白字，亮→黑字）。
 * 当前仅影像(img)为暗；矢量/地形/境界为亮。新增暗色底图时在此扩展。
 */
export function isDarkBasemap(basemapKey: string | undefined | null): boolean {
  return !!basemapKey && basemapKey.includes('img');
}
