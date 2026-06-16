/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import * as Cesium from 'cesium';
import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/use-map-store';
import { LayerState, GeometryType } from '../types/map-state';
import {
  measureAsyncPerformance,
  startPerformanceSpan,
} from '../monitoring/performance-monitor';
import { createSingleFlightController } from '../runtime/single-flight';

/**
 * 检测 GeoJSON 数据的几何类型
 */
function detectGeometryType(geojson: any): GeometryType | undefined {
  if (!geojson || !geojson.features || !Array.isArray(geojson.features)) {
    return undefined;
  }

  // 查找第一个非空几何体
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom || !geom.type) continue;

    const type = geom.type.toUpperCase();
    if (type === 'POINT' || type === 'MULTIPOINT') {
      return 'POINT';
    }
    if (type === 'LINESTRING' || type === 'MULTILINESTRING') {
      return 'LINESTRING';
    }
    if (type === 'POLYGON' || type === 'MULTIPOLYGON') {
      return 'POLYGON';
    }
  }

  return undefined;
}

function waitForStableFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export function LayerRenderer() {
  const viewerReady = useMapStore((state) => state.viewerReady);
  const layers = useMapStore((state) => state.layers);
  const setSelection = useMapStore((state) => state.setSelection);
  const updateLayerData = useMapStore((state) => state.updateLayerData);

  // Track Cesium DataSources by Layer ID
  const dataSourcesRef = useRef<Map<string, Cesium.DataSource>>(new Map());
  // Track previous layer state to detect changes
  const prevLayersRef = useRef<Map<string, LayerState>>(new Map());
  // Click handler reference for cleanup
  const clickHandlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  // Mount status to prevent updates on unmounted component
  const isMounted = useRef(true);
  // Prevent the same layer from being loaded twice while a previous load is still in flight
  const layerTaskControllerRef = useRef(createSingleFlightController());

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Helper: Load GeoJSON data from API and save to store
  const loadGeoJsonData = async (layer: LayerState): Promise<void> => {
    if (layer.type !== 'GeoJSON' || !layer.sourceId) return;

    const geojsonUrl =
      layer.routingMetadata?.geojsonUrl ??
      `/api/datasets/${layer.sourceId}/geojson`;
    const data = await measureAsyncPerformance(
      {
        name: 'layer.fetch',
        sceneType: layer.runtimeRoute?.sceneType,
        layerId: layer.id,
        metadata: {
          datasetId: layer.sourceId,
          runtimePath: layer.runtimeRoute?.runtimePath,
          complexityLevel: layer.routingMetadata?.complexityLevel,
          url: geojsonUrl,
        },
      },
      async () => {
        const response = await fetch(geojsonUrl);
        if (!response.ok) {
          throw new Error(`API returned ${response.status} for ${geojsonUrl}`);
        }

        return response.json();
      },
      {
        phase: 'fetch-and-parse',
      },
    );

    updateLayerData(layer.id, data);
  };

  // Helper: Add Layer to Viewer
  const addLayerToViewer = async (layer: LayerState, viewer: Cesium.Viewer) => {
    try {
      // Check if already exists in viewer (orphan check)
      const existing = viewer.dataSources.getByName(layer.id);
      if (existing.length > 0) {
        const ds = existing[0];
        ds.show = layer.visible;
        dataSourcesRef.current.set(layer.id, ds);
        return;
      }

      let dataSource: Cesium.DataSource | null = null;

      if (layer.type === 'GeoJSON' && layer.sourceId) {
        const geojsonUrl =
          layer.routingMetadata?.geojsonUrl ??
          `/api/datasets/${layer.sourceId}/geojson`;
        const data = await measureAsyncPerformance(
          {
            name: 'layer.fetch',
            sceneType: layer.runtimeRoute?.sceneType,
            layerId: layer.id,
            metadata: {
              datasetId: layer.sourceId,
              runtimePath: layer.runtimeRoute?.runtimePath,
              complexityLevel: layer.routingMetadata?.complexityLevel,
              url: geojsonUrl,
            },
          },
          async () => {
            const response = await fetch(geojsonUrl);
            if (!response.ok) {
              throw new Error(`API returned ${response.status} for ${geojsonUrl}`);
            }

            return response.json();
          },
          {
            phase: 'fetch-and-parse',
          },
        );

        if (!isMounted.current) return;

        // Save data to store for all layer types (not just point layers)
        // 保存完整的 GeoJSON FeatureCollection，而不是只保存 features 数组
        updateLayerData(layer.id, data);

        // Detect geometry type from GeoJSON data
        const detectedGeometryType = detectGeometryType(data);

        const endAttach = startPerformanceSpan({
          name: 'layer.attach',
          sceneType: layer.runtimeRoute?.sceneType,
          layerId: layer.id,
          metadata: {
            datasetId: layer.sourceId,
            renderer: 'cesium-geojson',
            geometryType: detectedGeometryType,
          },
        });

        // Load GeoJSON with basic styling (for line/polygon)
        dataSource = await Cesium.GeoJsonDataSource.load(data, {
          stroke: Cesium.Color.fromCssColorString(
            layer.style.color || '#3388ff',
          ),
          fill: Cesium.Color.fromCssColorString(
            layer.style.color || '#3388ff',
          ).withAlpha(layer.style.opacity ?? 0.5),
          strokeWidth: layer.style.width || 2,
          pointRadius: layer.style.pointSize || 10,
        } as any);
        endAttach();
      } else if (layer.type === 'Draw' && layer.data) {
        const endAttach = startPerformanceSpan({
          name: 'layer.attach',
          sceneType: layer.runtimeRoute?.sceneType,
          layerId: layer.id,
          metadata: {
            renderer: 'draw-geojson',
          },
        });
        dataSource = await Cesium.GeoJsonDataSource.load(layer.data, {
          stroke: Cesium.Color.fromCssColorString(
            layer.style.color || '#ef4444',
          ),
          fill: Cesium.Color.fromCssColorString(
            layer.style.color || '#ef4444',
          ).withAlpha(layer.style.opacity ?? 0.5),
          strokeWidth: layer.style.width || 3,
          pointRadius: layer.style.pointSize || 10,
        } as any);
        endAttach();
      } else if (layer.type === 'Tile') {
        if (layer.sourceId) {
          if (layer.sourceId === '4') {
            dataSource = new Cesium.CustomDataSource(layer.id);
          } else {
            dataSource = new Cesium.CustomDataSource(layer.id);
          }
        } else {
          console.warn(`Tile layer missing sourceId`);
        }
      } else if (layer.type === 'Model') {
        const ds = new Cesium.CustomDataSource(layer.id);
        ds.entities.add({
          name: 'Sample Model',
          position: Cesium.Cartesian3.fromDegrees(104.06, 30.67, 0),
          point: { pixelSize: 10, color: Cesium.Color.YELLOW },
        });
        dataSource = ds;
      } else {
        console.warn(`Unsupported layer type: ${layer.type}`);
      }

      if (dataSource && isMounted.current) {
        dataSource.name = layer.id;
        dataSource.show = layer.visible;
        await viewer.dataSources.add(dataSource);
        dataSourcesRef.current.set(layer.id, dataSource);

        const endStableFrame = startPerformanceSpan({
          name: 'layer.first-stable-frame',
          sceneType: layer.runtimeRoute?.sceneType,
          layerId: layer.id,
          metadata: {
            datasetId: layer.sourceId,
            renderer: layer.type,
          },
        });
        await waitForStableFrame();
        endStableFrame();


        // 触发图层加载完成事件（供 benchmark 等外部消费者监听）
        window.dispatchEvent(
          new CustomEvent('map:layer-loaded', {
            detail: { layerId: layer.id, name: layer.name },
          }),
        );
      }
    } catch (error) {
      console.error(`Failed to load layer ${layer.name}:`, error);
    }
  };

  // Helper: Update Layer Style (for non-point layers)
  const updateLayerStyle = (
    layer: LayerState,
    dataSource: Cesium.DataSource,
  ) => {
    const entities = dataSource.entities.values;
    for (const entity of entities) {
      const color = Cesium.Color.fromCssColorString(
        layer.style.color || '#3388ff',
      );
      // 统一使用 0.5 作为默认透明度，确保所有图层一致性
      const opacity = layer.style.opacity ?? 0.5;

      if (entity.polygon) {
        entity.polygon.material = new Cesium.ColorMaterialProperty(
          color.withAlpha(opacity),
        );
        if (layer.style.outlineColor) {
          entity.polygon.outlineColor = new Cesium.ConstantProperty(
            Cesium.Color.fromCssColorString(layer.style.outlineColor),
          );
          entity.polygon.outlineWidth = new Cesium.ConstantProperty(
            layer.style.outlineWidth || 1,
          );
        }
      }
      if (entity.polyline) {
        // 处理线型样式（虚线/点线）
        const lineType = layer.style.lineType || 'solid';

        if (lineType === 'solid') {
          entity.polyline.material = new Cesium.ColorMaterialProperty(
            color.withAlpha(opacity),
          );
        } else if (lineType === 'dashed' || lineType === 'dotted') {
          // 虚线/点线使用 PolylineDashMaterialProperty
          // dashPattern 是 16 位掩码：0xFFFF = 实线，0x00FF = 8像素虚线
          const dashPattern = lineType === 'dotted' ? 0x0F0F : 0x00FF;
          entity.polyline.material = new Cesium.PolylineDashMaterialProperty({
            color: color.withAlpha(opacity),
            dashPattern,
          });
        } else {
          entity.polyline.material = new Cesium.ColorMaterialProperty(
            color.withAlpha(opacity),
          );
        }
        entity.polyline.width = new Cesium.ConstantProperty(
          layer.style.width || 2,
        );
      }
    }
  };

  // Main Sync Logic
  const syncLayers = async () => {
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer || !viewerReady) return;

    const validLayerIds = new Set(layers.map((l) => l.id));

    // 1. Remove orphaned data sources directly from Cesium viewer.
    for (let i = viewer.dataSources.length - 1; i >= 0; i--) {
      const ds = viewer.dataSources.get(i);
      if (ds.name && !validLayerIds.has(ds.name)) {
        viewer.dataSources.remove(ds, true);
        dataSourcesRef.current.delete(ds.name);
        prevLayersRef.current.delete(ds.name);
      }
    }

    // 2. Reconcile tracked refs with current Cesium data sources.
    for (let i = 0; i < viewer.dataSources.length; i++) {
      const ds = viewer.dataSources.get(i);
      if (ds.name && validLayerIds.has(ds.name)) {
        dataSourcesRef.current.set(ds.name, ds);
      }
    }

    // 3. Remove deleted layers and their renderers
    const trackedLayerIds = new Set([
      ...Array.from(dataSourcesRef.current.keys()),
    ]);

    for (const id of trackedLayerIds) {
      if (!validLayerIds.has(id)) {
        const ds = dataSourcesRef.current.get(id);
        if (ds) {
          viewer.dataSources.remove(ds, true);
          dataSourcesRef.current.delete(id);
        }
        prevLayersRef.current.delete(id);
      }
    }

    // 3. Add or Update layers
    for (const layer of layers) {
      let ds = dataSourcesRef.current.get(layer.id);
      const prevLayer = prevLayersRef.current.get(layer.id);

      // Check if we need to reload data
      const needsReload =
        (layer.type === 'Draw' && prevLayer && layer.data !== prevLayer.data) ||
        (layer.type === 'GeoJSON' &&
          prevLayer &&
          layer.sourceId !== prevLayer.sourceId);

      if (needsReload && ds) {
        viewer.dataSources.remove(ds, true);
        dataSourcesRef.current.delete(layer.id);
        ds = undefined;
      }

      // Non-point layers: use DataSource
      if (!ds) {
        await layerTaskControllerRef.current.run(layer.id, async () => {
          if (dataSourcesRef.current.has(layer.id)) {
            return;
          }

          await addLayerToViewer(layer, viewer);
        });
        ds = dataSourcesRef.current.get(layer.id);
      }

      if (ds) {
        // Update Visibility
        if (ds.show !== layer.visible) {
          ds.show = layer.visible;
        }

        // Update style
        const styleChanged =
          !prevLayer ||
          JSON.stringify(prevLayer.style) !== JSON.stringify(layer.style);

        if (styleChanged) {
          // For non-point layers, use traditional style update
          updateLayerStyle(layer, ds);
        }
      }

      // Update prev ref
      prevLayersRef.current.set(layer.id, layer);
    }
  };

  // Effect: Sync Layers on Change or Viewer Ready
  useEffect(() => {
    syncLayers();

    const handleViewerReady = () => {
      syncLayers();
    };

    window.addEventListener('map:viewer-ready', handleViewerReady);
    return () => {
      window.removeEventListener('map:viewer-ready', handleViewerReady);
    };
  }, [layers, viewerReady]);

  // Effect: Setup Picking Interaction
  useEffect(() => {
    if (!viewerReady) return;

    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const setupHandler = () => {
      const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
        .CESIUM_VIEWER;
      if (!viewer || clickHandlerRef.current) return;

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clickHandlerRef.current = handler;

      handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
        const pickedObject = viewer.scene.pick(event.position);

        if (
          Cesium.defined(pickedObject) &&
          pickedObject.id instanceof Cesium.Entity
        ) {
          const entity = pickedObject.id;

          let foundLayerId: string | null = null;

          for (const [layerId, ds] of Array.from(
            dataSourcesRef.current.entries(),
          )) {
            if (ds.entities.contains(entity)) {
              foundLayerId = layerId;
              break;
            }
          }

          if (foundLayerId) {
            const layer = useMapStore
              .getState()
              .layers.find((l) => l.id === foundLayerId);
            const properties: Record<string, unknown> = {};

            if (entity.properties) {
              const propertyNames = entity.properties.propertyNames;
              if (propertyNames && propertyNames.length > 0) {
                propertyNames.forEach((name: string) => {
                  properties[name] = entity.properties[name].getValue(
                    viewer.clock.currentTime,
                  );
                });
              }
            }

            if (layer?.data) {
              const feature = layer.data.features?.find(
                (f: { id: string; properties?: Record<string, unknown> }) =>
                  f.id === entity.id,
              );
              if (feature && feature.properties) {
                Object.assign(properties, feature.properties);
              }
            }

            setSelection({
              layerId: foundLayerId,
              featureId: entity.id,
              properties,
            });
            return;
          }
        }

        setSelection({ layerId: null, featureId: null, properties: null });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    };

    setupHandler();
    window.addEventListener('map:viewer-ready', setupHandler);

    return () => {
      window.removeEventListener('map:viewer-ready', setupHandler);
      if (clickHandlerRef.current) {
        clickHandlerRef.current.destroy();
        clickHandlerRef.current = null;
      }
    };
  }, [setSelection, viewerReady]);
  return null;
}
