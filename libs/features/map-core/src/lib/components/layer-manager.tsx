/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useMapStore } from '../store/use-map-store';
import { useState } from 'react';
import * as Cesium from 'cesium';
import { AddLayerModal } from './add-layer-modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@txwx-monorepo/ui-kit';
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  GripVertical,
  MoreVertical,
  Search,
  FileText,
  Pencil,
  Edit3,
  Table,
} from 'lucide-react';

export function LayerManager() {
  const viewerReady = useMapStore((state) => state.viewerReady);
  const layers = useMapStore((state) => state.layers);
  const removeLayer = useMapStore((state) => state.removeLayer);
  const setLayerVisibility = useMapStore((state) => state.setLayerVisibility);
  const reorderLayers = useMapStore((state) => state.reorderLayers);
  const addBlankLayer = useMapStore((state) => state.addBlankLayer);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const setActiveLayer = useMapStore((state) => state.setActiveLayer);
  const openStylePanel = useMapStore((state) => state.openStylePanel);
  const openAttributePanel = useMapStore((state) => state.openAttributePanel);
  const attributePanel = useMapStore((state) => state.attributePanel);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // e.dataTransfer.setData('text/plain', index.toString()); // Optional
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null && draggedItemIndex !== index) {
      reorderLayers(draggedItemIndex, index);
    }
    setDraggedItemIndex(null);
  };

  /**
   * 缩放至图层 - 计算图层边界并跳转视角
   */
  const handleZoomToLayer = (layerId: string) => {
    if (!viewerReady) {
      console.error('[ZoomToLayer] Viewer not ready');
      return;
    }

    const viewer = (window as unknown as { CESIUM_VIEWER?: Cesium.Viewer })
      .CESIUM_VIEWER;

    const layer = layers.find((l) => l.id === layerId);
    if (!layer) {
      console.error('[ZoomToLayer] Layer not found:', layerId);
      return;
    }

    // 收集所有坐标点的通用函数
    const collectPositions = (data: any): Cesium.Cartesian3[] => {
      const positions: Cesium.Cartesian3[] = [];

      if (!data) return positions;

      // 处理 FeatureCollection 格式
      let features = data.features || (Array.isArray(data) ? data : []);

      // 如果 features 为空，尝试直接从 data 读取（兼容旧格式）
      if (!Array.isArray(features)) {
        features = [];
      }

      if (features.length === 0) {
        return positions;
      }

      for (const feature of features) {
        const geom = feature.geometry;
        if (!geom) continue;

        const coords = geom.coordinates;
        if (!coords) continue;

        // 根据几何类型处理坐标（GeoJSON 使用小写）
        const geometryType = geom.type;

        try {
          if (geometryType === 'Point') {
            if (Array.isArray(coords) && coords.length >= 2) {
              const [lng, lat, height = 0] = coords;
              if (typeof lng === 'number' && typeof lat === 'number') {
                positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, height));
              }
            }
          } else if (geometryType === 'LineString') {
            if (Array.isArray(coords)) {
              for (const coord of coords) {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const [lng, lat, height = 0] = coord;
                  if (typeof lng === 'number' && typeof lat === 'number') {
                    positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, height));
                  }
                }
              }
            }
          } else if (geometryType === 'Polygon') {
            // Polygon: [ [ [lng, lat], ... ] ] (可能有多个环)
            if (Array.isArray(coords)) {
              for (const ring of coords) {
                if (Array.isArray(ring)) {
                  for (const coord of ring) {
                    if (Array.isArray(coord) && coord.length >= 2) {
                      const [lng, lat, height = 0] = coord;
                      if (typeof lng === 'number' && typeof lat === 'number') {
                        positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, height));
                      }
                    }
                  }
                }
              }
            }
          } else if (geometryType === 'MultiPoint' || geometryType === 'MultiLineString' || geometryType === 'MultiPolygon') {
            // 处理 Multi 类型的递归展平
            const flattenCoords = (arr: any[]): number[][] => {
              const result: number[][] = [];
              for (const item of arr) {
                if (Array.isArray(item)) {
                  if (typeof item[0] === 'number' && typeof item[1] === 'number') {
                    result.push(item);
                  } else {
                    result.push(...flattenCoords(item));
                  }
                }
              }
              return result;
            };
            const flatCoords = flattenCoords(coords);
            for (const [lng, lat, height = 0] of flatCoords) {
              if (typeof lng === 'number' && typeof lat === 'number') {
                positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, height));
              }
            }
          } else if (geometryType === 'GeometryCollection') {
            // 处理几何集合
            const geometries = geom.geometries;
            if (Array.isArray(geometries)) {
              for (const g of geometries) {
                positions.push(...collectPositions({ features: [{ geometry: g }] }));
              }
            }
          }
        } catch (err) {
          console.warn('[ZoomToLayer] Failed to process feature:', err);
        }
      }

      return positions;
    };

    // 从 layer.data 中提取坐标
    let positions: Cesium.Cartesian3[] = [];

    if (layer.data) {
      positions = collectPositions(layer.data);
    }

    // 如果 layer.data 为空，尝试从 DataSource 读取（针对非 Draw 图层）
    if (positions.length === 0 && layer.type === 'GeoJSON' && layer.sourceId) {
      const dataSource = viewer.dataSources.getByName(layerId);
      if (dataSource.length > 0) {
        const ds = dataSource[0];
        const entities = ds.entities.values;
        for (const entity of entities) {
          try {
            if (entity.position) {
              positions.push(entity.position.getValue(viewer.clock.currentTime));
            } else if (entity.polyline) {
              const positionsAttr = entity.polyline.positions?.getValue(viewer.clock.currentTime);
              if (positionsAttr && Array.isArray(positionsAttr)) {
                positions.push(...positionsAttr);
              }
            } else if (entity.polygon) {
              const hierarchy = entity.polygon.hierarchy?.getValue(viewer.clock.currentTime);
              if (hierarchy) {
                const flattenHierarchy = (h: any): Cesium.Cartesian3[] => {
                  const result: Cesium.Cartesian3[] = [];
                  if (h.positions && Array.isArray(h.positions)) {
                    result.push(...h.positions);
                  }
                  if (h.holes && Array.isArray(h.holes)) {
                    for (const hole of h.holes) {
                      result.push(...flattenHierarchy(hole));
                    }
                  }
                  return result;
                };
                positions.push(...flattenHierarchy(hierarchy));
              }
            }
          } catch (err) {
            console.warn('[ZoomToLayer] Failed to extract position from entity:', err);
          }
        }
      }
    }

    if (positions.length === 0) {
      console.warn('[ZoomToLayer] No valid positions found for layer:', layerId, '- data:', layer.data ? 'exists' : 'missing', ', features:', layer.data?.features?.length || 0);
      return;
    }

    try {
      // 计算边界球
      const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);

      // 跳转视角
      viewer.camera.flyToBoundingSphere(boundingSphere, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(
          viewer.camera.heading,
          viewer.camera.pitch,
          boundingSphere.radius * 2, // 保持一定距离
        ),
      });
    } catch (err) {
      console.error('[ZoomToLayer] Failed to compute bounding sphere:', err);
    }
  };

  return (
    <div className="relative bg-white/90 backdrop-blur rounded-lg shadow-lg border w-72 flex flex-col max-h-[calc(100vh-100px)] pointer-events-auto transition-all">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 font-medium text-gray-700">
          <Layers className="w-4 h-4" />
          <span>图层管理</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-gray-600 transition-all"
            onClick={() => addBlankLayer('New Layer')}
            title="添加空白图层"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 hover:bg-white hover:shadow-sm rounded text-blue-600 transition-all"
            onClick={() => setIsAddModalOpen(true)}
            title="添加图层"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="p-2 space-y-1 overflow-auto flex-1 custom-scrollbar">
        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm">
            <Layers className="w-8 h-8 mb-2 opacity-50" />
            <span>暂无图层</span>
          </div>
        )}
        {layers.map((layer, index) => (
          <div
            key={layer.id}
            className={`flex items-center justify-between p-2 rounded group relative transition-colors ${draggedItemIndex === index ? 'opacity-50 bg-gray-100 border-dashed border-2 border-gray-300' : 'hover:bg-gray-50 bg-white border border-transparent hover:border-gray-200'} ${activeLayerId === layer.id ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              {/* Drag Handle */}
              <div className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Active Indicator */}
              {activeLayerId === layer.id && (
                <div className="text-blue-500" title="当前编辑图层">
                  <Pencil className="w-3 h-3" />
                </div>
              )}

              {/* Visibility Toggle */}
              <button
                onClick={() => setLayerVisibility(layer.id, !layer.visible)}
                className={`text-gray-400 hover:text-gray-600 ${!layer.visible && 'opacity-50'}`}
              >
                {layer.visible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>

              <span
                className="text-sm truncate select-none flex-1 text-gray-700 font-medium"
                title={layer.name}
              >
                {layer.name}
              </span>
              {attributePanel.isOpen && attributePanel.layerId === layer.id && (
                <div className="text-emerald-600" title="正在查看属性表">
                  <Table className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors ${activeLayerId === layer.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[60]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (activeLayerId === layer.id) {
                      setActiveLayer(null);
                    } else {
                      setActiveLayer(layer.id);
                    }
                  }}
                >
                  <Edit3 className="w-3 h-3 mr-2" />
                  {activeLayerId === layer.id ? '停止编辑' : '开启编辑'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleZoomToLayer(layer.id);
                  }}
                >
                  <Search className="w-3 h-3 mr-2" />
                  缩放至图层
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    openAttributePanel(layer.id);
                  }}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  属性表
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    openStylePanel(layer.id);
                  }}
                >
                  <Settings className="w-3 h-3 mr-2" />
                  样式设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onSelect={(e) => {
                    e.preventDefault();
                    removeLayer(layer.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <div className="addlayer absolute top-0 left-[290px]">
        <AddLayerModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      </div>
    </div>
  );
}
