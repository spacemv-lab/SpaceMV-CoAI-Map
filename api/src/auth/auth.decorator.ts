/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 认证相关装饰器
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import { CurrentUser } from './current-user.interface';

// 获取当前用户数据的装饰器
export const CurrentUserData = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// 跳过认证的元数据 key
export const SKIP_AUTH_KEY = 'skipAuth';

// 跳过认证的装饰器（用于公开接口）
export const SkipAuth = () => SetMetadata(SKIP_AUTH_KEY, true);