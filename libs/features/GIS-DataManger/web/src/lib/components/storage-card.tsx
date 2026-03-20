/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card';
import { StorageStats } from '../types';

interface StorageCardProps {
  /**
   * Storage statistics
   */
  stats: StorageStats;
}

/**
 * StorageCard Component
 *
 * 显示存储使用情况，带有圆形进度指示器。
 */
export function StorageCard({ stats }: StorageCardProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">存储空间</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-center h-24 w-24 rounded-full border-4 border-primary/20 relative mx-auto">
              <span className="text-xl font-bold">
                {stats.usagePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">总计:</span>
              <span className="font-medium">
                {formatSize(stats.totalSpace)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">已用:</span>
              <span className="font-medium">{formatSize(stats.usedSpace)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
