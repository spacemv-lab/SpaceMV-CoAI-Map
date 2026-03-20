/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { MapContainer } from '../renderer/map-container';
import { MapAgentBridge } from '../controllers/map-agent-bridge';
import { LayerManager } from './layer-manager';
import { StylePanelWrapper } from './style-panel';
import { DrawToolbar } from './draw-toolbar';
import { MapToolbar } from './map-toolbar';
import { BottomBar } from './bottom-bar';
import { BottomLog } from './bottom-log';
import { AttributePanel } from './attribute-panel';
import { LegendPanel } from './legend-panel';
import { useMapStore } from '../store/use-map-store';

export function MapViewer() {
  const attributePanel = useMapStore((state) => state.attributePanel);
  const dockOffset =
    attributePanel.isOpen && !attributePanel.isCollapsed
      ? attributePanel.height + 16
      : 80;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 3D Scene with Renderers */}
      <MapContainer />

      {/* Headless Logic */}
      <MapAgentBridge />

      {/* UI Overlays */}
      <div className="absolute top-4 left-4 z-10">
        <LayerManager />
      </div>

      <div
        className="absolute left-4 z-10 transition-all duration-300"
        style={{ bottom: `${dockOffset + 12}px` }}
      >
        <LegendPanel />
      </div>

      {/* Top-right toolbar and style panel container */}
      <StylePanelWrapper />

      <div className="absolute bottom-0 left-0 right-0 z-20">
        <AttributePanel />
      </div>
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
      <div className="absolute bottom-8 left-4 right-4 z-20">
        {/* <TimeAxis /> */}
      </div>
    </div>
  );
}
