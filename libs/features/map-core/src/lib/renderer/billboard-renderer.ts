/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


/**
 * Billboard 渲染器
 * 高表现力点渲染方案，支持自定义图片和符号
 * 使用独立的 BillboardCollection（不通过 Entity）
 */

import * as Cesium from 'cesium';
import { LayerState } from '../types/map-state';
import { createSymbolCanvas } from '../utils/symbol-canvas';
import { IPointRenderer } from './point-primitive-renderer';

/**
 * Billboard 渲染器实现
 */
export class BillboardRenderer implements IPointRenderer {
  private billboardCollection: Cesium.BillboardCollection | null = null;
  private labelCollection: Cesium.LabelCollection | null = null;
  private featureIdMap: Map<string, Cesium.Billboard> = new Map();
  private labelIdMap: Map<string, Cesium.Label> = new Map();
  private layerId: string | null = null;
  private viewer: Cesium.Viewer | null = null;
  private imageCache: Map<string, string | HTMLCanvasElement> = new Map();

  /**
   * 更新广告牌集合
   */
  async update(layer: LayerState, viewer: Cesium.Viewer): Promise<void> {
    this.viewer = viewer;

    console.log('[BillboardRenderer] update:', {
      layerId: layer.id,
      hasBillboardCollection: !!this.billboardCollection,
      layerIdChanged: this.layerId !== layer.id,
    });

    // 1. 检查是否需要重建 collection
    if (!this.billboardCollection || this.layerId !== layer.id) {
      this.destroy();
      this.layerId = layer.id;

      // 创建独立的 BillboardCollection 并添加到场景
      this.billboardCollection = viewer.scene.primitives.add(
        new Cesium.BillboardCollection(),
      );
    }

    // 2. 处理标签集合
    const hasLabels = !!layer.style.label?.text;
    if (hasLabels && !this.labelCollection) {
      this.labelCollection = viewer.scene.primitives.add(
        new Cesium.LabelCollection(),
      );
    } else if (!hasLabels && this.labelCollection) {
      viewer.scene.primitives.remove(this.labelCollection);
      this.labelCollection = null;
      this.labelIdMap.clear();
    }

    // 3. 清空现有
    if (this.billboardCollection) {
      this.billboardCollection.removeAll();
    }
    if (this.labelCollection) {
      this.labelCollection.removeAll();
    }
    this.featureIdMap.clear();
    this.labelIdMap.clear();

    if (!layer.data?.features || !this.billboardCollection) return;

    // 4. 准备图片资源
    const imageSource = await this.prepareImageSource(layer);

    // 5. 准备样式参数
    const defaultSize = layer.style.pointSize || 32;
    const defaultColor = Cesium.Color.fromCssColorString(
      layer.style.color || '#ffffff',
    );
    const defaultOpacity = layer.style.opacity ?? 1;
    const useMeters = layer.style.pointSizeUnit === 'meters';
    const rotation = (layer.style.pointRotation || 0) * (Math.PI / 180);

    const horizontalOrigin =
      Cesium.HorizontalOrigin[layer.style.pointHorizontalOrigin || 'CENTER'] ||
      Cesium.HorizontalOrigin.CENTER;
    const verticalOrigin =
      Cesium.VerticalOrigin[layer.style.pointVerticalOrigin || 'CENTER'] ||
      Cesium.VerticalOrigin.CENTER;

    // 6. 批量添加广告牌
    for (const feature of layer.data.features) {
      const coords = (feature.geometry as any)?.coordinates;
      if (!coords || coords.length < 2) continue;

      const [lng, lat, height = 0] = coords;
      const override = layer.featureOverrides?.[feature.id];

      // 合并样式
      const styleOverride = override?.styleOverride || {};
      const color = Cesium.Color.fromCssColorString(
        styleOverride.color || layer.style.color || '#ffffff',
      ).withAlpha(styleOverride.opacity ?? defaultOpacity);

      const size = styleOverride.pointSize || defaultSize;

      // 应用高度偏移
      const heightOffset = styleOverride.pointHeightOffset ?? layer.style.pointHeightOffset ?? 0;
      const finalHeight = height + heightOffset;

      const billboard = this.billboardCollection.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, finalHeight),
        image: imageSource,
        scale: useMeters ? 1 : size / 32,
        width: useMeters ? size : undefined,
        height: useMeters ? size : undefined,
        sizeInMeters: useMeters,
        color: color,
        rotation: rotation,
        horizontalOrigin: horizontalOrigin,
        verticalOrigin: verticalOrigin,
        show: override?.visible !== false,
      });

      this.featureIdMap.set(feature.id, billboard);

      // 添加标签
      if (this.labelCollection && layer.style.label?.text) {
        const showLabel = override?.showLabel ?? true;
        if (showLabel) {
          const label = this.addLabel(feature, layer, override?.labelOverride, finalHeight);
          this.labelIdMap.set(feature.id, label);
        }
      }
    }
  }

  /**
   * 准备图片资源
   * 优先级：自定义上传 > Canvas 生成符号 > 默认圆形
   */
  private async prepareImageSource(
    layer: LayerState,
  ): Promise<string | HTMLCanvasElement> {
    // 1. 自定义上传的图片
    if (layer.style.pointImageUri) {
      if (this.imageCache.has(layer.style.pointImageUri)) {
        return this.imageCache.get(layer.style.pointImageUri)!;
      }

      // 如果是 URL 或 dataURL，直接使用
      if (
        layer.style.pointImageUri.startsWith('http') ||
        layer.style.pointImageUri.startsWith('data:')
      ) {
        this.imageCache.set(
          layer.style.pointImageUri,
          layer.style.pointImageUri,
        );
        return layer.style.pointImageUri;
      }
    }

    // 2. Canvas 生成符号
    const symbol = layer.style.pointSymbol || 'circle';
    const color = layer.style.color || '#ffffff';
    const size = 64; // Canvas 尺寸

    const cacheKey = `symbol-${symbol}-${color}-${size}`;
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }

    const canvas = createSymbolCanvas(symbol, color, size);
    this.imageCache.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * 添加标签
   * @param feature 要素
   * @param layer 图层配置
   * @param override 覆盖配置
   * @param finalHeight 最终高度（与 Billboard 保持一致）
   */
  private addLabel(
    feature: any,
    layer: LayerState,
    override?: Partial<import('../types/map-state').LabelStyle>,
    finalHeight?: number,
  ): Cesium.Label {
    const labelStyle = layer.style.label!;
    const coords = (feature.geometry as any)?.coordinates;
    if (!coords || coords.length < 2) {
      return this.labelCollection!.add({ show: false });
    }

    const [lng, lat, height = 0] = coords;

    // 解析属性字段值：{fieldName} -> actualValue
    const rawText = override?.text || labelStyle.text || '';
    const text = rawText.replace(/\{(\w+)\}/g, (match, fieldName) => {
      return feature.properties?.[fieldName] || match;
    });

    // 计算 Label 偏移：使用 layer.style.label.labelOffset（用户配置的距离）
    // labelOffset 表示 Billboard 顶部到文字底部的距离（像素）
    const labelOffset = layer.style.label?.labelOffset ?? 10;

    return this.labelCollection!.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, finalHeight || height),
      text: text,
      font: override?.font || labelStyle.font || '14px sans-serif',
      fillColor: Cesium.Color.fromCssColorString(
        override?.fillColor || labelStyle.fillColor || '#ffffff',
      ),
      outlineColor: Cesium.Color.fromCssColorString(
        override?.outlineColor || labelStyle.outlineColor || '#000000',
      ),
      outlineWidth: override?.outlineWidth || labelStyle.outlineWidth || 0,
      style: Cesium.LabelStyle[override?.style || labelStyle.style || 'FILL'],
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -labelOffset),
    });
  }

  /**
   * 设置要素可见性
   */
  setFeatureVisible(featureId: string, visible: boolean): void {
    const billboard = this.featureIdMap.get(featureId);
    if (billboard) {
      billboard.show = visible;
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
    if (!(primitive instanceof Cesium.Billboard)) {
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
    if (this.viewer && this.billboardCollection) {
      this.viewer.scene.primitives.remove(this.billboardCollection);
    }
    if (this.viewer && this.labelCollection) {
      this.viewer.scene.primitives.remove(this.labelCollection);
    }
    this.featureIdMap.clear();
    this.labelIdMap.clear();
    this.imageCache.clear();
    this.layerId = null;
    this.viewer = null;
  }
}
