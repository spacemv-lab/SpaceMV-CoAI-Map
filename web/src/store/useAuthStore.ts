/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

/**
 * 认证状态管理
 * 使用 Zustand + immer 管理用户认证状态
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  getRefreshToken,
  setRefreshToken,
  removeRefreshToken,
  hasToken,
} from '../lib/auth/token';
import {
  loginWithPassword,
  loginWithSms,
  getUserInfo,
  getUserMe,
  logout,
  refreshToken as refreshTokenAPI,
} from '../lib/api/auth-api';

// ============ 类型定义 ============

interface User {
  userId: number;
  userName: string;
  nickName?: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;

  // Actions
  loginWithPassword: (
    username: string,
    password: string,
    code?: string,
    uuid?: string
  ) => Promise<void>;
  loginWithSms: (phone: string, verifyCode: string) => Promise<void>;
  fetchUserInfo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
  clearAuth: () => void;
  setError: (error: string | null) => void;
}

// ============ Store 创建 ============

export const useAuthStore = create<AuthState>()(
  immer((set, get) => ({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      error: null,

      // 账号密码登录
      loginWithPassword: async (username, password, code, uuid) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const res = await loginWithPassword(username, password, code, uuid);
          setRefreshToken(res.refreshToken);

          // 登录返回已包含用户信息，无需单独调用 getInfo
          set((state) => {
            state.user = {
              userId: res.userId,
              userName: res.username,
              nickName: res.username,
              roles: ['ROLE_DEFAULT'],
              permissions: [],
            };
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch (e) {
          set((state) => {
            state.isLoading = false;
            state.error = e instanceof Error ? e.message : '登录失败';
          });
          throw e;
        }
      },

      // 手机验证码登录
      loginWithSms: async (phone, verifyCode) => {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const res = await loginWithSms(phone, verifyCode);
          setRefreshToken(res.refreshToken);

          // 登录返回已包含用户信息，无需单独调用 getInfo
          set((state) => {
            state.user = {
              userId: res.userId,
              userName: res.username,
              nickName: res.username,
              roles: ['ROLE_DEFAULT'],
              permissions: [],
            };
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch (e) {
          set((state) => {
            state.isLoading = false;
            state.error = e instanceof Error ? e.message : '登录失败';
          });
          throw e;
        }
      },

      // 获取用户信息
      fetchUserInfo: async () => {
        try {
          const res = await getUserInfo();
          set((state) => {
            state.user = {
              userId: Number(res.user.userId),
              userName: res.user.userName,
              nickName: res.user.nickName,
              avatar: res.user.avatar,
              roles: res.roles || ['ROLE_DEFAULT'],
              permissions: res.permissions || [],
            };
          });
        } catch (e) {
          throw e;
        }
      },

      // 退出登录
      logout: async () => {
        set((state) => {
          state.isLoading = true;
        });

        try {
          await logout();
        } catch {
          // 忽略 logout API 错误
        }

        get().clearAuth();
      },

      // 刷新 refreshToken
      refreshToken: async () => {
        if (!hasToken()) return false;

        try {
          const newToken = await refreshTokenAPI();
          setRefreshToken(newToken);
          return true;
        } catch {
          get().clearAuth();
          return false;
        }
      },

      // 检查认证状态（应用启动时调用）
      // 有 token 时调用 getUserMe 验证 token 并获取用户信息
      checkAuthStatus: async () => {
        if (!hasToken()) {
          set((state) => {
            state.isAuthenticated = false;
            state.isLoading = false;
            state.user = null;
          });
          return;
        }

        // 有 token，调用 getUserMe 获取用户信息
        try {
          const res = await getUserMe();
          set((state) => {
            state.user = {
              userId: res.userId,
              userName: res.username,
              nickName: res.username,
              roles: ['ROLE_DEFAULT'],
              permissions: [],
            };
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch {
          // getUserMe 失败（token 无效或过期），清除认证状态
          get().clearAuth();
        }
      },

      // 清理认证状态
      clearAuth: () => {
        removeRefreshToken();
        set((state) => {
          state.isAuthenticated = false;
          state.isLoading = false;
          state.user = null;
          state.error = null;
        });
      },

      // 设置错误信息
      setError: (error) => {
        set((state) => {
          state.error = error;
        });
      },
    }))
);

// ============ 辅助 Hooks ============

/**
 * 获取当前用户信息
 */
export function useUser() {
  return useAuthStore((state) => state.user);
}

/**
 * 检查是否已认证
 */
export function useIsAuthenticated() {
  return useAuthStore((state) => state.isAuthenticated);
}

/**
 * 检查是否正在加载
 */
export function useAuthLoading() {
  return useAuthStore((state) => state.isLoading);
}

/**
 * 获取用户权限
 */
export function usePermissions() {
  return useAuthStore((state) => state.user?.permissions || []);
}

/**
 * 获取用户角色
 */
export function useRoles() {
  return useAuthStore((state) => state.user?.roles || []);
}

/**
 * 检查是否有特定权限
 */
export function useHasPermission(permission: string): boolean {
  const permissions = useAuthStore((state) => state.user?.permissions || []);
  return permissions.includes(permission) || permissions.includes('*:*:*');
}

/**
 * 检查是否有特定角色
 */
export function useHasRole(role: string): boolean {
  const roles = useAuthStore((state) => state.user?.roles || []);
  return roles.includes(role) || roles.includes('admin');
}