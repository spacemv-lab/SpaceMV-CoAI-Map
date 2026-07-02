/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';

/** 后端白板文档视图（document 为 null 表示尚未保存过的空板） */
export interface WhiteboardDocResponse {
  projectId: string;
  document: unknown | null;
  updatedAt: string | null;
}

/**
 * 白板 API —— 一站式配图（tldraw 画布文档）
 *
 * - GET  /projects/:id/whiteboard  读取（无则空板）
 * - PUT  /projects/:id/whiteboard  保存（upsert，body = { document: getSnapshot() }）
 */
export const whiteboardApi = {
  async get(projectId: string): Promise<WhiteboardDocResponse> {
    const response = await httpClient.get<ApiResponse<WhiteboardDocResponse>>(
      `/projects/${projectId}/whiteboard`
    );
    if (!response.data.data) {
      throw new Error('白板文档读取失败');
    }
    return response.data.data;
  },

  async save(projectId: string, document: unknown): Promise<WhiteboardDocResponse> {
    const response = await httpClient.put<ApiResponse<WhiteboardDocResponse>>(
      `/projects/${projectId}/whiteboard`,
      { document }
    );
    return response.data.data;
  },

  /** 发布当前页为预览图（dataURL），供 GET .../whiteboard/image 公开取用 */
  async publishPreview(projectId: string, dataUrl: string): Promise<void> {
    await httpClient.put(`/projects/${projectId}/whiteboard/preview`, { dataUrl });
  },

  /** 查询是否已发布预览图（供预览面板显示状态） */
  async getPreviewStatus(projectId: string): Promise<{ hasPreview: boolean }> {
    const response = await httpClient.get<ApiResponse<{ hasPreview: boolean }>>(
      `/projects/${projectId}/whiteboard/preview-status`
    );
    return response.data.data ?? { hasPreview: false };
  },
};

export default whiteboardApi;
