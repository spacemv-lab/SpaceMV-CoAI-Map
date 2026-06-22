/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsOptional, IsString, IsDateString } from 'class-validator';

/** 创建公开分享链接 */
export class CreateShareDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string; // ISO 8601，可选过期时间
}

/** 对外返回的分享信息（含拼接好的绝对公开 URL） */
export interface ShareDto {
  id: string;
  token: string;
  url: string; // `${PUBLIC_WEB_BASE_URL}/share/${token}`
  projectId: string;
  label: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  expiresAt: Date | null;
  viewCount: number;
}

/** 公开端点返回的只读视图：项目身份 + 当前实时 ProjectState */
export interface PublicShareViewDto {
  project: { id: string; name: string };
  state: {
    viewport: unknown;
    basemap: string;
    layers: unknown[];
    updatedAt: Date | null;
  };
}
