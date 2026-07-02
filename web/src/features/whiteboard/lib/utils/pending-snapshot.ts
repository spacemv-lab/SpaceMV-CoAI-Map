/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 待处理的地图截图（/map「加入白板」→ /board）的传递槽。
 *
 * 模块级、非持久：跨页内导航（非整页刷新）存活，刷新即丢——符合「截图优先、
 * 放完即用」的流程。比塞进 1500 行的 map store 更轻、不引入 feature 耦合。
 */
export interface PendingMapSnapshot {
  dataUrl: string;
  w: number;
  h: number;
  name: string;
}

let pending: PendingMapSnapshot | null = null;

export function getPendingMapSnapshot(): PendingMapSnapshot | null {
  return pending;
}

export function setPendingMapSnapshot(snapshot: PendingMapSnapshot): void {
  pending = snapshot;
}

export function clearPendingMapSnapshot(): void {
  pending = null;
}
