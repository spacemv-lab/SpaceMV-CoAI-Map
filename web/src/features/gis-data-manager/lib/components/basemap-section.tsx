/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 底图板块（数据广场 · GLOBAL）：天地图 token 配置 + 高德占位。
 */
import { useState, useEffect } from 'react';
import { tileSourceApi } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Globe, CheckCircle2, AlertCircle, Loader2, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';

/** 用 Image 对象探活一张瓦片（绕开 CORS） */
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

export function BasemapSection() {
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

  const configured = !!stored;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-1 text-gray-700">底图</h2>
      <p className="text-xs text-gray-400 mb-3">配置地图底图服务的访问令牌（天地图、高德等）</p>

      {/* 天地图 Token */}
      <div className="p-4 border rounded-lg bg-white mb-3">
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
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="粘贴天地图 token"
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
            <a
              href="https://cloudcenter.tianditu.gov.cn/center/development/myApp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              点此申请
            </a>{' '}
            天地图 token。加密存储，仅你本人可读。
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

      {/* 高德地图（即将支持） */}
      <div className="p-4 border rounded-lg bg-gray-50 opacity-60">
        <div className="flex items-center gap-2 text-sm">
          <MapIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-500">高德地图底图</span>
          <span className="ml-auto text-xs text-gray-400">即将支持</span>
        </div>
      </div>
    </div>
  );
}
