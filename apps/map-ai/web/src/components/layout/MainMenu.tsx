/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: '首页', exact: true },
  { to: '/data', label: '数据管理' },
];

export default function MainMenu() {
  return (
    <nav className="flex items-center gap-6">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          className={({ isActive }) =>
            [
              'text-sm transition-colors',
              isActive
                ? 'text-primary underline underline-offset-8'
                : 'text-muted-foreground hover:text-primary',
            ].join(' ')
          }
          end={it.exact}
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
