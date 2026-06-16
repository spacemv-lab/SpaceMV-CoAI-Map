/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 当前用户接口定义
 */

export interface CurrentUser {
  userId: string;
  userName: string;
  nickName: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
}