/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { IsObject, IsString } from 'class-validator';

/** 保存白板文档：tldraw editor.getSnapshot() 的可序列化对象（含 schema/store/assets） */
export class UpdateWhiteboardDto {
  @IsObject()
  document: Record<string, unknown>;
}

/** 发布预览图：前端导出的当前页 PNG dataURL（data:image/png;base64,...） */
export class PublishPreviewDto {
  @IsString()
  dataUrl: string;
}

/** 对外返回的白板文档视图。document 为 null 表示尚未保存过的空板 */
export interface WhiteboardDocDto {
  projectId: string;
  document: unknown | null;
  updatedAt: Date | null;
}
