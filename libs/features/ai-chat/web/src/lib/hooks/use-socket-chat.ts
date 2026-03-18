/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Message, ToolEvent } from '../../../../shared';

export type UseSocketChatOptions = {
  url?: string;
};

/**
 * useSocketChat
 * 基于 socket.io 的聊天 Hook，封装连接状态、消息/工具事件、以及上传与图层同步方法。
 * @param opts.url WebSocket 网关地址，默认 http://localhost:3000
 * @returns { status, messages, tools, send, join, uploadGeo, updateLayer }
 * - status: 连接状态（idle/connecting/open/closed）
 * - messages: 服务端返回的助手消息（包含流式合并结果）
 * - tools: 服务端广播的工具事件（例如 geojson 数据）
 * - send(payload): 发送对话文本
 * - join(conversationId): 加入会话房间
 * - uploadGeo(payload): 上传并广播 GeoJSON
 * - updateLayer(payload): 同步图层显隐状态
 */
export function useSocketChat(opts: UseSocketChatOptions = {}) {
  const { url = 'http://localhost:3000' } = opts;
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'open' | 'closed'
  >('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [error, setError] = useState<{ message?: string; id?: string } | null>(
    null,
  );
  const heartbeatRef = useRef<number | null>(null);
  const connectingTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    const s = io(url, { path: '/socket.io' });
    socketRef.current = s;
    connectingTimerRef.current = window.setTimeout(
      () => setStatus('connecting'),
      0,
    );
    s.on('connect', () => {
      setStatus('open');
      console.log('[ws-chat] connect', { url });
    });
    s.on('disconnect', () => {
      setStatus('closed');
      console.log('[ws-chat] disconnect');
    });
    s.on('hb', () => {
      setStatus('open');
    });
    heartbeatRef.current = window.setInterval(() => {
      s.emit('heartbeat', {});
    }, 10000);
    s.on('delta', (data: any) => {
      lastActivityRef.current = Date.now();
      console.log('[ws-chat] delta', {
        data: data,
        len: (data?.delta || '').length,
      });
      setIsStreaming(true);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === data.id);
        const content = (prev[idx]?.content ?? '') + (data.delta ?? '');
        const next: Message = { id: data.id, role: 'assistant', content };
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        }
        return [...prev, next];
      });
    });
    s.on('final', (data: any) => {
      lastActivityRef.current = Date.now();
      console.log('[ws-chat] final', { id: data?.id });
      setIsStreaming(false);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === data.id);
        const next: Message = {
          id: data.id,
          role: 'assistant',
          content: data.content,
        };
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        }
        return [...prev, next];
      });
    });
    s.on('tool', (data: any) => {
      if (!data || !data.id) return;
      lastActivityRef.current = Date.now();
      console.log('[ws-chat] tool', { id: data.id, type: data.type });
      const evt: ToolEvent = {
        id: data.id,
        type: data.type,
        data: data.data,
        schema: data.schema,
        plan: data.plan,
        conversationId: data.conversationId,
      };
      setTools((prev) => [...prev, evt]);
    });
    s.on('uploaded', (data: any) => {
      console.log('[ws-chat] uploaded', { ack: data });
    });
    s.on('error', (data: any) => {
      console.log('[ws-chat] error', data);
      setIsStreaming(false);
      setError({ message: data?.message || '请求错误', id: data?.id });
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }
    };
  }, [url]);

  /**
   * 发送聊天文本
   * @param payload.conversationId 可选，会话ID（推荐统一为 'global'）
   * @param payload.text 文本内容
   */
  const send = (payload: { conversationId?: string; text: string }) => {
    const s = socketRef.current;
    if (!s) return;
    console.log('[ws-chat] send', payload);
    setIsStreaming(true);
    s.emit('send', payload);
    const start = Date.now();
    window.setTimeout(() => {
      if (lastActivityRef.current < start) {
        console.log('[ws-chat] no-activity-after-send', {
          sinceMs: Date.now() - start,
          payload,
        });
      }
    }, 8000);
  };

  /**
   * 加入会话房间
   * @param conversationId 会话ID
   */
  const join = (conversationId: string) => {
    const s = socketRef.current;
    if (!s || !conversationId) return;
    console.log('[ws-chat] join', { conversationId });
    s.emit('join', { conversationId });
  };

  /**
   * 上传 GeoJSON 数据
   * @param payload.conversationId 可选，会话ID
   * @param payload.name 可选，文件名或图层名
   * @param payload.data GeoJSON 对象（Feature/FeatureCollection）
   */
  const uploadGeo = (payload: {
    conversationId?: string;
    name?: string;
    data: any;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    if (
      !payload?.data ||
      !['Feature', 'FeatureCollection'].includes(payload.data?.type)
    ) {
      return;
    }
    console.log('[ws-chat] uploadGeo', { name: payload?.name });
    s.emit('uploadGeo', payload, (ack: any) => {
      console.log('[ws-chat] uploadGeo-ack', ack);
    });
  };

  /**
   * 同步图层显隐状态
   * @param payload.conversationId 可选，会话ID
   * @param payload.layerId 图层唯一ID（通常为消息/工具事件 id）
   * @param payload.name 可选，图层名
   * @param payload.visible 显示(true)/隐藏(false)
   */
  const updateLayer = (payload: {
    conversationId?: string;
    layerId: string;
    name?: string;
    visible: boolean;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    console.log('[ws-chat] layer', {
      layerId: payload.layerId,
      visible: payload.visible,
    });
    s.emit('layer', payload);
  };

  /**
   * 回执 UI 动作执行结果
   * @param payload.conversationId 可选，会话ID
   * @param payload.actionId 动作ID
   * @param payload.status 执行状态
   * @param payload.message 可选，错误或提示信息
   */
  const uiActionAck = (payload: {
    conversationId?: string;
    actionId: string;
    status: 'applied' | 'failed';
    message?: string;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    console.log('[ws-chat] uiActionAck', {
      actionId: payload.actionId,
      status: payload.status,
    });
    s.emit('uiActionAck', payload);
  };

  const planAck = (payload: {
    conversationId?: string;
    planId: string;
    status: 'confirmed' | 'rejected';
    inputs?: any;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    console.log('[ws-chat] planAck', {
      planId: payload.planId,
      status: payload.status,
    });
    s.emit('planAck', payload);
  };

  return useMemo(
    () => ({
      status,
      messages,
      tools,
      isStreaming,
      error,
      send,
      join,
      uploadGeo,
      updateLayer,
      uiActionAck,
      planAck,
    }),
    [status, messages, tools, isStreaming, error],
  );
}
