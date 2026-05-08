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
  MC_JAR: z.string().default('server.jar'),
  MC_MIN_RAM: z.string().default('2G'),
  MC_MAX_RAM: z.string().default('4G'),
  MC_JVM_ARGS: z.string().default('-XX:+UseG1GC'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function detectJava(): string {
  try {
    const result = execSync('which java', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {}

  const commonPaths = [
    '/usr/bin/java',
    '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
    '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
  ];
  for (const p of commonPaths) {
    if (existsSync(p)) return p;
  }
  throw new Error('Java not found. Set JAVA_PATH in .env');
}

const raw = configSchema.parse(process.env);

export const config = {
  ...raw,
  JAVA_PATH: raw.JAVA_PATH || detectJava(),
};

export type Config = typeof config;
