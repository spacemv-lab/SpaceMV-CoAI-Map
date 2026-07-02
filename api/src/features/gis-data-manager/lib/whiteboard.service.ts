/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatasetService } from './dataset.service';
import { WhiteboardDocDto } from '../dto/whiteboard.dto';

/**
 * 项目白板服务 —— 一站式配图（tldraw 画布文档）
 *
 * 一个项目一份 tldraw 文档（projectId 唯一），document 存 editor.getSnapshot()。
 * 通过注入 DatasetService（其本身就是 PrismaClient）访问 whiteboardDoc / project 委托。
 * 仅项目所有者可读写；公开匿名访问不在本期范围。
 */
@Injectable()
export class WhiteboardService {
  constructor(private readonly datasetService: DatasetService) {}

  private get doc() {
    return this.datasetService.whiteboardDoc;
  }

  /** 校验当前用户是项目所有者；项目不存在 404，非所有者 403 */
  async assertOwnership(projectId: string, userId: string): Promise<void> {
    const project = await this.datasetService.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Not the project owner');
    }
  }

  /** 读取白板文档；无记录返回空板（document: null） */
  async getDoc(projectId: string): Promise<WhiteboardDocDto> {
    const doc = await this.doc.findUnique({ where: { projectId } });
    if (!doc) {
      return { projectId, document: null, updatedAt: null };
    }
    return { projectId, document: doc.document, updatedAt: doc.updatedAt };
  }

  /** 保存（upsert）白板文档 */
  async upsertDoc(projectId: string, document: unknown): Promise<WhiteboardDocDto> {
    const project = await this.datasetService.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const saved = await this.doc.upsert({
      where: { projectId },
      create: {
        projectId,
        document: document as unknown as Prisma.InputJsonValue,
      },
      update: {
        document: document as unknown as Prisma.InputJsonValue,
      },
    });
    return { projectId, document: saved.document, updatedAt: saved.updatedAt };
  }

  /**
   * 发布预览图：把前端导出的当前页 PNG dataURL 存到 previewDataUrl 列。
   * 供 GET .../whiteboard/image 公开取用。doc 行须已存在（先保存过白板）。
   */
  async publishPreview(projectId: string, dataUrl: string): Promise<{ updatedAt: Date }> {
    const existing = await this.doc.findUnique({ where: { projectId } });
    if (!existing) {
      throw new NotFoundException(`Whiteboard for project ${projectId} not found`);
    }
    const updated = await this.doc.update({
      where: { projectId },
      data: { previewDataUrl: dataUrl },
    });
    return { updatedAt: updated.updatedAt };
  }

  /** 取已发布的预览图 dataURL；未发布返回 null */
  async getPreview(projectId: string): Promise<string | null> {
    const doc = await this.doc.findUnique({
      where: { projectId },
      select: { previewDataUrl: true },
    });
    return doc?.previewDataUrl ?? null;
  }

  /** 是否已发布预览图（供前端面板显示「已发布/未发布」状态） */
  async getPreviewStatus(projectId: string): Promise<{ hasPreview: boolean }> {
    const doc = await this.doc.findUnique({
      where: { projectId },
      select: { previewDataUrl: true },
    });
    return { hasPreview: !!doc?.previewDataUrl };
  }
}
