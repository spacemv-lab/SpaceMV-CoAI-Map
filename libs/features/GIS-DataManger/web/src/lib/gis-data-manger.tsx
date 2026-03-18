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
import { Dataset, StorageStats, IngestStatusInfo, ValidationReport } from './types';
import { useDatasetList } from './hooks/use-dataset-list';
import { Upload, RefreshCw, Info, FileText } from 'lucide-react';

/**
 * GisDataManager Main Component
 *
 * The main entry point for the GIS Data Manager feature.
 * Coordinates state between sub-components and handles data fetching.
 */
export function GisDataManager() {
  const [projectId, setProjectId] = useState('default-project-id'); // TODO: Get from context/auth
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
        const response = await fetch('/api/stats/storage');
        if (response.ok) {
          const stats = await response.json();
          setStorageStats(stats);
        }
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
      const response = await fetch(`/api/datasets/${dataset.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDatasets();
      } else {
        alert('删除数据集失败');
      }
    } catch (error) {
      console.error('Delete failed:', error);
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

  return (
    <div className="flex h-full w-full bg-background p-6 gap-6">
      {/* 左侧：主要内容区域 */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GIS 数据管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理您的地理空间数据集合，支持多种格式上传与解析
            </p>
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

        {/* Dataset Table */}
        <DatasetTable
          data={datasets}
          loading={loading}
          onView={handleViewDetails}
          onDelete={handleDelete}
          onCopy={(item) => console.log('复制', item)}
          onDownload={(item) => console.log('下载', item)}
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
        projectId={projectId}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
