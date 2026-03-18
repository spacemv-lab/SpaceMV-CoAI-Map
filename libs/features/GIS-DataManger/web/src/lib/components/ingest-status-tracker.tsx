/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';
import { Progress } from './ui/progress';
import { CheckCircle, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { IngestStatus, IngestStatusInfo } from '../types';

interface IngestStatusTrackerProps {
  statusInfo: IngestStatusInfo | null;
  loading?: boolean;
}

const statusLabels: Record<IngestStatus, string> = {
  PENDING: '等待处理',
  PARSING: '解析中',
  VALIDATING: '校验中',
  IMPORTING: '导入中',
  INDEXING: '构建索引',
  SUCCESS: '已完成',
  FAILED: '失败',
};

const statusIcons: Record<IngestStatus, React.ReactNode> = {
  PENDING: <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />,
  PARSING: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
  VALIDATING: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
  IMPORTING: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
  INDEXING: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
  SUCCESS: <CheckCircle className="h-5 w-5 text-green-500" />,
  FAILED: <XCircle className="h-5 w-5 text-red-500" />,
};

const statusColors: Record<IngestStatus, string> = {
  PENDING: 'bg-gray-500',
  PARSING: 'bg-blue-500',
  VALIDATING: 'bg-blue-500',
  IMPORTING: 'bg-blue-500',
  INDEXING: 'bg-blue-500',
  SUCCESS: 'bg-green-500',
  FAILED: 'bg-red-500',
};

export function IngestStatusTracker({ statusInfo, loading }: IngestStatusTrackerProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">加载状态...</span>
      </div>
    );
  }

  if (!statusInfo) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>暂无状态信息</p>
      </div>
    );
  }

  const { status, progress = 0, statusMessage, startedAt, completedAt } = statusInfo;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center gap-3">
        {statusIcons[status]}
        <div>
          <h3 className="font-medium">{statusLabels[status]}</h3>
          {statusMessage && (
            <p className="text-sm text-gray-500">{statusMessage}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {status !== 'PENDING' && status !== 'FAILED' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">进度</span>
            <span className="text-gray-700">{progress}%</span>
          </div>
          <Progress value={progress} className={`h-2 ${statusColors[status]}`} />
        </div>
      )}

      {/* Timestamps */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {startedAt && (
          <div>
            <span className="text-gray-500">开始时间</span>
            <p className="text-gray-700">
              {new Date(startedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        )}
        {completedAt && (
          <div>
            <span className="text-gray-500">完成时间</span>
            <p className="text-gray-700">
              {new Date(completedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        )}
      </div>

      {/* Details */}
      {statusInfo.details && (
        <div className="bg-gray-50 rounded p-3 space-y-1 text-sm">
          {statusInfo.details.parsedCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-500">解析要素</span>
              <span className="text-gray-700">{statusInfo.details.parsedCount}</span>
            </div>
          )}
          {statusInfo.details.validCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-500">有效要素</span>
              <span className="text-gray-700">{statusInfo.details.validCount}</span>
            </div>
          )}
          {statusInfo.details.errorCount !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-500">错误数</span>
              <span className="text-gray-700">{statusInfo.details.errorCount}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
