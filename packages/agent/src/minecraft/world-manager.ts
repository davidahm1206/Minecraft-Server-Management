import path from 'path';
import fs from 'fs/promises';
import { existsSync, readdirSync, statSync } from 'fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { WorldInfo } from '@mcpanel/shared';

export class WorldManager {
  private serverDir: string;

  constructor() {
    this.serverDir = config.MC_SERVER_DIR;
  }

  async listWorlds(): Promise<WorldInfo[]> {
    const worlds: WorldInfo[] = [];
    const entries = readdirSync(this.serverDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const levelDat = path.join(this.serverDir, entry.name, 'level.dat');
      if (!existsSync(levelDat)) continue;

      const size = await this.getDirSize(path.join(this.serverDir, entry.name));
      const stats = statSync(levelDat);

      worlds.push({
        name: entry.name,
        size,
        lastPlayed: stats.mtime.toISOString(),
        seed: await this.getSeed(entry.name),
      });
    }
    return worlds;
  }

  async deleteWorld(worldName: string): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(worldName)) throw new Error('Invalid world name');
    const worldPath = path.join(this.serverDir, worldName);
    if (!existsSync(worldPath)) throw new Error('World not found');
    await fs.rm(worldPath, { recursive: true, force: true });
    // Also delete nether/end dimensions
    const dims = [`${worldName}_nether`, `${worldName}_the_end`];
    for (const dim of dims) {
      const dimPath = path.join(this.serverDir, dim);
      if (existsSync(dimPath)) await fs.rm(dimPath, { recursive: true, force: true });
    }
    logger.info({ worldName }, 'World deleted');
  }

  async regenerateWorld(seed?: string): Promise<void> {
    // Read server.properties to find level-name
    const propsPath = path.join(this.serverDir, 'server.properties');
    let levelName = 'world';
    if (existsSync(propsPath)) {
      const content = await fs.readFile(propsPath, 'utf-8');
      const match = content.match(/^level-name=(.+)$/m);
      if (match) levelName = match[1].trim();
    }
    // Delete existing world
    await this.deleteWorld(levelName);
    // Set seed if provided
    if (seed && existsSync(propsPath)) {
      let content = await fs.readFile(propsPath, 'utf-8');
      content = content.replace(/^level-seed=.*$/m, `level-seed=${seed}`);
      if (!content.includes('level-seed=')) content += `\nlevel-seed=${seed}`;
      await fs.writeFile(propsPath, content, 'utf-8');
    }
    logger.info({ seed }, 'World regenerated (will generate on next start)');
  }

  private async getSeed(worldName: string): Promise<string | undefined> {
    const propsPath = path.join(this.serverDir, 'server.properties');
    if (!existsSync(propsPath)) return undefined;
    const content = await fs.readFile(propsPath, 'utf-8');
    const match = content.match(/^level-seed=(.*)$/m);
    return match?.[1]?.trim() || undefined;
  }

  private async getDirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirSize(fullPath);
        } else {
          size += statSync(fullPath).size;
        }
      }
    } catch { /* ignore permission errors */ }
    return size;
  }
}
