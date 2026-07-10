/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 影像数据板块（数据广场 · GLOBAL）：GeoTIFF 上传 → COG + 列表(状态/删除)。
 */
import { useState, useEffect, useRef } from 'react';
import { tileSourceApi, type CogSource } from '../api';
import { Button } from './ui/button';
import {
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export function ImagerySection() {
  const [cogSources, setCogSources] = useState<CogSource[]>([]);
  const [uploadingCog, setUploadingCog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCogSources = async () => {
    try {
      setCogSources(await tileSourceApi.listCogSources());
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    fetchCogSources();
  }, []);
  useEffect(() => {
    const pending = cogSources.some(
      (s) => s.ingestStatus === 'PENDING' || s.ingestStatus === 'PROCESSING',
    );
    if (!pending) return;
    const t = setInterval(fetchCogSources, 2500);
    return () => clearInterval(t);
  }, [cogSources]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadingCog(true);
    try {
      const name = file.name.replace(/\.[^.]+$/, '');
      await tileSourceApi.uploadCog(file, name);
      toast.success('上传成功，后端转码中');
      await fetchCogSources();
    } catch {
      toast.error('上传失败');
    } finally {
      setUploadingCog(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该影像源？关联的 COG 文件也会删除。')) return;
    setDeletingId(id);
    try {
      await tileSourceApi.deleteCogSource(id);
      toast.success('已删除');
      await fetchCogSources();
    } catch {
      toast.error('删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-1 text-gray-700">影像数据</h2>
      <p className="text-xs text-gray-400 mb-3">
        GeoTIFF 影像上传，自动转 COG 后叠加到地图
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            影像瓦片源
          </span>
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCog}
          >
            {uploadingCog ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            上传影像
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tif,.tiff"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {cogSources.length === 0 ? (
          <p className="text-xs text-gray-400">
            暂无影像源。上传 .tif/.tiff，后端转 COG 后即可在地图加载。
          </p>
        ) : (
          <div className="space-y-1.5">
            {cogSources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 p-2 border rounded text-sm"
              >
                <span className="truncate flex-1" title={s.name}>
                  {s.name}
                </span>
                {s.ingestStatus === 'READY' ? (
                  <span className="flex items-center gap-1 text-green-600 text-xs whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    就绪
                  </span>
                ) : s.ingestStatus === 'FAILED' ? (
                  <span
                    className="flex items-center gap-1 text-red-600 text-xs whitespace-nowrap"
                    title={s.statusMessage ?? ''}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    失败
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-xs whitespace-nowrap">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    转码中
                  </span>
                )}
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deletingId === s.id}
                  className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="删除"
                >
                  {deletingId === s.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-400">
          在地图「添加图层 → 底图/瓦片」加载就绪（READY）的影像到地图。
        </p>
      </div>
    </div>
  );
}
