/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';
import type { TemplateSnapshot } from '../utils/template-snapshot';

/** 列表轻量项（不含 content，省带宽；前端按 hasThumbnail 决定 <img>/占位） */
export interface TemplateSummary {
  id: string;
  name: string;
  ownerId: string;
  hasThumbnail: boolean;
  createdAt: string; // ISO
}

/** 完整模板（apply 时取 content） */
export interface TemplateFull {
  id: string;
  name: string;
  ownerId: string;
  content: TemplateSnapshot;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 白板模板 API（base /whiteboard-templates，全局前缀 /api）。
 *
 * - GET    /              列出全部摘要
 * - GET    /:id           取完整内容（apply 用）
 * - POST   /              创建
 * - DELETE /:id           删除（owner only，后端校验）
 * - GET    /:id/thumbnail 缩略图（@SkipAuth，<img src> 直接用，不经 httpClient）
 */
export const templateApi = {
  async list(): Promise<TemplateSummary[]> {
    const res = await httpClient.get<ApiResponse<TemplateSummary[]>>(
      '/whiteboard-templates',
    );
    return res.data.data ?? [];
  },

  async getById(id: string): Promise<TemplateFull> {
    const res = await httpClient.get<ApiResponse<TemplateFull>>(
      `/whiteboard-templates/${id}`,
    );
    if (!res.data.data) throw new Error('模板读取失败');
    return res.data.data;
  },

  async create(payload: {
    name: string;
    content: TemplateSnapshot;
    thumbnailUrl?: string;
  }): Promise<TemplateFull> {
    const res = await httpClient.post<ApiResponse<TemplateFull>>(
      '/whiteboard-templates',
      payload,
    );
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await httpClient.delete(`/whiteboard-templates/${id}`);
  },

  /** 缩略图公开 URL（@SkipAuth，供卡片 <img src>；镜像 preview-panel 的 imageUrl 构造） */
  thumbnailUrl(id: string): string {
    return `${window.location.origin}/api/whiteboard-templates/${id}/thumbnail`;
  },
};

export default templateApi;
