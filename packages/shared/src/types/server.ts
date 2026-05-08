// ─── Server Types ───

export type ServerStatus = 'online' | 'offline' | 'starting' | 'stopping' | 'crashed';

export interface ServerInfo {
  id: string;
  name: string;
  status: ServerStatus;
  forgeVersion: string;
  mcVersion: string;
  lastSeenAt: string | null;
}

export interface ServerMetrics {
  cpuPercent: number;
  ramUsageMb: number;
  ramTotalMb: number;
  tps: number;
  onlinePlayers: string[];
  playerCount: number;
  maxPlayers: number;
  uptime: number; // seconds
}

export interface PlayerEvent {
  name: string;
  uuid?: string;
  action: 'join' | 'leave';
  timestamp: number;
}
