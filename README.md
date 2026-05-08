# MCPanel — Minecraft Forge Server Management Panel

A production-grade, self-hosted Minecraft Forge 1.20.1 server management panel built for Debian Linux servers behind DS-Lite/CGNAT.

## Architecture

```
Browser → Cloudflare Pages (Next.js) → Cloudflare Worker API → Durable Object (WS) → Debian Agent → Minecraft Server
```

**Key design**: The Debian agent connects *outbound* to Cloudflare via WebSocket — no incoming ports needed except Minecraft itself through Playit.gg.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TailwindCSS v4, shadcn/ui |
| Backend | Cloudflare Workers, Hono, Durable Objects |
| Database | Cloudflare D1 (SQLite) |
| Auth | JWT (jose, PBKDF2) |
| Agent | Node.js 20+, TypeScript |
| Monorepo | Turborepo, pnpm |

## Features

- **Dashboard** — Server status, CPU, RAM, TPS, players, uptime
- **Server Controls** — Start, stop, restart, force kill, console commands
- **Live Console** — Real-time log streaming with ANSI colors, filtering, search
- **Mod Manager** — Upload/delete/toggle mods, JAR metadata parsing, client-only detection
- **File Manager** — Browse, edit, upload, delete with sandbox protection
- **World Management** — Delete, regenerate, custom seed
- **Real-time** — WebSocket-driven live updates across all features
- **Security** — JWT auth, rate limiting, command allowlist, filesystem sandboxing

## Project Structure

```
├── apps/
│   ├── web/          # Next.js 15 frontend
│   └── worker/       # Cloudflare Worker + Durable Objects
├── packages/
│   ├── shared/       # Shared types, Zod schemas, constants
│   └── agent/        # Debian server agent (Node.js)
```

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Cloudflare account (free tier works)
- Debian Linux server with Java 17+

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your JWT_SECRET and AGENT_TOKEN
```

### 3. Local development
```bash
# Terminal 1: Start all dev servers
pnpm dev

# This starts:
# - Next.js on http://localhost:3000
# - Wrangler dev on http://localhost:8787
# - Agent in watch mode
```

### 4. Setup D1 database (local)
```bash
cd apps/worker
npx wrangler d1 migrations apply mcpanel-db --local
```

### 5. Create admin account
Visit `http://localhost:3000/login` and click "First time? Create admin account"

## Deployment

### Frontend → Cloudflare Pages
```bash
cd apps/web && npx wrangler pages deploy .next
```

### Worker → Cloudflare Workers
```bash
cd apps/worker
npx wrangler secret put JWT_SECRET
npx wrangler secret put AGENT_TOKEN
npx wrangler d1 create mcpanel-db
# Update wrangler.toml with the D1 database ID
npx wrangler d1 migrations apply mcpanel-db --remote
npx wrangler deploy
```

### Agent → Debian Server
```bash
# On Debian server:
git clone <repo> /opt/mcpanel-agent
cd /opt/mcpanel-agent/packages/agent
npm install && npm run build
cp .env.example .env  # Configure WORKER_WS_URL, AGENT_TOKEN, MC_SERVER_DIR
sudo cp agent.service /etc/systemd/system/mcpanel-agent.service
sudo systemctl enable --now mcpanel-agent
```

### Playit.gg (Minecraft tunneling)
Download and run the Playit.gg agent separately on the same Debian server for Minecraft port tunneling.

## Security

- PBKDF2 password hashing (100k iterations)
- JWT access tokens (15min) + refresh tokens (7 days)
- Agent authenticates via pre-shared token
- Filesystem sandboxed to MC server directory
- Directory traversal prevention
- Command injection prevention (no shell execution)
- Rate limiting (120 req/min)
- Upload validation (JAR structure, size limits)

## License

MIT
