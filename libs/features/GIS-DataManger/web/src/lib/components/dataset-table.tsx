/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import {
  Eye,
  Copy,
  Download,
  Trash2,
  FileType,
  MapPin,
  Activity,
  FileText,
} from 'lucide-react';
import { Dataset } from '../types';
import { cn } from '../utils';

interface DatasetTableProps {
  /**
   * List of datasets to display
   */
  data: Dataset[];

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Callback for viewing details
   */
  onView: (dataset: Dataset) => void;

  /**
   * Callback for deleting dataset
   */
  onDelete: (dataset: Dataset) => void;

  /**
   * Callback for copying dataset
   */
  onCopy?: (dataset: Dataset) => void;

  /**
   * Callback for downloading dataset
   */
  onDownload?: (dataset: Dataset) => void;

  /**
   * Callback for viewing validation report
   */
  onViewReport?: (dataset: Dataset) => void;
}

/**
 * DatasetTable Component
 *
 * 显示 GIS 数据集列表，包含元数据和操作。
 * 支持加载状态和空状态。
 */
export function DatasetTable({
  data,
  loading,
  onView,
  onDelete,
  onCopy,
  onDownload,
  onViewReport,
}: DatasetTableProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getGeometryIcon = (type: string) => {
    switch (type) {
      case 'POINT':
      case 'MULTI_POINT':
        return <MapPin className="h-4 w-4 text-blue-500" />;
      case 'LINESTRING':
      case 'MULTI_LINESTRING':
        return <Activity className="h-4 w-4 text-green-500" />;
      case 'POLYGON':
      case 'MULTI_POLYGON':
        return <FileType className="h-4 w-4 text-orange-500" />;
      default:
        return <FileType className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-muted-foreground">
        数据加载中...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-muted-foreground border rounded-md bg-muted/10">
        <FileType className="h-12 w-12 mb-4 opacity-50" />
        <p>未找到数据集</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">序号</TableHead>
            <TableHead>文件名称</TableHead>
            <TableHead>几何类型</TableHead>
            <TableHead>记录数</TableHead>
            <TableHead>大小</TableHead>
            <TableHead>来源</TableHead>
            <TableHead>上传时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => {
            const currentVersion = item.versions?.[0];

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getGeometryIcon(item.type)}
                    <span className="capitalize text-xs">
                      {item.type.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{currentVersion?.recordCount || '-'}</TableCell>
                <TableCell>
                  {currentVersion
                    ? formatFileSize(currentVersion.fileSize)
                    : '-'}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      item.source === 'UPLOAD'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {item.source}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView(item)}
                      title="详情"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onViewReport && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewReport(item)}
                        title="校验报告"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {onCopy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onCopy(item)}
                        title="复制"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {onDownload && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDownload(item)}
                        title="下载"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onDelete(item)}
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
