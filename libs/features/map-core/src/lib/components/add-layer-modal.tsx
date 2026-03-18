/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useState, useEffect } from 'react';
import { useMapStore } from '../store/use-map-store';
import { Globe } from 'lucide-react';
import { GeometryType } from '../types/map-state';
import { getStyleConfig } from '../constants/style-config';

interface AddLayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Dataset {
  id: string;
  name: string;
  type: 'POINT' | 'LINESTRING' | 'POLYGON';
}

/**
 * 标准化几何类型，确保大小写统一
 */
function normalizeGeometryType(type: string): GeometryType | undefined {
  const t = type.toUpperCase();
  if (t === 'POINT' || t === 'MULTIPOINT') return 'POINT';
  if (t === 'LINESTRING' || t === 'MULTILINESTRING') return 'LINESTRING';
  if (t === 'POLYGON' || t === 'MULTIPOLYGON') return 'POLYGON';
  return undefined;
}

export function AddLayerModal({ open, onOpenChange }: AddLayerModalProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'my-data' | 'tile-services'>(
    'my-data',
  );
  const addLayer = useMapStore((state) => state.addLayer);

  useEffect(() => {
    if (open) {
      fetch('/api/datasets')
        .then((res) => res.json())
        .then((data) => setDatasets(data.items || []))
        .catch(() => {
          // Fallback for demo if fetch fails or api doesn't exist
          setDatasets([]);
        });
      setSelectedIds(new Set());
      setActiveTab('my-data');
    }
  }, [open]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const mapBackendTypeToLayerType = (
    type: string,
  ): 'GeoJSON' | 'Tile' | 'Model' | 'Draw' => {
    const t = type.toUpperCase();
    if (
      [
        'LINESTRING',
        'POLYGON',
        'POINT',
        'MULTIPOINT',
        'MULTILINESTRING',
        'MULTIPOLYGON',
        'GEOJSON',
        'SHAPEFILE',
      ].includes(t)
    ) {
      return 'GeoJSON';
    }
    if (['RASTER', 'TILE', 'TMS', 'WMTS', 'WMS'].includes(t)) {
      return 'Tile';
    }
    if (['MODEL', '3D TILES', 'GLTF', 'GLB'].includes(t)) {
      return 'Model';
    }
    return 'GeoJSON'; // Default fallback
  };

  const handleBatchAdd = () => {
    datasets.forEach((d) => {
      if (selectedIds.has(d.id)) {
        const geometryType = normalizeGeometryType(d.type);
        // 根据几何类型获取默认样式配置
        const defaultStyle = geometryType
          ? getStyleConfig(geometryType).defaultStyle
          : { color: '#3388ff', opacity: 0.5 };

        addLayer({
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2),
          name: d.name,
          type: mapBackendTypeToLayerType(d.type),
          geometryType: geometryType,
          visible: true,
          opacity: 1,
          style: defaultStyle,
          sourceId: d.id,
          // Explicitly set data/dataSource as undefined
          data: undefined,
          dataSource: undefined,
        });
      }
    });
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="add-layer-model  z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg w-[400px] h-[600px] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">添加图层</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-black text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-white">
          <button
            className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'my-data' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('my-data')}
          >
            My Data
          </button>
          <button
            className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'tile-services' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('tile-services')}
          >
            Tile Services
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
          {activeTab === 'my-data' ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="border-b">
                  <th className="p-3 w-10">{/* Select All could go here */}</th>
                  <th className="p-3 font-semibold text-gray-600">名称</th>
                  <th className="p-3 font-semibold text-gray-600">类型</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-b hover:bg-blue-50 cursor-pointer transition-colors ${selectedIds.has(d.id) ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleSelection(d.id)}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        readOnly
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                    </td>
                    <td className="p-3 text-gray-800">{d.name}</td>
                    <td className="p-3 text-gray-600">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">
                        {d.type}
                      </span>
                    </td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-400">
                      No datasets available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Globe className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg">Tile Services coming soon...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
          <button
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            onClick={handleBatchAdd}
            disabled={selectedIds.size === 0}
          >
            添加选中 ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
