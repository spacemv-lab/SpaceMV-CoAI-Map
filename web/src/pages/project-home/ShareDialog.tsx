/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Share2, X, Plus, Copy, Trash2, Loader2, Eye, AlertTriangle } from 'lucide-react';
import {
  listShares,
  createShare,
  revokeShare,
  type Share,
} from '@/features/gis-data-manager/share-api';

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ projectId, projectName, open, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  // 打开时加载分享列表
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const list = await listShares(projectId);
        if (!cancelled) setShares(list);
      } catch {
        if (!cancelled) toast.error('加载分享列表失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  if (!open) return null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await createShare(projectId, { label: label.trim() || undefined });
      setShares((prev) => [created, ...prev]);
      setLabel('');
      toast.success('已创建分享链接');
    } catch {
      toast.error('创建分享失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('链接已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!window.confirm('确认撤销该分享链接？撤销后已嵌入的地图将立即不可用。')) return;
    setRevokingId(shareId);
    try {
      await revokeShare(shareId);
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      toast.success('已撤销分享');
    } catch {
      toast.error('撤销失败');
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[90vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">分享项目 · {projectName}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-auto">
          {/* 安全提示 */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>任何人拥有链接即可查看此项目的地图（只读），请勿分享敏感数据。</span>
          </div>

          {/* 创建新分享 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="备注（可选，如：wendao 文章）"
              className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 text-sm shrink-0"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              创建分享
            </button>
          </div>

          {/* 分享列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">暂无分享链接，点击「创建分享」生成。</div>
          ) : (
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={share.url}
                      className="flex-1 px-2 py-1.5 bg-gray-50 border rounded text-xs text-gray-600 font-mono"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={() => handleCopy(share.url)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                      title="复制链接"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRevoke(share.id)}
                      disabled={revokingId === share.id}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-50"
                      title="撤销分享"
                    >
                      {revokingId === share.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      浏览 {share.viewCount} 次
                    </span>
                    <span>创建于 {formatDate(share.createdAt)}</span>
                    {share.label && <span className="truncate">· {share.label}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
