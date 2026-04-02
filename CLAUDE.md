# CLAUDE.md

This file provides guidance for AI assistants working on this codebase.

## Project Overview

**Clipboard** — A universal clipboard web application that allows authenticated users to paste/upload any content (text, images, files, media) and access it across all devices in real-time. Items can be shared publicly via unique URLs. The app supports large file uploads (multi-GB), works as an installable PWA with Android Share Target support, and enforces configurable retention policies.

## Technology Stack

- **Backend**: Node.js + TypeScript, NestJS 11 with Fastify adapter
- **Frontend**: React 18 + TypeScript, Material UI 5 (MUI), Vite 7
- **Database**: SQLite with Prisma ORM (WAL mode, file-based)
- **File Storage**: AWS S3 (direct upload for small files, presigned multipart for large files)
- **Auth**: Google OAuth via Passport + JWT access tokens + httpOnly refresh token cookies
- **Real-time**: Socket.IO for cross-device clipboard sync
- **Testing**: Jest + Supertest (backend), Vitest + React Testing Library (frontend)
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (same-origin routing)

## Repository Structure

```
/
  apps/
    api/                    # Backend API (NestJS + Fastify)
      src/
      test/
      prisma/
        schema.prisma
        migrations/
      Dockerfile
    web/                    # Frontend React app (Vite + MUI)
      src/
      public/
      Dockerfile
  tools/
    clipcli/                # CLI tool (Commander.js + TypeScript)
      bin/clipcli.js        # Entry point
      src/                  # TypeScript source
      install.sh            # System-wide install script
  docs/
    specs/                  # Phase specification documents (phases 01-06)
  infra/
    compose/
      base.compose.yml      # Core services: api, web, nginx
      dev.compose.yml        # Development overrides (hot reload, volumes)
      prod.compose.yml       # Production overrides (resource limits)
      .env.example           # Environment variables template
    nginx/
      nginx.conf             # Nginx routing configuration
```

## Implementation Phases

The project is built in 6 sequential phases. Each phase has a detailed spec in `docs/specs/`:

1. **Phase 01 - Foundation & Auth** — Monorepo, NestJS, React, SQLite, Google OAuth, Docker
2. **Phase 02 - Core Clipboard** — Paste (Ctrl+V), drag-drop, file upload, S3, item list
3. **Phase 03 - Real-time & Large Upload** — Socket.IO sync, multipart S3 upload, progress
4. **Phase 04 - Sharing & Retention** — Public share links, admin settings, archive/delete crons
5. **Phase 05 - PWA & Mobile** — Manifest, service worker, Share Target API, mobile layout
6. **Phase 06 - Deployment & Docs** — Production Docker, README, API/Architecture docs

**Always read the relevant phase spec before implementing.** The specs contain exact file lists, API endpoints, implementation details, and testing checklists.

## Architecture Principles

1. **Separation of Concerns**: UI handles presentation only; API handles all business logic
2. **Same-Origin Hosting**: UI at `/`, API at `/api`, Swagger at `/api/docs`
3. **Security by Default**: All API endpoints require JWT or PAT authentication unless decorated with `@Public()`
4. **API-First**: All business logic resides in the API layer
5. **Simplified Auth**: No RBAC tables — just `isAdmin` boolean on User model (Google OAuth + Personal Access Tokens)

## MANDATORY: Testing Requirements

**Every code change MUST include corresponding tests.** This is non-negotiable.

### Testing Rules

1. **No code without tests.** Every new service, controller, hook, or component must have a test file.
2. **Test in the same commit or the next immediate commit.** Do not leave untested code.
3. **Test the behavior, not the implementation.** Focus on inputs/outputs and side effects.
4. **Mock external dependencies.** Database (Prisma), S3, OAuth — never hit real services in tests.

### API Tests (Jest)

- **Location**: Co-located with source files as `*.spec.ts` (e.g., `auth.service.spec.ts`)
- **Config**: `apps/api/test/jest.config.js`
- **Run**: `cd apps/api && npm test` (or via Docker: `docker run --rm -v $(pwd):/app -w /app/apps/api node:20-slim sh -c "npx jest --config ./test/jest.config.js"`)
- **Patterns**:
  - Use `@nestjs/testing` Test.createTestingModule() for dependency injection
  - Mock PrismaService with `jest.fn()` for each model method
  - Mock ConfigService, JwtService, and external providers
  - Test services for business logic, controllers for routing/guards
  - Test error cases (unauthorized, forbidden, not found, validation)

