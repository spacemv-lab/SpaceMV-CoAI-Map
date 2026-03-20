/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


export type Role = 'user' | 'assistant' | 'system';
export type Attachment = {
  id: string;
  name: string;
  type: string;
  size?: number;
  url?: string;
};
export type MessageStatus = 'pending' | 'complete' | 'error';
export type Message = {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  status?: MessageStatus;
};
export type Conversation = {
  id: string;
  title: string;
  updatedAt?: number;
  messageCount?: number;
};
export type StreamHandlers = {
  onDelta?: (chunk: string) => void;
  onComplete?: (final: string) => void;
  onError?: (error: unknown) => void;
};
export type ChatSendInput = {
  conversationId: string;
  text: string;
  signal?: AbortSignal;
  stream?: StreamHandlers;
};
export type ChatRefreshInput = {
  messageId: string;
  stream?: StreamHandlers;
};
export type ChatDeleteInput = {
  messageId: string;
};
export type FilesUploadInput = {
  conversationId: string;
  files: File[];
};
export type VoiceStartInput = {
  conversationId: string;
};
export type VoiceStopInput = {
  conversationId: string;
};
export type ChatAdapters = {
  send: (input: ChatSendInput) => Promise<Message | void>;
  refresh: (input: ChatRefreshInput) => Promise<Message | void>;
  delete: (input: ChatDeleteInput) => Promise<void>;
};
export type FilesAdapters = {
  upload: (input: FilesUploadInput) => Promise<Attachment[]>;
};
export type VoiceAdapters = {
  start: (input: VoiceStartInput) => Promise<void>;
  stop: (input: VoiceStopInput) => Promise<void>;
};
export type Adapters = {
  chat?: ChatAdapters;
  files?: FilesAdapters;
  voice?: VoiceAdapters;
};
export type ToolEventType = 'geo' | 'ui_action';
export type ToolEvent = {
  id: string;
  type: ToolEventType;
  data?: any;
  schema?: any;
  plan?: any;
  conversationId?: string;
};
export type DeltaPayload = {
  id: string;
  conversationId?: string;
  role: 'assistant';
  delta: string;
};
export type FinalPayload = {
  id: string;
  conversationId?: string;
  role: 'assistant';
  content: string;
};
export type ErrorPayload = {
  id: string;
  conversationId?: string;
  code: string;
  message?: string;
};
