/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * 点渲染器统一入口
 * 根据配置动态选择渲染策略
 */

import * as Cesium from 'cesium';
import { LayerState, PointRenderMode } from '../types/map-state';
import { PointPrimitiveRenderer } from './point-primitive-renderer';
import { BillboardRenderer } from './billboard-renderer';
import type { IPointRenderer } from './point-primitive-renderer';

// Re-export types for convenience
export type { IPointRenderer } from './point-primitive-renderer';
export { PointPrimitiveRenderer } from './point-primitive-renderer';
export { BillboardRenderer } from './billboard-renderer';

/**
 * 渲染器工厂
 * @param mode 渲染模式
 * @returns 对应的渲染器实例
 */
export function createPointRenderer(mode: PointRenderMode): IPointRenderer {
  switch (mode) {
    case 'point':
      return new PointPrimitiveRenderer();
    case 'billboard':
      return new BillboardRenderer();
    case 'model':
      // TODO: 实现 ModelRenderer
      console.warn('Model renderer not implemented, falling back to billboard');
      return new BillboardRenderer();
    default:
      return new BillboardRenderer();
  }
}

/**
 * 点渲染器管理器
 * 统一管理点图层的渲染，支持动态切换渲染模式
 */
export class PointRendererManager implements IPointRenderer {
  private currentRenderer: IPointRenderer | null = null;
  private currentMode: PointRenderMode | null = null;
  private layerId: string | null = null;

  /**
   * 更新渲染
   * @param layer 图层配置
   * @param viewer Cesium Viewer
   */
  async update(layer: LayerState, viewer: Cesium.Viewer): Promise<void> {
    const mode = layer.style.pointRenderMode || 'billboard';

    console.log('[PointRendererManager] update:', {
      layerId: layer.id,
      currentMode: this.currentMode,
      newMode: mode,
      shouldRecreate: this.currentMode !== mode || this.layerId !== layer.id,
    });

    // 检查是否需要切换渲染器
    if (this.currentMode !== mode || this.layerId !== layer.id) {
      // 销毁旧渲染器
      if (this.currentRenderer) {
        this.currentRenderer.destroy();
        this.currentRenderer = null;
      }

      // 创建新渲染器
      this.currentRenderer = createPointRenderer(mode);
      this.currentMode = mode;
      this.layerId = layer.id;
    }

    // 委托给当前渲染器
    if (this.currentRenderer instanceof BillboardRenderer) {
      await this.currentRenderer.update(layer, viewer);
    } else if (this.currentRenderer) {
      this.currentRenderer.update(layer, viewer);
    }
  }

  /**
   * 设置要素可见性
   */
  setFeatureVisible(featureId: string, visible: boolean): void {
    this.currentRenderer?.setFeatureVisible(featureId, visible);
  }

  /**
   * 设置要素标签可见性
   */
  setFeatureLabelVisible(featureId: string, visible: boolean): void {
    this.currentRenderer?.setFeatureLabelVisible(featureId, visible);
  }

  /**
   * 获取要素 ID
   */
  getFeatureId(featureId: string): string {
    return featureId;
  }

  findFeatureIdByPrimitive(
    primitive: Cesium.PointPrimitive | Cesium.Billboard,
  ): string | null {
    return this.currentRenderer?.findFeatureIdByPrimitive(primitive) ?? null;
  }

  getPrimitive(
    featureId: string,
  ): Cesium.PointPrimitive | Cesium.Billboard | null {
    return this.currentRenderer?.getPrimitive(featureId) ?? null;
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    if (this.currentRenderer) {
      this.currentRenderer.destroy();
      this.currentRenderer = null;
    }
    this.currentMode = null;
    this.layerId = null;
  }

  /**
   * 获取当前渲染模式
   */
  getCurrentMode(): PointRenderMode | null {
    return this.currentMode;
  }

  getLayerId(): string | null {
    return this.layerId;
  }

  /**
   * 强制切换渲染模式（重新创建渲染器）
   */
  switchMode(mode: PointRenderMode): void {
    if (this.currentRenderer) {
      this.currentRenderer.destroy();
    }
    this.currentRenderer = createPointRenderer(mode);
    this.currentMode = mode;
  }
}
