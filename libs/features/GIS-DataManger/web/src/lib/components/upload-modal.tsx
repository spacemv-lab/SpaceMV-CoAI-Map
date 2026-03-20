/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../utils';

interface UploadModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Project ID to upload to
   */
  projectId: string;

  /**
   * Callback when upload is successful
   */
  onUploadSuccess: () => void;
}

const ALLOWED_EXTENSIONS = {
  'application/geo+json': ['.geojson', '.json'],
  'application/zip': ['.zip'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
};

const SUPPORTED_FORMATS = ['.geojson', '.json', '.zip', '.csv', '.xls', '.xlsx', '.kml', '.kmz'];

/**
 * UploadModal Component
 *
 * 处理文件选择（拖拽）和后端上传。
 * 显示进度条并处理错误。
 */
export function UploadModal({
  open,
  onOpenChange,
  projectId,
  onUploadSuccess,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [targetCRS, setTargetCRS] = useState('EPSG:4326');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  // Reset state when modal opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFile(null);
      setName('');
      setTags('');
      setDescription('');
      setTargetCRS('EPSG:4326');
      setUploading(false);
      setProgress(0);
      setError(null);
      setUploadStatus('idle');
      setVersionId(null);
    }
    onOpenChange(newOpen);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];

      // Validate extension
      const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
      if (!SUPPORTED_FORMATS.includes(ext)) {
        setError(`不支持的文件格式。支持：${SUPPORTED_FORMATS.join(', ')}`);
        return;
      }

      setFile(selectedFile);
      setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setError(null);
      setUploadStatus('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: ALLOWED_EXTENSIONS as any,
  });

  const handleUpload = async () => {
    if (!file || !projectId) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('name', name || file.name.replace(/\.[^/.]+$/, ''));
    formData.append('targetCRS', targetCRS);

    if (description) {
      formData.append('description', description);
    }

    if (tags) {
      tags.split(',').forEach((tag) => formData.append('tags', tag.trim()));
    }

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 50) {
            clearInterval(progressInterval);
            return 50;
          }
          return prev + 5;
        });
      }, 200);

      const response = await fetch('/api/datasets/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `上传失败：${response.statusText}`);
      }

      const result = await response.json();
      setVersionId(result.versionId);
      setProgress(60);
      setUploadStatus('processing');

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/datasets/versions/${result.versionId}/status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();

            // Update progress based on status
            const progressMap: Record<string, number> = {
              'PENDING': 60,
              'PARSING': 70,
              'VALIDATING': 80,
              'IMPORTING': 90,
              'INDEXING': 95,
              'SUCCESS': 100,
              'FAILED': 100,
            };
            setProgress(progressMap[statusData.status] || 60);

            if (statusData.status === 'SUCCESS') {
              clearInterval(pollInterval);
              setUploadStatus('success');
              setTimeout(() => {
                onUploadSuccess();
                handleOpenChange(false);
              }, 1000);
            } else if (statusData.status === 'FAILED') {
              clearInterval(pollInterval);
              setUploadStatus('error');
              setError(statusData.statusMessage || '处理失败');
              setUploading(false);
            }
          }
        } catch (err) {
          // Ignore polling errors, continue polling
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (uploadStatus === 'processing') {
          setProgress(100);
          setUploadStatus('success');
          setTimeout(() => {
            onUploadSuccess();
            handleOpenChange(false);
          }, 1000);
        }
      }, 120000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生未知错误');
      setUploading(false);
      setUploadStatus('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>上传 GIS 数据</DialogTitle>
          <DialogDescription>
            支持 GeoJSON、Shapefile (.zip)、KML、CSV、Excel 格式。最大 100MB。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Drop Zone */}
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-primary bg-primary/10'
                  : 'border-muted-foreground/25 hover:border-primary/50',
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? '释放文件以选择' : '拖拽文件到此处，或点击选择'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                支持格式：.geojson, .json, .zip, .kml, .kmz, .csv, .xls, .xlsx
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              {!uploading && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Dataset Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">数据集名称</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入数据集名称"
              disabled={uploading}
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">描述</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请输入描述信息"
              disabled={uploading}
            />
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tags">标签 (逗号分隔)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：成都，交通，2024"
              disabled={uploading}
            />
          </div>

          {/* CRS Selection */}
          <div className="grid gap-2">
            <Label htmlFor="crs">目标坐标系</Label>
            <select
              id="crs"
              value={targetCRS}
              onChange={(e) => setTargetCRS(e.target.value)}
              className="w-full border rounded-md px-3 py-2 disabled:opacity-50"
              disabled={uploading}
            >
              <option value="EPSG:4326">WGS 84 (EPSG:4326)</option>
              <option value="EPSG:3857">Web Mercator (EPSG:3857)</option>
              <option value="EPSG:4490">CGCS2000 (EPSG:4490)</option>
            </select>
          </div>

          {/* Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {uploadStatus === 'uploading' && (
                  <Upload className="h-4 w-4 text-blue-500 animate-pulse" />
                )}
                {uploadStatus === 'processing' && (
                  <CheckCircle className="h-4 w-4 text-green-500 animate-pulse" />
                )}
                {uploadStatus === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {uploadStatus === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground flex-1">
                  {uploadStatus === 'uploading' && '上传中...'}
                  {uploadStatus === 'processing' && '解析处理中...'}
                  {uploadStatus === 'success' && '处理完成'}
                  {uploadStatus === 'error' && '处理失败'}
                </span>
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={uploading}
          >
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? '处理中...' : '开始上传'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
