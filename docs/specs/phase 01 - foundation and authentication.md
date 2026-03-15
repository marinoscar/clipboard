# Phase 01 - Foundation and Authentication

## Overview

This phase establishes the project foundation including the monorepo structure, NestJS API with Fastify, React frontend with MUI, SQLite database via Prisma ORM, Google OAuth authentication with JWT tokens, and Docker development infrastructure.

## Goals

- Functional monorepo with API and Web apps
- SQLite database with Prisma ORM (WAL mode for concurrent access)
- Google OAuth login flow (redirect -> consent -> callback -> JWT)
- JWT access tokens (15 min) + httpOnly refresh token cookies (14 days)
- Token rotation on refresh (security best practice)
- Basic responsive UI with MUI, dark/light theme toggle
- Docker Compose setup for local development
- Nginx reverse proxy routing `/api` to backend, `/` to frontend

## Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Backend Framework | NestJS + Fastify | 11.x |
| Frontend Framework | React + TypeScript | 18.x |
| Build Tool (API) | SWC | 1.x |
| Build Tool (Web) | Vite | 7.x |
| UI Library | MUI (Material-UI) | 5.x |
| ORM | Prisma Client | 5.x |
| Database | SQLite | WAL mode |
| Auth | Passport + JWT | 0.7 / 4.x |
| Container | Docker + Compose | v2 |
| Reverse Proxy | Nginx | Alpine |

## Project Structure

```
clipboard/
├── apps/
│   ├── api/                          # NestJS backend
│   │   ├── prisma/schema.prisma      # Database schema
│   │   ├── src/
│   │   │   ├── main.ts               # Fastify bootstrap
│   │   │   ├── app.module.ts          # Root module
│   │   │   ├── config/configuration.ts
│   │   │   ├── prisma/               # PrismaService + module
│   │   │   ├── auth/                 # Complete auth module
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/       # Google + JWT strategies
│   │   │   │   ├── guards/           # OAuth + JWT guards
│   │   │   │   ├── decorators/       # @Public(), @CurrentUser()
│   │   │   │   ├── interfaces/       # AuthenticatedUser, RequestUser
│   │   │   │   └── tasks/            # Token cleanup cron
│   │   │   ├── health/               # Health check endpoint
│   │   │   └── common/               # Filters, interceptors, middleware
│   │   ├── Dockerfile                # Multi-stage (dev + prod)
│   │   └── package.json
│   └── web/                          # React frontend
│       ├── src/
│       │   ├── main.tsx              # React entry point
│       │   ├── App.tsx               # Routes + providers
│       │   ├── services/api.ts       # API client with token mgmt
│       │   ├── contexts/             # Auth + Theme contexts
│       │   ├── components/           # Common, auth, navigation
│       │   ├── pages/               # Login, AuthCallback, Home
│       │   ├── theme/               # MUI light/dark themes
│       │   └── types/               # TypeScript interfaces
│       ├── Dockerfile               # Multi-stage (dev + prod)
│       ├── vite.config.ts
│       └── package.json
├── infra/
│   ├── compose/
│   │   ├── base.compose.yml         # Core services
│   │   ├── dev.compose.yml          # Dev overrides (hot reload)
│   │   ├── prod.compose.yml         # Prod overrides
│   │   └── .env.example             # Environment template
│   └── nginx/nginx.conf             # Reverse proxy config
├── docs/specs/                       # Phase specifications
└── package.json                      # Workspace root
```

## Database Schema

### User
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | String (unique) | User email |
| displayName | String? | Display name |
| profileImageUrl | String? | Profile picture URL |
| googleId | String (unique) | Google OAuth ID |
| isActive | Boolean | Account active flag |
| isAdmin | Boolean | Admin flag |
| createdAt | DateTime | Created timestamp |
| updatedAt | DateTime | Updated timestamp |

