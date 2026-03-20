/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * PointPrimitive 渲染器
 * 高性能点渲染方案，适合大规模点数据（10w+）
 */

import * as Cesium from 'cesium';
import { LayerState, FeatureOverride } from '../types/map-state';

/**
 * PointPrimitive 渲染器接口
 */
export interface IPointRenderer {
  /** 创建/更新点集合 */
  update(layer: LayerState, viewer: Cesium.Viewer): void;

  /** 销毁资源 */
  destroy(): void;

  /** 获取要素对应的 ID */
  getFeatureId(featureId: string): string;

  /** 更新单个要素的可见性 */
  setFeatureVisible(featureId: string, visible: boolean): void;

  /** 更新单个要素的标签可见性 */
  setFeatureLabelVisible(featureId: string, visible: boolean): void;

  /** 通过 primitive 反查要素 ID */
  findFeatureIdByPrimitive(
    primitive: Cesium.PointPrimitive | Cesium.Billboard,
  ): string | null;

  /** 获取要素对应的 primitive */
  getPrimitive(
    featureId: string,
  ): Cesium.PointPrimitive | Cesium.Billboard | null;
}

/**
 * PointPrimitive 渲染器实现
 */
export class PointPrimitiveRenderer implements IPointRenderer {
  private pointCollection: Cesium.PointPrimitiveCollection | null = null;
  private labelCollection: Cesium.LabelCollection | null = null;
  private featureIdMap: Map<string, Cesium.PointPrimitive> = new Map();
  private labelIdMap: Map<string, Cesium.Label> = new Map();
  private layerId: string | null = null;
  private viewer: Cesium.Viewer | null = null;

  /**
   * 更新点集合
   */
  update(layer: LayerState, viewer: Cesium.Viewer): void {
    this.viewer = viewer;

    console.log('[PointPrimitiveRenderer] update:', {
      layerId: layer.id,
      hasPointCollection: !!this.pointCollection,
      layerIdChanged: this.layerId !== layer.id,
    });

    // 1. 检查是否需要重建 collection（初次或 layer 变化）
    if (!this.pointCollection || this.layerId !== layer.id) {
      this.destroy();
      this.layerId = layer.id;

      this.pointCollection = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      );
    }

    // 2. 处理标签集合
    const hasLabels = !!layer.style.label?.text;
    if (hasLabels && !this.labelCollection) {
      this.labelCollection = viewer.scene.primitives.add(
        new Cesium.LabelCollection()
      );
    } else if (!hasLabels && this.labelCollection) {
      viewer.scene.primitives.remove(this.labelCollection);
      this.labelCollection = null;
      this.labelIdMap.clear();
    }

    // 3. 清空现有集合
    if (this.pointCollection) {
      this.pointCollection.removeAll();
    }
    this.featureIdMap.clear();

    if (!layer.data?.features || !this.pointCollection) return;

    // 4. 准备样式参数
    const defaultSize = layer.style.pointSize || 10;
    const defaultColor = Cesium.Color.fromCssColorString(
      layer.style.color || '#3b82f6'
    );
    const defaultOpacity = layer.style.opacity ?? 1;
    const outlineColor = Cesium.Color.fromCssColorString(
      layer.style.pointOutlineColor || '#000000'
    );
    const outlineWidth = layer.style.pointOutlineWidth || 0;
    const useMeters = layer.style.pointSizeUnit === 'meters';

