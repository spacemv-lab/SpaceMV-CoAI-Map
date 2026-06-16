/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

import { useEffect, useMemo, useCallback } from 'react';
import {
  useChatStore,
  ensureDefaultSession,
  getActiveSessionId,
  listMessages,
  addMessage,
  updateMessage,
} from '@/features/ai-chat';
import { MessageList, ChatInput, useSocketChat } from '@/features/ai-chat';
import type { Message, Adapters, ChatSendInput } from '@/features/ai-chat';

const API_BASE = '';

export function AiTabContent() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const messages = useChatStore((s) =>
    s.activeSessionId ? listMessages(s.activeSessionId) : []
  );

  useEffect(() => {
    ensureDefaultSession();
  }, []);

  const chatWs = useSocketChat({ url: API_BASE });

  const sendChat = useCallback(
    async ({ conversationId, text }: ChatSendInput): Promise<Message | void> => {
      const sid = conversationId || getActiveSessionId() || 'global';
      const id = crypto.randomUUID();
      addMessage({ id, sessionId: sid, role: 'user', content: text });
      chatWs.send({ conversationId: 'global', text });
      const pid = 'assistant-' + crypto.randomUUID();
      addMessage({
        id: pid,
        sessionId: sid,
        role: 'assistant',
        content: '',
        status: 'streaming',
      });
      return { id: 'pending', role: 'assistant', content: '' };
    },
    [chatWs]
  );

  const adapters = useMemo<Adapters>(
    () => ({
      chat: {
        send: sendChat,
        refresh: async () => {},
        delete: async ({ messageId }: { messageId: string }) => {
          const sid = getActiveSessionId();
          if (!sid) return;
        },
      },
      files: { upload: async () => [] },
      voice: { start: async () => {}, stop: async () => {} },
    }),
    [sendChat]
  );

  // Merge assistant messages from WS
  useEffect(() => {
    if (!chatWs.messages.length) return;
    const sid = getActiveSessionId() || 'global';
    const existing = listMessages(sid);
    for (const m of chatWs.messages) {
      const found = existing.find((x) => x.id === m.id);
      if (!found) {
        addMessage({
          id: m.id,
          sessionId: sid,
          role: m.role,
          content: m.content ?? '',
        });
      } else {
        updateMessage(m.id, sid, { role: m.role, content: m.content });
      }
    }
  }, [chatWs.messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection status */}
      <div className="px-3 py-1.5 border-b text-xs flex items-center justify-between">
        <span className="text-gray-500">AI 助手</span>
        <span
          className={`px-2 py-0.5 rounded ${
            chatWs.status === 'open'
              ? 'text-green-600 bg-green-50'
              : chatWs.status === 'connecting'
                ? 'text-yellow-600 bg-yellow-50'
                : 'text-red-600 bg-red-50'
          }`}
        >
          {chatWs.status === 'open' ? '已连接' : chatWs.status === 'connecting' ? '连接中' : '离线'}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <MessageList
          messages={messages as Message[]}
          onCopyMessage={(id) =>
            navigator.clipboard.writeText(
              (messages as Message[]).find((m) => m.id === id)?.content ?? ''
            )
          }
        />
      </div>

      {/* Input */}
      <div className="border-t">
        <ChatInput
          onSend={(text) =>
            adapters.chat?.send({
              conversationId: activeSessionId || 'global',
              text,
            })
          }
          isStreaming={chatWs.isStreaming}
          placeholder="输入指令或问题..."
        />
      </div>
    </div>
  );
}