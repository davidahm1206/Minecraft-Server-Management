import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

interface ConnectionAttachment {
  role: 'agent' | 'browser';
  connectedAt: number;
  userId?: string;
}

export class AgentSession extends DurableObject<Env> {
  private agentWs: WebSocket | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle REST forwarding from API routes
    if (url.pathname === '/forward' && request.method === 'POST') {
      const body = await request.text();
      if (this.agentWs) {
        try {
          this.agentWs.send(body);
          return new Response('OK', { status: 200 });
        } catch {
          return new Response('Agent disconnected', { status: 502 });
        }
      }
      return new Response('Agent not connected', { status: 502 });
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      const sockets = this.ctx.getWebSockets();
      const connected = [];
      for (const ws of sockets) {
        const att = ws.deserializeAttachment() as ConnectionAttachment;
        connected.push({ role: att?.role, connectedAt: att?.connectedAt });
      }
      return new Response(JSON.stringify({
        agentConnected: !!this.agentWs,
        totalSockets: sockets.length,
        sockets: connected,
        envToken: this.env.AGENT_TOKEN
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const role = url.searchParams.get('role') as 'agent' | 'browser';

    if (!role || !['agent', 'browser'].includes(role)) {
      return new Response('Invalid role', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const attachment: ConnectionAttachment = {
      role,
      connectedAt: Date.now(),
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    if (role === 'agent') {
      // Close previous agent connection if exists
      if (this.agentWs) {
        try { this.agentWs.close(1000, 'Replaced by new agent connection'); } catch {}
      }
      this.agentWs = server;
      this.broadcast({
        type: 'agent:connected',
        payload: {},
        timestamp: Date.now(),
      });
    } else if (role === 'browser' && this.agentWs) {
      // If a browser connects and the agent is already online, tell the browser immediately!
      try {
        server.send(JSON.stringify({
          type: 'agent:connected',
          payload: {},
          timestamp: Date.now(),
        }));
      } catch {}
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment;
    const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message);

    let parsed: any;
    try {
      parsed = JSON.parse(msgStr);
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid JSON' },
        timestamp: Date.now(),
      }));
      return;
    }

    if (attachment.role === 'browser') {
      // Forward browser commands to agent
      if (this.agentWs) {
        try {
          this.agentWs.send(msgStr);
        } catch {
          ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Agent not connected' },
            timestamp: Date.now(),
          }));
        }
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Agent not connected' },
          timestamp: Date.now(),
        }));
      }
    } else if (attachment.role === 'agent') {
      // Broadcast agent messages to all browser connections
      this.broadcast(parsed);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment;

    if (attachment.role === 'agent') {
      this.agentWs = null;
      this.broadcast({
        type: 'agent:disconnected',
        payload: {},
        timestamp: Date.now(),
      });
    }

    try { ws.close(code, reason); } catch {}
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment;
    console.error(`WebSocket error for ${attachment.role}:`, error);

    if (attachment.role === 'agent') {
      this.agentWs = null;
      this.broadcast({
        type: 'agent:disconnected',
        payload: {},
        timestamp: Date.now(),
      });
    }
  }

  private broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    const sockets = this.ctx.getWebSockets();

    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as ConnectionAttachment;
      if (attachment.role === 'browser') {
        try {
          ws.send(data);
        } catch {
          // Socket is dead, runtime will clean it up
        }
      }
    }
  }
}
