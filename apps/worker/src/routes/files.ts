import { Hono } from 'hono';
import type { Env } from '../index';
import { createWSMessage } from '@mcpanel/shared';
import { filePathSchema, fileWriteSchema, fileDeleteSchema } from '@mcpanel/shared';

export const filesRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ─── List Files ───
filesRoutes.get('/', async (c) => {
  const dirPath = c.req.query('path') || '.';
  const result = filePathSchema.safeParse({ path: dirPath });
  if (!result.success && dirPath !== '.') {
    return c.json({ error: 'Invalid path', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('files:list', { path: dirPath });
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'File list requested' });
});

// ─── Read File ───
filesRoutes.get('/read', async (c) => {
  const filePath = c.req.query('path');
  if (!filePath) return c.json({ error: 'Path required' }, 400);

  const result = filePathSchema.safeParse({ path: filePath });
  if (!result.success) {
    return c.json({ error: 'Invalid path', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('files:read', { path: filePath });
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'File read requested' });
});

// ─── Write File ───
filesRoutes.put('/write', async (c) => {
  const body = await c.req.json();
  const result = fileWriteSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid write request', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('files:write', result.data);
  await forwardToAgent(c.env, serverId, msg);

  await c.env.mcpanel_db.prepare(
    'INSERT INTO audit_log (user_id, server_id, action, details) VALUES (?, ?, ?, ?)'
  ).bind(c.get('userId'), serverId, 'files:write', JSON.stringify({ path: result.data.path })).run();

  return c.json({ message: 'File write sent' });
});

// ─── Delete File ───
filesRoutes.delete('/', async (c) => {
  const body = await c.req.json();
  const result = fileDeleteSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: 'Invalid delete request', details: result.error.flatten() }, 400);
  }

  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('files:delete', result.data);
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'Delete command sent' });
});

// ─── Upload File ───
filesRoutes.post('/upload', async (c) => {
  const body = await c.req.json();
  const serverId = c.req.param('serverId') || 'default';
  const msg = createWSMessage('files:upload', body);
  await forwardToAgent(c.env, serverId, msg);

  return c.json({ message: 'Upload sent to agent' });
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
