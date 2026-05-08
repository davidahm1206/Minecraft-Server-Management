'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSMessage } from '@mcpanel/shared';

type WSStatus = 'connecting' | 'connected' | 'disconnected';
type MessageCallback = (msg: WSMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const listenersRef = useRef<Map<string, Set<MessageCallback>>>(new Map());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8787/ws';
    const url = `${wsUrl}?token=${token}&role=browser&serverId=default`;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        const callbacks = listenersRef.current.get(msg.type);
        if (callbacks) callbacks.forEach((cb) => cb(msg));
        // Also fire wildcard listeners
        const wildcards = listenersRef.current.get('*');
        if (wildcards) wildcards.forEach((cb) => cb(msg));
      } catch {}
    };

    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: WSMessage | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const on = useCallback((type: string, callback: MessageCallback) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(callback);
    return () => { listenersRef.current.get(type)?.delete(callback); };
  }, []);

  return { status, send, on };
}
