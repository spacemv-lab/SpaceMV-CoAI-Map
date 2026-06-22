/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useMapStore } from '../store/use-map-store';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import * as Cesium from 'cesium';
import maplibregl from 'maplibre-gl';
import { AddLayerModal } from './add-layer-modal';
import { SaveDrawingDialog } from './save-drawing-dialog';
import { updateDataset } from '@/features/gis-data-manager/feature-api';
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
  Tag,
  Check,
  Edit2,
  Save,
} from 'lucide-react';
import { recordInteractionMetric } from '../monitoring/performance-monitor';

export function LayerManager({ readOnly = false }: { readOnly?: boolean } = {}) {
  const viewerReady = useMapStore((state) => state.viewerReady);
  const layers = useMapStore((state) => state.layers);
  const removeLayer = useMapStore((state) => state.removeLayer);
  const setLayerVisibility = useMapStore((state) => state.setLayerVisibility);
  const reorderLayers = useMapStore((state) => state.reorderLayers);
  const addBlankLayer = useMapStore((state) => state.addBlankLayer);
  const activeLayerId = useMapStore((state) => state.activeLayerId);
  const setActiveLayer = useMapStore((state) => state.setActiveLayer);
  const clearEditState = useMapStore((state) => state.clearEditState);
  const openStylePanel = useMapStore((state) => state.openStylePanel);
  const openAttributePanel = useMapStore((state) => state.openAttributePanel);
  const openLabelPanel = useMapStore((state) => state.openLabelPanel);
  const attributePanel = useMapStore((state) => state.attributePanel);
  const currentProjectId = useMapStore((state) => state.currentProjectId);
  const editPanel = useMapStore((state) => state.editPanel);
  const edit = useMapStore((state) => state.edit);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [renameLayerId, setRenameLayerId] = useState<string | null>(null);
  const [renameOriginalName, setRenameOriginalName] = useState<string>('');
  const [saveDialogLayerId, setSaveDialogLayerId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus rename input when entering edit mode
  useEffect(() => {
    if (renameLayerId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameLayerId]);

  /**
   * 删除图层前的确认逻辑
   * 如果正在编辑该图层的要素，弹出确认提示
   */
  const handleRemoveLayer = (layerId: string) => {
    const isEditingThisLayer =
      editPanel.isOpen &&
      (edit.selectedFeature?.layerId === layerId || activeLayerId === layerId);

    if (isEditingThisLayer && edit.hasUnsavedChanges) {
      const confirmed = confirm('正在编辑该图层的要素，删除图层将丢失未保存的修改，是否继续？');
      if (!confirmed) return;
    }

    removeLayer(layerId);
  };

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
   * 将图层名同步到数据库 Dataset 记录
   */
  const syncLayerNameToDataset = async (layerId: string, name: string) => {
    const layer = useMapStore.getState().layers.find(l => l.id === layerId);
    const datasetId = layer?.routingMetadata?.datasetId;
    if (!datasetId) return;
    try {
      await updateDataset(datasetId, { name });
    } catch {
      toast.error('同步图层名到数据库失败');
    }
  };

  /**
   * 缩放至图层 - 计算图层边界并跳转视角
   */
  const handleZoomToLayer = (layerId: string) => {
    const startedAt = performance.now();

    if (!viewerReady) {
      console.error('[ZoomToLayer] Viewer not ready');
      return;
    }

    // Check if using MapLibre
    const experimental = useMapStore.getState().experimental;
    if (experimental?.useMaplibre) {
      const map = (window as unknown as { MAPLIBRE_MAP?: maplibregl.Map }).MAPLIBRE_MAP;
      if (!map) {
        toast.error('地图查看器未初始化');
        console.error('[ZoomToLayer] MAPLIBRE_MAP is undefined');
        return;
      }
      handleZoomToLayerMapLibre(map, layerId, startedAt);
      return;
    }

    const viewer = (window as unknown as { CESIUM_VIEWER?: Cesium.Viewer })
      .CESIUM_VIEWER;

    if (!viewer) {
      toast.error('地图查看器未初始化');
      console.error('[ZoomToLayer] Viewer is undefined');
      return;
    }

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
      toast.warning('图层数据加载中，请稍后再试');
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
      recordInteractionMetric('interaction.zoom-to-layer', {
        layerId,
        durationMs: performance.now() - startedAt,
        pointCount: positions.length,
      });
    } catch (err) {
      console.error('[ZoomToLayer] Failed to compute bounding sphere:', err);
    }
  };

  // MapLibre zoom to layer handler
  const handleZoomToLayerMapLibre = (
    map: maplibregl.Map,
    layerId: string,
    startedAt: number,
  ) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) {
      console.error('[ZoomToLayer] Layer not found:', layerId);
      return;
    }

    // Use bbox from routingMetadata if available
    const bbox = layer.routingMetadata?.bbox;
    if (bbox && bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      map.fitBounds([minLng, minLat, maxLng, maxLat], {
        padding: 50,
        duration: 1500,
      });
      recordInteractionMetric('interaction.zoom-to-layer', {
        layerId,
        durationMs: performance.now() - startedAt,
        source: 'bbox',
      });
      return;
    }

    // Fallback: compute bbox from layer data
    if (!layer.data?.features?.length) {
      toast.warning('图层数据加载中，请稍后再试');
      console.warn('[ZoomToLayer] No data for layer:', layerId);
      return;
    }

    type GeoJsonGeometry = {
      type: string;
      coordinates: unknown;
    };

    const coords: number[][] = [];
    for (const feature of layer.data.features) {
      const geom = feature.geometry as GeoJsonGeometry | undefined;
      if (!geom?.coordinates) continue;

      const type = geom.type;
      const geometryCoords = geom.coordinates;

      if (type === 'Point' && Array.isArray(geometryCoords)) {
        coords.push(geometryCoords as number[]);
      } else if (type === 'LineString' && Array.isArray(geometryCoords)) {
        coords.push(...(geometryCoords as number[][]).filter(Array.isArray));
      } else if (type === 'MultiLineString' && Array.isArray(geometryCoords)) {
        coords.push(...(geometryCoords as number[][][]).flat().filter(Array.isArray));
      } else if (type === 'Polygon' && Array.isArray(geometryCoords)) {
        for (const ring of geometryCoords as number[][][]) {
          if (Array.isArray(ring)) {
            coords.push(...ring.filter(Array.isArray));
          }
        }
      } else if (type === 'MultiPolygon' && Array.isArray(geometryCoords)) {
        for (const polygon of geometryCoords as number[][][][]) {
          for (const ring of polygon) {
            if (Array.isArray(ring)) {
              coords.push(...ring.filter(Array.isArray));
            }
          }
        }
      }
    }

    if (coords.length === 0) {
      toast.warning('无法计算图层范围');
      return;
    }

    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    map.fitBounds([minLng, minLat, maxLng, maxLat], {
      padding: 50,
      duration: 1500,
    });
    recordInteractionMetric('interaction.zoom-to-layer', {
      layerId,
      durationMs: performance.now() - startedAt,
      source: 'computed',
      pointCount: coords.length,
    });
  };

  return (
    <div className="relative bg-white/90 backdrop-blur rounded-lg shadow-lg border w-72 flex flex-col max-h-[calc(100vh-100px)] pointer-events-auto transition-all">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 font-medium text-gray-700">
          <Layers className="w-4 h-4" />
          <span>图层管理</span>
        </div>
        {!readOnly && (
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
        )}
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
            draggable={!readOnly}
            onDragStart={readOnly ? undefined : (e) => handleDragStart(e, index)}
            onDragOver={readOnly ? undefined : (e) => handleDragOver(e)}
            onDrop={readOnly ? undefined : (e) => handleDrop(e, index)}
          >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              {/* Drag Handle */}
              {!readOnly && (
                <div className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              {/* Active Indicator */}
              {!readOnly && activeLayerId === layer.id && (
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

              {renameLayerId === layer.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={layer.name}
                  onChange={(e) => {
                    useMapStore.getState().updateLayer(layer.id, { name: e.target.value });
                  }}
                  onBlur={() => {
                    syncLayerNameToDataset(layer.id, layer.name);
                    setRenameLayerId(null);
                    setRenameOriginalName('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      syncLayerNameToDataset(layer.id, layer.name);
                      setRenameLayerId(null);
                      setRenameOriginalName('');
                    }
                    if (e.key === 'Escape') {
                      // Cancel: restore original name
                      useMapStore.getState().updateLayer(layer.id, { name: renameOriginalName });
                      setRenameLayerId(null);
                      setRenameOriginalName('');
                    }
                  }}
                  className="text-sm flex-1 px-1 border rounded focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span
                  className="text-sm truncate select-none flex-1 text-gray-700 font-medium"
                  title={layer.name}
                  onDoubleClick={
                    readOnly
                      ? undefined
                      : () => {
                          // Save original name before entering edit mode
                          setRenameOriginalName(layer.name);
                          setRenameLayerId(layer.id);
                        }
                  }
                >
                  {layer.name}
                </span>
              )}
              {attributePanel.isOpen && attributePanel.layerId === layer.id && (
                <div className="text-emerald-600" title="正在查看属性表">
                  <Table className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Actions：只读视图仅保留“缩放至图层”（安全的查看动作）；
                编辑/属性表/标注/样式/改名/删除等写操作只在编辑器（!readOnly）出现 */}
            {readOnly ? (
              <button
                className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                onClick={() => handleZoomToLayer(layer.id)}
                title="缩放至图层"
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
            <DropdownMenu
              key={`dropdown-${layer.id}`}
              open={openDropdownId === layer.id}
              onOpenChange={(open) => {
                setOpenDropdownId(open ? layer.id : null);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[60]" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem
                  onSelect={() => {
                    if (activeLayerId === layer.id) {
                      const hasChanges = useMapStore.getState().edit.hasUnsavedChanges;
                      if (hasChanges && !confirm('有未保存的修改，是否放弃？')) return;
                      setActiveLayer(null);
                      clearEditState();
                    } else {
                      setActiveLayer(layer.id);
                    }
                    setOpenDropdownId(null);
                  }}
                >
                  <Edit3 className="w-3 h-3 mr-2" />
                  {activeLayerId === layer.id ? '停止编辑' : '开启编辑'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    handleZoomToLayer(layer.id);
                    setOpenDropdownId(null);
                  }}
                >
                  <Search className="w-3 h-3 mr-2" />
                  缩放至图层
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    openAttributePanel(layer.id);
                    recordInteractionMetric('interaction.attribute-panel', {
                      layerId: layer.id,
                    });
                    setOpenDropdownId(null);
                  }}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  属性表
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={layer.style?.label?.enabled ? 'bg-green-50 text-green-700 focus:bg-green-100 focus:text-green-800' : ''}
                  onSelect={() => {
                    openLabelPanel(layer.id);
                    recordInteractionMetric('interaction.label-panel', {
                      layerId: layer.id,
                    });
                    setOpenDropdownId(null);
                  }}
                >
                  <Tag className="w-3 h-3 mr-2" />
                  标注
                  {layer.style?.label?.enabled && (
                    <span className="ml-auto text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      已启用
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    openStylePanel(layer.id);
                    recordInteractionMetric('interaction.style-panel', {
                      layerId: layer.id,
                    });
                    setOpenDropdownId(null);
                  }}
                >
                  <Settings className="w-3 h-3 mr-2" />
                  样式设置
                </DropdownMenuItem>
                {/* 改名菜单项 */}
                <DropdownMenuItem
                  onSelect={() => {
                    setRenameOriginalName(layer.name);
                    setRenameLayerId(layer.id);
                    setOpenDropdownId(null);
                  }}
                >
                  <Edit2 className="w-3 h-3 mr-2" />
                  改名
                </DropdownMenuItem>
                {/* 保存到项目菜单项 - 只对 Draw 图层显示 */}
                {layer.type === 'Draw' && layer.data?.features?.length > 0 && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setOpenDropdownId(null);
                      setSaveDialogLayerId(layer.id);
                    }}
                  >
                    <Save className="w-3 h-3 mr-2" />
                    保存到项目
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  onSelect={() => {
                    setOpenDropdownId(null);
                    handleRemoveLayer(layer.id);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        ))}
      </div>

      <div className="addlayer absolute top-0 left-[290px]">
        <AddLayerModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} projectId={currentProjectId} />
      </div>

      {saveDialogLayerId && (
        <SaveDrawingDialog
          layerId={saveDialogLayerId}
          onClose={() => setSaveDialogLayerId(null)}
        />
      )}
    </div>
  );
}
