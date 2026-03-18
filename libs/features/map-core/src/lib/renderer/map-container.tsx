/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import * as Cesium from 'cesium';
import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../store/use-map-store';
import { CESIUM_ION, TIANDITU_TOKEN } from '../constants/map-token';

// Set Cesium token if needed, or rely on default/ion
Cesium.Ion.defaultAccessToken = CESIUM_ION;

export function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const setViewport = useMapStore((state) => state.setViewport);
  const viewport = useMapStore((state) => state.viewport);
  const basemap = useMapStore((state) => state.basemap);

  useEffect(() => {
    if (!containerRef.current) return;

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
      infoBox: false, // We'll handle selection manually
    });

    // Hide credit container
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

    // Set initial view
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104.06, 30.67, 600000), // Chengdu, view covering Sichuan
    });

    // Expose viewer globally for Renderer and other components
    (window as unknown as { CESIUM_VIEWER: Cesium.Viewer }).CESIUM_VIEWER =
      viewer;
    window.dispatchEvent(new Event('map:viewer-ready'));

    // Sync Camera changes to Store
    const onCameraChange = () => {
      const position = viewer.camera.positionCartographic;
      setViewport({
        center: [
          Cesium.Math.toDegrees(position.longitude),
          Cesium.Math.toDegrees(position.latitude),
        ],
        zoom: position.height, // Approximate zoom as height
        heading: Cesium.Math.toDegrees(viewer.camera.heading),
        pitch: Cesium.Math.toDegrees(viewer.camera.pitch),
      });
    };

    viewer.camera.moveEnd.addEventListener(onCameraChange);

    setIsReady(true);

    return () => {
      viewer.camera.moveEnd.removeEventListener(onCameraChange);
      viewer.destroy();
      (
        window as unknown as { CESIUM_VIEWER: Cesium.Viewer | undefined }
      ).CESIUM_VIEWER = undefined;
    };
  }, []); // Only run once on mount

  // Handle Basemap Changes
  useEffect(() => {
    if (!isReady) return;
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const updateBasemap = async () => {
      viewer.imageryLayers.removeAll();

      try {
        if (basemap === 'tianditu-vec') {
          // Tianditu Base Layer
          const imgProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=vec&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'img',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(imgProvider);

          // Tianditu Annotation Layer
          const ciaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.gov.cn/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cva&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'cia',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(ciaProvider);
        } else if (basemap === 'tianditu-img') {
          // Tianditu Satellite Layer
          const imgProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.com/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'img',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(imgProvider);

          const ciaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.gov.cn/cia_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cia&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
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
            url: `http://t1.tianditu.gov.cn/ter_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=ter&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'ter',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(terProvider);

          const ctaProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.gov.cn/cta_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cta&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'cta',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(ctaProvider);
        } else if (basemap === 'tianditu-ibo') {
          // Tianditu IBO Layer
          const imgProvider = new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t1.tianditu.gov.cn/ibo_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=ibo&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${TIANDITU_TOKEN}`,
            layer: 'ibo',
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            maximumLevel: 18,
          });
          viewer.imageryLayers.addImageryProvider(imgProvider);
        }
      } catch (error) {
        console.error('Failed to load basemap:', error);
      }
    };

    updateBasemap();
  }, [basemap, isReady]);

  // Handle Viewport Changes (Store -> Camera)
  useEffect(() => {
    if (!isReady) return;
    const viewer = (window as unknown as { CESIUM_VIEWER: Cesium.Viewer })
      .CESIUM_VIEWER;
    if (!viewer) return;

    const currentHeight = viewer.camera.positionCartographic.height;
    // Only fly if the difference is significant (e.g., > 10 meters) to avoid loops
    if (Math.abs(currentHeight - viewport.zoom) > 10) {
      // We only update height/zoom here to support Zoom In/Out buttons.
      // Updating center might conflict with panning if not careful.
      // But if we want full sync, we should check distance.

      // For this task, we specifically need Zoom In/Out to work.
      // So we focus on height.
      const currentPos = viewer.camera.positionCartographic;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(
          currentPos.longitude,
          currentPos.latitude,
          viewport.zoom,
        ),
        duration: 0.5,
      });
    }
  }, [viewport.zoom, isReady]); // Only listen to zoom changes for now to avoid pan conflicts

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

  return <div ref={containerRef} className="w-full h-full min-h-0 flex-1" />;
}
