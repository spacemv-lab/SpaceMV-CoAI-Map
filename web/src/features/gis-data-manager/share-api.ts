/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 项目公开分享 - 管理端 API 客户端
 * 仅项目所有者可用（后端按 ownerId 校验）。
 */
import { httpClient, type ApiResponse } from '@txwx-monorepo/api-client';

export interface Share {
  id: string;
  token: string;
  url: string; // `${PUBLIC_WEB_BASE_URL}/share/${token}`
  projectId: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
  viewCount: number;
}

export async function listShares(projectId: string): Promise<Share[]> {
  const res = await httpClient.get<ApiResponse<Share[]>>(
    `/projects/${projectId}/shares`,
  );
  return res.data.data ?? [];
}

export async function createShare(
  projectId: string,
  payload: { label?: string; expiresAt?: string } = {},
): Promise<Share> {
  const res = await httpClient.post<ApiResponse<Share>>(
    `/projects/${projectId}/shares`,
    payload,
  );
  return res.data.data!;
}

export async function revokeShare(shareId: string): Promise<Share> {
  const res = await httpClient.delete<ApiResponse<Share>>(`/shares/${shareId}`);
  return res.data.data!;
}
