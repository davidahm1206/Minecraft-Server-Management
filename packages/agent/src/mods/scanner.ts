import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, readdirSync } from 'fs';
import AdmZip from 'adm-zip';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { MC_VERSION, FABRIC_CLIENT_ENVIRONMENTS, MAX_MOD_SIZE_BYTES } from '@mcpanel/shared';
import type { ModInfo } from '@mcpanel/shared';

// ─── Fabric mod.json schema (fabric.mod.json) ───
// https://wiki.fabricmc.net/documentation:fabric_mod_json
interface FabricModJson {
  schemaVersion: number;
  id: string;
  version: string;
  name?: string;
  description?: string;
  authors?: Array<string | { name: string; contact?: Record<string, string> }>;
  license?: string | string[];
  icon?: string;
  environment?: '*' | 'client' | 'server';
  entrypoints?: Record<string, string[]>;
  depends?: Record<string, string | string[]>;
  recommends?: Record<string, string | string[]>;
  suggests?: Record<string, string | string[]>;
  conflicts?: Record<string, string | string[]>;
  breaks?: Record<string, string | string[]>;
  contact?: Record<string, string>;
}

export class ModScanner {
  private modsDir: string;

  constructor() {
    this.modsDir = path.resolve(path.join(config.MC_SERVER_DIR, 'mods'));
  }

  async scan(): Promise<ModInfo[]> {
    if (!existsSync(this.modsDir)) return [];

    const files = readdirSync(this.modsDir);
    const mods: ModInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.jar') && !file.endsWith('.jar.disabled')) continue;

      const filePath = path.join(this.modsDir, file);
      try {
        const mod = this.parseFabricJar(filePath);
        if (mod) mods.push(mod);
      } catch (err) {
        logger.warn({ err, file }, 'Failed to parse Fabric mod JAR');
        const stats = statSync(filePath);
        mods.push({
          modId: 'unknown',
          version: 'unknown',
          displayName: file.replace(/\.(jar|jar\.disabled)$/, ''),
          description: 'Could not read fabric.mod.json',
          authors: '',
          mcVersion: '',
          fabricVersion: undefined,
          environment: 'both',
          clientOnly: false,
          fileName: file,
          enabled: file.endsWith('.jar'),
          fileSize: stats.size,
          incompatible: false,
          depends: {},
        });
      }
    }

    return mods.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Parse a Fabric mod JAR by reading fabric.mod.json from its root.
   * Fabric mods MUST contain fabric.mod.json — if absent, returns null
   * (could be a library JAR bundled by another mod).
   */
  private parseFabricJar(jarPath: string): ModInfo | null {
    const zip = new AdmZip(jarPath);
    const fileName = path.basename(jarPath);
    const stats = statSync(jarPath);

    // ── Primary: fabric.mod.json ──
    const fabricEntry = zip.getEntry('fabric.mod.json');
    if (!fabricEntry) {
      // Could be a bundled library (e.g., Fabric API sub-JARs inside a JAR)
      // Try nested JARs declared in jar-in-jar (jij) — skip for now, log as library
      logger.debug({ fileName }, 'No fabric.mod.json found — treating as library/non-Fabric JAR');
      return null;
    }

    let meta: FabricModJson;
    try {
      meta = JSON.parse(fabricEntry.getData().toString('utf-8')) as FabricModJson;
    } catch (err) {
      logger.warn({ fileName, err }, 'Failed to parse fabric.mod.json');
      return null;
    }

    // ── Environment detection ──
    // fabric.mod.json `environment` field:
    //   "*"      → works on both (default)
    //   "client" → client-only
    //   "server" → server-only
    const envField = (meta.environment ?? '*').toLowerCase();
    const clientOnly = envField === 'client';
    const environment: ModInfo['environment'] =
      envField === 'client' ? 'client' :
      envField === 'server' ? 'server' :
      'both';

    // ── Dependency extraction ──
    const depends = this.flattenDeps(meta.depends);

    // ── MC version from depends.minecraft ──
    const mcVersionRange = depends['minecraft'] ?? '';

    // ── Fabric loader version requirement ──
    const fabricVersion = depends['fabricloader'] ?? depends['fabric-loader'] ?? undefined;

    // ── Compatibility check ──
    // Fabric version ranges follow a semver-like syntax.
    // Most mods specify ">=1.21" or "~1.21.x" — do a best-effort check.
    const incompatible = mcVersionRange ? !this.isVersionCompatible(mcVersionRange, MC_VERSION) : false;

    // ── Author normalisation ──
    const authors = this.normaliseAuthors(meta.authors);

    return {
      modId: meta.id || 'unknown',
      version: meta.version || 'unknown',
      displayName: meta.name || meta.id || fileName,
      description: meta.description || '',
      authors,
      mcVersion: mcVersionRange,
      fabricVersion,
      environment,
      clientOnly,
      fileName,
      enabled: fileName.endsWith('.jar'),
      fileSize: stats.size,
      incompatible,
      incompatibleReason: incompatible
        ? `Requires MC ${mcVersionRange} (server is ${MC_VERSION})`
        : undefined,
      depends,
    };
  }

