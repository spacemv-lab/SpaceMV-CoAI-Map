/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { CurrentUserData } from '../../../auth';
import { CurrentUser } from '../../../auth/current-user.interface';
import { ProjectShareService } from './project-share.service';
import { CreateShareDto } from '../dto/project-share.dto';
import { success } from './api-response';

/**
 * 项目分享管理控制器 —— 仅项目所有者可用（走全局 IAM Guard）
 *
 * 路由：
 * - POST   /api/projects/:id/shares  创建分享链接
 * - GET    /api/projects/:id/shares  列举分享链接
 * - DELETE /api/shares/:shareId      撤销分享链接（置 revokedAt）
 */
@Controller()
export class ProjectShareController {
  constructor(private readonly shareService: ProjectShareService) {}

  @Post('projects/:id/shares')
  async createShare(
    @Param('id') id: string,
    @Body() body: CreateShareDto,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.shareService.assertOwnership(id, user.userId);
    return success(await this.shareService.createShare(id, body));
  }

  /**
   * 幂等获取项目的嵌入 token（供外部平台嵌入地图）：
   * 有活跃 embed token 则返回，否则自动生成。一个项目一个稳定 token。
   */
  @Post('projects/:id/embed-token')
  async getOrCreateEmbedToken(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.shareService.assertOwnership(id, user.userId);
    return success(await this.shareService.getOrCreateEmbedToken(id));
  }

  @Get('projects/:id/shares')
  async listShares(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.shareService.assertOwnership(id, user.userId);
    return success(await this.shareService.listShares(id));
  }

  @Delete('shares/:shareId')
  async revokeShare(
    @Param('shareId') shareId: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    return success(await this.shareService.revokeShare(shareId, user.userId));
  }
}
