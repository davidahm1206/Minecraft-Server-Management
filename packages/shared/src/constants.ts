// ─── Constants ───

export const MC_VERSION = '1.21.1';
export const MC_LOADER = 'fabric';

export const METRICS_INTERVAL_MS = 5000;
export const HEARTBEAT_INTERVAL_MS = 30000;
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;

export const MAX_MOD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_CONFIG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
export const MAX_LOG_LINES = 5000;
export const MAX_COMMAND_LENGTH = 500;

export const ALLOWED_CONFIG_EXTENSIONS = [
  '.properties', '.toml', '.json', '.yml', '.yaml', '.cfg', '.conf', '.txt', '.ini',
];

export const READ_ONLY_FILES = ['fabric-server-launch.jar', 'server.jar', 'eula.txt'];

export const BLOCKED_PATH_PATTERNS = [/\.\./, /^\//,  /\0/];

export const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG', 'UNKNOWN'] as const;
export type LogLevel = typeof LOG_LEVELS[number];

// Fabric client-only environment markers
export const CLIENT_ONLY_PACKAGES = [
  'net.minecraft.client',
  'com.mojang.blaze3d',
  'net.fabricmc.api.ClientModInitializer',
];

// Fabric mod environment values that indicate client-only
export const FABRIC_CLIENT_ENVIRONMENTS = ['client'];
