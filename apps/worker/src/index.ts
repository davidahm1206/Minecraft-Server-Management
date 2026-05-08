import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { serverRoutes } from './routes/server';
import { modsRoutes } from './routes/mods';
import { filesRoutes } from './routes/files';
import { worldsRoutes } from './routes/worlds';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';

export { AgentSession } from './durable-objects/agent-session';

export interface Env {
  mcpanel_db: D1Database;
  AGENT_SESSION: DurableObjectNamespace;
  JWT_SECRET: string;
  AGENT_TOKEN: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ───
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://*.pages.dev'],
  credentials: true,
}));

// ─── Health Check ───
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// ─── Auth Routes (public) ───
app.route('/api/auth', authRoutes);

// ─── WebSocket Upgrade ───
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket', 426);
  }

  // Determine role: agent uses x-agent-token header, browser uses JWT query param
  const agentToken = c.req.header('x-agent-token');
  const jwt = c.req.query('token');
  let role: 'agent' | 'browser';

  if (agentToken) {
    // Validate agent token
    const encoder = new TextEncoder();
    const data = encoder.encode(agentToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');

    // Check against stored hash (simplified: uses env directly for single-agent)
    const expectedHash = await hashAgentToken(c.env.AGENT_TOKEN);
    if (hashHex !== expectedHash) {
      return c.text('Unauthorized', 401);
    }
    role = 'agent';
  } else if (jwt) {
    try {
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      await jwtVerify(jwt, secret);
      role = 'browser';
    } catch {
      return c.text('Unauthorized', 401);
    }
  } else {
    return c.text('Unauthorized', 401);
  }

  // Route to Durable Object — single server ID for now
  const serverId = c.req.query('serverId') || 'default';
  const id = c.env.AGENT_SESSION.idFromName(serverId);
  const stub = c.env.AGENT_SESSION.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set('role', role);

  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// ─── Protected API Routes ───
const api = new Hono<{ Bindings: Env }>();
api.use('*', authMiddleware);
api.use('*', rateLimitMiddleware);
api.route('/servers', serverRoutes);
api.route('/servers/:serverId/mods', modsRoutes);
api.route('/servers/:serverId/files', filesRoutes);
api.route('/servers/:serverId/worlds', worldsRoutes);
app.route('/api', api);

// ─── 404 ───
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// ─── Error Handler ───
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

async function hashAgentToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default app;
