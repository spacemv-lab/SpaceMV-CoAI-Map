/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Controller, Get, Param, Header } from '@nestjs/common';
import { SkipAuth } from './skip-auth.decorator';
import { ProjectShareService } from './project-share.service';
import { success } from './api-response';

/**
 * 公开分享控制器 —— 匿名、token 网关
 *
 * `@SkipAuth()` 在类级别：本控制器所有方法均无需认证，
 * 仅凭 token 解析返回单个项目的只读视图（见 ProjectShareService.resolvePublicShare）。
 * 不会打开任何其它 IAM 保护端点。
 */
@Controller('public/share')
@SkipAuth()
export class PublicShareController {
  constructor(private readonly shareService: ProjectShareService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  async getPublicShare(@Param('token') token: string) {
    return success(await this.shareService.resolvePublicShare(token));
  }
}
