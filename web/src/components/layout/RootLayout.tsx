/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import HomeSidebar from './HomeSidebar';
import Logo from './Logo';
import AccountSlot from './AccountSlot';

export default function RootLayout() {
  const location = useLocation();
  // 首页级别的页面使用特殊布局：顶部Logo横条 + 左侧导航 + 主内容区
  const isHomeLevelPage = ['/', '/data-square', '/project-square'].includes(location.pathname);

  if (isHomeLevelPage) {
    return (
      <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
        {/* Logo 顶部横条 + 用户信息 */}
        <div className="px-8 py-5 flex items-center justify-between">
          <Logo />
          <AccountSlot />
        </div>
        <div className="w-full h-px bg-border" />

        {/* 左侧导航 + 主内容区 */}
        <div className="flex flex-1 min-h-0">
          {/* 左侧导航（悬浮） */}
          <div className="px-2 py-4">
            <HomeSidebar />
          </div>

          {/* 主内容区 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  // 其他页面显示 TopBar
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
      <TopBar />
      <div className="relative flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
