import { z } from 'zod';

const safePathRegex = /^[a-zA-Z0-9._\-/]+$/;

export const filePathSchema = z.object({
  path: z.string()
    .min(1)
    .max(512)
    .refine((p) => !p.includes('..'), 'Directory traversal not allowed')
    .refine((p) => !p.startsWith('/'), 'Absolute paths not allowed')
    .refine((p) => safePathRegex.test(p), 'Path contains invalid characters'),
});

export const fileWriteSchema = z.object({
  path: filePathSchema.shape.path,
  content: z.string().max(5 * 1024 * 1024), // 5MB max
});

export const fileUploadSchema = z.object({
  path: filePathSchema.shape.path,
  filename: z.string().min(1).max(255),
  data: z.string().min(1), // base64
});

export const fileDeleteSchema = z.object({
  path: filePathSchema.shape.path,
});
