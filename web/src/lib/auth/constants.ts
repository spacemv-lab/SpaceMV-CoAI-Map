/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 认证相关常量定义
 */

// IAM 服务基础 URL
// 本地开发：空字符串（通过 Vite proxy）
// 线上部署：通过环境变量配置，如 http://txwx-iam:19001
export const IAM_BASE_URL = import.meta.env.VITE_IAM_BASE_URL || '';

// Alias for backward compatibility
export const IAM_BASE_PATH = IAM_BASE_URL;

// IAM 接口路径（相对路径，由 iamFetch 拼接完整 URL）
export const IAM_ENDPOINTS = {
  LOGIN: '/auth/v1/login',
  LOGOUT: '/auth/v1/logout',
  REFRESH_TOKEN: '/auth/v1/token/refresh',
  GET_INFO: '/system/user/getInfo',
  USER_ME: '/auth/v1/user/me',
  CAPTCHA: '/auth/v1/code',
  CHECK_HUMAN: '/auth/v1/checkHuman',
  CHECK_UNIQUE: '/auth/v1/checkunique',
  SEND_VERIFY_CODE: '/auth/v1/verify-code/send',
  WHITELIST_CHECK: '/auth/v1/register/whitelist/check',
} as const;

// Cookie key
export const COOKIE_KEY = {
  TOKEN: 'Admin-Token',
} as const;

// 登录类型
export const LOGIN_TYPE = {
  PASSWORD: 'password',
  SMS: 'sms',
} as const;

// 白名单路由（无需认证）
export const AUTH_WHITE_LIST = ['/login', '/register', '/forgetPassword'] as const;