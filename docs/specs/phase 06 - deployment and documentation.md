# Phase 06 - Docker Production Deployment & Documentation

## Overview

This phase finalizes the application for production deployment on the VPS at `clipboard.dev.marin.cr`, optimizes Docker images, hardens configuration, and creates comprehensive project documentation.

## Goals

- Production-optimized Docker images (multi-stage, minimal size)
- Production Docker Compose with restart policies and resource limits
- Automated database migration on container startup
- Comprehensive project documentation (README, API, Architecture, Development, Deployment)
- SSL/HTTPS working end-to-end via host Nginx wildcard cert
- Health checks and monitoring readiness
- Cache busting for frontend static assets

## Prerequisites

- Phases 1-5 complete (all features working)
- VPS access with Docker installed
- Host Nginx wildcard config for `clipboard.dev.marin.cr` (already configured in Phase 1)
- Google OAuth callback URL registered for production domain (already done)
- S3 bucket with CORS configured

## Infrastructure

### Current State (from Phase 1)
- Host Nginx: `clipboard.dev.marin.cr` → `127.0.0.1:8320` (SSL terminated)
- Docker Compose: nginx + api + web on `app-network`
- SQLite volume: `compose_sqlite-data`

### Production Architecture
```
Internet
  │
  ├─ HTTPS (443) → Host Nginx (SSL termination, wildcard cert)
  │                    │
  │                    └─ proxy_pass → 127.0.0.1:8320
  │                                        │
  │                    ┌────────────────────┘
  │                    │
  │              Docker Compose
  │              ┌─────────────────────────────┐
  │              │  nginx:80 (project nginx)   │
  │              │    ├─ /api → api:3000       │
  │              │    ├─ /socket.io → api:3000 │
  │              │    └─ / → web:80 (static)   │
  │              │                             │
  │              │  api:3000 (NestJS/Fastify)   │
  │              │    ├─ SQLite (/data/*.db)    │
  │              │    ├─ S3 (file storage)      │
  │              │    └─ Socket.IO              │
  │              │                             │
  │              │  web:80 (nginx static)       │
  │              │    └─ /dist (Vite build)     │
  │              └─────────────────────────────┘
```

## Files to Create/Modify

### API Dockerfile (already exists, verify production target)

`apps/api/Dockerfile` - Verify production stage:
```dockerfile
FROM node:20-slim AS production
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
RUN mkdir -p data
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

Key points:
- `npx prisma migrate deploy` runs before app start (applies pending migrations)
- Uses `node:20-slim` (not Alpine) for OpenSSL/Prisma compatibility
- Production stage only copies `dist/` (compiled code) + `node_modules/` + `prisma/`

### Web Dockerfile (already exists, verify production target)

`apps/web/Dockerfile` - Production stage serves static files via nginx:
```dockerfile
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Production Docker Compose

Update `infra/compose/prod.compose.yml`:
```yaml
services:
  nginx:
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  api:
    build:
      target: production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  web:
    build:
      target: production
    restart: unless-stopped
```

### Nginx Configuration Updates

Update `infra/nginx/nginx.conf` for production:
- Change web upstream to `server web:80` (nginx static, not Vite dev server)
- Add caching headers for static assets
- Ensure `client_max_body_size 100m` for direct uploads

Production web upstream:
```nginx
upstream web_upstream {
    server web:80;
    keepalive 32;
}
```

### Environment Variables - Production Template

Update `infra/compose/.env.example` with all variables across all phases:

```bash
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://clipboard.dev.marin.cr
CORS_ORIGIN=https://clipboard.dev.marin.cr

# Database
DATABASE_URL=file:/data/clipboard.db

# JWT
JWT_SECRET=<generate-with: openssl rand -base64 32>
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=14
COOKIE_SECRET=<generate-with: openssl rand -base64 32>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
GOOGLE_CALLBACK_URL=https://clipboard.dev.marin.cr/api/auth/google/callback

# AWS S3
S3_BUCKET=clipboard-app
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
MAX_FILE_SIZE=10737418240
SIGNED_URL_EXPIRY=3600
STORAGE_PART_SIZE=10485760

# Admin
INITIAL_ADMIN_EMAIL=oscar.marin.saenz@gmail.com

# Logging
LOG_LEVEL=info
```

## Documentation Files to Create

### `README.md` (project root)
Complete project README:
1. **Overview** - What the app does, key features
2. **Features** - Bulleted feature list (clipboard, sharing, retention, PWA, real-time)
3. **Technology Stack** - Table of technologies
4. **Quick Start** - Local development setup steps
5. **Docker Deployment** - Production deployment steps
6. **Project Structure** - Directory tree overview
7. **Environment Variables** - Table of all env vars
8. **Contributing** - Development workflow
9. **License** - MIT or applicable

