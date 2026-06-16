/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

export { httpClient } from './http-client';
export type { ApiResponse, ApiError, RequestConfig } from './types';

// 导出拦截器（供测试或自定义配置）
export { authRequestInterceptor } from './interceptors/auth.interceptor';
export { errorResponseInterceptor } from './interceptors/error.interceptor';
export { getRefreshToken } from './interceptors/auth.interceptor';
