import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { BLOCKED_PATH_PATTERNS, READ_ONLY_FILES, ALLOWED_CONFIG_EXTENSIONS } from '@mcpanel/shared';
import type { FileEntry, FileReadResponse } from '@mcpanel/shared';

export class FileManager {
  private serverRoot: string;

  constructor() {
    this.serverRoot = path.resolve(config.MC_SERVER_DIR);
  }

  private resolveSafe(requestedPath: string): string {
    // Block dangerous patterns
    for (const pattern of BLOCKED_PATH_PATTERNS) {
      if (pattern.test(requestedPath)) {
        throw new Error('Invalid path: blocked pattern detected');
      }
    }

    const resolved = path.resolve(this.serverRoot, requestedPath);

    if (!resolved.startsWith(this.serverRoot)) {
      throw new Error('Path escapes server root — access denied');
    }

    return resolved;
  }

  private isWritable(filePath: string): boolean {
    const basename = path.basename(filePath);
    return !READ_ONLY_FILES.includes(basename);
  }

  async listDirectory(dirPath: string): Promise<FileEntry[]> {
    const resolved = this.resolveSafe(dirPath || '.');

    if (!existsSync(resolved)) {
      throw new Error('Directory not found');
    }

    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files and .git
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(resolved, entry.name);
      const relativePath = path.relative(this.serverRoot, fullPath).replace(/\\/g, '/');
      const stats = statSync(fullPath);

      result.push({
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? 0 : stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }

    // Sort: directories first, then alphabetical
    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  async readFile(filePath: string): Promise<FileReadResponse> {
    const resolved = this.resolveSafe(filePath);

    if (!existsSync(resolved)) {
      throw new Error('File not found');
    }

    const stats = statSync(resolved);
    if (stats.isDirectory()) {
      throw new Error('Cannot read a directory');
    }

    // Check if text file
    const ext = path.extname(resolved).toLowerCase();
    const isText = ALLOWED_CONFIG_EXTENSIONS.includes(ext) || ext === '.log';

    if (isText) {
      const content = await fs.readFile(resolved, 'utf-8');
      return { path: filePath, content, encoding: 'utf-8' };
    } else {
      const buffer = await fs.readFile(resolved);
      return { path: filePath, content: buffer.toString('base64'), encoding: 'base64' };
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolved = this.resolveSafe(filePath);

    if (!this.isWritable(filePath)) {
      throw new Error('File is read-only');
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    logger.info({ path: filePath }, 'File written');
  }

  async deleteFile(filePath: string): Promise<void> {
    const resolved = this.resolveSafe(filePath);

    if (!this.isWritable(filePath)) {
      throw new Error('File is read-only');
    }

    if (!existsSync(resolved)) {
      throw new Error('File not found');
    }

    const stats = statSync(resolved);
    if (stats.isDirectory()) {
      await fs.rm(resolved, { recursive: true });
    } else {
      await fs.unlink(resolved);
    }
    logger.info({ path: filePath }, 'File deleted');
  }

  async uploadFile(dirPath: string, filename: string, base64Data: string): Promise<void> {
    const targetDir = this.resolveSafe(dirPath);
    const targetFile = path.join(targetDir, filename);

    // Verify target is still within server root
    if (!targetFile.startsWith(this.serverRoot)) {
      throw new Error('Upload path escapes server root');
    }

    await fs.mkdir(targetDir, { recursive: true });
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.writeFile(targetFile, buffer);
    logger.info({ path: `${dirPath}/${filename}` }, 'File uploaded');
  }
}
