/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useEffect, useRef } from 'react';
import { Message } from '../../../../shared';
import { MessageItem } from './message-item';

export type MessageListProps = {
  messages: Message[];
  onCopyMessage?: (messageId: string) => void;
  onRefreshMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  autoScroll?: boolean;
  className?: string;
};

export function MessageList(props: MessageListProps) {
  const {
    messages,
    onCopyMessage,
    onRefreshMessage,
    onDeleteMessage,
    autoScroll = true,
    className,
  } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll]);
  return (
    <div
      ref={ref}
      className={['h-full overflow-auto px-4 py-3 space-y-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      {messages.map((m) => (
        <MessageItem
          key={m.id}
          message={m}
          onCopy={onCopyMessage}
          onRefresh={onRefreshMessage}
          onDelete={onDeleteMessage}
        />
      ))}
    </div>
  );
}
