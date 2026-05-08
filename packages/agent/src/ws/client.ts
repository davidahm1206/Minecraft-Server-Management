import WebSocket from 'ws';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { MessageHandler } from './handler.js';
import {
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  HEARTBEAT_INTERVAL_MS,
} from '@mcpanel/shared';
import type { WSMessage } from '@mcpanel/shared';

export class AgentWSClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = WS_RECONNECT_BASE_MS;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isDestroyed = false;
  private handler: MessageHandler;

  constructor(handler: MessageHandler) {
    this.handler = handler;
  }

  connect(): void {
    if (this.isDestroyed) return;

    const url = `${config.WORKER_WS_URL}?role=agent&serverId=default`;

    logger.info(`Connecting to ${config.WORKER_WS_URL}...`);

    this.ws = new WebSocket(url, {
      headers: {
        'x-agent-token': config.AGENT_TOKEN,
      },
      handshakeTimeout: 10_000,
    });

    this.ws.on('open', () => {
      logger.info('✓ Connected to Cloudflare Worker');
      this.reconnectDelay = WS_RECONNECT_BASE_MS;
      this.startHeartbeat();

      // Notify that agent is connected
      this.send({
        type: 'agent:connected',
        payload: {},
        timestamp: Date.now(),
      });
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as WSMessage;
        this.handler.dispatch(msg, this);
      } catch (err) {
        logger.error({ err }, 'Failed to parse incoming message');
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.warn(`WebSocket closed: ${code} ${reason.toString()}`);
      this.cleanup();
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ err }, 'WebSocket error');
      this.cleanup();
      this.scheduleReconnect();
    });

    this.ws.on('ping', () => {
      this.ws?.pong();
    });
  }

  send(msg: WSMessage | object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      logger.warn('Attempted to send message while disconnected');
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.ws?.close(1000, 'Agent shutting down');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    logger.info(`Reconnecting in ${this.reconnectDelay}ms...`);
    setTimeout(() => this.connect(), this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, WS_RECONNECT_MAX_MS);
  }
}
