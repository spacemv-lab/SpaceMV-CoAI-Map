/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import * as Cesium from 'cesium';

type HoverPointOptions = {
  position: Cesium.Cartesian3;
  pixelSize: number;
};

type HoverBillboardOptions = {
  position: Cesium.Cartesian3;
  scale?: number;
  width?: number;
  height?: number;
  sizeInMeters?: boolean;
  rotation?: number;
  horizontalOrigin?: Cesium.HorizontalOrigin;
  verticalOrigin?: Cesium.VerticalOrigin;
};

export class HoverOverlayManager {
  private pointCollection: Cesium.PointPrimitiveCollection | null = null;
  private currentPoint: Cesium.PointPrimitive | null = null;

  constructor(private readonly viewer: Cesium.Viewer) {}

  showPoint(options: HoverPointOptions): void {
    this.clear();

    if (!this.pointCollection) {
      this.pointCollection = this.viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection(),
      );
    }

    this.currentPoint = this.pointCollection.add({
      position: options.position,
      pixelSize: options.pixelSize + 6,
      color: Cesium.Color.YELLOW.withAlpha(0.35),
      outlineColor: Cesium.Color.YELLOW.withAlpha(0.95),
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }

  showBillboard(options: HoverBillboardOptions): void {
    const baseSize = Math.max(options.width ?? 32, options.height ?? 32);
    const pixelSize = options.sizeInMeters
      ? 18
      : Math.max(14, Math.min(48, baseSize * (options.scale ?? 1) * 0.6));

    this.showPoint({
      position: options.position,
      pixelSize,
    });
  }

  containsPrimitive(
    primitive: Cesium.PointPrimitive | Cesium.Billboard,
  ): boolean {
    return primitive === this.currentPoint;
  }

  clear(): void {
    if (this.pointCollection && this.currentPoint) {
      this.pointCollection.remove(this.currentPoint);
      this.currentPoint = null;
    }
  }

  destroy(): void {
    this.clear();

    if (this.pointCollection) {
      this.viewer.scene.primitives.remove(this.pointCollection);
      this.pointCollection = null;
    }
  }
}
