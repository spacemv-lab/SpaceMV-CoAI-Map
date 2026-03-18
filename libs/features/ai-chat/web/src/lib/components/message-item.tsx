/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';
import { Message } from '../../../../shared';
import { MarkdownContent } from './markdown';

export type MessageItemProps = {
  message: Message;
  onCopy?: (messageId: string) => void;
  onRefresh?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
};

function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode;
  },
) {
  const { children, ...rest } = props;
  return (
    <button
      {...rest}
      className="h-7 w-7 inline-flex items-center justify-center rounded border hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
      style={{ borderColor: 'var(--ai-border)' }}
    >
      {children}
    </button>
  );
}

function MessageItemBase(props: MessageItemProps) {
  const { message, onCopy, onRefresh, onDelete } = props;
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const [copied, setCopied] = React.useState(false);
  const isSkeleton = message.status === 'pending';
  const bubbleClass = isUser
    ? 'inline-block max-w-[75%] px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-primary-foreground shadow-md transition-colors animate-in fade-in slide-in-from-bottom-2'
    : 'inline-block max-w-[75%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white/85 dark:bg-neutral-900/60 text-foreground shadow-sm border backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2';
  return (
    <div
      className={['message-item flex gap-3', isUser ? 'flex-row-reverse' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="shrink-0 h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 shadow-sm" />
      <div className="flex-1">
        <div
          className={['text-xs opacity-60', isUser ? 'text-right' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {isAssistant ? 'AI' : '我'}
        </div>
        <div
          className={['mt-1', isUser ? 'flex justify-end' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {isSkeleton ? (
            <div className="chat-msg__skeleton inline-block max-w-[75%] rounded-2xl px-3 py-2">
              <div className="h-3 w-40 rounded bg-gray-200 dark:bg-neutral-800 animate-pulse" />
            </div>
          ) : (
            <div className={bubbleClass}>
              <MarkdownContent text={message.content} />
            </div>
          )}
        </div>
        <div
          className={[
            'mt-2 flex items-center gap-2',
            isUser ? 'justify-end' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <IconButton
            onClick={async () => {
              await navigator.clipboard.writeText(message.content);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
              onCopy && onCopy(message.id);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <rect x="3" y="3" width="13" height="13" rx="2" />
            </svg>
          </IconButton>
          {isAssistant && (
            <>
              <IconButton onClick={() => onRefresh && onRefresh(message.id)}>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M20 12a8 8 0 1 1-8-8" />
                  <path d="M20 4v8h-8" />
                </svg>
              </IconButton>
              <IconButton onClick={() => onDelete && onDelete(message.id)}>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M4 7h16" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
                  <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </IconButton>
            </>
          )}
          {copied && (
            <span className="text-xs px-2 py-1 rounded-md border bg-white/85 dark:bg-neutral-900/60 transition-opacity">
              已复制
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MessageItem = React.memo(MessageItemBase);
