/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import Logo from './Logo';
import MainMenu from './MainMenu';
import AccountSlot from './AccountSlot';

export default function TopBar() {
  return (
    <header className="z-10 w-full h-14 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="px-4 flex items-center justify-between h-full">
        <div className="flex items-center gap-4">
          <Logo />
        </div>
        <div className="flex-1 flex justify-center">
          <MainMenu />
        </div>
        <div className="flex items-center gap-2">
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
