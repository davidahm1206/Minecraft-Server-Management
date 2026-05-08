import { z } from 'zod';

export const modUploadSchema = z.object({
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+\.jar$/, 'Filename must be a .jar file')
    .refine((f) => !f.includes('..') && !f.includes('/') && !f.includes('\\'), 'Invalid filename'),
  data: z.string().min(1), // base64
});

export const modDeleteSchema = z.object({
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+\.(jar|jar\.disabled)$/, 'Invalid mod filename'),
});

export const modToggleSchema = z.object({
  filename: z.string().min(1).max(255),
  enabled: z.boolean(),
});
