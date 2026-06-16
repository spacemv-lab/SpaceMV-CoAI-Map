/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'Admin-Token';

/**
 * 从 Cookie 获取 refreshToken
 */
export function getRefreshToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === TOKEN_KEY) {
      return value;
    }
  }
  return null;
}

/**
 * 请求拦截器：自动注入 Authorization header
 */
export const authRequestInterceptor = (config: InternalAxiosRequestConfig) => {
  const token = getRefreshToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

export default authRequestInterceptor;