  /** Flatten Fabric depends values (can be string or string[]) to Record<string, string> */
  private flattenDeps(
    deps?: Record<string, string | string[]>
  ): Record<string, string> {
    if (!deps) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(deps)) {
      out[k] = Array.isArray(v) ? v[0] : v;
    }
    return out;
  }

  /** Normalise authors array (Fabric allows string or {name, contact} objects) */
  private normaliseAuthors(
    authors?: FabricModJson['authors']
  ): string {
    if (!authors || authors.length === 0) return '';
    return authors
      .map((a) => (typeof a === 'string' ? a : a.name))
      .join(', ');
  }

  /**
   * Best-effort Fabric semver range compatibility check.
   * Fabric uses Semver 2.0.0 via fabric-loader's own semver implementation.
   * We handle the common cases: exact, >= prefix, ~, ^, wildcards.
   */
  private isVersionCompatible(range: string, target: string): boolean {
    range = range.trim();

    // Exact match or starts with target
    if (range === target || range.startsWith(target)) return true;

    // ">= X.Y.Z" — check if target satisfies minimum
    const gteMatch = range.match(/^>=\s*([\d.]+)/);
    if (gteMatch) {
      return this.compareVersions(target, gteMatch[1]) >= 0;
    }

    // "~X.Y" — compatible within minor
    const tildeMatch = range.match(/^~([\d.]+)/);
    if (tildeMatch) {
      const [major, minor] = tildeMatch[1].split('.').map(Number);
      const [tMajor, tMinor] = target.split('.').map(Number);
      return tMajor === major && tMinor === minor;
    }

    // "^X.Y" — compatible within major
    const caretMatch = range.match(/^\^([\d.]+)/);
    if (caretMatch) {
      const [major] = caretMatch[1].split('.').map(Number);
      const [tMajor] = target.split('.').map(Number);
      return tMajor === major;
    }

    // Wildcard "1.21.x" or "1.21.*"
    if (range.includes('x') || range.includes('*')) {
      const prefix = range.replace(/[x*].*$/, '').replace(/\.$/, '');
      return target.startsWith(prefix);
    }

    // Fallback — partial prefix match
    return target.startsWith(range) || range.startsWith(target.split('.').slice(0, 2).join('.'));
  }

  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  // ─── File operations (unchanged logic, updated comments) ───

  async uploadMod(filename: string, base64Data: string): Promise<void> {
    if (!filename.endsWith('.jar')) {
      throw new Error('Only .jar files are allowed');
    }

    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length > MAX_MOD_SIZE_BYTES) {
      throw new Error(`Mod exceeds max size of ${MAX_MOD_SIZE_BYTES / 1024 / 1024}MB`);
    }

    // Validate it's a real ZIP/JAR
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw new Error('Invalid JAR file (not a valid ZIP archive)');
    }

    // Validate it contains fabric.mod.json — reject non-Fabric JARs
    const hasFabricMeta = zip.getEntry('fabric.mod.json') !== null;
    if (!hasFabricMeta) {
      // Allow library JARs (common with Fabric) but warn
      logger.warn({ filename }, 'Uploaded JAR has no fabric.mod.json — may be a library JAR');
    }

    await fs.mkdir(this.modsDir, { recursive: true });
    await fs.writeFile(path.join(this.modsDir, filename), buffer);
    logger.info({ filename }, 'Fabric mod uploaded');
  }

  async deleteMod(filename: string): Promise<void> {
    const filePath = path.join(this.modsDir, filename);
    if (!filePath.startsWith(this.modsDir)) throw new Error('Invalid filename');
    if (!existsSync(filePath)) throw new Error('Mod not found');
    await fs.unlink(filePath);
    logger.info({ filename }, 'Mod deleted');
  }

  async toggleMod(filename: string, enabled: boolean): Promise<void> {
    const base = filename.replace(/\.disabled$/, '');
    const currentPath = path.join(this.modsDir, enabled ? base + '.disabled' : base);
    const newPath = enabled
      ? path.join(this.modsDir, base)
      : path.join(this.modsDir, base + '.disabled');
    if (!existsSync(currentPath)) throw new Error('Mod file not found');
    await fs.rename(currentPath, newPath);
    logger.info({ filename, enabled }, 'Mod toggled');
  }
}
