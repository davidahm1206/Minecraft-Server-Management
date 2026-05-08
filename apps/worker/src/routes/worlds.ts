import { Hono } from 'hono';
import type { Env } from '../index';
import { createWSMessage } from '@mcpanel/shared';
import { worldDeleteSchema, worldRegenerateSchema } from '@mcpanel/shared';

export const worldsRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ─── List Worlds ───
worldsRoutes.get('/', async (c) => {
  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('world:list', {});
  await forwardToAgent(c.env, serverId, msg);
  return c.json({ message: 'World list requested' });
});

// ─── Delete World ───
worldsRoutes.delete('/:name', async (c) => {
  const worldName = c.req.param('name');
  const result = worldDeleteSchema.safeParse({ worldName });
  if (!result.success) {
    return c.json({ error: 'Invalid world name', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('world:delete', { worldName });
  await forwardToAgent(c.env, serverId, msg);

  await c.env.mcpanel_db.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'world:delete', JSON.stringify({ worldName })).run();

  return c.json({ message: 'World delete command sent' });
});

// ─── Regenerate World ───
worldsRoutes.post('/regenerate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = worldRegenerateSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid request', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('world:regenerate', { seed: result.data.seed });
  await forwardToAgent(c.env, serverId, msg);

  await c.env.mcpanel_db.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'world:regenerate', JSON.stringify(result.data)).run();

  return c.json({ message: 'World regeneration command sent' });
});

async function forwardToAgent(env: Env, serverId: string, message: object): Promise<void> {
  const id = env.AGENT_SESSION.idFromName(serverId);
  const stub = env.AGENT_SESSION.get(id);
  await stub.fetch(new Request('https://internal/forward', {
    method: 'POST',
    body: JSON.stringify(message),
    headers: { 'Content-Type': 'application/json' },
  }));
}
