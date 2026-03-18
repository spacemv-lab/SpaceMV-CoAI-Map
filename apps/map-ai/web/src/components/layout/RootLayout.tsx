/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

export default function RootLayout() {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
      <TopBar />
      <div className="relative flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
