import { Hono } from 'hono';
import type { Env } from '../index';
import { createWSMessage } from '@mcpanel/shared';
import { modUploadSchema, modDeleteSchema, modToggleSchema } from '@mcpanel/shared';

export const modsRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ─── List Mods ───
modsRoutes.get('/', async (c) => {
  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('mods:list', {});
  await forwardToAgent(c.env, serverId, msg);
  return c.json({ message: 'Mod list requested, check WebSocket for response' });
});

// ─── Upload Mod ───
modsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const result = modUploadSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid upload', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('mods:upload', result.data);
  await forwardToAgent(c.env, serverId, msg);

  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'mods:upload', JSON.stringify({ filename: result.data.filename })).run();

  return c.json({ message: 'Mod upload sent to agent' });
});

// ─── Delete Mod ───
modsRoutes.delete('/:name', async (c) => {
  const filename = c.req.param('name');
  const result = modDeleteSchema.safeParse({ filename });
  if (!result.success) {
    return c.json({ error: 'Invalid filename', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('mods:delete', { filename });
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'Delete command sent' });
});

// ─── Toggle Mod ───
modsRoutes.patch('/:name', async (c) => {
  const filename = c.req.param('name');
  const body = await c.req.json();
  const result = modToggleSchema.safeParse({ filename, enabled: body.enabled });
  if (!result.success) {
    return c.json({ error: 'Invalid toggle', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('mods:toggle', result.data);
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'Toggle command sent' });
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
