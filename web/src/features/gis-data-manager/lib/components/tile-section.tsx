/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 瓦片板块（数据广场 · GLOBAL）：
 *  - 天地图 token 配置（Phase 1）
 *  - 影像瓦片源（GeoTIFF 上传 → 后端转 COG；Phase 2）
 */
import { useState, useEffect, useRef } from 'react';
import { tileSourceApi, type CogSource } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';

/** 用 Image 对象探活一张瓦片（绕开 CORS——与地图实际加载方式一致） */
function probeTile(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src =
      `https://t4.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0` +
      `&LAYER=vec&tileMatrixSet=w&TileMatrix=4&TileRow=6&TileCol=6&style=default&format=tiles` +
      `&tk=${encodeURIComponent(token)}`;
    setTimeout(() => resolve(false), 8000);
  });
}

export function TileSection() {
  // --- 天地图 token ---
  const [stored, setStored] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    tileSourceApi
      .getCredential()
      .then((c) => {
        setStored(c.token);
        setInput(c.token ?? '');
      })
      .catch(() => {
        setStored(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    const t = input.trim();
    if (!t) {
      toast.error('请先填写 token');
      return;
    }
    setTesting(true);
    try {
      const ok = await probeTile(t);
      toast[ok ? 'success' : 'error'](
        ok ? 'token 有效，瓦片可正常访问' : 'token 验证失败（瓦片不可访问）',
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const t = input.trim();
    if (!t) {
      toast.error('请先填写 token');
      return;
    }
    setSaving(true);
    try {
      await tileSourceApi.setCredential(t);
      setStored(t);
      toast.success('已保存。新开地图 / 切换底图后生效');
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('清除自配 token，回退到平台兜底？')) return;
    setSaving(true);
    try {
      await tileSourceApi.clearCredential();
      setStored(null);
      setInput('');
      toast.success('已清除。地图将使用平台兜底 token');
    } catch {
      toast.error('清除失败');
    } finally {
      setSaving(false);
    }
  };

  // --- 影像瓦片源（GeoTIFF → COG） ---
  const [cogSources, setCogSources] = useState<CogSource[]>([]);
  const [uploadingCog, setUploadingCog] = useState(false);
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
  // 有转码中的源就轮询直到 READY/FAILED
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
    e.target.value = ''; // 允许同名文件再次触发
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

  const configured = !!stored;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 text-gray-700">瓦片</h2>

      {/* 天地图 Token */}
      <div className="p-4 border rounded-lg bg-white">
        <div className="flex items-center gap-2 mb-3 text-sm">
          <Globe className="w-4 h-4 text-blue-500" />
          <span className="font-medium">天地图 Token</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
          ) : configured ? (
            <span className="ml-auto flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-4 h-4" /> 已配置（你的 token）
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-4 h-4" /> 未配置（使用平台兜底）
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴天地图 token（lbs.tianditu.gov.cn 申请）"
            className="flex-1"
          />
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : '测试'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
          </Button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            申请：https://lbs.tianditu.gov.cn/ 。token 加密存储，仅你本人可读。
          </p>
          {configured && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-red-500"
            >
              清除（回退平台兜底）
            </button>
          )}
        </div>
      </div>

      {/* 影像瓦片源（GeoTIFF → COG） */}
      <div className="mt-4 p-4 border rounded-lg bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            影像瓦片源（GeoTIFF → COG）
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
