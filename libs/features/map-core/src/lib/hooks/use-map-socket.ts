/**
 * Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
 * This project is licensed under the MIT License - see the LICENSE file in the project root for details.
 */


import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ToolEvent = {
  id: string;
  type: string;
  data?: unknown;
  schema?: unknown;
  plan?: unknown;
  conversationId?: string;
};

export function useMapSocket({ url }: { url: string }) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<'open' | 'closed' | 'connecting'>('closed');
  const [tools, setTools] = useState<ToolEvent[]>([]);

  useEffect(() => {
    const s = io(url, { path: '/socket.io' });
    socketRef.current = s;
    setStatus('connecting');
    s.on('connect', () => setStatus('open'));
    s.on('disconnect', () => setStatus('closed'));
    s.on('tool', (data: unknown) => {
      const d = data as { id: string; type: string; data?: unknown; schema?: unknown; plan?: unknown; conversationId?: string };
      if (!d || !d.id) return;
      const evt: ToolEvent = {
        id: d.id,
        type: d.type,
        data: d.data,
        schema: d.schema,
        plan: d.plan,
        conversationId: d.conversationId,
      };
      setTools((prev) => [...prev, evt]);
    });
    s.on('error', (data: unknown) => {
      // noop: Map-only hook keeps minimal error handling
      console.log('[map-socket] error', data);
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [url]);

  const join = (conversationId: string) => {
    const s = socketRef.current;
    if (!s || !conversationId) return;
    s.emit('join', { conversationId });
  };

  const updateLayer = (payload: {
    conversationId?: string;
    layerId: string;
    name?: string;
    visible: boolean;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    s.emit('layer', payload);
  };

  const uiActionAck = (payload: {
    conversationId?: string;
    actionId: string;
    status: 'applied' | 'failed';
    message?: string;
  }) => {
    const s = socketRef.current;
    if (!s) return;
    s.emit('uiActionAck', payload);
  };

  return useMemo(
    () => ({
      status,
      tools,
      join,
      updateLayer,
      uiActionAck,
    }),
    [status, tools],
  );
}
