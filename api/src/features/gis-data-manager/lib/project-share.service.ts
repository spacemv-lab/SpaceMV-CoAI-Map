/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectShare } from '@prisma/client';
import { DatasetService } from './dataset.service';
import { generateShareToken } from '../utils/share-token.util';
import {
  CreateShareDto,
  ShareDto,
  PublicShareViewDto,
} from '../dto/project-share.dto';

/**
 * 项目公开分享服务
 *
 * - 所有者侧：创建 / 列举 / 撤销分享链接（校验项目所有权）
 * - 公开侧：匿名 token 解析 → 返回只读实时视图并自增 viewCount
 *
 * 通过注入 DatasetService（其本身就是 PrismaClient）访问 projectShare /
 * project 委托，并复用 getProjectState，使公开视图与编辑器视图永不漂移。
 */
@Injectable()
export class ProjectShareService {
  constructor(
    private readonly datasetService: DatasetService,
    private readonly config: ConfigService,
  ) {}

  private get share() {
    return this.datasetService.projectShare;
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

  async createShare(projectId: string, dto: CreateShareDto): Promise<ShareDto> {
    const token = generateShareToken();
    const created = await this.share.create({
      data: {
        token,
        projectId,
        label: dto.label,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return this.toDto(created);
  }

  async listShares(projectId: string): Promise<ShareDto[]> {
    const shares = await this.share.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return shares.map((s) => this.toDto(s));
  }

  async revokeShare(shareId: string, userId: string): Promise<ShareDto> {
    const share = await this.share.findUnique({
      where: { id: shareId },
      include: { project: { select: { ownerId: true } } },
    });
    if (!share) {
      throw new NotFoundException(`Share ${shareId} not found`);
    }
    if (share.project.ownerId !== userId) {
      throw new ForbiddenException('Not the project owner');
    }
    const revoked = await this.share.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
    return this.toDto(revoked);
  }

  /**
   * 公开、匿名解析：token → 返回该项目只读实时视图，并自增 viewCount。
   * 未知 / 已撤销 / 已过期 / 项目已删除 统一抛 404，不泄露任何存在性信息。
   */
  async resolvePublicShare(token: string): Promise<PublicShareViewDto> {
    const share = await this.share.findUnique({
      where: { token },
      include: { project: { select: { id: true, name: true } } },
    });

    const now = new Date();
    const invalid =
      !share ||
      share.revokedAt !== null ||
      (share.expiresAt !== null && share.expiresAt < now) ||
      !share.project;

    if (invalid) {
      throw new NotFoundException();
    }

    const state = await this.datasetService.getProjectState(share.projectId);

    // 原子自增浏览次数（v1：每次成功加载 +1，非唯一访客）
    await this.share.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    return {
      project: { id: share.project.id, name: share.project.name },
      state: {
        viewport: state.viewport,
        basemap: state.basemap,
        layers: state.layers,
        updatedAt: state.updatedAt,
      },
    };
  }

  private getPublicBaseUrl(): string {
    return (this.config.get<string>('PUBLIC_WEB_BASE_URL') || '').replace(
      /\/+$/,
      '',
    );
  }

  private toDto(share: ProjectShare): ShareDto {
    return {
      id: share.id,
      token: share.token,
      url: `${this.getPublicBaseUrl()}/share/${share.token}`,
      projectId: share.projectId,
      label: share.label,
      createdAt: share.createdAt,
      revokedAt: share.revokedAt,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
    };
  }
}
