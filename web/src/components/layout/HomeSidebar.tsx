/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { NavLink } from 'react-router-dom';
import { Home, Database, FolderOpen } from 'lucide-react';

const navItems = [
  { to: '/', label: '主页', icon: <Home className="w-5 h-5" />, exact: true },
  { to: '/data-square', label: '数据广场', icon: <Database className="w-5 h-5" /> },
  { to: '/project-square', label: '项目广场', icon: <FolderOpen className="w-5 h-5" /> },
];

export default function HomeSidebar() {
  return (
    <nav className="flex flex-col gap-1.5 w-16">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-3 rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:shadow-sm'
            }`
          }
        >
          {item.icon}
          <span className="text-xs mt-1.5 font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
