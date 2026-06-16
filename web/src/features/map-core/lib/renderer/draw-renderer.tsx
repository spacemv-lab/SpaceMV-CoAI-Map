/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import * as Cesium from 'cesium';
import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/use-map-store';
import { v4 as uuidv4 } from 'uuid';
import { GeometryType } from '../types/map-state';
import { STYLE_CONFIGS } from '../constants/style-config';

/**
 * Draw 图层 ID 常量
 * 每个几何类型对应一个独立图层，避免渲染器选择错误
 */
const DRAW_LAYER_IDS = {
  POINT: 'user-drawings-points',
  LINESTRING: 'user-drawings-lines',
  POLYGON: 'user-drawings-polygons',
} as const;

/**
 * Draw 图层名称
 */
const DRAW_LAYER_NAMES = {
  POINT: '我的标注-点',
  LINESTRING: '我的标注-线',
  POLYGON: '我的标注-面',
} as const;

export function DrawRenderer() {
  const mode = useMapStore((state) => state.interaction.mode);
  const viewerReady = useMapStore((state) => state.viewerReady);
  const addLayer = useMapStore((state) => state.addLayer);
  const setInteractionMode = useMapStore((state) => state.setInteractionMode);
  const updateLayer = useMapStore((state) => state.updateLayer);
  const layers = useMapStore((state) => state.layers);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const setActiveLayer = useMapStore((state) => state.setActiveLayer);

  const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer }).CESIUM_VIEWER;
  const handlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  
  // Temporary storage for drawing
  const activeShapePointsRef = useRef<Cesium.Cartesian3[]>([]);
  const activeShapeRef = useRef<Cesium.Entity | null>(null);
  const floatingPointRef = useRef<Cesium.Entity | null>(null);

  useEffect(() => {
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer }).CESIUM_VIEWER;
    if (!viewer || !viewerReady) return;

    // Clean up previous handler
    if (handlerRef.current) {
      handlerRef.current.destroy();
      handlerRef.current = null;
    }

    // Clean up previous temp entities
    if (activeShapeRef.current) {
      viewer.entities.remove(activeShapeRef.current);
      activeShapeRef.current = null;
    }
    if (floatingPointRef.current) {
      viewer.entities.remove(floatingPointRef.current);
      floatingPointRef.current = null;
    }
    activeShapePointsRef.current = [];

    if (mode === 'default' || mode === 'select' || mode.startsWith('measure')) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    // Left Click: Add Point
    handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
      // Pick position (using terrain or ellipsoid)
      const ray = viewer.camera.getPickRay(event.position);
      if (!ray) return;
      
      const position = viewer.scene.globe.pick(ray, viewer.scene);
      if (!position) return;

      if (mode === 'draw_point') {
        createPoint(position);
        // Reset mode after single point? Or keep adding? Let's keep adding.
        return;
      }

      if (activeShapePointsRef.current.length === 0) {
        activeShapePointsRef.current.push(position);
        const dynamicPositions = new Cesium.CallbackProperty(() => {
            if (mode === 'draw_polygon') {
                return new Cesium.PolygonHierarchy(activeShapePointsRef.current);
            }
            return activeShapePointsRef.current;
        }, false);

        activeShapeRef.current = drawShape(dynamicPositions, mode) || null;
      }
      
      activeShapePointsRef.current.push(position);
      // createPoint(position); // Optional: show vertices
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse Move: Update Floating Point
    handler.setInputAction((event: { endPosition: Cesium.Cartesian2 }) => {
      if (mode === 'draw_point') return;

      const ray = viewer.camera.getPickRay(event.endPosition);
      if (!ray) return;
      const position = viewer.scene.globe.pick(ray, viewer.scene);
      if (!position) return;

      if (activeShapePointsRef.current.length > 0) {
        // Update last point (floating)
        activeShapePointsRef.current.pop();
        activeShapePointsRef.current.push(position);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Double Click: Finish Drawing (for line/polygon)
    handler.setInputAction(() => {
      if (mode === 'draw_line' || mode === 'draw_polygon') {
        finishDrawing();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  }, [mode, viewerReady]);

  const createPoint = (position: Cesium.Cartesian3) => {
    // Convert to GeoJSON Point
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);

    const feature = {
      type: 'Feature',
      id: uuidv4(),
      properties: { name: 'New Point' },
      geometry: {
        type: 'Point',
        coordinates: [lng, lat],
      },
    };

    addToDrawLayer(feature);
  };

  const drawShape = (positionData: Cesium.CallbackProperty | Cesium.Cartesian3[], type: string) => {
    let shape;
    if (type === 'draw_line') {
      shape = viewer.entities.add({
        polyline: {
          positions: positionData,
          clampToGround: true,
          width: 3,
          material: Cesium.Color.RED,
        },
      });
    } else if (type === 'draw_polygon') {
      shape = viewer.entities.add({
        polygon: {
          hierarchy: positionData,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.RED.withAlpha(0.5)),
          outline: true,
          outlineColor: Cesium.Color.RED,
          outlineWidth: 2,
        },
      });
    }
    return shape;
  };

  const finishDrawing = () => {
    if (activeShapePointsRef.current.length < 2) return;
    
    // Remove last floating point
    activeShapePointsRef.current.pop();

    const positions = activeShapePointsRef.current;
    if (positions.length === 0) return;

    // Convert to GeoJSON
    const coordinates = positions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return [Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude)];
    });

    let feature: Record<string, unknown> | undefined;

    if (mode === 'draw_line') {
      feature = {
        type: 'Feature',
        id: uuidv4(),
        properties: { name: 'New Line' },
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
        },
      };
    } else if (mode === 'draw_polygon') {
        // Close the loop for polygon
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]);
        }
        feature = {
            type: 'Feature',
            id: uuidv4(),
            properties: { name: 'New Polygon' },
            geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
            },
        };
    }

    if (feature) {
      addToDrawLayer(feature);
    }

    // Reset
    if (activeShapeRef.current) {
      viewer.entities.remove(activeShapeRef.current);
      activeShapeRef.current = null;
    }
    activeShapePointsRef.current = [];
    setInteractionMode('default');
  };

  const addToDrawLayer = (feature: Record<string, unknown>) => {
    // Infer geometry type from feature
    const geomTypeRaw = (feature.geometry as { type: string } | undefined)?.type;
    let geometryType: GeometryType | undefined;
    if (geomTypeRaw) {
      const upperType = geomTypeRaw.toUpperCase();
      if (upperType === 'POINT' || upperType === 'MULTIPOINT') {
        geometryType = 'POINT';
      } else if (upperType === 'LINESTRING' || upperType === 'MULTILINESTRING') {
        geometryType = 'LINESTRING';
      } else if (upperType === 'POLYGON' || upperType === 'MULTIPOLYGON') {
        geometryType = 'POLYGON';
      }
    }

    if (!geometryType) {
      console.warn('[DrawRenderer] Unknown geometry type, skipping feature');
      return;
    }

    // Check if there's an active edit layer - route drawn features to it
    const currentActiveLayerId = useMapStore.getState().activeLayerId;
    if (currentActiveLayerId) {
      const targetLayer = useMapStore.getState().layers.find(
        (l) => l.id === currentActiveLayerId,
      );
      if (targetLayer) {
        const newData = {
          type: 'FeatureCollection',
          features: [
            ...(targetLayer.data?.features || []),
            feature as { id: string; properties?: Record<string, unknown>; geometry: unknown },
          ],
        };
        updateLayer(currentActiveLayerId, { data: newData });
      }
      return;
    }

    // No active edit layer - route to default user-drawings layer
    const defaultGeometryTypeMap: Record<string, GeometryType> = {
      'draw_point': 'POINT',
      'draw_line': 'LINESTRING',
      'draw_polygon': 'POLYGON',
    };
    const mode = useMapStore.getState().interaction.mode;
    const fallbackGeometryType = defaultGeometryTypeMap[mode] ?? geometryType;

    // Select target layer based on geometry type
    const targetLayerId = DRAW_LAYER_IDS[fallbackGeometryType as keyof typeof DRAW_LAYER_IDS];
    const targetLayerName = DRAW_LAYER_NAMES[fallbackGeometryType as keyof typeof DRAW_LAYER_NAMES];

    // Check if layer exists, create if not
    const currentLayers = useMapStore.getState().layers;
    const existingLayer = currentLayers.find((l) => l.id === targetLayerId);

    if (!existingLayer) {
      const styleConfig = STYLE_CONFIGS[fallbackGeometryType as keyof typeof STYLE_CONFIGS];
      const defaultStyle = styleConfig?.defaultStyle || { color: '#ff0000' };
      addLayer({
        id: targetLayerId,
        name: targetLayerName,
        type: 'Draw',
        visible: true,
        opacity: 1,
        geometryType: fallbackGeometryType,
        style: defaultStyle,
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Add feature to target layer
    const updatedLayers = useMapStore.getState().layers;
    const targetLayer = updatedLayers.find((l) => l.id === targetLayerId);
    if (targetLayer) {
      const newData = {
        ...targetLayer.data,
        type: targetLayer.data?.type || 'FeatureCollection',
        features: [...(targetLayer.data?.features || []), feature as { id: string; properties?: Record<string, unknown>; geometry: unknown }]
      };

      updateLayer(targetLayerId, { data: newData });
    }
  };

  return null;
}
