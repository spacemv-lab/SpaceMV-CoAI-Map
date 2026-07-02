/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUserData } from '../../../auth';
import { SkipAuth } from './skip-auth.decorator';
import { CurrentUser } from '../../../auth/current-user.interface';
import { WhiteboardService } from './whiteboard.service';
import {
  UpdateWhiteboardDto,
  PublishPreviewDto,
} from '../dto/whiteboard.dto';
import { success } from './api-response';

/**
 * 项目白板控制器
 *
 * 路由：
 * - GET  /api/projects/:id/whiteboard         读取白板文档（owner）
 * - PUT  /api/projects/:id/whiteboard         保存白板文档（owner）
 * - PUT  /api/projects/:id/whiteboard/preview 发布预览图（owner）
 * - GET  /api/projects/:id/whiteboard/image   取预览图 PNG（公开，供其他服务 <img>）
 */
@Controller()
export class WhiteboardController {
  constructor(private readonly whiteboardService: WhiteboardService) {}

  @Get('projects/:id/whiteboard')
  async getDoc(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.whiteboardService.assertOwnership(id, user.userId);
    return success(await this.whiteboardService.getDoc(id));
  }

  @Put('projects/:id/whiteboard')
  async putDoc(
    @Param('id') id: string,
    @Body() body: UpdateWhiteboardDto,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.whiteboardService.assertOwnership(id, user.userId);
    return success(await this.whiteboardService.upsertDoc(id, body.document));
  }

  /** 查询是否已发布预览图（owner）—— 供前端预览面板显示状态 */
  @Get('projects/:id/whiteboard/preview-status')
  async getPreviewStatus(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.whiteboardService.assertOwnership(id, user.userId);
    return success(await this.whiteboardService.getPreviewStatus(id));
  }

  /** 发布当前页为预览图（owner） */
  @Put('projects/:id/whiteboard/preview')
  async publishPreview(
    @Param('id') id: string,
    @Body() body: PublishPreviewDto,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.whiteboardService.assertOwnership(id, user.userId);
    return success(await this.whiteboardService.publishPreview(id, body.dataUrl));
  }

  /**
   * 公开取预览图（@SkipAuth）。其他服务可直接 <img src> 引用。
   * content-type 按 dataURL 前缀动态判定（前端压缩后通常是 image/jpeg）。
   * 未发布过返回 404。
   */
  @SkipAuth()
  @Get('projects/:id/whiteboard/image')
  async getPreviewImage(@Param('id') id: string, @Res() res: any): Promise<void> {
    const dataUrl = await this.whiteboardService.getPreview(id);
    if (!dataUrl) {
      throw new NotFoundException('No preview published for this project');
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
    const mime = match ? match[1] : 'image/png';
    const base64 = match ? match[2] : dataUrl.slice(dataUrl.indexOf(',') + 1);
    const buffer = Buffer.from(base64, 'base64');
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'no-cache');
    res.send(buffer);
  }
}
