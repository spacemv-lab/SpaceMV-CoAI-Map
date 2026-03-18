/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React from 'react';
import { Conversation } from '../../../../shared';
import { deleteSession, renameSession } from '../store/chat-store';

export type SidebarProps = {
  conversations: Conversation[];
  selectedConversationId?: string;
  onNewConversation?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onToggleCollapse?: () => void;
};

export function Sidebar(props: SidebarProps) {
  const {
    conversations,
    selectedConversationId,
    onNewConversation,
    onSelectConversation,
    onToggleCollapse,
  } = props;
  const [bulkMode, setBulkMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const toggleSelect = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const allIds = React.useMemo(
    () => conversations.map((c) => c.id),
    [conversations],
  );
  const selectedIds = React.useMemo(
    () => allIds.filter((id) => selected[id]),
    [allIds, selected],
  );
  const allSelected = selectedIds.length === allIds.length && allIds.length > 0;
  const handleSelectAll = () => {
    const next: Record<string, boolean> = {};
    for (const id of allIds) next[id] = true;
    setSelected(next);
  };
  const handleClearAll = () => setSelected({});
  const handleBulkDelete = () => {
    for (const id of selectedIds) deleteSession(id);
    setSelected({});
    setBulkMode(false);
  };
  return (
    <div className="chat-sidebar h-full min-h-0 flex flex-col">
      <div
        className="chat-sidebar__header flex items-center justify-between px-3 py-2 border-b cursor-move"
        style={{ borderColor: 'var(--ai-border)' }}
        data-rf-drag-handle=""
      >
        <div
          className="text-sm font-medium"
          style={{ color: 'var(--ai-primary)' }}
        >
          宜宾数字烟田地图
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
            style={{
              borderColor: 'var(--ai-border)',
              color: 'var(--ai-primary)',
            }}
            onClick={() => setBulkMode((v) => !v)}
            title="选择/批量删除"
          >
            {bulkMode ? '退出选择' : '选择'}
          </button>
          <button
            className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
            style={{
              borderColor: 'var(--ai-border)',
              color: 'var(--ai-primary)',
            }}
            onClick={onToggleCollapse}
          >
            折叠
          </button>
        </div>
      </div>
      <div
        className="chat-sidebar__actions px-3 py-2 border-b"
        style={{ borderColor: 'var(--ai-border)' }}
      >
        <button
          className="text-xs px-2 py-1 rounded-md bg-transparent border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
          style={{ borderColor: 'var(--ai-border)' }}
          onClick={onNewConversation}
        >
          新对话
        </button>
        {bulkMode && (
          <div className="mt-2 flex items-center gap-2">
            <button
              className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
              style={{ borderColor: 'var(--ai-border)' }}
              onClick={handleSelectAll}
            >
              全选
            </button>
            <button
              className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
              style={{ borderColor: 'var(--ai-border)' }}
              onClick={handleClearAll}
            >
              取消
            </button>
            <button
              className="text-xs px-2 py-1 rounded-md border transition-colors hover:bg-white/80 dark:hover:bg-neutral-800"
              style={{ borderColor: 'var(--ai-border)', color: '#ef4444' }}
              onClick={handleBulkDelete}
              disabled={!selectedIds.length}
              title="批量删除"
            >
              批量删除
            </button>
          </div>
        )}
      </div>
      <div className="chat-sidebar__list flex-1 min-h-0 overflow-auto">
        <div className="px-3 py-2 text-xs opacity-70 flex items-center gap-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setBulkMode(true);
                handleSelectAll();
              } else {
                handleClearAll();
                setBulkMode(false);
              }
            }}
            title="全选/取消全选"
          />
          <span>历史对话</span>
        </div>
        <ul className="text-sm">
          {conversations.map((c) => (
            <li key={c.id}>
              <div
                className={[
                  'group w-full text-left px-3 py-2 rounded-md mx-2 mt-2 transition-colors cursor-pointer',
                  selectedConversationId === c.id
                    ? 'bg-white/80 dark:bg-neutral-900/60 shadow-sm'
                    : 'hover:bg-black/5 dark:hover:bg-white/5',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="flex items-center gap-2">
                  {bulkMode && (
                    <input
                      type="checkbox"
                      className="chat-session-checkbox"
                      checked={!!selected[c.id]}
                      onChange={() => toggleSelect(c.id)}
                    />
                  )}
                  <button
                    className="flex-1 text-left"
                    onClick={() =>
                      onSelectConversation && onSelectConversation(c.id)
                    }
                  >
                    <div className="truncate">{c.title}</div>
                    <div className="text-xs opacity-60">
                      {c.messageCount ?? 0} 条 ·{' '}
                      {c.updatedAt
                        ? new Date(c.updatedAt).toLocaleString()
                        : ''}
                    </div>
                  </button>
                  {!bulkMode && (
                    <div className="relative">
                      <button
                        className="h-7 w-7 inline-flex items-center justify-center rounded border transition-colors opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ borderColor: 'var(--ai-border)' }}
                        onClick={() =>
                          setMenuFor((v) => (v === c.id ? null : c.id))
                        }
                        title="更多操作"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                        >
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {menuFor === c.id && (
                        <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-md border bg-white/95 dark:bg-neutral-900/70 shadow-lg">
                          <button
                            className="w-full text-left px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                            onClick={() => {
                              const name =
                                window.prompt('重命名为：', c.title) || c.title;
                              renameSession(c.id, name);
                              setMenuFor(null);
                            }}
                          >
                            重命名
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                            onClick={() => {
                              deleteSession(c.id);
                              setMenuFor(null);
                            }}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
