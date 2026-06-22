/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { CesiumContainer } from '../renderer/cesium-container';
import { MapLibreContainer } from '../renderer/maplibre-container';
import { MapAgentBridge } from '../controllers/map-agent-bridge';
import { LayerManager } from './layer-manager';
import { BottomBar } from './bottom-bar';
import { BottomLog } from './bottom-log';
import { AttributePanel } from './attribute-panel';
import { LegendPanel } from './legend-panel';
import { MapToolbar } from './map-toolbar';
import { DrawToolbar } from './draw-toolbar';
import { useMapStore } from '../store/use-map-store';
import { useMapPerformanceMonitor } from '../hooks/use-map-performance-monitor';

/**
 * MapArea contains the map renderer and all UI overlays.
 * Toolbars are positioned at top-right, floating over the map.
 * Bottom elements (AttributePanel, BottomBar, BottomLog) are constrained to this area.
 */
export function MapArea({ readOnly = false }: { readOnly?: boolean } = {}) {
  useMapPerformanceMonitor({ sceneType: 'browse' });

  const attributePanel = useMapStore((state) => state.attributePanel);
  const useMaplibre = useMapStore((state) => state.experimental?.useMaplibre ?? false);

  const dockOffset =
    attributePanel.isOpen && !attributePanel.isCollapsed
      ? attributePanel.height + 16
      : 80;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 3D Scene with Renderers */}
      {useMaplibre ? <MapLibreContainer /> : <CesiumContainer />}

      {/* Headless Logic */}
      <MapAgentBridge />

      {/* UI Overlays - left side */}
      <div className="absolute top-4 left-4 z-10">
        <LayerManager readOnly={readOnly} />
      </div>

      {!readOnly && (
        <div
          className="absolute left-4 z-10 transition-all duration-300"
          style={{ bottom: `${dockOffset + 12}px` }}
        >
          <LegendPanel />
        </div>
      )}

      {/* Toolbars - top-right, floating over map (editing tools, hidden in readOnly) */}
      {!readOnly && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-4">
          <MapToolbar />
          <DrawToolbar />
        </div>
      )}

      {/* Bottom elements - constrained to MapArea width (hidden in readOnly) */}
      {!readOnly && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <AttributePanel />
        </div>
      )}
      <div
        className="bottombar absolute left-4 z-20 transition-all duration-300"
        style={{
          bottom:
            attributePanel.isOpen && !attributePanel.isCollapsed
              ? `${attributePanel.height + 8}px`
              : '16px',
        }}
      >
        <BottomBar />
      </div>
      <div
        className="bottomlog absolute right-4 z-20 transition-all duration-300"
        style={{
          bottom:
            attributePanel.isOpen && !attributePanel.isCollapsed
              ? `${attributePanel.height + 8}px`
              : '16px',
        }}
      >
        <BottomLog />
      </div>
    </div>
  );
}