### RefreshToken
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| userId | String (FK) | User reference |
| tokenHash | String (unique) | SHA-256 hash of token |
| expiresAt | DateTime | Token expiry |
| createdAt | DateTime | Created timestamp |
| revokedAt | DateTime? | Revocation timestamp |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/providers` | Public | List enabled OAuth providers |
| GET | `/api/auth/google` | Public | Redirect to Google OAuth |
| GET | `/api/auth/google/callback` | Public | Google OAuth callback |
| GET | `/api/auth/me` | JWT | Get current user info |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | JWT | Logout (revoke token) |
| GET | `/api/health` | Public | Health check |

## Authentication Flow

### Login Flow
1. User clicks "Sign in with Google" on `/login`
2. Frontend redirects to `/api/auth/google`
3. GoogleOAuthGuard redirects to Google consent screen
4. User authorizes, Google redirects to `/api/auth/google/callback`
5. GoogleStrategy validates response, extracts profile
6. AuthService creates/finds user, generates JWT + refresh token
7. Refresh token set as httpOnly cookie (`refresh_token`, path `/api/auth`)
8. User redirected to `/auth/callback?token=JWT&expiresIn=900`
9. AuthCallbackPage stores JWT in memory, fetches user via `/auth/me`
10. User redirected to return URL (or `/`)

### Token Refresh Flow
1. API call returns 401 (JWT expired)
2. ApiService calls `POST /api/auth/refresh` (sends cookie automatically)
3. Server validates refresh token, rotates it (revoke old, create new)
4. New access token + refresh token cookie returned
5. ApiService retries original request with new token

### Security Features
- JWT stored in memory only (not localStorage) - XSS resistant
- Refresh token in httpOnly, secure, SameSite=lax cookie - CSRF resistant
- Token rotation on refresh - limits reuse window
- Refresh token reuse detection - revokes all user tokens
- SHA-256 hashed tokens in database - limits exposure if DB leaked
- Hourly cleanup of expired/revoked tokens

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |
| PORT | 3000 | API port |
| APP_URL | http://localhost:8320 | Application URL |
| DATABASE_URL | file:./data/clipboard.db | SQLite path |
| JWT_SECRET | (required) | JWT signing secret |
| JWT_ACCESS_TTL_MINUTES | 15 | Access token TTL |
| JWT_REFRESH_TTL_DAYS | 14 | Refresh token TTL |
| GOOGLE_CLIENT_ID | (required) | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | (required) | Google OAuth client secret |
| GOOGLE_CALLBACK_URL | (required) | OAuth callback URL |
| INITIAL_ADMIN_EMAIL | (optional) | First admin email |
| S3_BUCKET | (phase 2) | S3 bucket name |
| S3_REGION | us-east-1 | S3 region |
| AWS_ACCESS_KEY_ID | (phase 2) | AWS access key |
| AWS_SECRET_ACCESS_KEY | (phase 2) | AWS secret key |

## Running Locally

### Without Docker
```bash
# Install dependencies
npm install

# Generate Prisma client
cd apps/api && npx prisma generate && npx prisma migrate dev && cd ../..

# Create .env file in apps/api/
cp infra/compose/.env.example apps/api/.env

# Start API (terminal 1)
npm run api:dev

# Start Web (terminal 2)
npm run web:dev
```

### With Docker
```bash
# Copy environment file
cp infra/compose/.env.example infra/compose/.env
# Edit .env with your Google OAuth credentials

# Start all services
npm run docker:dev
```

## Testing Checklist

- [ ] Navigate to `http://localhost:8320` - redirected to `/login`
- [ ] Login page shows "Clipboard" branding and Google sign-in button
- [ ] Click "Sign in with Google" - redirected to Google consent
- [ ] After Google auth - redirected to home page with welcome message
- [ ] User name/avatar shown in top-right corner
- [ ] Theme toggle (dark/light) works
- [ ] Refresh page - session persists (refresh token cookie)
- [ ] Click Logout - returned to login page
- [ ] `/api/health` returns `{ "status": "ok" }`
- [ ] `/api/docs` shows Swagger UI
- [ ] First user automatically gets admin flag

## Dependencies on Other Phases

None - this is the foundation phase.

## What Phase 2 Builds On

- Auth module (JWT guard, @CurrentUser decorator)
- Prisma schema (adds ClipboardItem, SystemSettings models)
- API structure (adds clipboard module, storage module)
- Frontend structure (adds clipboard page, components, hooks)
- Docker infrastructure (unchanged)
