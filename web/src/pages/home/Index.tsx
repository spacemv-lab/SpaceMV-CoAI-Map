/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import React, { useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { MapViewer, useMapStore, RightPanelArea } from '@/features/map-core';
import { useProjectState } from '../../hooks/useProjectState';
import { useProjects } from '../../hooks/useProjects';

// Auto-save debounce time (ms)
const AUTO_SAVE_DELAY = 2000;
export default function Home() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { state, isLoading, loadState, clearState, saveState } = useProjectState(projectId ?? null);
  const { setCurrentProjectId, setCurrentProjectName, setViewport, setBasemap, setLayers, switchProject, captureProjectState, currentProjectId, resetProjectUIState } = useMapStore();
  const { projects } = useProjects();

  // Track previous projectId to detect project switch
  const prevProjectIdRef = useRef<string | null>(null);

  // Track if initial state load is complete (for first project entry)
  const initialStateLoadedRef = useRef<boolean>(false);

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On projectId change: switch project context (clear old state first)
  useEffect(() => {
    if (projectId && projectId !== prevProjectIdRef.current) {
      // Project switched: clear old state first, then set new projectId
      clearState();  // Clear React state to prevent stale data

      // Reset UI panel state to prevent cross-project pollution
      // (stylePanel, editPanel, rightPanelActiveTab, etc.)
      resetProjectUIState();

      if (prevProjectIdRef.current) {
        switchProject(projectId);  // Clear zustand state and set new projectId
      } else {
        setCurrentProjectId(projectId);
        // Also clear layers for first load
        setLayers([]);
      }
      prevProjectIdRef.current = projectId;

      // Load new project state from database
      loadState();
    }
  }, [projectId, switchProject, setCurrentProjectId, loadState, clearState, setLayers, resetProjectUIState]);

  // Separate effect: set project name when projects list is ready
  useEffect(() => {
    if (projectId) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setCurrentProjectName(project.name);
      }
    }
  }, [projectId, projects, setCurrentProjectName]);

  // When state is loaded: restore viewport, basemap, and layers
  useEffect(() => {
    if (state) {
      // Always set viewport and basemap (from DB or defaults)
      if (state.viewport) {
        setViewport(state.viewport);
      }
      if (state.basemap) {
        setBasemap(state.basemap);
      }

      // Set layers - handle both API format and frontend format
      const mapCoreLayers = (state.layers || []).map((layer) => {
        // API format: type='dataset', datasetId
        // Frontend format: type='GeoJSON', sourceId
        const frontendType = layer.type === 'dataset' || layer.type === 'GeoJSON' ? 'GeoJSON'
          : layer.type === 'draw' || layer.type === 'Draw' ? 'Draw'
          : 'Tile';
        const effectiveSourceId = layer.datasetId || (layer as any).sourceId;

        // Draw layers: data field contains GeoJSON features
        // Dataset layers: might have geojson (legacy) or routingMetadata
        const layerData = (layer as any).data || layer.geojson || { type: 'FeatureCollection', features: [] };

        return {
          id: layer.id,
          name: layer.name,
          type: frontendType,
          visible: layer.visible,
          opacity: layer.opacity,
          style: layer.style || {},
          data: layerData,
          geometryType: layer.geometryType,
          sourceId: effectiveSourceId,
          routingMetadata: layer.routingMetadata,
          fields: layer.fields,
        };
      });
      setLayers(mapCoreLayers);

      // Mark initial state as loaded
      initialStateLoadedRef.current = true;
    }
  }, [state, setViewport, setBasemap, setLayers]);

  // Cleanup: when leaving project page (navigating to home or other non-project routes)
  useEffect(() => {
    const currentProjectId = projectId;

    return () => {
      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      const isLeavingProject = !location.pathname.startsWith(`/project/${currentProjectId}`);
      if (currentProjectId && isLeavingProject) {
        // Save state before leaving
        const projectState = captureProjectState();
        saveState(projectState);

        setCurrentProjectId(null);
        initialStateLoadedRef.current = false;
      }
    };
  }, [projectId, location.pathname, setCurrentProjectId, captureProjectState, saveState]);

  // Auto-save: subscribe to store changes with 2s debounce
  useEffect(() => {
    if (!projectId) return;

    const unsub = useMapStore.subscribe((state, prevState) => {
      // Skip if still loading initial state
      if (!initialStateLoadedRef.current) return;

      // Check if meaningful state changed
      const layersChanged = state.layers !== prevState.layers;
      const viewportChanged = state.viewport !== prevState.viewport;
      const basemapChanged = state.basemap !== prevState.basemap;

      if (layersChanged || viewportChanged || basemapChanged) {
        // Clear previous timer
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }

        // Set new debounce timer
        autoSaveTimerRef.current = setTimeout(() => {
          const projectState = captureProjectState();
          saveState(projectState);
        }, AUTO_SAVE_DELAY);
      }
    });

    return () => {
      unsub();
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [projectId, captureProjectState, saveState]);

  // Wait for initial state load before rendering MapViewer (prevents visual jump)
  const showMap = initialStateLoadedRef.current || !projectId;

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* TopBar is rendered by RootLayout, not here */}
      {/* Main content: left map area + right panel area */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Map area (~70%) */}
        <div className="flex-1 min-w-0 relative">
          {showMap ? (
            <MapViewer />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              加载中...
            </div>
          )}
        </div>
        {/* Right: Multi-function panel (~30%) */}
        <div className="w-[30%] min-w-[320px] max-w-[400px] border-l bg-background">
          <RightPanelArea />
        </div>
      </div>
    </div>
  );
}
