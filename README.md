# Clipboard

A universal clipboard web application that lets you paste, upload, and access any content — text, images, files, media — across all your devices in real-time. Items can be shared publicly via unique URLs. Supports large file uploads (multi-GB), works as an installable PWA with Android Share Target, and enforces configurable retention policies.

## Features

- **Universal Paste** — Tap the Paste button for text and images, or press Ctrl+V / Cmd+V for text, images, and files
- **File Upload** — Upload files via the Upload button, or drag and drop anywhere on the page (desktop)
- **Camera Capture** — Snap a photo directly from your mobile device's camera
- **Cross-Device Sync** — Real-time synchronization via WebSockets; changes appear instantly on all logged-in devices
- **Large File Upload** — S3 multipart upload supports multi-GB files with progress tracking and cancellation
- **Public Sharing** — Generate unique share links for any item; recipients need no account
- **Favorites** — Star important items to pin them and protect them from auto-archival retention policies
- **Archive & Restore** — Archive items to declutter your clipboard; restore or permanently delete from the archive
- **Batch Operations** — Multi-select items for bulk archive, restore, or delete
- **Installable PWA** — Add to home screen on mobile; runs in standalone mode without browser chrome
- **Android Share Target** — Share content from any Android app directly into Clipboard
- **Mobile-First UI** — Floating action buttons, bottom navigation, icon-only controls on small screens
- **Welcome Guide** — Interactive onboarding dialog on first visit; re-accessible via the help button
- **Retention Policies** — Admin-configurable auto-archive and auto-delete with scheduled cron jobs
- **Dark / Light Theme** — Toggle between themes via the user menu; preference persists across sessions
- **Google OAuth** — Secure sign-in with token rotation and reuse detection

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, NestJS 11, Fastify |
| Frontend | React 18, TypeScript, Material UI 5, Vite 7 |
| Database | SQLite (WAL mode) with Prisma ORM |
| File Storage | AWS S3 (direct + presigned multipart upload) |
| Real-time | Socket.IO |
| Auth | Google OAuth, Passport, JWT + httpOnly refresh cookies |
| PWA | Web App Manifest, Service Worker, Share Target API |
| Infrastructure | Docker, Docker Compose, Nginx reverse proxy |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Google OAuth credentials ([console.cloud.google.com](https://console.cloud.google.com))
- AWS S3 bucket with CORS configured for your domain

### 1. Clone and configure

```bash
git clone https://github.com/marinoscar/clipboard.git
cd clipboard
cp infra/compose/.env.example infra/compose/.env
```

Edit `infra/compose/.env` with your credentials:

```env
JWT_SECRET=your-jwt-secret-at-least-32-characters-long
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8320/api/auth/google/callback
S3_BUCKET=your-s3-bucket-name
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
INITIAL_ADMIN_EMAIL=you@example.com
```

### 2. Run (development)

```bash
docker compose -f infra/compose/base.compose.yml -f infra/compose/dev.compose.yml up --build
```

Open [http://localhost:8320](http://localhost:8320). The dev setup includes hot reload for both API and frontend.

### 3. Run (production)

```bash
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d
```

The API automatically runs Prisma migrations on startup. Production containers restart automatically and have resource limits configured.

## Project Structure

```
├── apps/
│   ├── api/                  # NestJS backend (Fastify)
│   │   ├── src/              # Source code (modules, services, controllers)
│   │   ├── prisma/           # Schema and migrations
│   │   └── test/             # Jest configuration
│   └── web/                  # React frontend (Vite)
│       ├── src/              # Components, hooks, services, pages
│       └── public/           # PWA manifest, service worker, icons
├── infra/
│   ├── compose/              # Docker Compose files + .env
│   └── nginx/                # Nginx configs (prod + dev)
└── docs/
    └── specs/                # Phase specification documents
```

## API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/providers` | Public | List enabled OAuth providers |
| GET | `/api/auth/google` | Public | Initiate Google OAuth flow |
| GET | `/api/auth/google/callback` | Public | OAuth callback |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | JWT | Logout and revoke tokens |

### Clipboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard` | JWT | Create text item |
| POST | `/api/clipboard/upload` | JWT | Upload file (< 100 MB) |
| GET | `/api/clipboard` | JWT | List items (paginated, filterable) |
| GET | `/api/clipboard/:id` | JWT | Get single item |
| PATCH | `/api/clipboard/:id` | JWT | Update item |
| DELETE | `/api/clipboard/:id` | JWT | Soft-delete item |
| GET | `/api/clipboard/:id/download` | JWT | Get signed download URL |
| POST | `/api/clipboard/batch` | JWT | Batch archive, restore, or delete (up to 100 items) |

### Large File Upload (Multipart)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard/upload/init` | JWT | Initialize multipart upload |
| GET | `/api/clipboard/upload/:id/url` | JWT | Get presigned URL for part |
| POST | `/api/clipboard/upload/:id/part` | JWT | Record uploaded part (eTag, size) |
| POST | `/api/clipboard/upload/:id/complete` | JWT | Finalize upload |
| POST | `/api/clipboard/upload/:id/abort` | JWT | Abort upload |

### Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/clipboard/:id/share` | JWT | Generate public share link |
| DELETE | `/api/clipboard/:id/share` | JWT | Revoke share link |
| GET | `/api/share/:shareToken` | Public | View shared item |
| GET | `/api/share/:shareToken/download` | Public | Download shared file |

### Admin Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings/system` | Admin | Get system settings |
| PATCH | `/api/settings/system` | Admin | Update system settings |

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Health check |

Swagger UI is available at `/api/docs` when the server is running.

## Architecture

```
Internet (HTTPS)
  │
  ▼
Host Nginx (SSL termination)
  │
  ▼  :8320
Docker Compose
  ├─ Nginx ─────┬── /api, /socket.io → API (NestJS + Fastify, port 3000)
  │             └── /                → Web (Nginx serving static build, port 80)
  ├─ API ────────── SQLite volume (/data/clipboard.db)
  │             └── AWS S3 (file storage)
  └─ Web ────────── Static React bundle
```

**Key design decisions:**

- **Same-origin hosting** — UI at `/`, API at `/api`. No CORS complexity for the frontend.
- **JWT in memory** — Access tokens are never stored in localStorage (XSS resistant). Refresh tokens use httpOnly secure cookies (CSRF resistant).
- **Token rotation** — Every refresh issues a new token and revokes the old one. Reuse detection flags compromised sessions.
- **SQLite** — Simple file-based database with WAL mode for concurrent reads. No external DB server needed.
- **S3 direct upload** — Large files go straight from browser to S3 via presigned URLs, bypassing the API server.
- **Socket.IO rooms** — Each user gets a room (`user:{id}`); events broadcast only to that user's devices.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | API server port |
| `APP_URL` | `http://localhost:8320` | Public-facing URL |
| `DATABASE_URL` | `file:/data/clipboard.db` | SQLite database path |
| `JWT_SECRET` | — | JWT signing secret (min 32 chars) |
| `JWT_ACCESS_TTL_MINUTES` | `15` | Access token lifetime |
| `JWT_REFRESH_TTL_DAYS` | `14` | Refresh token lifetime |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | — | OAuth callback URL |
| `S3_BUCKET` | — | AWS S3 bucket name |
| `S3_REGION` | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | — | AWS secret key |
| `INITIAL_ADMIN_EMAIL` | — | First user with this email becomes admin |
| `LOG_LEVEL` | `info` | Logging level |

## Testing

Tests run inside Docker (no Node.js required on the host):

```bash
# API tests (Jest)
docker run --rm -v $(pwd):/app -w /app/apps/api node:20-slim \
  sh -c "apt-get update -qq && apt-get install -y -qq openssl > /dev/null 2>&1 && \
  DATABASE_URL='file:./test.db' npx prisma generate > /dev/null 2>&1 && \
  npx jest --config ./test/jest.config.js"

# Web tests (Vitest)
docker run --rm -v $(pwd):/app -w /app/apps/web node:20-slim \
  sh -c "npx vitest run --config vitest.config.ts"
```

## Operations

### Database backup

```bash
docker cp compose-api-1:/data/clipboard.db ./backup-$(date +%Y%m%d).db
```

### Update deployment

```bash
git pull origin main
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d
```

### View logs

```bash
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml logs -f api
```