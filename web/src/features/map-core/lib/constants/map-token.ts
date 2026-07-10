/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../store/use-map-store';

/**
 * 天地图 Token —— 运行时由 API 下发（GET /api/tile-sources/tianditu-token，平台兜底）。
 *
 * 不再构建期注入 bundle（旧 VITE_TIANDITU_TOKEN）、不再源码硬编码 fallback。
 * token 由 useMapStore.loadTiandituToken() 在应用启动时拉取并写入 store；
 * 地图渲染器经 getTiandituToken() 同步读取。未就绪时返回空串
 * （底图瓦片会加载失败，但地图 UI 正常渲染，token 到达后由 basemap 切换/刷新恢复）。
 */
export function getTiandituToken(): string {
  return useMapStore.getState().tiandituToken ?? '';
}
