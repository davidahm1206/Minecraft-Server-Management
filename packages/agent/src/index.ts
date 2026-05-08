import { config } from './config.js';
import { logger } from './utils/logger.js';
import { AgentWSClient } from './ws/client.js';
import { MessageHandler } from './ws/handler.js';
import { MinecraftProcess } from './minecraft/process.js';
import { LogParser } from './minecraft/log-parser.js';
import { ModScanner } from './mods/scanner.js';
import { FileManager } from './files/manager.js';
import { MetricsCollector } from './metrics/collector.js';
import { WorldManager } from './minecraft/world-manager.js';
import { METRICS_INTERVAL_MS } from '@mcpanel/shared';

async function main() {
  logger.info('MCPanel Agent starting...');
  logger.info({ serverDir: config.MC_SERVER_DIR, java: config.JAVA_PATH });

  // Initialize subsystems
  const mcProcess = new MinecraftProcess();
  const logParser = new LogParser();
  const modScanner = new ModScanner();
  const fileManager = new FileManager();
  const metrics = new MetricsCollector(mcProcess, logParser);
  const worldManager = new WorldManager();

  // Create message handler
  const handler = new MessageHandler(
    mcProcess, logParser, modScanner, fileManager, metrics, worldManager
  );

  // Create WebSocket client
  const wsClient = new AgentWSClient(handler);

  // Setup log parser callbacks
  logParser.setCallbacks({
    onLog: (log) => {
      wsClient.send({ type: 'server:log', payload: log, timestamp: Date.now() });
    },
    onPlayer: (name, action) => {
      if (action === 'join') metrics.addPlayer(name);
      else metrics.removePlayer(name);
      wsClient.send({ type: `player:${action}`, payload: { name }, timestamp: Date.now() });
    },
    onCrash: (report) => {
      wsClient.send({ type: 'server:crash', payload: { report, timestamp: new Date().toISOString() }, timestamp: Date.now() });
      wsClient.send({ type: 'server:status', payload: { status: 'crashed', uptime: 0 }, timestamp: Date.now() });
    },
    onServerReady: () => {
      wsClient.send({ type: 'server:status', payload: { status: 'online', uptime: 0 }, timestamp: Date.now() });
    },
  });

  // Start log parser
  logParser.start();

  // Detect if MC is already running
  const alreadyRunning = await mcProcess.detectRunning();
  if (alreadyRunning) {
    logger.info('Minecraft server detected as already running');
  }

  // Connect to Cloudflare Worker
  wsClient.connect();

  // Periodic metrics push
  setInterval(async () => {
    if (wsClient.isConnected && mcProcess.isRunning) {
      const data = await metrics.collect();
      wsClient.send({ type: 'metrics:update', payload: data, timestamp: Date.now() });
    }
  }, METRICS_INTERVAL_MS);

  // Send status periodically
  setInterval(() => {
    if (wsClient.isConnected) {
      wsClient.send({
        type: 'server:status',
        payload: { status: mcProcess.isRunning ? 'online' : 'offline', uptime: mcProcess.uptime },
        timestamp: Date.now(),
      });
    }
  }, 15_000);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down agent...');
    logParser.stop();
    wsClient.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('MCPanel Agent running ✓');
}

main().catch((err) => {
  logger.fatal({ err }, 'Agent failed to start');
  process.exit(1);
});
