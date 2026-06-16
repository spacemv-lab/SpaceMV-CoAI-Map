/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { httpClient } from '../http-client';
import { toast } from 'sonner';

const TOKEN_KEY = 'Admin-Token';
const IAM_REFRESH_URL = '/auth/v1/token/refresh';

interface RefreshResponse {
  code: number;
  data?: {
    refreshToken: string;
  };
}

// 刷新锁，防止并发刷新
let refreshPromise: Promise<string> | null = null;

/**
 * 从 Cookie 获取 refreshToken
 */
function getRefreshToken(): string | null {
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
 * 设置 refreshToken 到 Cookie
 */
function setRefreshToken(token: string): void {
  document.cookie = `${TOKEN_KEY}=${token}; path=/`;
}

/**
 * 清除 refreshToken
 */
function clearRefreshToken(): void {
  document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * 刷新 token
 */
async function refreshToken(): Promise<string> {
  const currentToken = getRefreshToken();
  if (!currentToken) {
    throw new Error('无 refreshToken');
  }

  // IAM 要求 Authorization header 携带 refreshToken
  const response = await fetch(IAM_REFRESH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`,
    },
    body: JSON.stringify({ refreshToken: currentToken }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ msg: '请求失败' }));
    throw new Error(errorBody.msg || `刷新 Token 失败: HTTP ${response.status}`);
  }

  const data: RefreshResponse = await response.json();
  if (data.code !== 200 || !data.data?.refreshToken) {
    throw new Error('刷新 Token 失败');
  }

  const newToken = data.data.refreshToken;
  setRefreshToken(newToken);
  return newToken;
}

/**
 * 处理 token 刷新（防并发）
 */
async function handleTokenRefresh(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshToken();

  try {
    const newToken = await refreshPromise;
    return newToken;
  } finally {
    refreshPromise = null;
  }
}

/**
 * 响应拦截器：处理 401 和其他错误
 */
export const errorResponseInterceptor = {
  onFulfilled: (response: AxiosResponse) => response,

  onRejected: async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401: token 过期，尝试刷新
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await handleTokenRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return httpClient(originalRequest);
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : '会话已过期';

        // 显示 toast 提示（用户能看到原因）
        toast.error(`登录已过期: ${errorMsg}`, { duration: 5000 });

        // 延迟 2 秒跳转，让用户看到 toast
        setTimeout(() => {
          clearRefreshToken();
          window.location.href = '/login';
        }, 2000);

        return Promise.reject(new Error(errorMsg));
      }
    }

    // 其他错误统一处理
    const message = (error.response?.data as { msg?: string })?.msg || error.message || '请求失败';
    return Promise.reject(new Error(message));
  },
};

export default errorResponseInterceptor;
