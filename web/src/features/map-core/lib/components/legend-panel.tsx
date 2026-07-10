/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useMapStore } from '../store/use-map-store';
import { createSymbolCanvas } from '../utils/symbol-canvas';
import { computeGraduatedLegendItems } from '../utils/graduated-legend';
import type { LayerState, PointSymbolShape } from '../types/map-state';

const DEFAULT_COLOR = '#cccccc';

/** 点形状图标——复用 createSymbolCanvas，与地图上实际渲染的形状/描边完全一致 */
function PointSwatch({
  symbol,
  color,
  imageUri,
  opacity,
}: {
  symbol?: PointSymbolShape;
  color: string;
  imageUri?: string;
  opacity?: number;
}) {
  const dataUrl = useMemo(() => {
    if (imageUri) return '';
    const sym = symbol && symbol !== 'custom' ? symbol : 'circle';
    return createSymbolCanvas(sym, color, 24).toDataURL('image/png');
  }, [symbol, color, imageUri]);

  if (imageUri) {
    return <img src={imageUri} alt="" className="w-4 h-4 object-contain" style={{ opacity }} />;
  }
  return <img src={dataUrl} alt="" className="w-4 h-4" style={{ opacity }} />;
}

/** 分级单色小标：POINT→圆、LINE→条、其他→方块 */
function GraduatedSwatch({ color, geometryType }: { color: string; geometryType?: string }) {
  if (geometryType === 'LINESTRING') {
    return <span className="inline-block shrink-0 rounded-sm" style={{ width: 16, height: 2, backgroundColor: color }} />;
  }
  if (geometryType === 'POINT') {
    return <span className="inline-block shrink-0 rounded-full" style={{ width: 10, height: 10, backgroundColor: color }} />;
  }
  return <span className="inline-block shrink-0 border border-gray-200" style={{ width: 12, height: 12, backgroundColor: color }} />;
}

/** 单色几何图标：点按 pointSymbol 渲染对应形状，线/面按形状给色块 */
function ColorIcon({ layer }: { layer: LayerState }) {
  const style = layer.style;
  const color = style?.color || DEFAULT_COLOR;
  const opacity = style?.opacity;

  switch (layer.geometryType) {
    case 'POINT':
      return <PointSwatch color={color} symbol={style?.pointSymbol} imageUri={style?.pointImageUri} opacity={opacity} />;
    case 'LINESTRING':
      return (
        <span
          className="inline-block shrink-0 rounded-sm"
          style={{ width: 16, height: 2, backgroundColor: color, opacity }}
        />
      );
    case 'POLYGON':
      return (
        <span
          className="inline-block shrink-0 border border-gray-300"
          style={{ width: 12, height: 12, backgroundColor: color, opacity }}
        />
      );
    default:
      return (
        <span
          className="inline-block shrink-0"
          style={{ width: 12, height: 12, backgroundColor: color, opacity }}
        />
      );
  }
}

export function LegendPanel() {
  const legendVisible = useMapStore((s) => s.legendVisible);
  const layers = useMapStore((s) => s.layers);
  const setLegendVisible = useMapStore((s) => s.setLegendVisible);

  // 图例显隐由侧边栏工具栏的图例按钮统一控制；隐藏时不渲染浮动入口。
  if (!legendVisible) return null;

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-4 text-sm relative min-w-40 max-w-64">
      <button
        onClick={() => setLegendVisible(false)}
        className="absolute top-1 right-1 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        title="隐藏图例"
      >
        <X className="w-3 h-3" />
      </button>
      <h4 className="font-medium mb-3 text-gray-800">图例</h4>
      {layers.length === 0 ? (
        <p className="text-gray-400 text-xs">暂无图层，请添加数据</p>
      ) : (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 300 }}>
          {layers.map((layer) => {
            // 分级渲染：展开成分级条目（颜色 + 区间），与样式面板预览一致
            if (layer.style?.renderingType === 'graduated' && layer.style?.graduatedConfig) {
              const items = computeGraduatedLegendItems(layer.style.graduatedConfig);
              return (
                <div key={layer.id} className="space-y-1">
                  <div className="text-gray-700 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                    {layer.name}
                  </div>
                  <div className="ml-2 space-y-0.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <GraduatedSwatch color={item.color} geometryType={layer.geometryType} />
                        <span className="text-xs text-gray-600">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            // 单色渲染：按几何类型/点形状出图标
            return (
              <div key={layer.id} className="flex items-center gap-2">
                <ColorIcon layer={layer} />
                <span className="text-gray-700 flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{layer.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
