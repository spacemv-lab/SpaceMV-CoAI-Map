/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipAuth } from '../auth/auth.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 健康检查接口（K8s 存活探测）
   * 无需认证
   */
  @SkipAuth()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: Date.now() };
  }

  @Get()
  getData() {
    return this.appService.getData();
  }
}
