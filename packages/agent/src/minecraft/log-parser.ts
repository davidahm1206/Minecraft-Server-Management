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

const LOG_LEVEL_REGEX = /\[(\d{2}:\d{2}:\d{2})\]\s+\[([^\]]+)\/(INFO|WARN|ERROR|DEBUG)\]/;
const PLAYER_JOIN_REGEX = /(\w+)\s+joined the game/;
const PLAYER_LEAVE_REGEX = /(\w+)\s+left the game/;
const TPS_REGEX = /Dim\s+\d+.*?:\s+Mean tick time:\s+([\d.]+)\s+ms/;
const DONE_REGEX = /Done \([\d.]+s\)!/;

export class LogParser {
  private logPath: string;
  private watcher: ReturnType<typeof watch> | null = null;
  private lastSize = 0;
  private onLog: LogCallback | null = null;
  private onPlayer: PlayerCallback | null = null;
  private onCrash: CrashCallback | null = null;
  private onServerReady: (() => void) | null = null;
  private _lastTps = 20.0;

  constructor() {
    this.logPath = path.join(config.MC_SERVER_DIR, 'logs', 'latest.log');
  }

  get lastTps(): number {
    return this._lastTps;
  }

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
    // Initialize file position to end of current file
    if (existsSync(this.logPath)) {
      this.lastSize = statSync(this.logPath).size;
    }

    const logsDir = path.dirname(this.logPath);

    this.watcher = watch(this.logPath, {
      persistent: true,
      usePolling: true,
      interval: 500,
    });

    this.watcher.on('change', () => this.readNewLines());
    this.watcher.on('add', () => {
      this.lastSize = 0; // New file created, read from start
      this.readNewLines();
    });

    // Also watch crash-reports directory
    const crashDir = path.join(config.MC_SERVER_DIR, 'crash-reports');
    if (existsSync(crashDir)) {
      const crashWatcher = watch(crashDir, { persistent: true });
      crashWatcher.on('add', (filePath) => {
        this.handleCrashReport(filePath);
      });
    }

    logger.info('Log parser started');
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private readNewLines(): void {
    if (!existsSync(this.logPath)) return;

    const currentSize = statSync(this.logPath).size;
    if (currentSize <= this.lastSize) {
      // File was truncated (new server start), reset
      if (currentSize < this.lastSize) {
        this.lastSize = 0;
      }
      return;
    }

    const stream = createReadStream(this.logPath, {
      start: this.lastSize,
      encoding: 'utf-8',
    });

    const rl = createInterface({ input: stream });

    rl.on('line', (line) => {
      this.parseLine(line);
    });

    rl.on('close', () => {
      this.lastSize = currentSize;
    });
  }

  private parseLine(line: string): void {
    if (!line.trim()) return;

    // Detect log level
    let level: LogLevel = 'UNKNOWN';
    let timestamp = '';
    const levelMatch = line.match(LOG_LEVEL_REGEX);
    if (levelMatch) {
      timestamp = levelMatch[1];
      level = levelMatch[3] as LogLevel;
    }

    // Emit log
    this.onLog?.({
      line,
      level,
      timestamp: timestamp || new Date().toISOString(),
    });

    // Detect player events
    const joinMatch = line.match(PLAYER_JOIN_REGEX);
    if (joinMatch) {
      this.onPlayer?.(joinMatch[1], 'join');
    }

    const leaveMatch = line.match(PLAYER_LEAVE_REGEX);
    if (leaveMatch) {
      this.onPlayer?.(leaveMatch[1], 'leave');
    }

    // Detect TPS from debug output
    const tpsMatch = line.match(TPS_REGEX);
    if (tpsMatch) {
      const meanTickMs = parseFloat(tpsMatch[1]);
      this._lastTps = Math.min(20, 1000 / meanTickMs);
    }

    // Detect server ready
    if (DONE_REGEX.test(line)) {
      this.onServerReady?.();
    }
  }

  private async handleCrashReport(filePath: string): Promise<void> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');
      logger.error('Crash report detected!');
      this.onCrash?.(content);
    } catch (err) {
      logger.error({ err }, 'Failed to read crash report');
    }
  }
}
