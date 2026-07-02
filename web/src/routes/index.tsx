/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import RootLayout from '../components/layout/RootLayout';
import ProjectLayout from '../pages/project/Index';
import LoginPage from '../auth/LoginPage';
import RegisterPage from '../auth/RegisterPage';
import { ProtectedRoute } from '../auth/ProtectedRoute';

const HomePage = lazy(() => import('../pages/project-home/Index'));
const MapPage = lazy(() => import('../pages/home/Index'));
const DataPage = lazy(() => import('../pages/data/Index'));
const ProjectDataPage = lazy(() => import('../pages/project/data/Index'));
const BoardPage = lazy(() => import('../pages/project/board/Index'));
const SharePage = lazy(() => import('../pages/share/Index'));

// 占位页面组件
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center w-full h-full">
    <div className="text-muted-foreground">{title}功能开发中...</div>
  </div>
);

const router = createBrowserRouter([
  // 登录页（无需保护）
  {
    path: '/login',
    element: <LoginPage />,
  },
  // 注册页（无需保护）
  {
    path: '/register',
    element: <RegisterPage />,
  },
  // 公开分享页（无需认证，只读地图）
  {
    path: '/share/:token',
    element: (
      <Suspense fallback={<div className="p-6 text-sm">正在加载分享地图…</div>}>
        <SharePage />
      </Suspense>
    ),
  },
  // 受保护的路由
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <RootLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<div className="p-6 text-sm">正在加载首页…</div>}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'data-square',
        element: (
          <Suspense fallback={<div className="p-6 text-sm">正在加载数据广场…</div>}>
            <DataPage />
          </Suspense>
        ),
      },
      {
        path: 'project-square',
        element: <PlaceholderPage title="项目广场" />,
      },
      {
        path: 'project/:projectId',
        element: <ProjectLayout />,
        children: [
          {
            path: 'map',
            element: (
              <Suspense fallback={<div className="p-6 text-sm">正在加载地图…</div>}>
                <MapPage />
              </Suspense>
            ),
          },
          {
            path: 'data',
            element: (
              <Suspense fallback={<div className="p-6 text-sm">正在加载数据管理…</div>}>
                <ProjectDataPage />
              </Suspense>
            ),
          },
          {
            path: 'board',
            element: (
              <Suspense fallback={<div className="p-6 text-sm">正在加载白板…</div>}>
                <BoardPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  // 未匹配的路由重定向到首页
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
