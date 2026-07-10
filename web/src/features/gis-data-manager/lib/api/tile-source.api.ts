/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { httpClient, ApiResponse } from '@txwx-monorepo/api-client';

export interface TiandituCredential {
  token: string | null; // null = 用户未自配，地图走平台兜底
}

/** 影像瓦片源(kind='titiler-cog') */
export interface CogSource {
  id: string;
  name: string;
  kind: string;
  ingestStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | string;
  statusMessage?: string | null;
  config?: { layers?: Array<{ urlTemplate?: string }>; bounds?: [number, number, number, number] } | null;
  objectKey?: string | null;
  createdAt: string;
}

/**
 * 天地图 token 配置 API（凭据 AES-256-GCM 加密落库，仅 owner 可读写）。
 * 清除后地图回退到平台兜底 token。
 */
export const tileSourceApi = {
  /** 取当前用户的天地图 token（无则 null） */
  async getCredential(): Promise<TiandituCredential> {
    const res = await httpClient.get<ApiResponse<TiandituCredential>>(
      '/tile-sources/tianditu/credential',
    );
    return res.data.data ?? { token: null };
  },

  /** 设置/更新当前用户的天地图 token */
  async setCredential(token: string): Promise<void> {
    await httpClient.put('/tile-sources/tianditu/credential', { token });
  },

  /** 清除当前用户的天地图 token（回退平台兜底） */
  async clearCredential(): Promise<void> {
    await httpClient.delete('/tile-sources/tianditu/credential');
  },

  /** 列出当前用户的影像瓦片源(kind=titiler-cog,含转码状态) */
  async listCogSources(): Promise<CogSource[]> {
    const res = await httpClient.get<ApiResponse<CogSource[]>>(
      '/tile-sources/cog',
    );
    return res.data.data ?? [];
  },

  /** 上传 GeoTIFF → 异步转 COG(大文件给 10 分钟 timeout) */
  async uploadCog(
    file: File,
    name: string,
  ): Promise<{ id: string; ingestStatus: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name);
    const res = await httpClient.post<
      ApiResponse<{ id: string; ingestStatus: string }>
    >('/tile-sources/cog', form, {
      timeout: 600000,
      // httpClient 实例默认 Content-Type: application/json,浏览器会尊重该显式头、
      // 不为 FormData 自动改 multipart → multer 不解析、file 没到 → 400。
      // 显式设 multipart(同 dataset.api.upload 的做法)。
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data!;
  },

  /** 删除影像瓦片源(删 DB 行 + MinIO COG) */
  async deleteCogSource(id: string): Promise<void> {
    await httpClient.delete(`/tile-sources/cog/${id}`);
  },
};
