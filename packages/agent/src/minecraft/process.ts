import { spawn, ChildProcess, execSync } from 'child_process';
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

    if (config.MC_LAUNCH_MODE === 'script') {
      await this.startViaScript();
    } else {
      await this.startViaJar();
    }
  }

  /**
   * Fabric JAR mode: java [jvm_args] -jar fabric-server-launch.jar nogui
   * This is the standard Fabric dedicated server launch method.
   */
  private async startViaJar(): Promise<void> {
    const jarPath = path.join(config.MC_SERVER_DIR, config.MC_JAR);
    if (!existsSync(jarPath)) {
      throw new Error(
        `Fabric server JAR not found: ${jarPath}\n` +
        `Make sure you have downloaded fabric-server-launch.jar into ${config.MC_SERVER_DIR}`
      );
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

    logger.info({ mode: 'jar', jar: config.MC_JAR, cwd: config.MC_SERVER_DIR }, 'Starting Fabric server (jar mode)');
    this.spawnProcess(config.JAVA_PATH, args);
  }

  /**
   * Script mode: bash run.sh
   * Fabric's server installer generates a run.sh with the correct classpath.
   * This is preferred when using the Fabric installer's generated launch script.
   */
  private async startViaScript(): Promise<void> {
    const scriptPath = path.join(config.MC_SERVER_DIR, config.MC_RUN_SCRIPT);
    if (!existsSync(scriptPath)) {
      throw new Error(
        `Fabric run script not found: ${scriptPath}\n` +
        `Run the Fabric installer with --install-server to generate run.sh`
      );
    }

    // Make sure run.sh is executable
    try {
      execSync(`chmod +x "${scriptPath}"`);
    } catch { /* non-fatal */ }

    logger.info({ mode: 'script', script: config.MC_RUN_SCRIPT, cwd: config.MC_SERVER_DIR }, 'Starting Fabric server (script mode)');
    this.spawnProcess('bash', [config.MC_RUN_SCRIPT]);
  }

  private spawnProcess(command: string, args: string[]): void {
    this.process = spawn(command, args, {
      cwd: config.MC_SERVER_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    this._isRunning = true;
    this.startedAt = Date.now();

    this.process.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        logger.debug({ source: 'mc-stdout' }, line);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split(('\n')).filter(Boolean);
      for (const line of lines) {
        logger.warn({ source: 'mc-stderr' }, line);
      }
    });

    this.process.on('exit', (code, signal) => {
      logger.info({ code, signal }, 'Fabric server process exited');
      this._isRunning = false;
      this.process = null;
    });

    this.process.on('error', (err) => {
      logger.error({ err }, 'Fabric server process error');
      this._isRunning = false;
      this.process = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.process) {
      throw new Error('Server is not running');
    }

    logger.info('Stopping Fabric server gracefully...');
    this.sendCommand('stop');

    // Fabric/vanilla servers honour the 'stop' command — wait up to 60s
    // (Fabric with many mods can take longer to unload than Forge)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('Graceful shutdown timed out, force killing...');
        this.kill();
        resolve();
      }, 60_000);

      this.process?.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async kill(): Promise<void> {
    if (!this.process) return;

    logger.warn('Force killing Fabric server...');
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
    logger.info({ command }, 'Sent command to Fabric server');
  }

  /**
   * Detect if a Fabric/Minecraft server process is already running.
   * Checks for fabric-server-launch.jar OR run.sh bash processes.
   */
  async detectRunning(): Promise<boolean> {
    try {
      const jarCheck = execSync(
        `pgrep -f "fabric-server-launch.jar" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).trim();
      if (jarCheck.length > 0) return true;

      const scriptCheck = execSync(
        `pgrep -f "${config.MC_RUN_SCRIPT}" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      ).trim();
      return scriptCheck.length > 0;
    } catch {
      return false;
    }
  }
}
