import { spawn, ChildProcess } from 'child_process';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import { existsSync } from 'fs';

export class MinecraftProcess {
  private process: ChildProcess | null = null;
  private startedAt: number | null = null;
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning && this.process !== null && !this.process.killed;
  }

  get uptime(): number {
    if (!this.startedAt || !this.isRunning) return 0;
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  get pid(): number | null {
    return this.process?.pid ?? null;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    const jarPath = path.join(config.MC_SERVER_DIR, config.MC_JAR);
    if (!existsSync(jarPath)) {
      throw new Error(`Server JAR not found: ${jarPath}`);
    }

    const jvmArgs = config.MC_JVM_ARGS.split(' ').filter(Boolean);
    const args = [
      `-Xms${config.MC_MIN_RAM}`,
      `-Xmx${config.MC_MAX_RAM}`,
      ...jvmArgs,
      '-jar',
      config.MC_JAR,
      'nogui',
    ];

    logger.info({ args, cwd: config.MC_SERVER_DIR }, 'Starting Minecraft server');

    this.process = spawn(config.JAVA_PATH, args, {
      cwd: config.MC_SERVER_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    this._isRunning = true;
    this.startedAt = Date.now();

    this.process.stdout?.on('data', (data: Buffer) => {
      // Log output is handled by LogParser via file watching
      // But we capture stdout here for safety
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        logger.debug({ source: 'mc-stdout' }, line);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        logger.warn({ source: 'mc-stderr' }, line);
      }
    });

    this.process.on('exit', (code, signal) => {
      logger.info({ code, signal }, 'Minecraft server process exited');
      this._isRunning = false;
      this.process = null;
    });

    this.process.on('error', (err) => {
      logger.error({ err }, 'Minecraft server process error');
      this._isRunning = false;
      this.process = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      throw new Error('Server is not running');
    }

    logger.info('Stopping Minecraft server gracefully...');
    this.sendCommand('stop');

    // Wait up to 30 seconds for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('Graceful shutdown timed out, force killing...');
        this.kill();
        resolve();
      }, 30_000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async kill(): Promise<void> {
    if (!this.process) return;

    logger.warn('Force killing Minecraft server...');
    this.process.kill('SIGKILL');
    this._isRunning = false;
    this.process = null;
    this.startedAt = null;
  }

  sendCommand(command: string): void {
    if (!this.isRunning || !this.process?.stdin) {
      throw new Error('Server is not running');
    }
    this.process.stdin.write(command + '\n');
    logger.info({ command }, 'Sent command to server');
  }

  /**
   * Detect if a Minecraft server process is already running
   * by checking for java processes with the server JAR
   */
  async detectRunning(): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      const result = execSync(
        `pgrep -f "${config.MC_JAR}" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).trim();
      return result.length > 0;
    } catch {
      return false;
    }
  }
}
