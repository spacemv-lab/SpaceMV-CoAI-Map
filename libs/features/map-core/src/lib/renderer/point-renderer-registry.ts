/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { PointRendererManager } from './point-renderer';

const pointRendererRegistry = new Map<string, PointRendererManager>();

export function getPointRenderer(layerId: string): PointRendererManager | undefined {
  return pointRendererRegistry.get(layerId);
}

export function setPointRenderer(
  layerId: string,
  renderer: PointRendererManager,
): void {
  pointRendererRegistry.set(layerId, renderer);
}

export function deletePointRenderer(layerId: string): void {
  pointRendererRegistry.delete(layerId);
}

export function getPointRendererEntries(): Array<[string, PointRendererManager]> {
  return Array.from(pointRendererRegistry.entries());
}

export function clearPointRendererRegistry(): void {
  pointRendererRegistry.clear();
}
