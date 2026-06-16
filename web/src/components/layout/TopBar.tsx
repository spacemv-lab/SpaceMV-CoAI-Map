/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useLocation, useParams } from 'react-router-dom';
import Logo from './Logo';
import MainMenu from './MainMenu';
import BackToHome from './BackToHome';
import AccountSlot from './AccountSlot';
import { useMapStore } from '@/features/map-core';

export default function TopBar() {
  const location = useLocation();
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProjectName } = useMapStore();

  // 判断是否在项目页面
  const isProjectPage = location.pathname.startsWith('/project/');
  // 判断是否在首页（项目列表页）
  const isHomePage = location.pathname === '/';

  // 从 Store 获取当前项目名称
  const projectName = currentProjectName;

  // 首页和项目页面都不显示 MainMenu
  const showMainMenu = !isHomePage && !isProjectPage;

  return (
    <header className="z-10 w-full h-14 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="px-4 flex items-center justify-between h-full">
        <div className="flex items-center gap-4">
          {isProjectPage ? (
            <BackToHome projectName={projectName} />
          ) : (
            <Logo />
          )}
        </div>
        <div className="flex-1 flex justify-center">
          {/* 首页和项目页面不显示 MainMenu */}
          {showMainMenu && <MainMenu />}
        </div>
        <div className="flex items-center gap-2">
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