    // 5. 批量添加点
    for (const feature of layer.data.features) {
      const coords = (feature.geometry as any)?.coordinates;
      if (!coords || coords.length < 2) continue;

      const [lng, lat, height = 0] = coords;
      const override = layer.featureOverrides?.[feature.id];

      // 合并样式
      const styleOverride = override?.styleOverride || {};
      const color = Cesium.Color.fromCssColorString(
        styleOverride.color || layer.style.color || '#3b82f6'
      ).withAlpha(styleOverride.opacity ?? defaultOpacity);

      // 应用高度偏移
      const heightOffset = styleOverride.pointHeightOffset ?? layer.style.pointHeightOffset ?? 0;
      const finalHeight = height + heightOffset;

      const point = this.pointCollection.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, finalHeight),
        pixelSize: styleOverride.pointSize || defaultSize,
        color: color,
        outlineColor: outlineColor,
        outlineWidth: outlineWidth,
        // 移除 heightReference，PointPrimitiveCollection 在 scene.primitives 中不支持该参数
        scaleByDistance: useMeters
          ? undefined
          : new Cesium.NearFarScalar(1.5e2, 1.0, 20e3, 0.5),
        show: override?.visible !== false,
      });

      this.featureIdMap.set(feature.id, point);

      // 添加标签
      if (this.labelCollection && layer.style.label?.text) {
        const showLabel = override?.showLabel ?? true;
        if (showLabel) {
          const label = this.addLabel(feature, layer, override?.labelOverride);
          if (label) {
            this.labelIdMap.set(feature.id, label);
          }
        }
      }
    }
  }

  /**
   * 添加标签
   */
  private addLabel(
    feature: any,
    layer: LayerState,
    override?: Partial<import('../types/map-state').LabelStyle>
  ): Cesium.Label | null {
    const labelStyle = layer.style.label!;
    const coords = (feature.geometry as any)?.coordinates;
    if (!coords || coords.length < 2) {
      // 不创建空 label，直接返回 null
      return null;
    }

    const [lng, lat, height = 0] = coords;

    return this.labelCollection!.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      text: override?.text || labelStyle.text || '',
      font: override?.font || labelStyle.font || '14px sans-serif',
      fillColor: Cesium.Color.fromCssColorString(
        override?.fillColor || labelStyle.fillColor || '#ffffff'
      ),
      outlineColor: Cesium.Color.fromCssColorString(
        override?.outlineColor || labelStyle.outlineColor || '#000000'
      ),
      outlineWidth: override?.outlineWidth || labelStyle.outlineWidth || 0,
      style: Cesium.LabelStyle[override?.style || labelStyle.style || 'FILL'],
      horizontalOrigin:
        Cesium.HorizontalOrigin[
          override?.horizontalOrigin || labelStyle.horizontalOrigin || 'CENTER'
        ],
      verticalOrigin:
        Cesium.VerticalOrigin[
          override?.verticalOrigin || labelStyle.verticalOrigin || 'CENTER'
        ],
      pixelOffset: new Cesium.Cartesian2(
        override?.pixelOffset?.[0] || labelStyle.pixelOffset?.[0] || 0,
        override?.pixelOffset?.[1] || labelStyle.pixelOffset?.[1] || 0
      ),
    });
  }

  /**
   * 设置要素可见性
   */
  setFeatureVisible(featureId: string, visible: boolean): void {
    const point = this.featureIdMap.get(featureId);
    if (point) {
      point.show = visible;
    }
  }

  /**
   * 设置要素标签可见性
   */
  setFeatureLabelVisible(featureId: string, visible: boolean): void {
    const label = this.labelIdMap.get(featureId);
    if (label) {
      label.show = visible;
    }
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
    if (!(primitive instanceof Cesium.PointPrimitive)) {
      return null;
    }

    for (const [featureId, candidate] of this.featureIdMap.entries()) {
      if (candidate === primitive) {
        return featureId;
      }
    }

    return null;
  }

  getPrimitive(
    featureId: string,
  ): Cesium.PointPrimitive | Cesium.Billboard | null {
    return this.featureIdMap.get(featureId) ?? null;
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 从场景中移除 primitives
    // 使用 try-catch 防止访问已销毁的 viewer.scene
    try {
      if (this.viewer && this.pointCollection && this.viewer.scene) {
        this.viewer.scene.primitives.remove(this.pointCollection);
      }
    } catch (e) {
      // viewer 已销毁，忽略错误
    }
    try {
      if (this.viewer && this.labelCollection && this.viewer.scene) {
        this.viewer.scene.primitives.remove(this.labelCollection);
      }
    } catch (e) {
      // viewer 已销毁，忽略错误
    }
    this.featureIdMap.clear();
    this.labelIdMap.clear();
    this.layerId = null;
    this.viewer = null;
  }
}
