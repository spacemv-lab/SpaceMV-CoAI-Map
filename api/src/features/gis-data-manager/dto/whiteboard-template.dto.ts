/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 白板模板 DTO
 *
 * content = 前端 captureTemplateSnapshot(editor) 的产物（页级 { assets, shapes }），
 * image 的 dataURL 在 asset.props.src 里 → 自包含 JSON。thumbnailUrl 为 JPEG dataURL。
 */
export class CreateWhiteboardTemplateDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsObject()
  content: { assets: unknown[]; shapes: unknown[] };

  @IsOptional()
  @IsString()
  thumbnailUrl?: string; // data:image/jpeg;base64,...
}

/** 完整视图（详情/创建返回；前端 apply 时取 content） */
export interface WhiteboardTemplateDto {
  id: string;
  name: string;
  ownerId: string;
  content: unknown; // { assets, shapes }
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 列表轻量项（不含 content 省带宽；前端按 hasThumbnail 决定 <img>/占位图标） */
export interface WhiteboardTemplateSummaryDto {
  id: string;
  name: string;
  ownerId: string;
  hasThumbnail: boolean;
  createdAt: Date;
}