### `docs/API.md`
Complete API documentation:
- All endpoints across all phases organized by module
- Request/response examples for each endpoint
- Authentication requirements
- Error response format
- WebSocket events documentation
- Query parameter specifications
- Rate limiting (if applicable)

### `docs/ARCHITECTURE.md`
System architecture documentation:
- Architecture diagram (ASCII or description)
- Component overview (API, Web, Nginx, SQLite, S3)
- Authentication flow diagram
- Real-time sync architecture
- File upload flow (direct vs multipart)
- Retention policy lifecycle
- Database schema (full ERD)
- Key design decisions and rationale

### `docs/DEVELOPMENT.md`
Local development guide:
- Prerequisites (Docker, Node.js optional)
- Environment setup step-by-step
- Running with Docker Compose
- Running without Docker (Node.js directly)
- Database migrations
- Adding new features (module, controller, service pattern)
- Testing (API with Jest, Web with Vitest)
- Code style and conventions
- Debugging tips

### `docs/DEPLOYMENT.md`
VPS deployment guide:
- Server requirements
- DNS setup (Route 53 wildcard)
- Host Nginx configuration
- Docker deployment steps
- S3 bucket setup and CORS
- Google OAuth setup
- SSL certificate management
- Monitoring and logging
- Backup and restore (SQLite database)
- Updating the application
- Troubleshooting common issues

## Deployment Steps (for reference)

### First-time deployment
```bash
# 1. SSH to VPS
ssh marinoscar@vmi3152619.contaboserver.net

# 2. Clone repo
cd ~/git
git clone git@github.com:marinoscar/clipboard.git
cd clipboard

# 3. Configure environment
cp infra/compose/.env.example infra/compose/.env
nano infra/compose/.env  # Fill in all values

# 4. Host Nginx (already done in Phase 1)
# Verify: clipboard 8320; exists in /etc/nginx/sites-available/dev-wildcard

# 5. Build and start
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d

# 6. Verify
curl https://clipboard.dev.marin.cr/api/health
```

### Updating deployment
```bash
cd ~/git/clipboard
git pull origin main
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d
```

### Backup SQLite database
```bash
# Find the volume
docker volume inspect compose_sqlite-data

# Copy database out
docker cp compose-api-1:/data/clipboard.db ./backup-$(date +%Y%m%d).db
```

### View logs
```bash
docker logs -f compose-api-1     # API logs
docker logs -f compose-nginx-1   # Nginx access/error logs
docker logs -f compose-web-1     # Web build logs (production: nginx)
```

## Testing Checklist

### Production Deployment
- [ ] `docker compose up --build -d` starts all services without errors
- [ ] `https://clipboard.dev.marin.cr` loads the login page
- [ ] `https://clipboard.dev.marin.cr/api/health` returns 200
- [ ] `https://clipboard.dev.marin.cr/api/docs` shows Swagger UI
- [ ] Google OAuth flow works end-to-end
- [ ] Clipboard paste and file upload work
- [ ] Real-time sync works across devices
- [ ] Public share links work
- [ ] PWA installs on mobile
- [ ] Share Target works on Android

### Resilience
- [ ] `docker restart compose-api-1` → API comes back, data preserved
- [ ] `docker compose down && docker compose up -d` → all data preserved (SQLite volume)
- [ ] Health check detects unhealthy API → Docker restarts container
- [ ] Log files rotate (10MB max, 3 files)

### Security
- [ ] No secrets in Docker image layers
- [ ] `.env` file not in git
- [ ] JWT tokens expire after 15 minutes
- [ ] Refresh tokens rotate on use
- [ ] CORS configured for production domain only
- [ ] Security headers set (X-Frame-Options, X-Content-Type-Options, etc.)
- [ ] SQLite database inside Docker volume (not exposed)

### Performance
- [ ] Frontend static assets served with long cache headers
- [ ] Gzip compression enabled in Nginx
- [ ] Vite build produces optimized bundles with content hashing
- [ ] Service worker caches app shell for instant load

## Dependencies on Phase 5

- All features complete and working
- Service worker needs cache version bumping on deploy
- PWA manifest and icons in place

## Post-Deployment

After Phase 6 is complete, the application is fully deployed and documented. Future improvements could include:
- Custom domain (not .dev.marin.cr subdomain)
- Automated CI/CD pipeline
- Database backup automation
- Performance monitoring (e.g., OpenTelemetry)
- Usage analytics
- Rich text / markdown support
- Clipboard history search
- Tags / folders for organization
