import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120;

export const rateLimitMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const now = Date.now();

    let entry = requestCounts.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      requestCounts.set(ip, entry);
    }

    entry.count++;

    if (entry.count > MAX_REQUESTS) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    c.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count).toString());

    await next();
  }
);
