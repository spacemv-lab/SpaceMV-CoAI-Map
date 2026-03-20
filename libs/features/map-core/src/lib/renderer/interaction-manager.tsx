/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import * as Cesium from 'cesium';
import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/use-map-store';
import { HoverOverlayManager } from './hover-overlay-manager';
import { getPointRendererEntries } from './point-renderer-registry';

interface HighlightState {
  entity: Cesium.Entity | null;
  originalColor: Cesium.Color | null;
  originalPixelSize: number | undefined;
  originalWidth: number | undefined;
  originalMaterial: Cesium.MaterialProperty | Cesium.Color | undefined;
}

interface HoveredPointState {
  layerId: string | null;
  featureId: string | null;
}

type GeoJsonFeature = {
  id: string;
  geometry: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

export function InteractionManager() {
  const viewerReady = useMapStore((state) => state.viewerReady);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const layers = useMapStore((state) => state.layers);
  const addPopup = useMapStore((state) => state.addPopup);
  const clearPopups = useMapStore((state) => state.clearPopups);
  const setHover = useMapStore((state) => state.setHover);

  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const highlightedRef = useRef<HighlightState>({
    entity: null,
    originalColor: null,
    originalPixelSize: undefined,
    originalWidth: undefined,
    originalMaterial: undefined,
  });
  const hoveredPointRef = useRef<HoveredPointState>({
    layerId: null,
    featureId: null,
  });
  const draggingEntityRef = useRef<Cesium.Entity | null>(null);

  useEffect(() => {
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer || !viewerReady) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const hoverOverlay = new HoverOverlayManager(viewer);
    handlerRef.current = handler;

    const restoreEntityHighlight = () => {
      const highlighted = highlightedRef.current;
      if (!highlighted.entity) return;

      if (highlighted.entity.point) {
        if (highlighted.originalColor) {
          highlighted.entity.point.color = new Cesium.ConstantProperty(
            highlighted.originalColor,
          );
        }
        if (highlighted.originalPixelSize !== undefined) {
          highlighted.entity.point.pixelSize = new Cesium.ConstantProperty(
            highlighted.originalPixelSize,
          );
        }
      } else if (
        highlighted.originalWidth !== undefined &&
        highlighted.entity.polyline
      ) {
        highlighted.entity.polyline.width = new Cesium.ConstantProperty(
          highlighted.originalWidth,
        );
      } else if (
        highlighted.originalMaterial !== undefined &&
        highlighted.entity.polygon
      ) {
        highlighted.entity.polygon.material = highlighted.originalMaterial;
      }

      highlighted.entity = null;
      highlighted.originalColor = null;
      highlighted.originalPixelSize = undefined;
      highlighted.originalWidth = undefined;
      highlighted.originalMaterial = undefined;
    };

    const applyEntityHighlight = (entity: Cesium.Entity) => {
      const highlighted = highlightedRef.current;
      if (highlighted.entity === entity) return;

      restoreEntityHighlight();

      highlighted.entity = entity;
      highlighted.originalColor = null;
      highlighted.originalPixelSize = undefined;
      highlighted.originalWidth = undefined;
      highlighted.originalMaterial = undefined;

      if (entity.point) {
        highlighted.originalColor = entity.point.color?.getValue(
          Cesium.JulianDate.now(),
        );
        highlighted.originalPixelSize = entity.point.pixelSize?.getValue(
          Cesium.JulianDate.now(),
        );
        entity.point.color = new Cesium.ConstantProperty(Cesium.Color.YELLOW);
        entity.point.pixelSize = new Cesium.ConstantProperty(
          (highlighted.originalPixelSize || 10) * 1.5,
        );
      } else if (entity.polyline) {
        highlighted.originalWidth = entity.polyline.width?.getValue(
          Cesium.JulianDate.now(),
        );
        entity.polyline.width = new Cesium.ConstantProperty(
          (highlighted.originalWidth || 2) + 2,
        );
      } else if (entity.polygon) {
        // 保存原始材质和颜色
        highlighted.originalMaterial = entity.polygon.material;
        // 使用完全不透明的亮黄色，避免与原始颜色混合
        entity.polygon.material = new Cesium.ColorMaterialProperty(
          Cesium.Color.YELLOW.withAlpha(0.95),
        );
      }
    };

    const clearPointHover = () => {
      hoverOverlay.clear();
      hoveredPointRef.current = {
        layerId: null,
        featureId: null,
      };
      setHover({ layerId: null, featureId: null });
    };

    const resolvePointFeature = (
      primitive: Cesium.PointPrimitive | Cesium.Billboard,
    ) => {
      for (const [layerId, renderer] of getPointRendererEntries()) {
        const featureId = renderer.findFeatureIdByPrimitive(primitive);
        if (featureId) {
          return { layerId, featureId };
        }
      }

      return null;
    };

    const applyPointHover = (
      layerId: string,
      featureId: string,
      primitive: Cesium.PointPrimitive | Cesium.Billboard,
    ) => {
      const hovered = hoveredPointRef.current;
      if (hovered.layerId === layerId && hovered.featureId === featureId) {
        return;
      }

      clearPointHover();
      restoreEntityHighlight();

      if (primitive instanceof Cesium.PointPrimitive) {
        const position = primitive.position;
        if (!position) return;

        hoverOverlay.showPoint({
          position,
          pixelSize: primitive.pixelSize || 10,
        });
      } else {
        const position = primitive.position;
        if (!position) return;

        hoverOverlay.showBillboard({
          position,
          scale: primitive.scale,
          width: primitive.width,
          height: primitive.height,
          sizeInMeters: primitive.sizeInMeters,
          rotation: primitive.rotation,
          horizontalOrigin: primitive.horizontalOrigin,
          verticalOrigin: primitive.verticalOrigin,
        });
      }

      hoveredPointRef.current = { layerId, featureId };
      setHover({ layerId, featureId });
    };

    handler.setInputAction(
      (event: { endPosition: Cesium.Cartesian2 }) => {
        if (draggingEntityRef.current) {
          const ray = viewer.camera.getPickRay(event.endPosition);
          if (ray) {
            const position = viewer.scene.globe.pick(ray, viewer.scene);
            if (position && draggingEntityRef.current.position) {
              (
                draggingEntityRef.current
                  .position as Cesium.ConstantPositionProperty
              ).setValue(position);
            }
          }
          return;
        }

        const pickedObject = viewer.scene.pick(event.endPosition);

        // 优化：快速路径 - 没有拾取到任何对象
        if (!Cesium.defined(pickedObject)) {
          restoreEntityHighlight();
          clearPointHover();
          viewer.container.style.cursor = 'default';
          return;
        }

        // 优化：拾取到 Entity 对象（面、线）
        if (pickedObject.id instanceof Cesium.Entity) {
          // 提前返回：如果已经高亮了同一个 entity，跳过重复操作
          if (highlightedRef.current.entity === pickedObject.id) {
            viewer.container.style.cursor = 'pointer';
            return;
          }
          clearPointHover();
          applyEntityHighlight(pickedObject.id);
          viewer.container.style.cursor = 'pointer';
          return;
        }

        // 优化：拾取到 PointPrimitive 或 Billboard（点图层）
        if (
          pickedObject.primitive instanceof Cesium.PointPrimitive ||
          pickedObject.primitive instanceof Cesium.Billboard
        ) {
          const primitive = pickedObject.primitive;

          if (hoverOverlay.containsPrimitive(primitive)) {
            restoreEntityHighlight();
            viewer.container.style.cursor = 'pointer';
            return;
          }

          const pointFeature = resolvePointFeature(primitive);
          if (pointFeature) {
            applyPointHover(
              pointFeature.layerId,
              pointFeature.featureId,
              primitive,
            );
            viewer.container.style.cursor = 'pointer';
            return;
          }
        }

        // 默认情况：没有拾取到任何有效对象
        restoreEntityHighlight();
        clearPointHover();
        viewer.container.style.cursor = 'default';
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE,
    );

    handler.setInputAction(
      (event: { position: Cesium.Cartesian2 }) => {
        const pickedObject = viewer.scene.pick(event.position);
        if (
          Cesium.defined(pickedObject) &&
          pickedObject.id instanceof Cesium.Entity
        ) {
          const entity = pickedObject.id;

          if (activeLayerId) {
            const layer = layers.find((candidate) => candidate.id === activeLayerId);
            if (layer && layer.data) {
              const feature = layer.data.features.find(
                (candidate) => candidate.id === entity.id,
              );
              if (
                feature &&
                feature.geometry &&
                (feature.geometry as GeoJsonFeature['geometry']).type === 'Point'
              ) {
                draggingEntityRef.current = entity;
                viewer.scene.screenSpaceCameraController.enableRotate = false;
              }
            }
          }
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_DOWN,
    );

    handler.setInputAction(
      (event: { position: Cesium.Cartesian2 }) => {
        if (draggingEntityRef.current) {
          const entity = draggingEntityRef.current;
          draggingEntityRef.current = null;
          viewer.scene.screenSpaceCameraController.enableRotate = true;

          const position = entity.position?.getValue(Cesium.JulianDate.now());
          if (position && activeLayerId) {
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const lng = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);

            const layer = layers.find((candidate) => candidate.id === activeLayerId);
            if (layer && layer.data) {
              const newFeatures = layer.data.features.map((feature) => {
                if (feature.id === entity.id) {
                  return {
                    ...feature,
                    geometry: {
                      ...feature.geometry,
                      coordinates: [lng, lat],
                    },
                  };
                }
                return feature;
              });

              useMapStore.getState().updateLayerData(activeLayerId, {
                ...layer.data,
                features: newFeatures,
              });
            }
          }
          return;
        }

        const pickedObject = viewer.scene.pick(event.position);
        if (
          Cesium.defined(pickedObject) &&
          pickedObject.id instanceof Cesium.Entity
        ) {
          const entity = pickedObject.id;
          const properties: Record<string, unknown> = {};

          if (entity.properties) {
            entity.properties.propertyNames.forEach((name: string) => {
              if (entity.properties) {
                properties[name] = entity.properties[name].getValue(
                  Cesium.JulianDate.now(),
                );
              }
            });
          }

          const cartesian = viewer.scene.pickPosition(event.position);
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const lng = Cesium.Math.toDegrees(cartographic.longitude);
            const lat = Cesium.Math.toDegrees(cartographic.latitude);

            clearPopups();
            addPopup({
              id: entity.id,
              position: [lng, lat],
              properties,
              layerName: 'Layer',
            });
          }
        } else {
          clearPopups();
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    handler.setInputAction(() => {
      if (draggingEntityRef.current) {
        const entity = draggingEntityRef.current;
        draggingEntityRef.current = null;
        viewer.scene.screenSpaceCameraController.enableRotate = true;

        const position = entity.position?.getValue(Cesium.JulianDate.now());
        if (position && activeLayerId) {
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const lng = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);

          const layer = layers.find((candidate) => candidate.id === activeLayerId);
          if (layer && layer.data) {
            const newFeatures = layer.data.features.map((feature) => {
              if (feature.id === entity.id) {
                return {
                  ...feature,
                  geometry: {
                    ...feature.geometry,
                    coordinates: [lng, lat],
                  },
                };
              }
              return feature;
            });
            useMapStore.getState().updateLayerData(activeLayerId, {
              ...layer.data,
              features: newFeatures,
            });
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
      hoverOverlay.destroy();
      handler.destroy();
      handlerRef.current = null;
      restoreEntityHighlight();
      setHover({ layerId: null, featureId: null });
    };
  }, [viewerReady, activeLayerId, layers, addPopup, clearPopups, setHover]);

  return null;
}
