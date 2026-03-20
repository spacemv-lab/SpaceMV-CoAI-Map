/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Adapters, Conversation, Message } from '../../../../shared';
import { Sidebar } from './sidebar';
import { ResizableHandle } from './resizable-handle';

export type ChatWindowProps = {
  conversations: Conversation[];
  selectedConversationId?: string;
  messages: Message[];
  title?: string;
  adapters?: Adapters;
  collapsed?: boolean;
  collapsibleBreakpoint?: number;
  initialSidebarWidth?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  onNewConversation?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onCopyMessage?: (messageId: string) => void;
  onRefreshMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  headerRight?: React.ReactNode;
  className?: string;
  slotClassNames?: {
    container?: string;
    sidebar?: string;
    header?: string;
    content?: string;
    input?: string;
  };
  renderChatHeader?: (
    title?: string,
    right?: React.ReactNode,
  ) => React.ReactNode;
  renderMessageList?: (messages: Message[]) => React.ReactNode;
  renderChatInput?: () => React.ReactNode;
};

export function ChatWindow(props: ChatWindowProps) {
  const {
    conversations,
    selectedConversationId,
    messages,
    title,
    adapters,
    collapsed,
    collapsibleBreakpoint = 960,
    initialSidebarWidth = 280,
    minSidebarWidth = 200,
    maxSidebarWidth = 420,
    onNewConversation,
    onSelectConversation,
    headerRight,
    className,
    slotClassNames,
    renderChatHeader,
    renderMessageList,
    renderChatInput,
  } = props;

  const [internalCollapsed, setInternalCollapsed] =
    useState<boolean>(!!collapsed);
  const [sidebarWidth, setSidebarWidth] = useState<number>(initialSidebarWidth);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (collapsed !== undefined) return;
    const applyCollapse = () => {
      const w = window.innerWidth;
      setInternalCollapsed(w < collapsibleBreakpoint);
    };
    applyCollapse();
    window.addEventListener('resize', applyCollapse);
    return () => window.removeEventListener('resize', applyCollapse);
  }, [collapsibleBreakpoint, collapsed]);

  const onDragStart = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.min(
        Math.max(startWidth + delta, minSidebarWidth),
        maxSidebarWidth,
      );
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const isCollapsed = collapsed ?? internalCollapsed;

  const sidebarStyle = useMemo<React.CSSProperties>(
    () => ({
      width: isCollapsed ? 0 : sidebarWidth,
      backgroundColor: 'var(--ai-panel)',
      borderRight: '1px solid var(--ai-border)',
    }),
    [isCollapsed, sidebarWidth],
  );

  const containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--ai-bg)',
  };

  return (
    <div
      ref={containerRef}
      className={[
        'chat-window',
        'w-full h-full min-h-0 overflow-hidden',
        'flex flex-row',
        className,
        slotClassNames?.container,
      ]
        .filter(Boolean)
        .join(' ')}
      style={containerStyle}
    >
      {!isCollapsed && (
        <div
          className={['h-full', slotClassNames?.sidebar]
            .filter(Boolean)
            .join(' ')}
          style={sidebarStyle}
        >
          <Sidebar
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onNewConversation={onNewConversation}
            onSelectConversation={onSelectConversation}
            onToggleCollapse={() => {
              if (collapsed === undefined) setInternalCollapsed(true);
            }}
          />
        </div>
      )}
      {!isCollapsed && <ResizableHandle onPointerDown={onDragStart} />}
      {isCollapsed && (
        <div
          className="h-full flex items-center"
          style={{ borderRight: '1px solid var(--ai-border)' }}
        >
          <button
            className="mx-1 text-xs px-2 py-1 rounded border"
            style={{
              borderColor: 'var(--ai-border)',
              color: 'var(--ai-primary)',
            }}
            onClick={() => {
              if (collapsed === undefined) setInternalCollapsed(false);
            }}
            title="展开侧栏"
          >
            展开
          </button>
        </div>
      )}
      <div className="chat-window__content flex flex-col flex-1 min-w-0 min-h-0">
        <div
          className={[
            'chat-window__header flex items-center justify-between px-4 py-2',
            'border-b',
          ].join(' ')}
          style={{
            borderColor: 'var(--ai-border)',
            backgroundColor: 'var(--ai-panel)',
          }}
        >
          <div
            className="text-sm font-medium"
            style={{ color: 'var(--ai-primary)' }}
            data-rf-drag-handle=""
            role="button"
            title="拖拽移动"
          >
            {renderChatHeader ? renderChatHeader(title, headerRight) : title}
          </div>
          <div className="flex items-center gap-2">{headerRight}</div>
        </div>
        <div className="message-container flex-1 min-h-0 overflow-y-auto">
          {renderMessageList ? renderMessageList(messages) : null}
        </div>
        <div
          className="chat-window__input border-t"
          style={{ borderColor: 'var(--ai-border)' }}
        >
          {renderChatInput ? renderChatInput() : null}
        </div>
      </div>
    </div>
  );
}
