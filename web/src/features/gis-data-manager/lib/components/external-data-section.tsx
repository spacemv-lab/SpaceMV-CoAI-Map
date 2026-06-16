/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * External Data Sources Section
 * Displays AIS/ADS-B and other real-time data sources in the data square
 */

import { useState, useEffect } from 'react';
import { Ship, Plane, RefreshCw } from 'lucide-react';
import { externalApi } from '../api/external.api';

/**
 * 外部数据源配置（与后端 ExternalDataSourceConfig 对应）
 */
interface ExternalSource {
  id: string;
  name: string;
  type: 'ADS-B' | 'AIS';
  description: string;
  icon: 'plane' | 'ship';
  tag: string;
  externalId: string;
}

interface ExternalDataSectionProps {
  onAddLayer: (source: ExternalSource) => void;
}

export function ExternalDataSection({ onAddLayer }: ExternalDataSectionProps) {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchExternalSources();
  }, []);

  const fetchExternalSources = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await externalApi.listSources();
      setSources(data.items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // 筛选 AIS 和 ADS-B
  const aisSources = sources.filter(s => s.tag === 'ais' || s.type === 'AIS');
  const adsbSources = sources.filter(s => s.tag === 'ads-b' || s.type === 'ADS-B');

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
        加载实时数据源...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        加载失败: {error.message}
      </div>
    );
  }

  if (sources.length === 0) {
    return null; // 暂无外部数据源时不显示
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 text-gray-700">实时数据源</h2>

      {/* 所有数据源统一网格布局 */}
      <div className="grid grid-cols-2 gap-3">
        {sources.map(source => (
          <ExternalDataCard key={source.id} source={source} onAdd={onAddLayer} />
        ))}
      </div>
    </div>
  );
}

function ExternalDataCard({
  source,
  onAdd
}: {
  source: ExternalSource;
  onAdd: (source: ExternalSource) => void;
}) {
  return (
    <div
      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
      onClick={() => onAdd(source)}
    >
      <div className="font-medium text-sm">{source.name}</div>
      <div className="text-xs text-gray-500 mt-1">
        {source.description}
      </div>
      <div className="text-xs text-gray-400 mt-2">
        类型: {source.type}
      </div>
    </div>
  );
}