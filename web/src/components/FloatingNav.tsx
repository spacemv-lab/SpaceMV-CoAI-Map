/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Map, Database, Presentation } from 'lucide-react';
import { cn } from '../lib/utils';
import { useMapStore } from '@/features/map-core';
import { useProjectState } from '../hooks/useProjectState';

interface FloatingNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const NAV_ITEMS: FloatingNavItem[] = [
  { id: 'map', icon: <Map className="w-5 h-5" />, label: '地图', path: 'map' },
  { id: 'data', icon: <Database className="w-5 h-5" />, label: '数据', path: 'data' },
  { id: 'board', icon: <Presentation className="w-5 h-5" />, label: '白板', path: 'board' },
];

interface FloatingNavProps {
  projectId: string;
}

export default function FloatingNav({ projectId }: FloatingNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { captureProjectState, currentProjectId } = useMapStore();
  const { saveState } = useProjectState(currentProjectId);

  // 从当前路径提取激活的路由段
  // location.pathname 格式: /project/:projectId/map 或 /project/:projectId/data
  const pathSegments = location.pathname.split('/');
  const activePath = pathSegments[3] || 'map';  // ['', 'project', projectId, 'map']

  // Handle navigation: capture state before navigating away
  const handleNavigation = (path: string) => {
    // Capture current state and save to localStorage + API
    if (currentProjectId) {
      const projectState = captureProjectState();
      saveState(projectState);
    }
    // Navigate to the new path
    navigate(`/project/${projectId}/${path}`);
  };

  return (
    <nav
      className="fixed left-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2"
      aria-label="项目导航"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activePath === item.path;

        return (
          <button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            className={cn(
              'group relative flex items-center',
              'w-12 h-12 rounded-xl transition-all duration-200',
              'hover:w-[120px] hover:justify-start hover:px-4',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isActive
                ? 'bg-primary/10 text-primary border-l-4 border-primary pl-2'
                : 'bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground'
            )}
          >
            {/* 图标 */}
            <span className="flex-shrink-0 ml-1">{item.icon}</span>

            {/* 文字标签（CSS hover 控制） */}
            <span
              className={cn(
                'ml-3 text-sm font-medium whitespace-nowrap',
                'opacity-0 group-hover:opacity-100',
                'transition-opacity duration-200'
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
