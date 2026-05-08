import { Hono } from 'hono';
import * as jose from 'jose';
import type { Env } from '../index';

export const authRoutes = new Hono<{ Bindings: Env }>();

// ─── Login ───
authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  // Query user
  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash, role FROM users WHERE username = ?'
  ).bind(username).first<{ id: string; username: string; password_hash: string; role: string }>();

  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Verify password (using Web Crypto for PBKDF2)
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Generate tokens
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);

  const accessToken = await new jose.SignJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);

  const refreshToken = await new jose.SignJWT({
    sub: user.id,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  // Store refresh token hash
  const refreshHash = await hashString(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(user.id, refreshHash, expiresAt).run();

  // Audit log
  await c.env.DB.prepare(
    'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)'
  ).bind(user.id, 'login', JSON.stringify({ ip: c.req.header('cf-connecting-ip') })).run();

  return c.json({
    accessToken,
    refreshToken,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

// ─── Refresh Token ───
authRoutes.post('/refresh', async (c) => {
  const body = await c.req.json();
  const { refreshToken } = body;

  if (!refreshToken) {
    return c.json({ error: 'Refresh token required' }, 400);
  }

  try {
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(refreshToken, secret);

    if (payload.type !== 'refresh') {
      return c.json({ error: 'Invalid token type' }, 401);
    }

    // Verify refresh token exists in DB
    const tokenHash = await hashString(refreshToken);
    const stored = await c.env.DB.prepare(
      'SELECT id FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND expires_at > datetime("now")'
    ).bind(tokenHash, payload.sub).first();

    if (!stored) {
      return c.json({ error: 'Token revoked or expired' }, 401);
    }

    // Get user
    const user = await c.env.DB.prepare(
      'SELECT id, username, role FROM users WHERE id = ?'
    ).bind(payload.sub).first<{ id: string; username: string; role: string }>();

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Delete old refresh token
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id = ?').bind(stored.id).run();

    // Issue new tokens
    const newAccessToken = await new jose.SignJWT({
      sub: user.id,
      username: user.username,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(secret);

    const newRefreshToken = await new jose.SignJWT({
      sub: user.id,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const newRefreshHash = await hashString(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, newRefreshHash, expiresAt).run();

    return c.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
});

// ─── Setup (first-run admin creation) ───
authRoutes.post('/setup', async (c) => {
  // Only allow if no users exist
  const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
  if (count && count.count > 0) {
    return c.json({ error: 'Setup already completed' }, 403);
  }

  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password || password.length < 8) {
    return c.json({ error: 'Username and password (min 8 chars) required' }, 400);
  }

  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).bind(username, passwordHash, 'admin').run();

  return c.json({ message: 'Admin user created' });
});

// ─── Password Hashing (PBKDF2 via Web Crypto) ───
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = [...hashArray].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, storedHashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = [...new Uint8Array(derivedBits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHashHex;
}

async function hashString(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
