/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../../store/use-map-store';
import { StylePanel } from './style-panel';
import { MapToolbar } from '../map-toolbar';
import { DrawToolbar } from '../draw-toolbar';

/**
 * StylePanel 和 Toolbar 的容器组件
 * 实现 StylePanel 展开/收起时的动画效果
 */
export function StylePanelWrapper() {
  const isOpen = useMapStore((state) => state.stylePanel.isOpen);

  return (
    <div className="absolute top-4 right-4 z-30 flex flex-row-reverse items-start gap-4">
      {/* Style Panel - 通过宽度变化实现展开/收起动画 */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: isOpen ? '320px' : '0px' }}
      >
        <StylePanel />
      </div>
      {/* Toolbars - 被 StylePanel 自动推开 */}
      <div className="flex flex-col gap-4">
        <MapToolbar />
        <DrawToolbar />
      </div>
    </div>
  );
}
