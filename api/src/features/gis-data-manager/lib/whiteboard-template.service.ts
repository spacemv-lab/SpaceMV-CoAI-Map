/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, WhiteboardTemplate } from '@prisma/client';
import { DatasetService } from './dataset.service';
import {
  CreateWhiteboardTemplateDto,
  WhiteboardTemplateDto,
  WhiteboardTemplateSummaryDto,
} from '../dto/whiteboard-template.dto';

/**
 * 白板模板服务 —— 保存的画板快照（shapes + assets）+ 名称 + 缩略图。
 *
 * 模板跨项目共享：所有登录用户可读，仅 owner 可删。通过注入 DatasetService
 * （本身就是 PrismaClient）访问 whiteboardTemplate 委托。content 自包含
 * （image dataURL 在 asset.props.src 里），无外部存储依赖。
 */
@Injectable()
export class WhiteboardTemplateService {
  constructor(private readonly datasetService: DatasetService) {}

  private get tpl() {
    return this.datasetService.whiteboardTemplate;
  }

  /** 列出全部模板摘要（按创建时间倒序） */
  async list(): Promise<WhiteboardTemplateSummaryDto[]> {
    const rows = await this.tpl.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        ownerId: true,
        thumbnailUrl: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      ownerId: r.ownerId,
      hasThumbnail: !!r.thumbnailUrl,
      createdAt: r.createdAt,
    }));
  }

  /** 取单个模板完整内容（apply 时用） */
  async getById(id: string): Promise<WhiteboardTemplateDto> {
    const row = await this.tpl.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    return this.toDto(row);
  }

  /** 创建（ownerId 来自登录态） */
  async create(
    ownerId: string,
    dto: CreateWhiteboardTemplateDto,
  ): Promise<WhiteboardTemplateDto> {
    const row = await this.tpl.create({
      data: {
        name: dto.name,
        ownerId,
        content: dto.content as unknown as Prisma.InputJsonValue,
        thumbnailUrl: dto.thumbnailUrl ?? null,
      },
    });
    return this.toDto(row);
  }

  /** 删除（仅 owner）；不存在 404，非 owner 403 */
  async delete(id: string, userId: string): Promise<void> {
    const row = await this.tpl.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!row) {
      throw new NotFoundException(`Template ${id} not found`);
    }
    if (row.ownerId !== userId) {
      throw new ForbiddenException('Not the template owner');
    }
    await this.tpl.delete({ where: { id } });
  }

  /** 取缩略图 dataURL（供 @SkipAuth 图片端点；未设置返回 null） */
  async getThumbnail(id: string): Promise<string | null> {
    const row = await this.tpl.findUnique({
      where: { id },
      select: { thumbnailUrl: true },
    });
    return row?.thumbnailUrl ?? null;
  }

  private toDto(row: WhiteboardTemplate): WhiteboardTemplateDto {
    return {
      id: row.id,
      name: row.name,
      ownerId: row.ownerId,
      content: row.content,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
