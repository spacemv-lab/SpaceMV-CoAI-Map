/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 认证 API 封装
 * 封装 IAM 服务接口
 */

import { IAM_BASE_PATH, IAM_ENDPOINTS } from '../auth/constants';
import { getRefreshToken, setRefreshToken, removeRefreshToken } from '../auth/token';
import { encryptPassword } from '../auth/rsa';
import { httpClient } from '@txwx-monorepo/api-client';

// ============ 类型定义 ============

interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

interface LoginResponse {
  accessToken?: string;
  refreshToken: string;
  userId: number;
  username: string;
  productLine: string;
  expiresIn: number;
}

interface UserInfoResponse {
  user: {
    userId: string;
    userName: string;
    nickName: string;
    avatar?: string;
    deptId?: string;
  };
  roles: string[];
  permissions: string[];
}

interface CaptchaResponse {
  img: string;
  uuid: string;
  captchaEnabled: boolean;
}

// ============ IAM API ============

/**
 * IAM 服务请求（不自动附加认证 header）
 */
async function iamFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${IAM_BASE_PATH}${path}`;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  // 如果有 refreshToken，附加到请求头（除了登录、验证码接口）
  // refresh 接口也需要 Authorization header
  if (!path.includes('/login') && !path.includes('/code') && !path.includes('/send')) {
    const token = getRefreshToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ msg: '请求失败' }));
    throw new Error(errorData.msg || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 登录
 */
export async function login(data: {
  channelAccount: string;
  credential: string;
  loginType: 'password' | 'sms';
  code?: string;
  uuid?: string;
  productLine?: string;
}): Promise<LoginResponse> {
  const res = await iamFetch<ApiResponse<LoginResponse>>(IAM_ENDPOINTS.LOGIN, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      productLine: 'spacemv-coai-map',
    }),
  });

  if (res.code !== 200) {
    throw new Error(res.msg || '登录失败');
  }

  return res.data!;
}

/**
 * 账号密码登录（自动加密密码）
 */
export async function loginWithPassword(
  username: string,
  password: string,
  code?: string,
  uuid?: string
): Promise<LoginResponse> {
  const encryptedPassword = encryptPassword(password);
  if (!encryptedPassword) {
    throw new Error('密码加密失败');
  }

  return login({
    channelAccount: username,
    credential: encryptedPassword,
    loginType: 'password',
    code,
    uuid,
  });
}

/**
 * 手机验证码登录
 */
export async function loginWithSms(phone: string, verifyCode: string): Promise<LoginResponse> {
  return login({
    channelAccount: phone,
    credential: verifyCode,
    loginType: 'sms',
  });
}

/**
 * 刷新 refreshToken
 */
export async function refreshToken(): Promise<string> {
  const currentToken = getRefreshToken();
  if (!currentToken) {
    throw new Error('无 refreshToken');
  }

  const res = await iamFetch<ApiResponse<{ refreshToken: string }>>(IAM_ENDPOINTS.REFRESH_TOKEN, {
    method: 'POST',
    body: JSON.stringify({ refreshToken: currentToken }),
  });

  if (res.code !== 200) {
    throw new Error(res.msg || '刷新 Token 失败');
  }

  const newToken = res.data!.refreshToken;
  setRefreshToken(newToken);
  return newToken;
}

/**
 * 获取用户信息
 */
export async function getUserInfo(): Promise<UserInfoResponse> {
  const res = await iamFetch<ApiResponse<UserInfoResponse>>(IAM_ENDPOINTS.GET_INFO, {
    method: 'GET',
  });

  if (res.code !== 200) {
    throw new Error(res.msg || '获取用户信息失败');
  }

  return res.data!;
}

/**
 * 退出登录
 */
export async function logout(): Promise<void> {
  try {
    await iamFetch<void>(IAM_ENDPOINTS.LOGOUT, {
      method: 'POST',
    });
  } catch {
    // 忽略 logout API 错误
  }
  removeRefreshToken();
}

/**
 * 获取当前用户信息（使用 refreshToken，自动刷新）
 */
export async function getUserMe(): Promise<{ userId: number; username: string }> {
  // IAM 请求通过 /auth 代理，不走 httpClient
  const token = getRefreshToken();
  const response = await fetch(`${IAM_BASE_PATH}${IAM_ENDPOINTS.USER_ME}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('获取用户信息失败');
  }

  const res = await response.json();

  if (res.code !== 200) {
    throw new Error(res.msg || '获取用户信息失败');
  }

  return res.data!;
}

