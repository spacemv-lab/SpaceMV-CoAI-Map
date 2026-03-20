/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useEffect } from 'react';
import { useMapSocket } from '../hooks/use-map-socket';
import { useMapStore } from '../store/use-map-store';

export function MapAgentBridge() {
  const socket = useMapSocket({ url: '/api' }); // Use relative path if proxy is set up
  const { addLayer, removeLayer, updateLayer, setViewport, getSnapshot } =
    useMapStore();

  useEffect(() => {
    socket.join('global');
  }, [socket]);

  // Listen for AI actions
  useEffect(() => {
    if (!socket.tools?.length) return;
    const latest = socket.tools[socket.tools.length - 1];

    if (latest.type === 'ui_action') {
      const { intent, params } = (latest.data as any) || {};

      switch (intent) {
        case 'ADD_LAYER':
          addLayer({
            id: params.datasetId,
            name: params.name || params.datasetId,
            type: 'GeoJSON',
            geometryType: params.geometryType, // 从后端获取的几何类型
            visible: true,
            opacity: 1,
            style: { color: '#3388ff' },
            sourceId: params.datasetId,
          });
          break;
        case 'REMOVE_LAYER':
          removeLayer(params.layerId);
          break;
        case 'TOGGLE_LAYER':
          updateLayer(params.layerId, { visible: params.visible });
          break;
        case 'FLY_TO':
          setViewport({
            center: params.center,
            zoom: params.zoom,
          });
          break;
        case 'SET_STYLE':
          updateLayer(params.layerId, { style: params.style });
          break;
      }

      // Ack
      socket.uiActionAck({
        conversationId: latest.conversationId,
        actionId: latest.id,
        status: 'applied',
      });
    }
  }, [socket.tools, addLayer, removeLayer, updateLayer, setViewport]);

  // Sync state back to AI (Debounced in real app)
  useEffect(() => {
    const snapshot = getSnapshot();
    // In a real app, we would emit this via socket
    // socket.updateState(snapshot);
    console.log('Map State Updated:', snapshot);
  }, [getSnapshot]); // getSnapshot changes on every store update if we use it directly in dependency?
  // No, getSnapshot is a function. We should subscribe to store.

  useEffect(() => {
    const unsub = useMapStore.subscribe(() => {
      // Emit state update to socket
      // socket.emit('state_update', state);
    });
    return unsub;
  }, []);

  return null;
}
