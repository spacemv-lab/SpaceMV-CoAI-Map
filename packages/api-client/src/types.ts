/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

export interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

export interface ApiError {
  code: number;
  message: string;
  status: number;
}

export interface RequestConfig {
  retry?: number;
  retryDelay?: number;
  cache?: boolean;
  debounce?: number;
}
