/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import * as Cesium from 'cesium';
import { useEffect, useRef } from 'react';
import { useMapStore } from '../store/use-map-store';
import { LayerState, GeometryType } from '../types/map-state';
import { PointRendererManager } from './point-renderer';
import {
  clearPointRendererRegistry,
  deletePointRenderer,
  getPointRenderer,
  getPointRendererEntries,
  setPointRenderer,
} from './point-renderer-registry';

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

// Mock Data Loader
const getMockGeoJSON = (id: string) => {
  switch (id) {
    case '1': // Chengdu Zone
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Chengdu Zone' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [104.04, 30.65],
                  [104.08, 30.65],
                  [104.08, 30.69],
                  [104.04, 30.69],
                  [104.04, 30.65],
                ],
              ],
            },
          },
        ],
      };
    case '2': // Building models (placeholder points)
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Building A', height: 100 },
            geometry: { type: 'Point', coordinates: [104.06, 30.67] },
          },
          {
            type: 'Feature',
            properties: { name: 'Building B', height: 150 },
            geometry: { type: 'Point', coordinates: [104.07, 30.68] },
          },
        ],
      };
    case '3': // City Roads
      return {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Main Road' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [104.05, 30.66],
                [104.09, 30.68],
              ],
            },
          },
        ],
      };
    default:
      return null;
  }
};

