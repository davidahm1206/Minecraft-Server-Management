-- Migration 0001: Initial schema
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin','viewer')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Servers (multi-server ready)
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  agent_token_hash TEXT NOT NULL,
  forge_version TEXT,
  mc_version TEXT DEFAULT '1.20.1',
  status TEXT DEFAULT 'offline' CHECK(status IN ('online','offline','starting','stopping','crashed')),
  last_seen_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id),
  server_id TEXT REFERENCES servers(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Command allowlist
CREATE TABLE IF NOT EXISTS allowed_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT REFERENCES servers(id),
  pattern TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
