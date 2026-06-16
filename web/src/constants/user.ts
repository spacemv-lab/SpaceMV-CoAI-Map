/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 用户配置
 * 目前使用默认用户，后续集成认证系统后从 token 获取
 */

/** 默认用户ID（临时方案，认证系统上线后移除） */
export const DEFAULT_USER_ID = 'default-user';

/** 获取当前用户ID（预留认证集成接口） */
export function getCurrentUserId(): string {
  // TODO: 从认证系统获取当前用户ID
  // 当前返回默认用户
  return DEFAULT_USER_ID;
}
