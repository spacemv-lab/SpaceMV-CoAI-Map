/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useAuthStore } from '../../store/useAuthStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { User, LogOut, Settings } from 'lucide-react';

export default function AccountSlot() {
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground">
        未登录
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 h-9">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt={user.nickName} className="w-full h-full rounded-full" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-sm text-muted-foreground font-medium">
            {user.nickName || user.userName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {user.userName}
        </div>
        <DropdownMenuItem onClick={logout} className="text-muted-foreground cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="text-muted-foreground/50">
          <Settings className="w-4 h-4 mr-2" />
          设置（开发中）
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
