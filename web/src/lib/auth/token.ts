/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * Token 存取工具
 * 使用 Cookie 存储 refreshToken (Admin-Token)
 */

import Cookies from 'js-cookie';

// Cookie key 常量
const TOKEN_KEY = 'Admin-Token';

/**
 * 获取 refreshToken
 */
export function getRefreshToken(): string | undefined {
  return Cookies.get(TOKEN_KEY);
}

/**
 * 设置 refreshToken (Persistent Cookie，30天过期)
 * 与 refreshToken 的有效期保持一致
 */
export function setRefreshToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, {
    expires: 30,        // 30天过期
    path: '/',          // 全站有效
    sameSite: 'Lax',    // CSRF 保护
  });
}

/**
 * 删除 refreshToken
 */
export function removeRefreshToken(): void {
  Cookies.remove(TOKEN_KEY, { path: '/' });
}

/**
 * 清理所有认证信息
 */
export function clearAuth(): void {
  removeRefreshToken();
}

/**
 * 检查是否有 refreshToken
 */
export function hasToken(): boolean {
  return !!getRefreshToken();
}