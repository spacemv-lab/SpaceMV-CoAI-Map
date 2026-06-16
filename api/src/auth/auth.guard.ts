/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 认证 Guard
 * 验证请求中的 Authorization header
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_AUTH_KEY } from './auth.decorator';
import { CurrentUser } from './current-user.interface';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否跳过认证
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAuth) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未提供认证信息');
    }

    const token = authHeader.slice(7); // 移除 'Bearer ' 前缀
    const iamBaseUrl = process.env.IAM_BASE_URL?.trim();
    if (!iamBaseUrl) {
      throw new Error('IAM_BASE_URL is required');
    }

    // 调用 IAM 服务验证 token
    try {
      const user = await this.verifyToken(token, iamBaseUrl);
      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('认证信息无效或已过期');
    }
  }

  /**
   * 验证 token - 调用 IAM 服务获取用户信息
   */
  private async verifyToken(token: string, iamBaseUrl: string): Promise<CurrentUser> {
    const response = await fetch(`${iamBaseUrl}/auth/v1/user/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Token验证失败');
    }

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(data.msg || '认证失败');
    }

    const userInfo = data.data;

    return {
      userId: String(userInfo.userId),
      userName: userInfo.username,
      nickName: userInfo.displayName || userInfo.username,
      roles: userInfo.roles || [],
      permissions: userInfo.permissions || [],
    };
  }
}
