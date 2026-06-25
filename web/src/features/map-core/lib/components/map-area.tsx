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
import { BOTTOM_INFO_BAR_HEIGHT } from '../constants/layout';

/**
 * MapArea contains the map renderer and all UI overlays.
 *
 * 底部采用 dock 模型（ArcGIS 风格）：属性表 + 信息栏同处一个 flex 列父级，
 * 信息栏固定在底部不动，拖拽/开关只改变属性表高度。
 * 因此信息栏无需 JS 计算偏移、无 transition，天然与属性表同步、拖拽无延迟。
 */
export function MapArea({ readOnly = false }: { readOnly?: boolean } = {}) {
  useMapPerformanceMonitor({ sceneType: 'browse' });

  const attributePanel = useMapStore((state) => state.attributePanel);
  const isPanelResizing = useMapStore((state) => state.isPanelResizing);
  const useMaplibre = useMapStore((state) => state.experimental?.useMaplibre ?? false);

  // dock 顶部离屏幕底部的距离 = 属性表高度（打开时）+ 信息栏高度；图例据此浮于 dock 之上
  const panelHeight = attributePanel.isOpen ? attributePanel.height : 0;
  const dockTopOffset = panelHeight + BOTTOM_INFO_BAR_HEIGHT;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 3D Scene with Renderers */}
      {useMaplibre ? <MapLibreContainer /> : <CesiumContainer />}

      {/* Headless Logic */}
      <MapAgentBridge />

      {/* 图层管理 - 左上 */}
      <div className="absolute left-4 top-4 z-10">
        <LayerManager readOnly={readOnly} />
      </div>

      {/* 图例 - 浮于 dock 之上；拖拽时关过渡使其跟手，其余平滑 */}
      {!readOnly && (
        <div
          className="absolute left-4 z-10"
          style={{
            bottom: `${dockTopOffset + 12}px`,
            transition: isPanelResizing ? 'none' : 'all 300ms ease-out',
          }}
        >
          <LegendPanel />
        </div>
      )}

      {/* 工具栏 - 右上（编辑工具，readOnly 隐藏） */}
      {!readOnly && (
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-4">
          <MapToolbar />
          <DrawToolbar />
        </div>
      )}

      {/* 底部 dock：信息栏 + 属性表，同一 flex 列父级（信息栏在上、面板在下贴底）。
          面板高度变化时，信息栏作为其 flex 上方兄弟逐帧同步上移 → 无延迟、无不同步。 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
        <div
          className="flex items-center justify-between gap-4 px-4"
          style={{ height: BOTTOM_INFO_BAR_HEIGHT }}
        >
          <BottomBar />
          <BottomLog />
        </div>
        {!readOnly && <AttributePanel />}
      </div>
    </div>
  );
}
