/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */

export * from './lib/components/chat-window';
export * from './lib/components/message-list';
export * from './lib/components/chat-input';
export * from './lib/examples/Demo';
export * from './lib/theme';
export * from './lib/components/resizable-frame';
export * from './lib/hooks/use-socket-chat';
// Explicit exports to avoid Attachment conflict with shared
export {
  useChatStore,
  ensureDefaultSession,
  getActiveSessionId,
  listMessages,
  listSessions,
  createSession,
  setActiveSessionId,
  addMessage,
  updateMessage,
  removeMessage,
  stopMessageUpdates,
} from './lib/store/chat-store';
// Re-export shared types (Message, Adapters, etc.)
export * from '@txwx-monorepo/chat-contracts';
