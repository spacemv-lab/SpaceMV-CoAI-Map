/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUserData } from '../../../auth';
import { SkipAuth } from './skip-auth.decorator';
import { CurrentUser } from '../../../auth/current-user.interface';
import { WhiteboardTemplateService } from './whiteboard-template.service';
import { CreateWhiteboardTemplateDto } from '../dto/whiteboard-template.dto';
import { success } from './api-response';

/**
 * 白板模板控制器
 *
 * 路由（base /whiteboard-templates，全局前缀 /api）。除缩略图外均需登录态（全局守卫默认保护）：
 * - GET    /              列出全部模板摘要
 * - GET    /:id           取单个完整内容（apply 时用）
 * - POST   /              创建模板（ownerId = user.userId）
 * - DELETE /:id           删除模板（service 内 owner 校验）
 * - GET    /:id/thumbnail 缩略图 JPEG（@SkipAuth，供卡片 <img src>）
 */
@Controller('whiteboard-templates')
export class WhiteboardTemplateController {
  constructor(private readonly service: WhiteboardTemplateService) {}

  @Get()
  async list() {
    return success(await this.service.list());
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return success(await this.service.getById(id));
  }

  @Post()
  async create(
    @Body() body: CreateWhiteboardTemplateDto,
    @CurrentUserData() user: CurrentUser,
  ) {
    return success(await this.service.create(user.userId, body));
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.service.delete(id, user.userId);
    return success({ ok: true });
  }

  /**
   * 公开取缩略图（@SkipAuth）—— 卡片库 <img src> 直接用。
   * content-type 按 dataURL 前缀动态判定（前端压缩后通常是 image/jpeg）。
   * 未设置缩略图返回 404。
   */
  @SkipAuth()
  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @Res() res: any): Promise<void> {
    const dataUrl = await this.service.getThumbnail(id);
    if (!dataUrl) {
      throw new NotFoundException('No thumbnail for this template');
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    const mime = match ? match[1] : 'image/jpeg';
    const base64 = match ? match[2] : dataUrl.slice(dataUrl.indexOf(',') + 1);
    const buffer = Buffer.from(base64, 'base64');
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  }
}
