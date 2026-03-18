/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Bell } from 'lucide-react';

export interface Notification {
  id: string;
  date: string;
  message: string;
}

interface NotificationListProps {
  notifications: Notification[];
}

/**
 * NotificationList Component
 *
 * 显示系统通知列表。
 */
export function NotificationList({ notifications }: NotificationListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">系统通知</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              暂无新通知
            </p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 items-start border-b pb-3 last:border-0 last:pb-0"
              >
                <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm leading-tight">{item.message}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