```typescript
// Example: Service test
const module = await Test.createTestingModule({
  providers: [
    MyService,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: ConfigService, useValue: mockConfig },
  ],
}).compile();
```

### Web Tests (Vitest)

- **Location**: Co-located as `*.test.ts` or `*.test.tsx` (e.g., `api.test.ts`, `LoadingSpinner.test.tsx`)
- **Config**: `apps/web/vitest.config.ts`
- **Setup**: `apps/web/src/__tests__/setup.ts` (mocks: matchMedia, localStorage, sessionStorage)
- **Run**: `cd apps/web && npx vitest run` (or via Docker: `docker run --rm -v $(pwd):/app -w /app/apps/web node:20-slim sh -c "npx vitest run --config vitest.config.ts"`)
- **Patterns**:
  - Use `vi.mock()` for module mocking, `vi.fn()` for function mocking
  - Use `render()` from @testing-library/react for component tests
  - Use `renderHook()` for hook tests
  - Use `waitFor()` for async assertions
  - Mock fetch globally with `vi.stubGlobal('fetch', mockFetch)` for API tests
  - Test loading, error, and success states

```typescript
// Example: Component test
import { render, screen } from '@testing-library/react';
render(<MyComponent />);
expect(screen.getByText('Hello')).toBeInTheDocument();
```

### What Must Be Tested

| Layer | What to test | Example |
|-------|-------------|---------|
| API Services | Business logic, DB queries, error handling | `auth.service.spec.ts` |
| API Controllers | Route mapping, guards, validation | `clipboard.controller.spec.ts` |
| API Guards/Interceptors | Auth checks, response transforms | `transform.interceptor.spec.ts` |
| Web Hooks | Data fetching, state management | `useClipboard.test.ts` |
| Web Components | Rendering, user interactions | `ClipboardItemCard.test.tsx` |
| Web Services | API calls, token handling | `api.test.ts` |

## MANDATORY: Commit Rules

### Core Rules
1. **Commit early, commit often.** Do not leave large uncommitted change sets.
2. Each commit must be **small, coherent, and reviewable**.
3. **One intent per commit** (no "misc fixes" bundles).
4. If you change behavior, you must add/adjust tests in the same commit or the next immediate commit.

### Commit Message Format
```
<type>(<scope>): <short imperative summary>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
Scopes: `api`, `web`, `db`, `infra`, `auth`, `clipboard`, `ui`, `storage`, `gateway`, `settings`

### Commit Cadence
1. **Scaffold** — New files, routes, basic plumbing
2. **Core functionality** — Smallest working slice
3. **Edge cases + validation** — Error handling
4. **Tests** — Unit tests for new behavior
5. **Cleanup** — Related refactors only

## Key Commands

```bash
# Development with Docker (recommended)
docker compose -f infra/compose/base.compose.yml -f infra/compose/dev.compose.yml up --build

# Production
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d

# Run API tests (via Docker since no Node.js on host)
docker run --rm -v $(pwd):/app -w /app/apps/api node:20-slim \
  sh -c "apt-get update -qq && apt-get install -y -qq openssl > /dev/null 2>&1 && \
  DATABASE_URL='file:./test.db' npx prisma generate > /dev/null 2>&1 && \
  npx jest --config ./test/jest.config.js"

# Run Web tests (via Docker)
docker run --rm -v $(pwd):/app -w /app/apps/web node:20-slim \
  sh -c "npx vitest run --config vitest.config.ts"

# Generate Prisma client after schema changes
cd apps/api && npx prisma generate

# Create a new migration
cd apps/api && DATABASE_URL="file:./data/clipboard.db" npx prisma migrate dev --name <name>

# Apply migrations (production)
cd apps/api && npx prisma migrate deploy

# CLI tool (clipcli)
cd tools/clipcli && ./install.sh          # Install globally
clipcli --help                            # Show all commands
clipcli auth login                        # Authenticate with a PAT
clipcli copy "text"                       # Create text item
clipcli upload ./file.pdf                 # Upload file
clipcli list --json                       # List items as JSON
```

## Service URLs

**VPS (production):**
- **Application**: https://clipboard.dev.marin.cr
- **Swagger UI**: https://clipboard.dev.marin.cr/api/docs
- **Health Check**: https://clipboard.dev.marin.cr/api/health

**Local Docker (development):**
- **Application**: http://localhost:8320
- **Swagger UI**: http://localhost:8320/api/docs

## VPS Deployment

The app runs on a VPS at `clipboard.dev.marin.cr` (port 8320):
- Host Nginx handles SSL termination with wildcard cert for `*.dev.marin.cr`
- Host Nginx map: `clipboard.dev.marin.cr → 127.0.0.1:8320`
- Config: `/etc/nginx/sites-available/dev-wildcard`
- Google OAuth callback: `https://clipboard.dev.marin.cr/api/auth/google/callback` (registered in Google Console)