/**
 * 获取图形验证码
 */
export async function getCaptcha(): Promise<CaptchaResponse> {
  const res = await iamFetch<ApiResponse<CaptchaResponse>>(IAM_ENDPOINTS.CAPTCHA, {
    method: 'GET',
  });

  if (res.code !== 200) {
    throw new Error(res.msg || '获取验证码失败');
  }

  return res.data!;
}

/**
 * 人机验证（校验图形验证码）
 */
export async function checkHuman(data: {
  uuid: string;
  code: string;
}): Promise<boolean> {
  const res = await iamFetch<ApiResponse>(IAM_ENDPOINTS.CHECK_HUMAN, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return res.code === 200;
}

/**
 * 检查用户是否存在
 * 后端逻辑：data=false 表示用户已存在，data=true 表示用户不存在
 * 返回 true = 用户存在，false = 用户不存在（反转后便于前端使用）
 */
export async function checkUnique(params: {
  fieldType: 'username' | 'phone' | 'email';
  fieldValue: string;
  productLine: string;
}): Promise<boolean> {
  const res = await iamFetch<ApiResponse<boolean>>(
    `${IAM_ENDPOINTS.CHECK_UNIQUE}?fieldType=${params.fieldType}&fieldValue=${encodeURIComponent(params.fieldValue)}&productLine=${params.productLine}`,
    { method: 'GET' }
  );

  // 反转：后端 false = 存在，true = 不存在
  // 返回 true = 用户存在，便于前端判断
  return res.code === 200 && res.data === false;
}

/**
 * 发送短信/邮箱验证码
 */
export async function sendVerifyCode(data: {
  channelAccount: string;
  channelType: 'phone' | 'email';
  verifyType: 'login' | 'register' | 'forget';
  uuid?: string;
  code?: string;
}): Promise<void> {
  const res = await iamFetch<ApiResponse>(IAM_ENDPOINTS.SEND_VERIFY_CODE, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (res.code !== 200) {
    throw new Error(res.msg || '发送验证码失败');
  }
}

/**
 * 检查账号白名单
 * 返回 allowed: true 表示在白名单中，允许注册
 */
export async function checkWhitelist(params: {
  account: string;
  productLine: string;
}): Promise<{ allowed: boolean; reason?: string; message?: string }> {
  const res = await iamFetch<ApiResponse<{
    allowed: boolean;
    reason?: string;
    message?: string
  }>>(IAM_ENDPOINTS.WHITELIST_CHECK, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // code: 200 表示请求成功
  if (res.code !== 200) {
    throw new Error(res.msg || '白名单验证失败');
  }

  return res.data!;
}

// ============ 业务 API 客户端（使用共享 httpClient） ============

/**
 * 业务 API 请求（使用共享 httpClient，自动认证 + 401 刷新）
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // 使用共享的 httpClient（已配置认证拦截器和错误拦截器）
  const method = (options.method || 'GET').toLowerCase();

  if (method === 'get') {
    const response = await httpClient.get<T>(path);
    return response.data;
  }

  if (method === 'post') {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const response = await httpClient.post<T>(path, body);
    return response.data;
  }

  if (method === 'put') {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const response = await httpClient.put<T>(path, body);
    return response.data;
  }

  if (method === 'patch') {
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    const response = await httpClient.patch<T>(path, body);
    return response.data;
  }

  if (method === 'delete') {
    const response = await httpClient.delete<T>(path);
    return response.data;
  }

  // 默认使用 GET
  const response = await httpClient.get<T>(path);
  return response.data;
}