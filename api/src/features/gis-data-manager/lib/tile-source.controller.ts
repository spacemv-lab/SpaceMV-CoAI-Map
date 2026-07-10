/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CurrentUserData } from '../../../auth';
import { CurrentUser } from '../../../auth/current-user.interface';
import { SkipAuth } from './skip-auth.decorator';
import { TileSourceService } from './tile-source.service';
import { SetTiandituTokenDto } from '../dto/tile-source.dto';
import { success } from './api-response';

/**
 * 瓦片源控制器
 *
 * 路由：
 * - GET  /api/tile-sources/tianditu-token        公开(@SkipAuth)：返回生效 token（本批恒为平台兜底）
 * - GET  /api/tile-sources/tianditu/credential   (owner)：取当前用户 token（供配置 UI，P1-4）
 * - PUT  /api/tile-sources/tianditu/credential   (owner)：设置/更新 token（P1-4）
 *
 * 说明：tianditu-token 为 @SkipAuth 公开端点（分享页匿名也要用），无 user 上下文，
 * 本批恒返回平台兜底。用户 token 的差异化下发（登录态优先用户 token，否则平台兜底）
 * 待 P1-4 配置 UI 上线后，由前端先取鉴权态 credential、回退公开端点实现。
 */
@Controller('tile-sources')
export class TileSourceController {
  constructor(private readonly tileSourceService: TileSourceService) {}

  /** 公开取生效 token：分享页(匿名)与地图启动都用它 */
  @SkipAuth()
  @Get('tianditu-token')
  async getTiandituToken() {
    const token = this.tileSourceService.getPlatformTiandituToken();
    return success({ token, source: 'platform' });
  }

  /** 取当前用户 token（无则 token=null）；供配置 UI 显示状态 */
  @Get('tianditu/credential')
  async getCredential(@CurrentUserData() user: CurrentUser) {
    const token = await this.tileSourceService.getUserTiandituToken(user.userId);
    return success({ token });
  }

  /** 设置/更新当前用户 token */
  @Put('tianditu/credential')
  async putCredential(
    @Body() body: SetTiandituTokenDto,
    @CurrentUserData() user: CurrentUser,
  ) {
    const { updatedAt } = await this.tileSourceService.setTiandituCredential(
      user.userId,
      body.token,
    );
    return success({ updatedAt });
  }

  /** 清除当前用户 token（回退平台兜底） */
  @Delete('tianditu/credential')
  async deleteCredential(@CurrentUserData() user: CurrentUser) {
    await this.tileSourceService.clearTiandituCredential(user.userId);
    return success({ ok: true });
  }

  /**
   * 上传 GeoTIFF → 转 COG(异步)。multipart 'file' + name。
   * diskStorage 流式落盘(支持大 tif,不入堆);service 上传 MinIO 后清临时文件。
   */
  @Post('cog')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, fsSync.mkdtempSync(path.join(os.tmpdir(), 'cog-upload-')));
        },
        filename: (_req, file, cb) => {
          const fixed = Buffer.from(file.originalname, 'latin1').toString('utf8');
          const ext = path.extname(fixed) || '.tif';
          cb(null, `upload-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB(GeoTIFF 可很大)
    }),
  )
  async uploadCog(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    if (!file?.path) {
      throw new BadRequestException('GeoTIFF file is required');
    }
    if (!name) {
      throw new BadRequestException('name is required');
    }
    // multer/busboy 已按 UTF-8 解码 name 与文件名(实测 latin1→utf8 反而会破坏中文),
    // 直接透传。filename 仅用于生成原档 MinIO key(转码后即删)。
    const { id } = await this.tileSourceService.uploadCogSource(
      user.userId,
      name,
      file.path,
      file.originalname,
    );
    return success({ id, ingestStatus: 'PENDING' });
  }

  /** 列出当前用户的影像瓦片源(kind=titiler-cog,含转码状态) */
  @Get('cog')
  async listCog(@CurrentUserData() user: CurrentUser) {
    return success(await this.tileSourceService.listCogSources(user.userId));
  }

  /** 删除影像瓦片源(删 DB 行 + MinIO COG 对象;owner only) */
  @Delete('cog/:id')
  async deleteCog(
    @Param('id') id: string,
    @CurrentUserData() user: CurrentUser,
  ) {
    await this.tileSourceService.deleteCogSource(user.userId, id);
    return success({ ok: true });
  }
}
