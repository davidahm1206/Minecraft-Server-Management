import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';
import type { Env } from '../index';

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { userId: string; username: string; role: string } }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing authorization header' }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(token, secret);

      c.set('userId', payload.sub as string);
      c.set('username', payload.username as string);
      c.set('role', payload.role as string);

      await next();
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  }
);

export const adminOnly = createMiddleware<{ Bindings: Env; Variables: { role: string } }>(
  async (c, next) => {
    if (c.get('role') !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }
    await next();
  }
);
