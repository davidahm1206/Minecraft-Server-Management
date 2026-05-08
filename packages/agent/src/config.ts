import dotenv from 'dotenv';
import { z } from 'zod';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

dotenv.config();

const configSchema = z.object({
  WORKER_WS_URL: z.string().url(),
  AGENT_TOKEN: z.string().min(1),
  MC_SERVER_DIR: z.string().min(1),
  JAVA_PATH: z.string().optional().default(''),

  // Launch mode:
  //   'jar'    → java -jar fabric-server-launch.jar nogui  (default)
  //   'script' → bash run.sh (if the server uses a run.sh launcher)
  MC_LAUNCH_MODE: z.enum(['jar', 'script']).default('jar'),

  // Primary JAR — for 'jar' mode. Fabric uses fabric-server-launch.jar
  MC_JAR: z.string().default('fabric-server-launch.jar'),

  // run.sh path relative to MC_SERVER_DIR — for 'script' mode
  MC_RUN_SCRIPT: z.string().default('run.sh'),

  // JVM memory — 4G/8G recommended for Fabric 1.21.1
  MC_MIN_RAM: z.string().default('4G'),
  MC_MAX_RAM: z.string().default('8G'),

  // JVM flags tuned for modern Java 21 + Fabric
  // G1GC is still solid; Aikar's flags work well with Fabric
  MC_JVM_ARGS: z.string().default(
    '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 ' +
    '-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC ' +
    '-XX:+AlwaysPreTouch -XX:G1HeapWastePercent=5 ' +
    '-XX:G1MixedGCCountTarget=4 -XX:G1MixedGCLiveThresholdPercent=90 ' +
    '-XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 ' +
    '-XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 ' +
    '-Dfabric.skipMcProvider=true'
  ),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function detectJava(): string {
  // Prefer Java 21 for Fabric 1.21.1 (minimum: Java 21)
  try {
    const result = execSync('which java', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {}

  const commonPaths = [
    '/usr/bin/java',
    '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
    '/usr/lib/jvm/java-21-openjdk-arm64/bin/java',
    '/usr/lib/jvm/java-21/bin/java',
    '/usr/lib/jvm/temurin-21/bin/java',
    '/usr/lib/jvm/java-17-openjdk-amd64/bin/java', // fallback
  ];
  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }
  throw new Error('Java 21+ not found. Set JAVA_PATH in .env');
}

const raw = configSchema.parse(process.env);

export const config = {
  ...raw,
  JAVA_PATH: raw.JAVA_PATH || detectJava(),
};

export type Config = typeof config;