## Environment Variables

Key variables (see `infra/compose/.env.example` for full list):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite file path (e.g., `file:/data/clipboard.db`) |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `S3_BUCKET` / `S3_REGION` | AWS S3 bucket config |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `INITIAL_ADMIN_EMAIL` | First user with this email becomes admin |

## Database

- **SQLite** with Prisma ORM (not PostgreSQL)
- WAL mode enabled via `$queryRawUnsafe('PRAGMA journal_mode=WAL;')` in PrismaService
- Schema includes all models upfront (User, RefreshToken, PersonalAccessToken, ClipboardItem, UploadChunk, SystemSettings)
- Migrations in `apps/api/prisma/migrations/`

## API Endpoints

### Authentication
- `GET /api/auth/providers` — List enabled OAuth providers (Public)
- `GET /api/auth/google` — Initiate Google OAuth (Public)
- `GET /api/auth/google/callback` — OAuth callback (Public)
- `GET /api/auth/me` — Get current user (JWT or PAT)
- `POST /api/auth/refresh` — Refresh access token (Cookie)
- `POST /api/auth/logout` — Logout (JWT)
- `POST /api/auth/tokens` — Create personal access token (JWT or PAT)
- `GET /api/auth/tokens` — List user's PATs (JWT or PAT)
- `DELETE /api/auth/tokens/:id` — Revoke a PAT (JWT or PAT)

### Clipboard
- `POST /api/clipboard` — Create text item
- `POST /api/clipboard/upload` — Upload file (multipart, < 100MB)
- `GET /api/clipboard` — List items (paginated)
- `GET /api/clipboard/:id` — Get item
- `PATCH /api/clipboard/:id` — Update item
- `DELETE /api/clipboard/:id` — Soft-delete item
- `GET /api/clipboard/:id/download` — Get signed download URL

### Health
- `GET /api/health` — Health check (Public)

## Common Patterns

### Adding a New API Module
1. Create `src/<module>/<module>.module.ts`, `.controller.ts`, `.service.ts`
2. Create DTOs with Zod schemas in `src/<module>/dto/`
3. Register module in `src/app.module.ts`
4. Write tests: `*.spec.ts` for service and controller
5. Use `@CurrentUser()` decorator for authenticated user
6. Use `@Public()` decorator for unauthenticated endpoints

### Adding a New Frontend Page
1. Create page in `src/pages/<PageName>.tsx`
2. Add lazy import and route in `src/App.tsx`
3. Create hooks in `src/hooks/` for data fetching
4. Create components in `src/components/<feature>/`
5. Write tests: `*.test.tsx` for components, `*.test.ts` for hooks
6. Add API functions to `src/services/api.ts`

## Security Notes

- JWT stored in memory only (not localStorage) — XSS resistant
- Refresh token in httpOnly, secure, SameSite=lax cookie — CSRF resistant
- Token rotation on refresh with reuse detection
- Google OAuth strategy uses `proxy: true` for reverse proxy compatibility
- All file uploads go to S3 (never stored locally)
- Input validation via Zod on all endpoints
- Personal Access Tokens (PATs) stored as SHA256 hash, prefixed with `clip_`
- PAT auth handled in JwtAuthGuard — tokens starting with `clip_` bypass JWT validation
- CLI stores PAT in `~/.config/clipcli/auth.json` with 0o600 permissions

## Known Gotchas

- SQLite PRAGMAs must use `$queryRawUnsafe()` not `$executeRawUnsafe()` (they return results)
- Swagger requires `@fastify/static` package with Fastify adapter
- Google OAuth strategy needs `proxy: true` when behind Nginx reverse proxy
- Prisma migrate must run inside the container (SQLite file is in Docker volume)
- No Node.js on the host — all commands run via Docker
- Nginx config is split: `nginx.conf` (prod, web on port 80) and `nginx.dev.conf` (dev, web on port 5173) — dev.compose.yml mounts the dev variant
- Web `tsconfig.json` excludes test files (`*.test.ts/tsx`, `*.spec.ts/tsx`, `__tests__/`) to prevent build failures
