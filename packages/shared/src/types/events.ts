// ─── WebSocket Event Types ───

import type { ServerMetrics, ServerStatus, PlayerEvent } from './server.js';
import type { ModInfo } from './mods.js';
import type { FileEntry, FileReadResponse } from './files.js';

// ─── Envelope ───
export interface WSMessage<T = unknown> {
  type: WSEventType;
  id?: string;        // Request ID for req/res correlation
  payload: T;
  timestamp: number;
}

// ─── All Event Types ───
export type WSEventType =
  // Browser → Agent (via Worker)
  | 'server:start'
  | 'server:stop'
  | 'server:restart'
  | 'server:command'
  | 'metrics:request'
  | 'mods:list'
  | 'mods:upload'
  | 'mods:delete'
  | 'mods:toggle'
  | 'files:list'
  | 'files:read'
  | 'files:write'
  | 'files:delete'
  | 'files:upload'
  | 'world:list'
  | 'world:delete'
  | 'world:regenerate'
  // Agent → Browser (via Worker)
  | 'server:status'
  | 'server:log'
  | 'server:crash'
  | 'metrics:update'
  | 'player:join'
  | 'player:leave'
  | 'mods:list:response'
  | 'files:list:response'
  | 'files:read:response'
  | 'world:list:response'
  | 'agent:connected'
  | 'agent:disconnected'
  | 'error'
  | 'success';

// ─── Payload Types ───
export interface ServerStartPayload {}
export interface ServerStopPayload { graceful: boolean; }
export interface ServerRestartPayload {}
export interface ServerCommandPayload { command: string; }

export interface ServerStatusPayload {
  status: ServerStatus;
  uptime: number;
}

export interface ServerLogPayload {
  line: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'UNKNOWN';
  timestamp: string;
}

export interface ServerCrashPayload {
  report: string;
  timestamp: string;
}

export interface MetricsUpdatePayload extends ServerMetrics {}

export interface ModsListResponsePayload { mods: ModInfo[]; }
export interface ModUploadPayload { filename: string; data: string; }
export interface ModDeletePayload { filename: string; }
export interface ModTogglePayload { filename: string; enabled: boolean; }

export interface FilesListPayload { path: string; }
export interface FilesListResponsePayload { path: string; entries: FileEntry[]; }
export interface FileReadPayload { path: string; }
export interface FileReadResponsePayload extends FileReadResponse {}
export interface FileWritePayload { path: string; content: string; }
export interface FileDeletePayload { path: string; }

export interface WorldDeletePayload { worldName: string; }
export interface WorldRegeneratePayload { seed?: string; }

export interface ErrorPayload { message: string; code?: string; }
export interface SuccessPayload { message: string; }

// ─── Helper to create messages ───
export function createWSMessage<T>(type: WSEventType, payload: T, id?: string): WSMessage<T> {
  return { type, payload, timestamp: Date.now(), id: id ?? crypto.randomUUID() };
}
