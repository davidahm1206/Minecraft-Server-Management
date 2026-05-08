import { Hono } from 'hono';
import type { Env } from '../index';
import { createWSMessage } from '@mcpanel/shared';
import { serverCommandSchema } from '@mcpanel/shared';

export const serverRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; role: string } }>();

// ─── List Servers ───
serverRoutes.get('/', async (c) => {
  const servers = await c.env.DB.prepare('SELECT * FROM servers').all();
  return c.json({ servers: servers.results });
});

// ─── Get Server Details ───
serverRoutes.get('/:serverId', async (c) => {
  const { serverId } = c.req.param();
  const server = await c.env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first();
  if (!server) return c.json({ error: 'Server not found' }, 404);
  return c.json({ server });
});

// ─── Start Server ───
serverRoutes.post('/:serverId/start', async (c) => {
  const { serverId } = c.req.param();
  const msg = createWSMessage('server:start', {});
  await forwardToAgent(c.env, serverId, msg);

  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, server_id, action) VALUES (?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'server:start').run();

  return c.json({ message: 'Start command sent' });
});

// ─── Stop Server ───
serverRoutes.post('/:serverId/stop', async (c) => {
  const body = await c.req.json().catch(() => ({ graceful: true }));
  const msg = createWSMessage('server:stop', { graceful: body.graceful ?? true });
  const { serverId } = c.req.param();
  await forwardToAgent(c.env, serverId, msg);

  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'server:stop', JSON.stringify(body)).run();

  return c.json({ message: 'Stop command sent' });
});

// ─── Restart Server ───
serverRoutes.post('/:serverId/restart', async (c) => {
  const { serverId } = c.req.param();
  const msg = createWSMessage('server:restart', {});
  await forwardToAgent(c.env, serverId, msg);

  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, server_id, action) VALUES (?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'server:restart').run();

  return c.json({ message: 'Restart command sent' });
});

// ─── Send Console Command ───
serverRoutes.post('/:serverId/command', async (c) => {
  const body = await c.req.json();
  const result = serverCommandSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid command', details: result.error.flatten() }, 400);
  }

  const { serverId } = c.req.param();
  const msg = createWSMessage('server:command', { command: result.data.command });
  await forwardToAgent(c.env, serverId, msg);

  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'server:command', JSON.stringify({ command: result.data.command })).run();

  return c.json({ message: 'Command sent' });
});

// ─── Helper: Forward to Agent via DO ───
async function forwardToAgent(env: Env, serverId: string, message: object): Promise<void> {
  const id = env.AGENT_SESSION.idFromName(serverId);
  const stub = env.AGENT_SESSION.get(id);

  // Use DO's internal storage to forward — the DO will relay to the agent WS
  // We send via a POST request to the DO
  await stub.fetch(new Request('https://internal/forward', {
    method: 'POST',
    body: JSON.stringify(message),
    headers: { 'Content-Type': 'application/json' },
  }));
}
