import pidusage from 'pidusage';
import os from 'os';
import { MinecraftProcess } from '../minecraft/process.js';
import { LogParser } from '../minecraft/log-parser.js';
import { logger } from '../utils/logger.js';
import type { ServerMetrics } from '@mcpanel/shared';

export class MetricsCollector {
  private mcProcess: MinecraftProcess;
  private logParser: LogParser;
  private onlinePlayers: Set<string> = new Set();
  private maxPlayers = 20;

  constructor(mcProcess: MinecraftProcess, logParser: LogParser) {
    this.mcProcess = mcProcess;
    this.logParser = logParser;
  }

  addPlayer(name: string): void {
    this.onlinePlayers.add(name);
  }

  removePlayer(name: string): void {
    this.onlinePlayers.delete(name);
  }

  clearPlayers(): void {
    this.onlinePlayers.clear();
  }

  setMaxPlayers(max: number): void {
    this.maxPlayers = max;
  }

  async collect(): Promise<ServerMetrics> {
    const pid = this.mcProcess.pid;

    let cpuPercent = 0;
    let ramUsageMb = 0;

    if (pid && this.mcProcess.isRunning) {
      try {
        const stats = await pidusage(pid);
        cpuPercent = Math.round(stats.cpu * 100) / 100;
        ramUsageMb = Math.round(stats.memory / (1024 * 1024));
      } catch (err) {
        logger.debug({ err }, 'Failed to get process stats');
      }
    }

    const totalRamMb = Math.round(os.totalmem() / (1024 * 1024));

    return {
      cpuPercent,
      ramUsageMb,
      ramTotalMb: totalRamMb,
      tps: this.logParser.lastTps,
      onlinePlayers: [...this.onlinePlayers],
      playerCount: this.onlinePlayers.size,
      maxPlayers: this.maxPlayers,
      uptime: this.mcProcess.uptime,
    };
  }
}
