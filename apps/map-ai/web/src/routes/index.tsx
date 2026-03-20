/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from '../components/layout/RootLayout';

const HomePage = lazy(() => import('../pages/home/Index'));
const DataPage = lazy(() => import('../pages/data/Index'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
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
        path: 'data',
        element: (
          <Suspense
            fallback={<div className="p-6 text-sm">正在加载数据管理…</div>}
          >
            <DataPage />
          </Suspense>
        ),
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
