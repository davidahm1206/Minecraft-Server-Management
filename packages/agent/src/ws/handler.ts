import type { WSMessage, WSEventType } from '@mcpanel/shared';
import type { AgentWSClient } from './client.js';
import { MinecraftProcess } from '../minecraft/process.js';
import { LogParser } from '../minecraft/log-parser.js';
import { ModScanner } from '../mods/scanner.js';
import { FileManager } from '../files/manager.js';
import { MetricsCollector } from '../metrics/collector.js';
import { WorldManager } from '../minecraft/world-manager.js';
import { logger } from '../utils/logger.js';

type Handler = (payload: any, ws: AgentWSClient, id?: string) => Promise<void>;

export class MessageHandler {
  private handlers = new Map<WSEventType, Handler>();
  private mcProcess: MinecraftProcess;
  private logParser: LogParser;
  private modScanner: ModScanner;
  private fileManager: FileManager;
  private metrics: MetricsCollector;
  private worldManager: WorldManager;

  constructor(
    mcProcess: MinecraftProcess,
    logParser: LogParser,
    modScanner: ModScanner,
    fileManager: FileManager,
    metrics: MetricsCollector,
    worldManager: WorldManager,
  ) {
    this.mcProcess = mcProcess;
    this.logParser = logParser;
    this.modScanner = modScanner;
    this.fileManager = fileManager;
    this.metrics = metrics;
    this.worldManager = worldManager;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Server controls
    this.handlers.set('server:start', async (_, ws) => {
      await this.mcProcess.start();
      ws.send({ type: 'server:status', payload: { status: 'starting', uptime: 0 }, timestamp: Date.now() });
    });

    this.handlers.set('server:stop', async (payload, ws) => {
      if (payload.graceful) {
        await this.mcProcess.stop();
      } else {
        await this.mcProcess.kill();
      }
      ws.send({ type: 'server:status', payload: { status: 'stopping', uptime: 0 }, timestamp: Date.now() });
    });

    this.handlers.set('server:restart', async (_, ws) => {
      ws.send({ type: 'server:status', payload: { status: 'stopping', uptime: 0 }, timestamp: Date.now() });
      await this.mcProcess.stop();
      await new Promise((r) => setTimeout(r, 3000));
      await this.mcProcess.start();
      ws.send({ type: 'server:status', payload: { status: 'starting', uptime: 0 }, timestamp: Date.now() });
    });

    this.handlers.set('server:command', async (payload, ws) => {
      const { command } = payload;
      this.mcProcess.sendCommand(command);
      ws.send({ type: 'success', payload: { message: `Command sent: ${command}` }, timestamp: Date.now() });
    });

    // Metrics
    this.handlers.set('metrics:request', async (_, ws) => {
      const data = await this.metrics.collect();
      ws.send({ type: 'metrics:update', payload: data, timestamp: Date.now() });
    });

    // Mods
    this.handlers.set('mods:list', async (_, ws) => {
      const mods = await this.modScanner.scan();
      ws.send({ type: 'mods:list:response', payload: { mods }, timestamp: Date.now() });
    });

    this.handlers.set('mods:upload', async (payload, ws) => {
      await this.modScanner.uploadMod(payload.filename, payload.data);
      const mods = await this.modScanner.scan();
      ws.send({ type: 'mods:list:response', payload: { mods }, timestamp: Date.now() });
      ws.send({ type: 'success', payload: { message: `Mod ${payload.filename} uploaded` }, timestamp: Date.now() });
    });

    this.handlers.set('mods:delete', async (payload, ws) => {
      await this.modScanner.deleteMod(payload.filename);
      const mods = await this.modScanner.scan();
      ws.send({ type: 'mods:list:response', payload: { mods }, timestamp: Date.now() });
      ws.send({ type: 'success', payload: { message: `Mod ${payload.filename} deleted` }, timestamp: Date.now() });
    });

    this.handlers.set('mods:toggle', async (payload, ws) => {
      await this.modScanner.toggleMod(payload.filename, payload.enabled);
      const mods = await this.modScanner.scan();
      ws.send({ type: 'mods:list:response', payload: { mods }, timestamp: Date.now() });
    });

    // Files
    this.handlers.set('files:list', async (payload, ws) => {
      const entries = await this.fileManager.listDirectory(payload.path);
      ws.send({ type: 'files:list:response', payload: { path: payload.path, entries }, timestamp: Date.now() });
    });

    this.handlers.set('files:read', async (payload, ws) => {
      const result = await this.fileManager.readFile(payload.path);
      ws.send({ type: 'files:read:response', payload: result, timestamp: Date.now() });
    });

    this.handlers.set('files:write', async (payload, ws) => {
      await this.fileManager.writeFile(payload.path, payload.content);
      ws.send({ type: 'success', payload: { message: `File saved: ${payload.path}` }, timestamp: Date.now() });
    });

    this.handlers.set('files:delete', async (payload, ws) => {
      await this.fileManager.deleteFile(payload.path);
      ws.send({ type: 'success', payload: { message: `File deleted: ${payload.path}` }, timestamp: Date.now() });
    });

    this.handlers.set('files:upload', async (payload, ws) => {
      await this.fileManager.uploadFile(payload.path, payload.filename, payload.data);
      ws.send({ type: 'success', payload: { message: `File uploaded: ${payload.filename}` }, timestamp: Date.now() });
    });

    // Worlds
    this.handlers.set('world:list', async (_, ws) => {
      const worlds = await this.worldManager.listWorlds();
      ws.send({ type: 'world:list:response', payload: { worlds }, timestamp: Date.now() });
    });

    this.handlers.set('world:delete', async (payload, ws) => {
      await this.worldManager.deleteWorld(payload.worldName);
      ws.send({ type: 'success', payload: { message: `World ${payload.worldName} deleted` }, timestamp: Date.now() });
    });

    this.handlers.set('world:regenerate', async (payload, ws) => {
      await this.worldManager.regenerateWorld(payload.seed);
      ws.send({ type: 'success', payload: { message: 'World regenerated' }, timestamp: Date.now() });
    });
  }

  async dispatch(msg: WSMessage, ws: AgentWSClient): Promise<void> {
    const handler = this.handlers.get(msg.type);
    if (!handler) {
      logger.warn(`Unknown event type: ${msg.type}`);
      ws.send({ type: 'error', payload: { message: `Unknown event: ${msg.type}` }, timestamp: Date.now() });
      return;
    }

    try {
      await handler(msg.payload, ws, msg.id);
    } catch (err: any) {
      logger.error({ err, type: msg.type }, 'Handler error');
      ws.send({
        type: 'error',
        id: msg.id,
        payload: { message: err.message || 'Internal agent error' },
        timestamp: Date.now(),
      });
    }
  }
}
