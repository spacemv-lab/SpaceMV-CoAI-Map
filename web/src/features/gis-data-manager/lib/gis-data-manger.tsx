/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { UploadModal } from './components/upload-modal';
import { DatasetTable } from './components/dataset-table';
import { StorageCard } from './components/storage-card';
import { NotificationList, Notification } from './components/notification-list';
import { IngestStatusTracker } from './components/ingest-status-tracker';
import { ValidationReportView } from './components/validation-report-view';
import { ExternalDataSection } from './components/external-data-section';
import { Dataset, StorageStats, IngestStatusInfo, ValidationReport, DatasetScope } from './types';
import { useDatasetList } from './hooks/use-dataset-list';
import { Upload, RefreshCw, Info, FileText } from 'lucide-react';
import { statsApi, datasetApi } from './api';

interface GisDataManagerProps {
  /**
   * Project ID - null 表示全局数据广场
   */
  projectId?: string | null;

  /**
   * 数据范围 - 默认根据 projectId 自动推断
   */
  scope?: DatasetScope;

  /**
   * 自定义标题
   */
  title?: string;

  /**
   * 自定义描述
   */
  description?: string;

  /**
   * 是否在项目页面（需要为左侧悬浮导航留出空间）
   */
  isInProject?: boolean;
}

/**
 * GisDataManager Main Component
 *
 * The main entry point for the GIS Data Manager feature.
 * Coordinates state between sub-components and handles data fetching.
 *
 * Supports both global data square (projectId = null) and project-specific data.
 */
export function GisDataManager({
  projectId = null,
  scope,
  title,
  description,
  isInProject = false,
}: GisDataManagerProps) {
  // 根据 projectId 自动推断 scope
  const effectiveScope = scope ?? (projectId ? 'PROJECT' : 'GLOBAL');

  // 默认标题和描述
  const effectiveTitle = title ?? (effectiveScope === 'GLOBAL' ? '全局数据广场' : 'GIS 数据管理');
  const effectiveDescription = description ??
    (effectiveScope === 'GLOBAL'
      ? '管理全局地理空间数据，所有工程均可使用'
      : '管理工程私有地理空间数据');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);

  const {
    datasets,
    total,
    loading,
    error,
    fetchDatasets,
  } = useDatasetList({
    projectId,
    scope: effectiveScope,
    autoFetch: true,
  });

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      date: '2024-04-06',
      message: '【数据资源】新增 2024 年第一季度土地覆盖数据',
    },
    {
      id: '2',
      date: '2024-04-06',
      message: '【数据资源】更新成都市行政区划矢量数据',
    },
  ]);

  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalSpace: 100 * 1024 * 1024, // 100MB
    usedSpace: 0,
    usagePercent: 0,
    datasetCount: 0,
    featureCount: 0,
    fileStats: {
      totalFiles: 0,
      totalSize: 0,
    },
  });

  // Fetch storage stats
  useEffect(() => {
    const fetchStorageStats = async () => {
      try {
        const stats = await statsApi.getStorage();
        setStorageStats(stats);
      } catch (error) {
        console.error('Failed to fetch storage stats:', error);
      }
    };

    fetchStorageStats();
  }, []);

  const handleUploadSuccess = () => {
    fetchDatasets();
    // 添加通知
    const newNotification = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      message: '【数据资源】新数据集上传成功',
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const handleDelete = async (dataset: Dataset) => {
    if (!window.confirm(`确认要删除 "${dataset.name}" 吗？`)) return;

    try {
      await datasetApi.delete(dataset.id);
      fetchDatasets();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('删除数据集失败');
    }
  };

  const handleViewDetails = async (dataset: Dataset) => {
    // Set the current version for status tracking
    if (dataset.currentVersionId) {
      setSelectedVersionId(dataset.currentVersionId);
      setShowStatusPanel(true);
    }
  };

  const handleViewReport = async (dataset: Dataset) => {
    if (dataset.currentVersionId) {
      setSelectedVersionId(dataset.currentVersionId);
      setShowReportPanel(true);
    }
  };

  // 处理外部数据源添加到地图
  const handleAddExternalSource = async (source: { id: string; name: string; tag: string; type: string; externalId: string }) => {
    // 获取最新版本
    try {
      const data = await datasetApi.getExternalVersions(source.externalId);

      if (!data.versions?.length) {
        alert('暂无可用数据');
        return;
      }

      // 获取最新版本 ID
      const versionId = data.versions[0].id;

      // 构造图层参数，导航到地图页面
      const layerParams = new URLSearchParams({
        sourceId: versionId,
        name: source.name,
        type: 'GeoJSON',
        geometryType: 'POINT',
        tags: source.tag,
      });

      // 导航到地图页面
      window.location.href = `/map?${layerParams.toString()}`;
    } catch (err) {
      console.error('Failed to add external source:', err);
      alert('添加失败');
    }
  };

  return (
    <div className={`flex h-full w-full bg-background gap-6 ${isInProject ? 'pl-[72px] pr-6 py-6' : 'p-6'}`}>
      {/* 左侧：主要内容区域 */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{effectiveTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">{effectiveDescription}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchDatasets}
              title="刷新"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              上传数据
            </Button>
          </div>
        </div>

        {/* External Data Sources - Only in GLOBAL scope */}
        {effectiveScope === 'GLOBAL' && (
          <ExternalDataSection onAddLayer={handleAddExternalSource} />
        )}

        {/* Dataset Table - Filter out external data sources (AIS/ADS-B) */}
        <DatasetTable
          data={datasets.filter(d => !d.externalId)}
          loading={loading}
          onView={handleViewDetails}
          onDelete={handleDelete}
          onViewReport={handleViewReport}
        />
      </div>

      {/* 右侧：侧边栏 */}
      <div className="w-[350px] flex flex-col gap-4">
        {/* Storage Stats */}
        <StorageCard stats={storageStats} />

        {/* Status Panel */}
        {showStatusPanel && selectedVersionId && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                解析状态
              </h3>
              <button
                onClick={() => setShowStatusPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <IngestStatusTracker
              statusInfo={null}
              loading={false}
            />
            {/* In a real implementation, you would use the useIngestStatus hook here */}
          </div>
        )}

        {/* Report Panel */}
        {showReportPanel && selectedVersionId && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                校验报告
              </h3>
              <button
                onClick={() => setShowReportPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <ValidationReportView report={null} />
            {/* In a real implementation, you would fetch the report here */}
          </div>
        )}

        {/* Notifications */}
        <NotificationList notifications={notifications} />
      </div>

      {/* Upload Modal */}
      <UploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId ?? 'global'}
        scope={effectiveScope}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}

export default GisDataManager;
