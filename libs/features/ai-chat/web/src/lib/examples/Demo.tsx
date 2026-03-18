/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import React, { useMemo, useCallback } from 'react';
import { AiTheme } from '../theme';
import {
  Message,
  Conversation,
  Adapters,
  Attachment,
  ChatSendInput,
} from '../../../../shared';
import { ChatWindow } from '../components/chat-window';
import { ResizableFrame } from '../components/resizable-frame';
import { MessageList } from '../components/message-list';
import { ChatInput } from '../components/chat-input';
import { useSocketChat } from '../hooks/use-socket-chat';
import { ToolPanel } from '../components/tool-panel';
import {
  useChatStore,
  ensureDefaultSession,
  listSessions,
  listMessages,
  createSession,
  setActiveSessionId,
  getActiveSessionId,
  addMessage,
  updateMessage,
  removeMessage,
  stopMessageUpdates,
} from '../store/chat-store';

export type DemoProps = { url?: string; embedded?: boolean };
export function Demo(props: DemoProps) {
  const chatWs = useSocketChat({ url: props.url ?? 'http://localhost:3000' });
  ensureDefaultSession();
  const activeId =
    useChatStore((s) => s.activeSessionId) || getActiveSessionId();
  const sessions = useChatStore(() => listSessions());
  const messages = useChatStore((s) =>
    s.activeSessionId ? listMessages(s.activeSessionId) : [],
  );
  const pendingAssistantIdRef = React.useRef<string | null>(null);
  const lastUserTextRef = React.useRef<string>('');
  const [presetText, setPresetText] = React.useState<string>('');

  const sendChat = useCallback(
    async ({
      conversationId,
      text,
    }: ChatSendInput): Promise<Message | void> => {
      const sid = conversationId || getActiveSessionId() || 'global';
      const id = crypto.randomUUID();
      lastUserTextRef.current = text;
      addMessage({ id, sessionId: sid, role: 'user', content: text });
      chatWs.send({ conversationId: 'global', text });
      const pid = 'assistant-' + crypto.randomUUID();
      pendingAssistantIdRef.current = pid;
      addMessage({
        id: pid,
        sessionId: sid,
        role: 'assistant',
        content: '',
        status: 'streaming',
      });
      const pending: Message = {
        id: 'pending',
        role: 'assistant',
        content: '',
      };
      return pending;
    },
    [chatWs],
  );

  const refreshChat = useCallback(
    async ({ messageId }: { messageId: string }): Promise<Message | void> => {
      const sid = getActiveSessionId() || 'global';
      const list = listMessages(sid);
      const lastAssistant = [...list]
        .reverse()
        .find((m) => m.role === 'assistant');
      if (!lastAssistant) {
        const msg: Message = { id: messageId, role: 'assistant', content: '' };
        return msg;
      }
      const lastIdx = list.findIndex((m) => m.id === lastAssistant.id);
      let lastUserText = '';
      for (let i = lastIdx - 1; i >= 0; i--) {
        if (list[i].role === 'user') {
          lastUserText = list[i].content;
          break;
        }
      }
      removeMessage(lastAssistant.id, sid);
      if (lastUserText) {
        await sendChat({ conversationId: sid, text: lastUserText });
      }
      const msg: Message = { id: messageId, role: 'assistant', content: '' };
      return msg;
    },
    [sendChat],
  );

  const deleteChat = useCallback(
    async ({ messageId }: { messageId: string }) => {
      const sid = getActiveSessionId();
      if (!sid) return;
      removeMessage(messageId, sid);
    },
    [],
  );

  const uploadFiles = useCallback(
    async ({
      conversationId,
      files,
    }: {
      conversationId?: string;
      files: File[];
    }) => {
      chatWs.join('global');
      const attachments: Attachment[] = [];
      const sid = conversationId || getActiveSessionId() || 'global';
      for (const f of files) {
        const text = await f.text();
        try {
          const json = JSON.parse(text);
          chatWs.uploadGeo({
            conversationId: 'global',
            name: f.name,
            data: json,
          });
          attachments.push({
            id: crypto.randomUUID(),
            name: f.name,
            type: 'application/geo+json',
            size: f.size,
          });
          addMessage({
            id: crypto.randomUUID(),
            sessionId: sid,
            role: 'system',
            content: `已上传 ${f.name}`,
          });
        } catch {
          addMessage({
            id: crypto.randomUUID(),
            sessionId: sid,
            role: 'system',
            content: `文件解析失败：${f.name}`,
          });
        }
      }
      return attachments;
    },
    [chatWs],
  );

  const voiceStart = useCallback(
    async ({ conversationId }: { conversationId?: string }) => {
      const sid = conversationId || getActiveSessionId() || 'global';
      chatWs.join('global');
      const SR: any =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SR) {
        const recog = new SR();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'zh-CN';
        recog.onresult = (evt: any) => {
          const res = evt.results[evt.results.length - 1];
          if (res?.isFinal) {
            const text = res[0].transcript || '';
            addMessage({
              id: crypto.randomUUID(),
              sessionId: sid,
              role: 'user',
              content: text,
            });
          }
        };
        recog.start();
        (window as any).__ai_recog = recog;
      } else {
        addMessage({
          id: crypto.randomUUID(),
          sessionId: sid,
          role: 'system',
          content: '开始语音',
        });
      }
    },
    [chatWs],
  );

  const voiceStop = useCallback(
    async ({ conversationId }: { conversationId?: string }) => {
      const sid = conversationId || getActiveSessionId() || 'global';
      const recog = (window as any).__ai_recog;
      if (recog && typeof recog.stop === 'function') {
        try {
          recog.stop();
        } catch {
          console.log('recog.stop error');
        }
        (window as any).__ai_recog = null;
        addMessage({
          id: crypto.randomUUID(),
          sessionId: sid,
          role: 'system',
          content: '已停止语音',
        });
      } else {
        addMessage({
          id: crypto.randomUUID(),
          sessionId: sid,
          role: 'system',
          content: '结束语音',
        });
      }
    },
    [],
  );

  const adapters = useMemo<Adapters>(
    () => ({
      chat: {
        send: sendChat,
        refresh: refreshChat,
        delete: deleteChat,
      },
      files: {
        upload: uploadFiles,
      },
      voice: {
        start: voiceStart,
        stop: voiceStop,
      },
    }),
    [sendChat, refreshChat, deleteChat, uploadFiles, voiceStart, voiceStop],
  );

  // Merge assistant messages from WS into local list
  React.useEffect(() => {
    if (!chatWs.messages.length) return;
    const sid = getActiveSessionId() || 'global';
    const existing = listMessages(sid);
    const placeholder = [...existing]
      .reverse()
      .find((x) => x.role === 'assistant' && x.status === 'streaming');
    for (const m of chatWs.messages) {
      const found = existing.find((x) => x.id === m.id);
      if (placeholder && placeholder.id !== m.id) {
        removeMessage(placeholder.id, sid);
        pendingAssistantIdRef.current = null;
      }
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

  React.useEffect(() => {
    if (!chatWs.error) return;
    const sid = getActiveSessionId() || 'global';
    const lastAssistant = [...listMessages(sid)]
      .reverse()
      .find((m) => m.role === 'assistant');
    if (lastAssistant) {
      updateMessage(lastAssistant.id, sid, { status: 'error' });
    }
    setPresetText(lastUserTextRef.current || '');
  }, [chatWs.error]);

  React.useEffect(() => {
    chatWs.join('global');
  }, [activeId]);

  return (
    <AiTheme
      tokens={{
        bg: 'rgba(255,255,255,0.9)',
        panel: '#ffffff',
        border: '#e5e7eb',
        primary: '#2563eb',
      }}
    >
      <div className="demo w-full h-full app-gradient">
        {props.embedded ? (
          <div className="w-full h-full">
            <ChatWindow
              conversations={sessions.map<Conversation>((s) => ({
                id: s.id,
                title: s.title,
                updatedAt: s.updatedAt,
                messageCount: listMessages(s.id).length,
              }))}
              selectedConversationId={activeId || undefined}
              messages={messages as Message[]}
              title="AI 聊天"
              headerRight={
                <span
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--ai-border)' }}
                >
                  {chatWs.status === 'open'
                    ? '已连接'
                    : chatWs.status === 'connecting'
                      ? '连接中'
                      : '断开'}
                </span>
              }
              adapters={adapters}
              collapsibleBreakpoint={960}
              initialSidebarWidth={280}
              onNewConversation={() => {
                const ses = createSession('新会话');
                setActiveSessionId(ses.id);
              }}
              onSelectConversation={(id) => setActiveSessionId(id)}
              renderMessageList={(msgs) => (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0">
                    {chatWs.error?.message && (
                      <div className="chat-error-banner mx-4 my-2 px-3 py-2 rounded-md border text-xs text-red-600 bg-red-50 border-red-200">
                        {chatWs.error?.message}
                      </div>
                    )}
                    <MessageList
                      messages={msgs}
                      onCopyMessage={(id) =>
                        navigator.clipboard.writeText(
                          (messages as Message[]).find((m) => m.id === id)
                            ?.content ?? '',
                        )
                      }
                      onRefreshMessage={(id) =>
                        adapters.chat?.refresh({ messageId: id })
                      }
                      onDeleteMessage={(id) =>
                        adapters.chat?.delete({ messageId: id })
                      }
                    />
                  </div>
                  <ToolPanel
                    events={chatWs.tools}
                    onToggleLayer={(layerId, visible) =>
                      chatWs.updateLayer({
                        conversationId: activeId || 'global',
                        layerId,
                        visible,
                      })
                    }
                  />
                </div>
              )}
              renderChatInput={() => (
                <ChatInput
                  onSend={(text) =>
                    adapters.chat?.send({
                      conversationId: activeId || 'global',
                      text,
                    })
                  }
                  isStreaming={chatWs.isStreaming}
                  presetText={presetText}
                  onUploadFiles={(files) =>
                    adapters.files?.upload({
                      conversationId: activeId || 'global',
                      files,
                    })
                  }
                  onVoiceStart={() =>
                    adapters.voice?.start({
                      conversationId: activeId || 'global',
                    })
                  }
                  onVoiceStop={() =>
                    adapters.voice?.stop({
                      conversationId: activeId || 'global',
                    })
                  }
                  onStop={() => {
                    const sid = getActiveSessionId() || 'global';
                    const list = listMessages(sid);
                    const lastAssistant = [...list]
                      .reverse()
                      .find((m) => m.role === 'assistant');
                    if (lastAssistant) stopMessageUpdates(lastAssistant.id);
                  }}
                  onRegenerate={() => {
                    const sid = getActiveSessionId() || 'global';
                    const list = listMessages(sid);
                    const lastAssistant = [...list]
                      .reverse()
                      .find((m) => m.role === 'assistant');
                    if (lastAssistant)
                      adapters.chat?.refresh({ messageId: lastAssistant.id });
                  }}
                />
              )}
            />
          </div>
        ) : (
          <ResizableFrame
            initialWidth={800}
            initialHeight={600}
            initialLeft={0}
            initialTop={0}
            minWidth={480}
            minHeight={360}
          >
            <ChatWindow
              conversations={sessions.map<Conversation>((s) => ({
                id: s.id,
                title: s.title,
                updatedAt: s.updatedAt,
                messageCount: listMessages(s.id).length,
              }))}
              selectedConversationId={activeId || undefined}
              messages={messages as Message[]}
              title="AI 聊天"
              headerRight={
                <span
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: 'var(--ai-border)' }}
                >
                  {chatWs.status === 'open'
                    ? '已连接'
                    : chatWs.status === 'connecting'
                      ? '连接中'
                      : '断开'}
                </span>
              }
              adapters={adapters}
              collapsibleBreakpoint={960}
              initialSidebarWidth={280}
              onNewConversation={() => {
                const ses = createSession('新会话');
                setActiveSessionId(ses.id);
              }}
              onSelectConversation={(id) => setActiveSessionId(id)}
              renderMessageList={(msgs) => (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="flex-1 min-h-0">
                    {chatWs.error?.message && (
                      <div className="chat-error-banner mx-4 my-2 px-3 py-2 rounded-md border text-xs text-red-600 bg-red-50 border-red-200">
                        {chatWs.error?.message}
                      </div>
                    )}
                    <MessageList
                      messages={msgs}
                      onCopyMessage={(id) =>
                        navigator.clipboard.writeText(
                          (messages as Message[]).find((m) => m.id === id)
                            ?.content ?? '',
                        )
                      }
                      onRefreshMessage={(id) =>
                        adapters.chat?.refresh({ messageId: id })
                      }
                      onDeleteMessage={(id) =>
                        adapters.chat?.delete({ messageId: id })
                      }
                    />
                  </div>
                  <ToolPanel
                    events={chatWs.tools}
                    onToggleLayer={(layerId, visible) =>
                      chatWs.updateLayer({
                        conversationId: activeId || 'global',
                        layerId,
                        visible,
                      })
                    }
                  />
                </div>
              )}
              renderChatInput={() => (
                <ChatInput
                  onSend={(text) =>
                    adapters.chat?.send({
                      conversationId: activeId || 'global',
                      text,
                    })
                  }
                  isStreaming={chatWs.isStreaming}
                  presetText={presetText}
                  onUploadFiles={(files) =>
                    adapters.files?.upload({
                      conversationId: activeId || 'global',
                      files,
                    })
                  }
                  onVoiceStart={() =>
                    adapters.voice?.start({
                      conversationId: activeId || 'global',
                    })
                  }
                  onVoiceStop={() =>
                    adapters.voice?.stop({
                      conversationId: activeId || 'global',
                    })
                  }
                  onStop={() => {
                    const sid = getActiveSessionId() || 'global';
                    const list = listMessages(sid);
                    const lastAssistant = [...list]
                      .reverse()
                      .find((m) => m.role === 'assistant');
                    if (lastAssistant) stopMessageUpdates(lastAssistant.id);
                  }}
                  onRegenerate={() => {
                    const sid = getActiveSessionId() || 'global';
                    const list = listMessages(sid);
                    const lastAssistant = [...list]
                      .reverse()
                      .find((m) => m.role === 'assistant');
                    if (lastAssistant)
                      adapters.chat?.refresh({ messageId: lastAssistant.id });
                  }}
                />
              )}
            />
          </ResizableFrame>
        )}
      </div>
    </AiTheme>
  );
}
