/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import axios, { AxiosInstance } from 'axios';
import { authRequestInterceptor } from './interceptors/auth.interceptor';
import { errorResponseInterceptor } from './interceptors/error.interceptor';

const API_BASE_URL = '/api';

// 创建 axios 实例
export const httpClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 注册认证拦截器
httpClient.interceptors.request.use(authRequestInterceptor);

// 注册错误拦截器
httpClient.interceptors.response.use(
  errorResponseInterceptor.onFulfilled,
  errorResponseInterceptor.onRejected
);

export default httpClient;
