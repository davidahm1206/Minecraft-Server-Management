import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(128),
});

export const serverCommandSchema = z.object({
  command: z.string().min(1).max(500).refine(
    (cmd) => !cmd.includes('&&') && !cmd.includes('|') && !cmd.includes(';'),
    { message: 'Command contains disallowed characters' }
  ),
});

export const serverStopSchema = z.object({
  graceful: z.boolean().default(true),
});

export const worldRegenerateSchema = z.object({
  seed: z.string().max(64).optional(),
});

export const worldDeleteSchema = z.object({
  worldName: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid world name'),
});
