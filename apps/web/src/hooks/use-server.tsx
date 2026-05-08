'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from './use-websocket';
import type { ServerMetrics, ServerStatus, ServerLogPayload } from '@mcpanel/shared';

interface ServerState {
  status: ServerStatus;
  metrics: ServerMetrics;
  logs: ServerLogPayload[];
  agentConnected: boolean;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
  send: (msg: object) => void;
  on: (type: string, cb: (msg: any) => void) => () => void;
}

const defaultMetrics: ServerMetrics = {
  cpuPercent: 0, ramUsageMb: 0, ramTotalMb: 0, tps: 20,
  onlinePlayers: [], playerCount: 0, maxPlayers: 20, uptime: 0,
};

const ServerContext = createContext<ServerState | null>(null);

export function ServerProvider({ children }: { children: ReactNode }) {
  const { status: wsStatus, send, on } = useWebSocket();
  const [serverStatus, setServerStatus] = useState<ServerStatus>('offline');
  const [metrics, setMetrics] = useState<ServerMetrics>(defaultMetrics);
  const [logs, setLogs] = useState<ServerLogPayload[]>([]);
  const [agentConnected, setAgentConnected] = useState(false);

  useEffect(() => {
    const unsubs = [
      on('server:status', (msg) => {
        setServerStatus(msg.payload.status);
        if (msg.payload.uptime) setMetrics((m) => ({ ...m, uptime: msg.payload.uptime }));
      }),
      on('metrics:update', (msg) => setMetrics(msg.payload)),
      on('server:log', (msg) => {
        setLogs((prev) => {
          const next = [...prev, msg.payload];
          return next.length > 5000 ? next.slice(-5000) : next;
        });
      }),
      on('agent:connected', () => setAgentConnected(true)),
      on('agent:disconnected', () => { setAgentConnected(false); setServerStatus('offline'); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  return (
    <ServerContext.Provider value={{
      status: serverStatus, metrics, logs, agentConnected, wsStatus, send, on,
    }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used within ServerProvider');
  return ctx;
}
