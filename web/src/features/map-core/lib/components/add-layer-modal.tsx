/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useEffect } from 'react';
import { useMapStore } from '../store/use-map-store';
import { Globe, Ship, Plane, RefreshCw, FolderOpen, Map as MapIcon, Image as ImageIcon } from 'lucide-react';
import { DatasetRoutingSummary, createLayerFromDataset } from '../runtime/layer-routing';
import { TIANDITU_PRESETS } from '../constants/tianditu-presets';
import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import { tileSourceApi, type CogSource } from '@/features/gis-data-manager/lib/api';

interface ExternalSource {
  id: string;
  name: string;
  type: 'ADS-B' | 'AIS';
  description: string;
  icon: 'plane' | 'ship';
  tag: string;
  externalId: string;
}

interface AddLayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string | null;  // 当前工程ID
}

export function AddLayerModal({ open, onOpenChange, projectId }: AddLayerModalProps) {
  const [projectDatasets, setProjectDatasets] = useState<DatasetRoutingSummary[]>([]);
  const [globalDatasets, setGlobalDatasets] = useState<DatasetRoutingSummary[]>([]);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [externalLoading, setExternalLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedExternalIds, setSelectedExternalIds] = useState<Set<string>>(new Set());
  const [cogSources, setCogSources] = useState<CogSource[]>([]);
  const [selectedCogIds, setSelectedCogIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'project-data' | 'public-data' | 'realtime-data' | 'basemap'>(
    projectId ? 'project-data' : 'public-data',
  );
  const addLayer = useMapStore((state) => state.addLayer);
  const basemap = useMapStore((state) => state.basemap);
  const setBasemap = useMapStore((state) => state.setBasemap);
  const tiandituToken = useMapStore((state) => state.tiandituToken);

  useEffect(() => {
    if (!open) return;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        // 加载项目数据（仅项目页面）
        if (projectId) {
          const projectParams = new URLSearchParams();
          projectParams.append('scope', 'PROJECT');
          projectParams.append('projectId', projectId);

          const projectRes = await httpClient.get<ApiResponse<{ items: DatasetRoutingSummary[]; total: number }>>(
            `/datasets?${projectParams.toString()}`,
          );
          setProjectDatasets(projectRes.data.data?.items || []);
        }

        // 加载公共数据（GLOBAL scope，排除 externalId）
        const globalParams = new URLSearchParams();
        globalParams.append('scope', 'GLOBAL');

        const globalRes = await httpClient.get<ApiResponse<{ items: DatasetRoutingSummary[]; total: number }>>(
          `/datasets?${globalParams.toString()}`,
        );
        // 过滤掉外部数据源（AIS/ADS-B）
        setGlobalDatasets((globalRes.data.data?.items || []).filter((d: any) => !d.externalId));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const loadExternalSources = async () => {
      setExternalLoading(true);
      try {
        const response = await httpClient.get<ApiResponse<{ items: ExternalSource[] }>>(
          '/datasets/external/sources',
        );
        setExternalSources(response.data.data?.items || []);
      } catch (error) {
        console.error('Failed to load external sources:', error);
        setExternalSources([]);
      } finally {
        setExternalLoading(false);
      }
    };

    const loadCogSources = async () => {
      try {
        setCogSources(await tileSourceApi.listCogSources());
      } catch {
        setCogSources([]);
      }
    };

    void Promise.all([loadData(), loadExternalSources(), loadCogSources()]);

    setSelectedIds(new Set());
    setSelectedExternalIds(new Set());
    setSelectedCogIds(new Set());
    setActiveTab(projectId ? 'project-data' : 'public-data');
  }, [open, projectId]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleExternalSelection = (id: string) => {
    const newSelected = new Set(selectedExternalIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedExternalIds(newSelected);
  };

  const toggleCogSelection = (id: string) => {
    const newSelected = new Set(selectedCogIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCogIds(newSelected);
  };

  const handleBatchAdd = async () => {
    // Add project datasets
    projectDatasets.forEach((d) => {
      if (selectedIds.has(d.id)) {
        addLayer(createLayerFromDataset(d, 'browse'));
      }
    });

    // Add global datasets
    globalDatasets.forEach((d) => {
      if (selectedIds.has(d.id)) {
        addLayer(createLayerFromDataset(d, 'browse'));
      }
    });

    // Add external sources
    for (const source of externalSources) {
      if (selectedExternalIds.has(source.id)) {
        try {
          const response = await httpClient.get<ApiResponse<{ versions: any[]; datasetId?: string }>>(
            `/datasets/external/${source.externalId}/versions`,
          );
          const data = response.data.data;

          if (data?.versions?.length > 0) {
            const latestVersion = data.versions[0];
            addLayer({
              id: `external-${source.externalId}`,
              name: source.name,
              type: 'GeoJSON',
              sourceId: data.datasetId,
              geometryType: 'POINT',
              visible: true,
              opacity: 1,
              tags: [source.tag],
              style: {},
              routingMetadata: {
                datasetId: data.datasetId,
                geometryType: 'POINT',
                geojsonUrl: `/api/datasets/${data.datasetId}/geojson`,
                recordCount: latestVersion.recordCount,
              },
            });
          }
        } catch (error) {
          console.error(`Failed to add external source ${source.name}:`, error);
        }
      }
    }

    // Add cog tile sources（影像瓦片，作为栅格叠加图层）
    for (const s of cogSources) {
      if (selectedCogIds.has(s.id)) {
        const urlTemplate = s.config?.layers?.[0]?.urlTemplate;
        const bounds = s.config?.bounds;
        if (urlTemplate) {
          addLayer({
            id: `cog-${s.id}`,
            name: s.name,
            type: 'Tile',
            visible: true,
            opacity: 1,
            style: { tileUrlTemplate: urlTemplate },
            routingMetadata: bounds ? { bbox: bounds } : undefined,
          });
        }
      }
    }

    onOpenChange(false);
  };

  // 获取当前 tab 对应的数据集
  const getCurrentDatasets = () => {
    if (activeTab === 'project-data') return projectDatasets;
    if (activeTab === 'public-data') return globalDatasets;
    return [];
  };

  if (!open) return null;

  return (
    <div className="add-layer-model z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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
          {projectId && (
            <button
              className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'project-data' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setActiveTab('project-data')}
            >
              <FolderOpen className="w-4 h-4 inline mr-1" />
              项目内数据
            </button>
          )}
          <button
            className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'public-data' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('public-data')}
          >
            <Globe className="w-4 h-4 inline mr-1" />
            公共数据
          </button>
          <button
            className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'realtime-data' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('realtime-data')}
          >
            实时数据
          </button>
          <button
            className={`flex-1 p-3 text-sm font-medium transition-colors ${activeTab === 'basemap' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('basemap')}
          >
            <MapIcon className="w-4 h-4 inline mr-1" />
            底图/瓦片
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
          {activeTab === 'basemap' ? (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <MapIcon className="w-4 h-4" />
                <span className="font-medium">底图（单选）</span>
              </div>
              {!tiandituToken && (
                <div className="mb-3 p-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded">
                  未检测到天地图 token，底图瓦片将无法加载。请到「数据广场 → 瓦片」配置。
                </div>
              )}
              <div className="space-y-1">
                {Object.entries(TIANDITU_PRESETS).map(([key, preset]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition ${
                      basemap === key ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50 border-transparent'
                    }`}
                    onClick={() => {
                      setBasemap(key);
                      onOpenChange(false);
                    }}
                  >
                    <span className={`w-3 h-3 rounded-full border-2 ${basemap === key ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
                    <span className="text-sm">{preset.label}</span>
                  </div>
                ))}
              </div>
              {/* 影像瓦片(多选,作为栅格叠加图层) */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                  <ImageIcon className="w-4 h-4" />
                  <span className="font-medium">影像瓦片（多选，叠加图层）</span>
                </div>
                {cogSources.filter((s) => s.ingestStatus === 'READY').length === 0 ? (
                  <p className="text-xs text-gray-400 ml-6">
                    暂无就绪影像。到「数据广场 → 瓦片」上传 GeoTIFF。
                  </p>
                ) : (
                  <div className="space-y-1 ml-6">
                    {cogSources
                      .filter((s) => s.ingestStatus === 'READY')
                      .map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCogIds.has(s.id)}
                            onChange={() => toggleCogSelection(s.id)}
                            className="rounded border-gray-300 text-blue-600 w-4 h-4"
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'project-data' || activeTab === 'public-data' ? (
            loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b">
                    <th className="p-3 w-10"></th>
                    <th className="p-3 font-semibold text-gray-600">名称</th>
                    <th className="p-3 font-semibold text-gray-600">类型</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentDatasets().map((d) => (
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
                  {getCurrentDatasets().length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-400">
                        {loadError || (activeTab === 'project-data' ? '暂无项目数据' : '暂无公共数据')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )
          ) : (
            <div className="p-4">
              {externalLoading ? (
                <div className="flex items-center justify-center h-32 text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  加载实时数据源...
                </div>
              ) : externalSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <Globe className="w-12 h-12 mb-2 text-gray-300" />
                  <p>暂无实时数据源</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* AIS 船舶 */}
                  {externalSources.filter(s => s.tag === 'ais').length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-blue-600">
                        <Ship className="w-4 h-4" />
                        <span className="text-sm font-medium">船舶 AIS</span>
                      </div>
                      <div className="space-y-2">
                        {externalSources.filter(s => s.tag === 'ais').map(source => (
                          <div
                            key={source.id}
                            className={`p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition ${selectedExternalIds.has(source.id) ? 'bg-blue-50 border-blue-300' : ''}`}
                            onClick={() => toggleExternalSelection(source.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{source.name}</div>
                              <input
                                type="checkbox"
                                checked={selectedExternalIds.has(source.id)}
                                readOnly
                                className="rounded border-gray-300 text-blue-600 w-4 h-4"
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{source.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ADS-B 飞机 */}
                  {externalSources.filter(s => s.tag === 'ads-b').length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 text-orange-600">
                        <Plane className="w-4 h-4" />
                        <span className="text-sm font-medium">飞机 ADS-B</span>
                      </div>
                      <div className="space-y-2">
                        {externalSources.filter(s => s.tag === 'ads-b').map(source => (
                          <div
                            key={source.id}
                            className={`p-3 border rounded-lg hover:bg-orange-50 cursor-pointer transition ${selectedExternalIds.has(source.id) ? 'bg-orange-50 border-orange-300' : ''}`}
                            onClick={() => toggleExternalSelection(source.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-sm">{source.name}</div>
                              <input
                                type="checkbox"
                                checked={selectedExternalIds.has(source.id)}
                                readOnly
                                className="rounded border-gray-300 text-orange-600 w-4 h-4"
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{source.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
            disabled={selectedIds.size + selectedExternalIds.size + selectedCogIds.size === 0}
          >
            添加选中 ({selectedIds.size + selectedExternalIds.size + selectedCogIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}