/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import * as Cesium from 'cesium';
import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../store/use-map-store';
import { getTiandituToken } from '../constants/map-token';
import { LayerRenderer } from './layer-renderer';
import { DrawRenderer } from './draw-renderer';
import { InteractionManager } from './interaction-manager';
import { PopupContainer } from '../components/popup-container';
import { startPerformanceSpan } from '../monitoring/performance-monitor';

export function CesiumContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const setViewport = useMapStore((state) => state.setViewport);
  const viewport = useMapStore((state) => state.viewport);
  const basemap = useMapStore((state) => state.basemap);
  const setViewerReady = useMapStore((state) => state.setViewerReady);

  useEffect(() => {
    if (!containerRef.current) return;

    const endMapInitialize = startPerformanceSpan({
      name: 'map.initialize',
      sceneType: 'browse',
    });

    // Initialize Cesium Viewer
    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      navigationHelpButton: false,
      geocoder: false,
      infoBox: false,
    });

    // Hide credit container
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // Expose viewer globally for Renderer and other components
    (window as unknown as { CESIUM_VIEWER: Cesium.Viewer }).CESIUM_VIEWER =
      viewer;
    window.dispatchEvent(new Event('map:viewer-ready'));

    // Register camera listener before setView to ensure persistence
    const onCameraChange = () => {
      const position = viewer.camera.positionCartographic;
      setViewport({
        center: [
          Cesium.Math.toDegrees(position.longitude),
          Cesium.Math.toDegrees(position.latitude),
        ],
        zoom: position.height,
        heading: Cesium.Math.toDegrees(viewer.camera.heading),
        pitch: Cesium.Math.toDegrees(viewer.camera.pitch),
      });
    };

    viewer.camera.moveEnd.addEventListener(onCameraChange);

    // Restore viewport from store (may be rehydrated from localStorage)
    const restoredViewport = useMapStore.getState().viewport;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        restoredViewport.center[0],
        restoredViewport.center[1],
        restoredViewport.zoom,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(restoredViewport.heading),
        pitch: Cesium.Math.toRadians(restoredViewport.pitch),
        roll: 0,
      },
    });

    setIsReady(true);
    setViewerReady(true);
    endMapInitialize({
      basemap,
      initialZoom: 600000,
    });

    return () => {
      viewer.camera.moveEnd.removeEventListener(onCameraChange);
      setViewerReady(false);
      setTimeout(() => {
        // Always destroy this viewer to clean up DOM (prevents basemap flashing).
        // Only clear CESIUM_VIEWER if it still points to this viewer instance
        // (guards against Strict Mode double-mount clearing a newer viewer).
        const current = (window as unknown as { CESIUM_VIEWER?: Cesium.Viewer })
          .CESIUM_VIEWER;
        viewer.destroy();
        if (current === viewer) {
          (
            window as unknown as { CESIUM_VIEWER: Cesium.Viewer | undefined }
          ).CESIUM_VIEWER = undefined;
        }
      }, 0);
    };
  }, [setViewerReady]);

  // Handle Basemap Changes
  useEffect(() => {
    if (!isReady) return;
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const updateBasemap = async () => {
      // Remove all imagery layers except the base layer (index 0)
      while (viewer.imageryLayers.length > 0) {
        viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
      }

      try {
        if (basemap === 'tianditu-vec') {
          // Tianditu Vector Base Layer
          const vecProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=vec&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'vec',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(vecProvider);

          // Tianditu Annotation Layer (cva)
          const cvaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cva&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'cva',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(cvaProvider);
        } else if (basemap === 'tianditu-img') {
          // Tianditu Satellite Layer
          const imgProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'img',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(imgProvider);

          // Tianditu Satellite Annotation Layer (cia)
          const ciaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/cia_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cia&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'cia',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(ciaProvider);
        } else if (basemap === 'tianditu-ter') {
          // Tianditu Terrain Layer
          const terProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/ter_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=ter&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'ter',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(terProvider);

          // Tianditu Terrain Annotation Layer (cta)
          const ctaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/cta_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cta&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'cta',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(ctaProvider);
        } else if (basemap === 'tianditu-ibo') {
          // Tianditu IBO (Global Map) Layer
          const iboProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t1.tianditu.gov.cn/ibo_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=ibo&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${getTiandituToken()}`,
            layer: 'ibo',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(iboProvider);
        }
      } catch (error) {
        console.error('Failed to load basemap:', error);
      }
    };

    void updateBasemap();
  }, [basemap, isReady]);

  // Handle Viewport Changes (Store -> Camera)
  useEffect(() => {
    if (!isReady) return;
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const currentCartographic = viewer.camera.positionCartographic;
    const currentLon = Cesium.Math.toDegrees(currentCartographic.longitude);
    const currentLat = Cesium.Math.toDegrees(currentCartographic.latitude);
    const currentHeight = currentCartographic.height;

    const centerDiff =
      Math.abs(currentLon - viewport.center[0]) +
      Math.abs(currentLat - viewport.center[1]);
    const heightDiff = Math.abs(currentHeight - viewport.zoom);

    // Only fly if there's a meaningful difference to avoid feedback loops
    if (centerDiff > 0.01 || heightDiff > 10) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          viewport.center[0],
          viewport.center[1],
          viewport.zoom,
        ),
      });
    }
  }, [viewport.center[0], viewport.center[1], viewport.zoom, isReady]);

  // Handle Save Image
  useEffect(() => {
    const handleSaveImage = () => {
      const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
        .CESIUM_VIEWER;
      if (!viewer) return;

      viewer.render();
      const canvas = viewer.scene.canvas;
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `map-snapshot-${Date.now()}.png`;
      link.href = image;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    window.addEventListener('map:save-image', handleSaveImage);
    return () => window.removeEventListener('map:save-image', handleSaveImage);
  }, []);

  // Handle Mouse Move
  useEffect(() => {
    if (!isReady) return;
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      const cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        viewer.scene.globe.ellipsoid,
      );
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        window.dispatchEvent(
          new CustomEvent('map:mouse-move', { detail: { lat, lon } }),
        );
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
    };
  }, [isReady]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-0 flex-1 relative">
      <LayerRenderer />
      <DrawRenderer />
      <InteractionManager />
      <PopupContainer />
    </div>
  );
}
