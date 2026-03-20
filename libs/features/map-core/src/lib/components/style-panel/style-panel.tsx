/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../../store/use-map-store';
import { Palette, X, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { GeometryType, LayerState } from '../../types/map-state';
import { getStyleConfig } from '../../constants/style-config';
import {
  ColorControl,
  OpacityControl,
  SizeUnitControl,
  SizeControl,
  SymbolControl,
  WidthControl,
  LineTypeControl,
  OutlineControl,
  RenderModeControl,
  ImageUploadControl,
  LabelControl,
} from './controls';

/**
 * 从图层数据推断几何类型
 * 优先级：1. layer.geometryType 字段 > 2. GeoJSON 数据 > 3. Model 类型 > 4. 名称关键词
 */
function inferGeometryType(layer: LayerState): GeometryType | null {
  // 1. 优先使用 layer.geometryType 字段（最可靠）
  if (layer.geometryType) {
    return layer.geometryType;
  }

  // 2. 从 GeoJSON 数据判断（GeoJSON 使用首字母大写，需转换）
  if (layer.data?.features?.length > 0) {
    const geomType = layer.data.features[0].geometry?.type as string;
    if (!geomType) return null;

    // 转换为大写统一处理
    const upperType = geomType.toUpperCase();
    if (upperType === 'POINT' || upperType === 'MULTIPOINT') {
      return 'POINT';
    }
    if (upperType === 'LINESTRING' || upperType === 'MULTILINESTRING') {
      return 'LINESTRING';
    }
    if (upperType === 'POLYGON' || upperType === 'MULTIPOLYGON') {
      return 'POLYGON';
    }
  }

  // 3. 从 Model 类型直接判断
  if (layer.type === 'Model') {
    return 'POINT';
  }

  // 4. 从图层名称关键词判断 (备用方案，仅用于兼容旧数据)
  const name = layer.name.toLowerCase();
  if (name.includes('点') || name.includes('point')) {
    return 'POINT';
  }
  if (name.includes('线') || name.includes('line') || name.includes('road')) {
    return 'LINESTRING';
  }
  if (
    name.includes('面') ||
    name.includes('polygon') ||
    name.includes('zone')
  ) {
    return 'POLYGON';
  }

  // 无法判断
  return null;
}

export function StylePanel() {
  const layers = useMapStore((state) => state.layers);
  const stylePanel = useMapStore((state) => state.stylePanel);
  const updateLayerStyle = useMapStore((state) => state.updateLayerStyle);
  const resetLayerStyle = useMapStore((state) => state.resetLayerStyle);
  const closeStylePanel = useMapStore((state) => state.closeStylePanel);

  // 计算目标图层
  const layer = useMemo(() => {
    if (!stylePanel.layerId) return null;
    return layers.find((l) => l.id === stylePanel.layerId);
  }, [stylePanel.layerId, layers]);

  // 自动识别几何类型
  const geometryType = useMemo(() => {
    if (!layer) return null;
    return inferGeometryType(layer);
  }, [layer]);

  // 获取样式配置
  const config = useMemo(() => {
    if (!geometryType) return null;
    console.log('[StylePanel] geometryType:', getStyleConfig(geometryType));
    return getStyleConfig(geometryType);
  }, [geometryType]);

  // 渲染控制
  if (!stylePanel.isOpen || !layer || !config) {
    return null;
  }

  console.log('[StylePanel] config:', config);
  // 事件处理
  const handleApplyPreset = (style: Record<string, unknown>) => {
    updateLayerStyle(layer.id, style);
  };

  const handleReset = () => {
    resetLayerStyle(layer.id, config.defaultStyle);
  };

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow-lg border p-4 w-80 text-sm pointer-events-auto max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-800">样式设置</h3>
        </div>
        <button
          onClick={closeStylePanel}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Info */}
      <div className="mb-4 bg-blue-50 p-2 rounded border border-blue-100 flex items-center justify-between">
        <div className="font-medium text-blue-900 truncate" title={layer.name}>
          {layer.name}
        </div>
        {geometryType && (
          <div className="text-xs text-blue-400 mt-1">
            {geometryType === 'POINT' && '点图层'}
            {geometryType === 'LINESTRING' && '线图层'}
            {geometryType === 'POLYGON' && '面图层'}
          </div>
        )}
      </div>

      {/* Preset Section */}
      <div className="mb-6">
        <h4 className="font-medium mb-2 text-gray-700 flex items-center justify-between">
          <span>预设样式</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            快速应用
          </span>
        </h4>

        <div className="space-y-2">
          {config.presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.style)}
              className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded flex items-center justify-center bg-white border border-gray-200 shadow-sm">
                <PresetPreview
                  style={preset.style}
                  geometryType={geometryType}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700">
                  {preset.name}
                </div>
                <div className="text-xs text-gray-400">点击应用</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Section */}
      <div className="border-t pt-4 border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-700">自定义样式</h4>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
          >
            <RotateCcw className="w-3 h-3" />
            <span>重置样式</span>
          </button>
        </div>

        <div className="space-y-3">
          {/* Render controls based on config */}
          {config.customControls.map((controlType) => {
            switch (controlType) {
              case 'color':
                return (
                  <ColorControl
                    key="color"
                    value={layer.style.color || '#cccccc'}
                    onChange={(color) => updateLayerStyle(layer.id, { color })}
                  />
                );
              case 'opacity':
                return (
                  <OpacityControl
                    key="opacity"
                    value={layer.style.opacity ?? 1}
                    onChange={(opacity) =>
                      updateLayerStyle(layer.id, { opacity })
                    }
                  />
                );
              case 'sizeUnit':
                return (
                  <SizeUnitControl
                    key="sizeUnit"
                    value={layer.style.pointSizeUnit || 'pixels'}
                    onChange={(pointSizeUnit) =>
                      updateLayerStyle(layer.id, { pointSizeUnit })
                    }
                  />
                );
              case 'size':
                return (
                  <SizeControl
                    key="size"
                    value={layer.style.pointSize || 10}
                    unit={layer.style.pointSizeUnit || 'pixels'}
                    onChange={(pointSize) =>
                      updateLayerStyle(layer.id, { pointSize })
                    }
                  />
                );
              case 'symbol':
                return (
                  <SymbolControl
                    key="symbol"
                    value={layer.style.pointSymbol || 'circle'}
                    onChange={(pointSymbol) =>
                      updateLayerStyle(layer.id, { pointSymbol })
                    }
                  />
                );
              case 'renderMode':
                return (
                  <RenderModeControl
                    key="renderMode"
                    value={layer.style.pointRenderMode || 'billboard'}
                    onChange={(pointRenderMode) => {
                      console.log('[StylePanel] RenderMode onChange:', {
                        layerId: layer.id,
                        oldValue: layer.style.pointRenderMode,
                        newValue: pointRenderMode,
                      });
                      updateLayerStyle(layer.id, { pointRenderMode });
                    }}
                  />
                );
              case 'rotation':
                return (
                  <div key="rotation">
                    <label className="text-sm text-gray-600 block mb-1">
                      旋转角度
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={layer.style.pointRotation || 0}
                      onChange={(e) =>
                        updateLayerStyle(layer.id, {
                          pointRotation: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                    <div className="text-xs text-gray-400 text-right">
                      {layer.style.pointRotation || 0}°
                    </div>
                  </div>
                );
              case 'labelText':
                return (
                  <LabelControl
                    key="labelText"
                    value={layer.style.label}
                    onChange={(label) =>
                      updateLayerStyle(layer.id, { label })
                    }
                    featureProperties={
                      layer.data?.features?.[0]?.properties
                        ? Object.keys(layer.data.features[0].properties)
                        : []
                    }
                  />
                );
              case 'imageUpload':
                return (
                  <ImageUploadControl
                    key="imageUpload"
                    value={layer.style.pointImageUri}
                    onChange={(pointImageUri) =>
                      updateLayerStyle(layer.id, { pointImageUri })
                    }
                  />
                );
              case 'width':
                return (
                  <WidthControl
                    key="width"
                    value={layer.style.width || 2}
                    onChange={(width) => updateLayerStyle(layer.id, { width })}
                  />
                );
              case 'lineType':
                return (
                  <LineTypeControl
                    key="lineType"
                    value={layer.style.lineType || 'solid'}
                    onChange={(lineType) =>
                      updateLayerStyle(layer.id, { lineType })
                    }
                  />
                );
              case 'outline':
                return (
                  <OutlineControl
                    key="outline"
                    outlineColor={
                      layer.style.outlineColor || layer.style.color || '#cccccc'
                    }
                    outlineWidth={layer.style.outlineWidth || 1}
                    onChangeColor={(outlineColor) =>
                      updateLayerStyle(layer.id, { outlineColor })
                    }
                    onChangeWidth={(outlineWidth) =>
                      updateLayerStyle(layer.id, { outlineWidth })
                    }
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * 预设样式预览组件
 */
function PresetPreview({
  style,
  geometryType,
}: {
  style: Record<string, unknown>;
  geometryType: GeometryType;
}) {
  if (geometryType === 'Point') {
    return (
      <div
        className="rounded-full"
        style={{
          backgroundColor: style.color as string,
          width: Math.min(20, (style.pointSize as number) || 8),
          height: Math.min(20, (style.pointSize as number) || 8),
          opacity: style.opacity as number,
        }}
      />
    );
  }

  if (geometryType === 'LineString') {
    return (
      <div
        style={{
          backgroundColor: style.color as string,
          height: Math.min(4, (style.width as number) || 2),
          width: 24,
          opacity: style.opacity as number,
        }}
      />
    );
  }

  if (geometryType === 'Polygon') {
    return (
      <div
        style={{
          backgroundColor: style.color as string,
          width: 20,
          height: 20,
          opacity: style.opacity as number,
          borderColor:
            (style.outlineColor as string) || (style.color as string),
          borderWidth: 1,
          borderStyle: 'solid',
        }}
      />
    );
  }

  return null;
}
