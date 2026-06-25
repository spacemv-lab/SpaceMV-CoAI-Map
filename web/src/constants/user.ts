/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 用户配置
 *
 * 当前用户 ID 取自 useAuthStore（登录后由 IAM /auth/v1/user/me 经 getUserMe() 写入），
 * 与后端 AuthGuard 的 user.userId（String(userInfo.userId)）同源同值。
 * 新建项目以此作为 ownerId —— ProjectShareService.assertOwnership 据此判定所有权，
 * 二者不一致会直接 403（创建/列举分享失败）。
 */

import { useAuthStore } from '../store/useAuthStore';

/** 获取当前登录用户 ID（与后端 guard 同源；未登录时显式失败，不做默认兜底） */
export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().user?.userId;
  if (userId === undefined || userId === null) {
    throw new Error('未登录，无法获取当前用户 ID');
  }
  return String(userId);
}
