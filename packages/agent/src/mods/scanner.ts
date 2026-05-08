import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, readdirSync } from 'fs';
import AdmZip from 'adm-zip';
import { parse as parseTOML } from '@iarna/toml';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { CLIENT_ONLY_PACKAGES, MC_VERSION, MAX_MOD_SIZE_BYTES } from '@mcpanel/shared';
import type { ModInfo } from '@mcpanel/shared';

export class ModScanner {
  private modsDir: string;

  constructor() {
    this.modsDir = path.join(config.MC_SERVER_DIR, 'mods');
  }

  async scan(): Promise<ModInfo[]> {
    if (!existsSync(this.modsDir)) return [];
    const files = readdirSync(this.modsDir);
    const mods: ModInfo[] = [];
    for (const file of files) {
      if (!file.endsWith('.jar') && !file.endsWith('.jar.disabled')) continue;
      const filePath = path.join(this.modsDir, file);
      try {
        const mod = this.parseModJar(filePath);
        if (mod) mods.push(mod);
      } catch (err) {
        logger.warn({ err, file }, 'Failed to parse mod JAR');
        const stats = statSync(filePath);
        mods.push({
          modId: 'unknown', version: 'unknown',
          displayName: file.replace(/\.(jar|jar\.disabled)$/, ''),
          description: 'Could not read mod metadata', authors: '',
          mcVersion: '', forgeVersion: '', clientOnly: false,
          fileName: file, enabled: file.endsWith('.jar'),
          fileSize: stats.size, incompatible: false,
        });
      }
    }
    return mods.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private parseModJar(jarPath: string): ModInfo | null {
    const zip = new AdmZip(jarPath);
    const modsTomlEntry = zip.getEntry('META-INF/mods.toml');
    const fileName = path.basename(jarPath);
    const stats = statSync(jarPath);
    if (!modsTomlEntry) return null;
    const content = modsTomlEntry.getData().toString('utf-8');
    let parsed: any;
    try { parsed = parseTOML(content); } catch { return null; }
    const mod = (parsed.mods as any[])?.[0];
    if (!mod) return null;
    const deps = (parsed as any).dependencies?.[mod.modId] || [];
    const mcDep = deps.find((d: any) => d.modId === 'minecraft');
    const forgeDep = deps.find((d: any) => d.modId === 'forge');
    const clientOnly = deps.some((d: any) => d.side === 'CLIENT' && (d.modId === 'minecraft' || d.modId === 'forge'));
    const mcVersionRange = mcDep?.versionRange || '';
    const incompatible = mcVersionRange ? !mcVersionRange.includes(MC_VERSION) : false;
    return {
      modId: mod.modId || 'unknown',
      version: mod.version?.replace?.('${file.jarVersion}', 'unknown') || 'unknown',
      displayName: mod.displayName || mod.modId || fileName,
      description: mod.description || '', authors: mod.authors || '',
      mcVersion: mcVersionRange, forgeVersion: forgeDep?.versionRange || '',
      clientOnly, fileName, enabled: fileName.endsWith('.jar'),
      fileSize: stats.size, incompatible,
      incompatibleReason: incompatible ? `Requires MC ${mcVersionRange}` : undefined,
    };
  }

  async uploadMod(filename: string, base64Data: string): Promise<void> {
    if (!filename.endsWith('.jar')) throw new Error('Only .jar files allowed');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_MOD_SIZE_BYTES) throw new Error('Mod too large');
    try { new AdmZip(buffer); } catch { throw new Error('Invalid JAR file'); }
    await fs.mkdir(this.modsDir, { recursive: true });
    await fs.writeFile(path.join(this.modsDir, filename), buffer);
  }

  async deleteMod(filename: string): Promise<void> {
    const filePath = path.join(this.modsDir, filename);
    if (!filePath.startsWith(this.modsDir)) throw new Error('Invalid filename');
    if (!existsSync(filePath)) throw new Error('Mod not found');
    await fs.unlink(filePath);
  }

  async toggleMod(filename: string, enabled: boolean): Promise<void> {
    const base = filename.replace(/\.disabled$/, '');
    const currentPath = path.join(this.modsDir, enabled ? base + '.disabled' : base);
    const newPath = enabled ? path.join(this.modsDir, base) : path.join(this.modsDir, base + '.disabled');
    if (!existsSync(currentPath)) throw new Error('Mod file not found');
    await fs.rename(currentPath, newPath);
  }
}
