/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect } from 'react';
import { useMapSocket } from '../hooks/use-map-socket';
import { useMapStore } from '../store/use-map-store';
import {
  DatasetRoutingSummary,
  createLayerFromDataset,
} from '../runtime/layer-routing';
import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';

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

    if (latest.type !== 'ui_action') return;

    const { intent, params } = (latest.data as any) || {};

    const applyUiAction = async () => {
      switch (intent) {
        case 'ADD_LAYER': {
          let datasetSummary: DatasetRoutingSummary | undefined =
            params.datasetSummary;

          if (!datasetSummary && params.datasetId) {
            const response = await httpClient.get<ApiResponse<DatasetRoutingSummary>>(
              `/datasets/${params.datasetId}`,
            );
            datasetSummary = response.data.data;
          }

          if (!datasetSummary) {
            throw new Error('ADD_LAYER requires dataset routing metadata');
          }

          addLayer(createLayerFromDataset(datasetSummary, params.sceneType ?? 'browse'));
          break;
        }
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
    };

    void applyUiAction()
      .then(() => {
        socket.uiActionAck({
          conversationId: latest.conversationId,
          actionId: latest.id,
          status: 'applied',
        });
      })
      .catch((error) => {
        console.error('Failed to apply map ui action:', error);
        socket.uiActionAck({
          conversationId: latest.conversationId,
          actionId: latest.id,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      });
  }, [socket.tools, addLayer, removeLayer, updateLayer, setViewport]);

  // Sync state back to AI (Debounced in real app)
  useEffect(() => {
    const snapshot = getSnapshot();
    // In a real app, we would emit this via socket
    // socket.updateState(snapshot);
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
