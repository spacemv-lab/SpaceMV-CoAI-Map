/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 统一 API 响应格式
 * 与公司 IAM 服务格式保持一致
 */

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

/**
 * 成功响应包装器
 */
export function success<T>(data: T, msg = 'success'): ApiResponse<T> {
  return {
    code: 200,
    data,
    msg,
  };
}

/**
 * 错误响应包装器
 */
export function error(code: number, msg: string): ApiResponse<null> {
  return {
    code,
    data: null,
    msg,
  };
}