export function LayerRenderer() {
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Helper: Load GeoJSON data from API and save to store
  const loadGeoJsonData = async (layer: LayerState): Promise<void> => {
    if (layer.type !== 'GeoJSON' || !layer.sourceId) return;

    try {
      const response = await fetch(`/api/datasets/${layer.sourceId}/geojson`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      // Save data to store
      updateLayerData(layer.id, data);
      console.log(
        `[LayerRenderer] Saved GeoJSON data to store for layer: ${layer.name}`,
      );
    } catch (err) {
      console.warn(
        `Failed to fetch GeoJSON from API for layer ${layer.name}, falling back to mock.`,
        err,
      );
      const mockData = getMockGeoJSON(layer.sourceId);
      if (mockData) {
        updateLayerData(layer.id, mockData);
        console.log(
          `[LayerRenderer] Loaded mock data for layer: ${layer.name}`,
        );
      }
    }
  };

  // Helper: Add Layer to Viewer
  const addLayerToViewer = async (layer: LayerState, viewer: Cesium.Viewer) => {
    try {
      // Point layers: load data and render with PointRenderer, skip DataSource
      if (layer.geometryType === 'POINT') {
        await loadGeoJsonData(layer);
        await updatePointLayerStyle(layer, viewer);
        console.log(
          `[LayerRenderer] Point layer ${layer.name} added with PointRenderer.`,
        );
        return;
      }

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
        let data = null;

        try {
          const response = await fetch(
            `/api/datasets/${layer.sourceId}/geojson`,
          );
          if (response.ok) {
            data = await response.json();
            console.log(`Loaded GeoJSON from API for layer: ${layer.name}`);
          } else {
            throw new Error(`API returned ${response.status}`);
          }
        } catch (err) {
          console.warn(
            `Failed to fetch GeoJSON from API for layer ${layer.name}, falling back to mock.`,
            err,
          );
          data = getMockGeoJSON(layer.sourceId);
          if (data) {
            console.log(`Loaded mock data for layer: ${layer.name}`);
          }
        }

        if (!data) {
          console.error(`No data available for layer ${layer.name}`);
          return;
        }

        if (!isMounted.current) return;

        // Save data to store for all layer types (not just point layers)
        // 保存完整的 GeoJSON FeatureCollection，而不是只保存 features 数组
        updateLayerData(layer.id, data);
        console.log(
          `[LayerRenderer] Saved GeoJSON data to store for layer: ${layer.name}`,
        );

        // Detect geometry type from GeoJSON data
        const detectedGeometryType = detectGeometryType(data);
        console.log(
          `Detected geometry type for ${layer.name}: ${detectedGeometryType}`,
        );

        // Load GeoJSON with basic styling (for line/polygon)
        // Point styling is handled by PointRenderer
        dataSource = await Cesium.GeoJsonDataSource.load(data, {
          stroke: Cesium.Color.fromCssColorString(
            layer.style.color || '#3388ff',
          ),
          fill: Cesium.Color.fromCssColorString(
            layer.style.color || '#3388ff',
          ).withAlpha(layer.style.opacity ?? 0.5),
          strokeWidth: layer.style.width || 2,
          // Disable point styling - we handle it separately
          pointRadius: 0,
        });
      } else if (layer.type === 'Draw' && layer.data) {
        dataSource = await Cesium.GeoJsonDataSource.load(layer.data, {
          stroke: Cesium.Color.fromCssColorString(
            layer.style.color || '#ef4444',
          ),
          fill: Cesium.Color.fromCssColorString(
            layer.style.color || '#ef4444',
          ).withAlpha(layer.style.opacity ?? 0.5),
          strokeWidth: layer.style.width || 3,
          pointRadius: 0,
        });
      } else if (layer.type === 'Tile') {
        if (layer.sourceId) {
          if (layer.sourceId === '4') {
            console.log('Terrain loaded (Mock)');
            dataSource = new Cesium.CustomDataSource(layer.id);
          } else {
            console.log(`Attempting to load Tile layer`);
            dataSource = new Cesium.CustomDataSource(layer.id);
          }
        } else {
          console.warn(`Tile layer missing sourceId`);
        }
      } else if (layer.type === 'Model') {
        console.log('Model layer loaded (Mock)');
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
        console.log(`Layer ${layer.name} added successfully.`);
      }
    } catch (error) {
      console.error(`Failed to load layer ${layer.name}:`, error);
    }
  };

  // Helper: Update Point Layer Styling using PointRenderer
  const updatePointLayerStyle = async (
    layer: LayerState,
    viewer: Cesium.Viewer,
  ) => {
    // Get or create renderer
    let renderer = getPointRenderer(layer.id);
    if (!renderer) {
      renderer = new PointRendererManager();
      setPointRenderer(layer.id, renderer);
      console.log(
        `[LayerRenderer] Created PointRendererManager for layer: ${layer.name}`,
      );
    }

    // Only update rendering if this is a point layer with data
    const isPointLayer =
      layer.geometryType?.toUpperCase() === 'POINT' ||
      (layer.data?.features?.length &&
        layer.data.features[0].geometry?.type?.toUpperCase() === 'POINT');

    if (!isPointLayer) {
      console.log(
        `[LayerRenderer] Skip point rendering for non-point layer: ${layer.name}`,
      );
      return;
    }

    // Update the point layer
    await renderer.update(layer, viewer);
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
        entity.polyline.material = new Cesium.ColorMaterialProperty(
          color.withAlpha(opacity),
        );
        entity.polyline.width = new Cesium.ConstantProperty(
          layer.style.width || 2,
        );
      }
      // Note: entity.point is handled by PointRenderer
      // entity.billboard is also handled by PointRenderer for billboard mode
    }
  };

  // Main Sync Logic
  const syncLayers = async () => {
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

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
      ...getPointRendererEntries().map(([id]) => id),
    ]);

    for (const id of trackedLayerIds) {
      if (!validLayerIds.has(id)) {
        const ds = dataSourcesRef.current.get(id);
        if (ds) {
          viewer.dataSources.remove(ds, true);
          dataSourcesRef.current.delete(id);
          prevLayersRef.current.delete(id);
        }
        // Destroy point renderer
        const renderer = getPointRenderer(id);
        if (renderer) {
          renderer.destroy();
          deletePointRenderer(id);
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

      // Check if render mode changed (requires renderer recreation)
      const renderModeChanged =
        prevLayer &&
        layer.style.pointRenderMode !== prevLayer.style.pointRenderMode;

      if (needsReload && ds) {
        viewer.dataSources.remove(ds, true);
        dataSourcesRef.current.delete(layer.id);
        ds = undefined;
      }

      // Destroy renderer if render mode changed
      if (renderModeChanged) {
        const renderer = getPointRenderer(layer.id);
        if (renderer) {
          renderer.destroy();
          deletePointRenderer(layer.id);
          console.log(
            `[LayerRenderer] Destroyed renderer for layer: ${layer.name}`,
          );
        }
      }

      // Point layers: load data and render with PointRenderer, skip DataSource
      if (layer.geometryType === 'POINT') {
        // Reload data if needed
        if (needsReload || !layer.data?.features?.length) {
          await loadGeoJsonData(layer);
        }

        // Always update point layer (data should be available now)
        await updatePointLayerStyle(layer, viewer);

        // Update prev ref
        prevLayersRef.current.set(layer.id, layer);
        continue; // Skip DataSource handling for point layers
      }

      // Non-point layers: use DataSource
      if (!ds) {
        await addLayerToViewer(layer, viewer);
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
  }, [layers]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Destroy all point renderers
      getPointRendererEntries().forEach(([, renderer]) => {
        renderer.destroy();
      });
      clearPointRendererRegistry();
    };
  }, []);

  // Effect: Setup Picking Interaction
  useEffect(() => {
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
  }, [setSelection]);
  return null;
}
