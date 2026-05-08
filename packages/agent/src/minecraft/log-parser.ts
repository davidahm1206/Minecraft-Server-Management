import { watch } from 'chokidar';
import { createReadStream, statSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ServerLogPayload, LogLevel } from '@mcpanel/shared';

type LogCallback = (log: ServerLogPayload) => void;
type PlayerCallback = (name: string, action: 'join' | 'leave') => void;
type CrashCallback = (report: string) => void;

// ─── Log Parsing Regexes ───
// Fabric / vanilla 1.21.x log format:
//   [HH:MM:SS] [Thread/LEVEL]: message
// Examples:
//   [12:34:56] [Server thread/INFO]: Done (5.123s)!
//   [12:34:56] [Server thread/WARN]: ...
//   [12:34:56] [Netty Epoll Server IO #1/ERROR]: ...
const LOG_LEVEL_REGEX = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[([^\]]+)\/(INFO|WARN|ERROR|DEBUG)\]:\s*(.*)/;

// Player join/leave — identical in Fabric and vanilla
const PLAYER_JOIN_REGEX = /(\w+)\s+joined the game/;
const PLAYER_LEAVE_REGEX = /(\w+)\s+left the game/;

// Server ready — same in Fabric as vanilla
const DONE_REGEX = /Done \([\d.]+s\)!/;

// TPS detection:
// Fabric doesn't expose tick time in the log by default.
// However, Carpet mod (common on Fabric) logs:
//   [Server thread/INFO]: TPS from last 100 ticks: 20.0
// And MSPT can be obtained from /tick warp output.
// We also capture the vanilla debug.txt format as a fallback.
const CARPET_TPS_REGEX = /TPS from last \d+ ticks:\s*([\d.]+)/;
const MSPT_REGEX = /Mean tick time:\s*([\d.]+)\s*ms/;

// Fabric-specific: mod loading complete
const FABRIC_MODS_LOADED_REGEX = /Loading \d+ mods:/;

// Server overloaded — Fabric still emits this vanilla warning
const OVERLOADED_REGEX = /Can't keep up! Is the server overloaded\?.*running ([\d]+)ms behind/;

export class LogParser {
  private logPath: string;
  private watcher: ReturnType<typeof watch> | null = null;
  private crashWatcher: ReturnType<typeof watch> | null = null;
  private lastSize = 0;
  private onLog: LogCallback | null = null;
  private onPlayer: PlayerCallback | null = null;
  private onCrash: CrashCallback | null = null;
  private onServerReady: (() => void) | null = null;
  private _lastTps = 20.0;
  private _lastMspt = 50.0;
  private _overloadedMs = 0;

  constructor() {
    this.logPath = path.join(config.MC_SERVER_DIR, 'logs', 'latest.log');
  }

  get lastTps(): number { return this._lastTps; }
  get lastMspt(): number { return this._lastMspt; }

  setCallbacks(opts: {
    onLog?: LogCallback;
    onPlayer?: PlayerCallback;
    onCrash?: CrashCallback;
    onServerReady?: () => void;
  }): void {
    this.onLog = opts.onLog ?? null;
    this.onPlayer = opts.onPlayer ?? null;
    this.onCrash = opts.onCrash ?? null;
    this.onServerReady = opts.onServerReady ?? null;
  }

  start(): void {
    if (existsSync(this.logPath)) {
      this.lastSize = statSync(this.logPath).size;
    }

    this.watcher = watch(this.logPath, {
      persistent: true,
      usePolling: true,
      interval: 500,
    });

    this.watcher.on('change', () => this.readNewLines());
    this.watcher.on('add', () => {
      this.lastSize = 0;
      this.readNewLines();
    });

    // Watch crash-reports directory (same structure in Fabric)
    const crashDir = path.join(config.MC_SERVER_DIR, 'crash-reports');
    this.crashWatcher = watch(crashDir, { persistent: true, ignoreInitial: true });
    this.crashWatcher.on('add', (filePath) => this.handleCrashReport(filePath));

    logger.info('Fabric log parser started');
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    this.crashWatcher?.close();
    this.crashWatcher = null;
  }

  private readNewLines(): void {
    if (!existsSync(this.logPath)) return;

    const currentSize = statSync(this.logPath).size;
    if (currentSize <= this.lastSize) {
      if (currentSize < this.lastSize) this.lastSize = 0; // truncated (server restart)
      return;
    }

    const stream = createReadStream(this.logPath, {
      start: this.lastSize,
      encoding: 'utf-8',
    });

    const rl = createInterface({ input: stream });
    rl.on('line', (line) => this.parseLine(line));
    rl.on('close', () => { this.lastSize = currentSize; });
  }

  private parseLine(line: string): void {
    if (!line.trim()) return;

    // Parse Fabric/vanilla log format
    let level: LogLevel = 'UNKNOWN';
    let timestamp = '';
    const levelMatch = line.match(LOG_LEVEL_REGEX);
    if (levelMatch) {
      timestamp = levelMatch[1];
      level = levelMatch[3] as LogLevel;
    }

    // Emit raw log
    this.onLog?.({ line, level, timestamp: timestamp || new Date().toISOString() });

    // ─── Player events ───
    const joinMatch = line.match(PLAYER_JOIN_REGEX);
    if (joinMatch) this.onPlayer?.(joinMatch[1], 'join');

    const leaveMatch = line.match(PLAYER_LEAVE_REGEX);
    if (leaveMatch) this.onPlayer?.(leaveMatch[1], 'leave');

    // ─── TPS detection (Fabric Carpet mod or vanilla debug) ───
    const carpetTps = line.match(CARPET_TPS_REGEX);
    if (carpetTps) {
      this._lastTps = Math.min(20, parseFloat(carpetTps[1]));
      this._lastMspt = parseFloat((1000 / this._lastTps).toFixed(2));
    }

    const msptMatch = line.match(MSPT_REGEX);
    if (msptMatch) {
      const meanMs = parseFloat(msptMatch[1]);
      this._lastMspt = meanMs;
      this._lastTps = Math.min(20, parseFloat((1000 / meanMs).toFixed(2)));
    }

    // ─── Overload detection → degrade TPS estimate ───
    const overloadMatch = line.match(OVERLOADED_REGEX);
    if (overloadMatch) {
      this._overloadedMs = parseInt(overloadMatch[1], 10);
      // Estimate degraded TPS from overload lag
      const tickMs = 50 + this._overloadedMs;
      this._lastTps = Math.min(20, parseFloat((1000 / tickMs).toFixed(2)));
      this._lastMspt = tickMs;
    }

    // ─── Server ready ───
    if (DONE_REGEX.test(line)) {
      this._lastTps = 20.0;
      this._lastMspt = 50.0;
      this.onServerReady?.();
    }
  }

  private async handleCrashReport(filePath: string): Promise<void> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');
      logger.error({ filePath }, 'Crash report detected!');
      this.onCrash?.(content);
    } catch (err) {
      logger.error({ err }, 'Failed to read crash report');
    }
  }
}
