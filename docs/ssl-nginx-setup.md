# SSL & Nginx Reverse Proxy Setup for *.dev.marin.cr

## Objective

Deploy a Docker-based web application behind a two-tier Nginx reverse proxy with automatic SSL certificate management. The setup enables:

- **Wildcard HTTPS** for all `*.dev.marin.cr` subdomains using a single Let's Encrypt certificate
- **Zero-downtime certificate renewal** via Certbot with AWS Route53 DNS validation
- **Subdomain-based routing** — each project gets its own subdomain mapped to a Docker Compose stack on a unique port
- **Same-origin hosting** — frontend, API, and WebSocket traffic all served through one domain with path-based routing inside Docker

This guide is written to be replicable for any new project on the same VPS.

## Architecture

```
Internet (HTTPS :443)
│
▼
Host Nginx (SSL termination, wildcard cert for *.dev.marin.cr)
│
│   map $host → $backend_port:
│     clipboard.dev.marin.cr  → 127.0.0.1:8320
│     knecta.dev.marin.cr     → 127.0.0.1:8319
│     <new-project>           → 127.0.0.1:<port>
│
▼  127.0.0.1:<port>
Docker Compose (bridge network)
├─ Nginx container (port 80 → exposed as <port>)
│  ├── /api, /socket.io/  → API container (port 3000)
│  └── /                  → Web container (port 80 or 5173)
├─ API container (NestJS, Express, etc.)
└─ Web container (React, Vue, etc.)
```

**Key design decisions:**

- SSL terminates at the host level — Docker containers only handle plain HTTP
- The host Nginx `map` block routes subdomains to ports, so adding a new project is a one-line change
- Each project's Docker Compose stack has its own internal Nginx that handles path-based routing between frontend and backend
- WebSocket upgrade headers are forwarded at both tiers

## Prerequisites

- Ubuntu VPS with root access (tested on Ubuntu 22.04+)
- Domain with DNS managed by AWS Route53 (for wildcard cert DNS validation)
- Nginx installed on the host (`apt install nginx`)
- Certbot installed with Route53 plugin (`apt install certbot python3-certbot-nginx python3-certbot-dns-route53`)
- Docker and Docker Compose installed
- AWS credentials configured for Route53 access (for cert renewal)

## Step 1: DNS Configuration

Create DNS records in Route53 (or your DNS provider):

```
Type    Name                    Value
A       dev.marin.cr            144.126.129.254
A       *.dev.marin.cr          144.126.129.254
```

The wildcard `A` record means any subdomain (`clipboard.dev.marin.cr`, `myapp.dev.marin.cr`, etc.) resolves to the VPS without adding individual records.

## Step 2: Obtain Wildcard SSL Certificate

Use Certbot with the Route53 DNS plugin to obtain a wildcard certificate:

```bash
sudo certbot certonly \
  --dns-route53 \
  --key-type ecdsa \
  -d "*.dev.marin.cr" \
  -d "dev.marin.cr"
```

This creates:

```
/etc/letsencrypt/live/dev.marin.cr/
├── cert.pem        # X.509 certificate
├── privkey.pem     # Private key
├── chain.pem       # Intermediate chain
└── fullchain.pem   # cert + chain (used by Nginx)
```

**Note:** Wildcard certs require DNS validation (not HTTP). The `dns-route53` plugin automates this by creating temporary TXT records in Route53.

### AWS credentials for Route53

Certbot needs AWS credentials to create DNS records. Configure via one of:

- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- AWS credentials file at `~/.aws/credentials` (root user, since certbot runs as root)
- IAM instance role (if running on EC2)

Minimum IAM policy required:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:GetChange",
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": "*"
    }
  ]
}
```

## Step 3: Configure Automatic Certificate Renewal

Certbot installs a systemd timer by default. Verify it's active:

```bash
sudo systemctl status certbot.timer
```

Expected output:

```
Active: active (waiting)
Trigger: (next scheduled run, typically twice daily)
```

The timer runs `certbot renew` twice daily. Certificates are renewed only when within 30 days of expiry.

To test renewal without actually renewing:

```bash
sudo certbot renew --dry-run
```

## Step 4: Host Nginx — Wildcard Reverse Proxy

Create the vhost configuration:

```bash
sudo nano /etc/nginx/sites-available/dev-wildcard
```

Contents of `/etc/nginx/sites-available/dev-wildcard`:

```nginx
# Map subdomains to internal Docker Compose ports.
# To add a new project, add one line here and restart nginx.
map $host $backend_port {
    clipboard.dev.marin.cr    8320;
    knecta.dev.marin.cr       8319;
    # <new-project>.dev.marin.cr  <port>;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name *.dev.marin.cr;
    return 301 https://$host$request_uri;
}

# HTTPS — wildcard SSL termination + reverse proxy
server {
    listen 443 ssl;
    server_name *.dev.marin.cr;

    # Wildcard certificate
    ssl_certificate     /etc/letsencrypt/live/dev.marin.cr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dev.marin.cr/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Reject unmapped subdomains (closes connection)
    if ($backend_port = '') {
        return 444;
    }

    # Allow large file uploads through the proxy
    client_max_body_size 200m;

    location / {
        proxy_pass         http://127.0.0.1:$backend_port;
        proxy_http_version 1.1;
        proxy_buffering    off;

        # WebSocket support
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward client info
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and test:

```bash
sudo ln -s /etc/nginx/sites-available/dev-wildcard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 5: Docker Compose — Internal Nginx + Services

Each project has its own Docker Compose stack with an internal Nginx that routes paths to the correct container.

### 5a. Internal Nginx config (production)

File: `infra/nginx/nginx.conf`

```nginx
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log  /var/log/nginx/error.log;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;

    # Backend API
    upstream api_upstream {
        server api:3000;
        keepalive 32;
    }

    # Frontend
    upstream web_upstream {
        server web:80;      # Production: Nginx serving static build
        keepalive 32;
    }

    server {
        listen 80;

        client_max_body_size 100m;

        # Security headers
        add_header X-Frame-Options        "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection       "1; mode=block" always;
        add_header Referrer-Policy        "strict-origin-when-cross-origin" always;

        # WebSocket (Socket.IO)
        location /socket.io/ {
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Upgrade    $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host       $host;
            proxy_set_header X-Real-IP  $remote_addr;
            proxy_read_timeout  300s;
            proxy_send_timeout  300s;
        }

        # API
        location /api {
            proxy_pass http://api_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host             $host;
            proxy_set_header X-Real-IP        $remote_addr;
            proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout  120s;
            proxy_send_timeout  120s;
            proxy_buffering     on;
            proxy_buffer_size   128k;
            proxy_buffers       4 256k;
        }

        # Frontend (catch-all)
        location / {
            proxy_pass http://web_upstream;
            proxy_http_version 1.1;
            proxy_set_header Host             $host;
            proxy_set_header X-Real-IP        $remote_addr;
            proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /nginx-health {
            access_log off;
            return 200 'ok';
            add_header Content-Type text/plain;
        }
    }
}
```

### 5b. Internal Nginx config (development)

File: `infra/nginx/nginx.dev.conf`

Identical to production except the web upstream targets the Vite dev server:

```nginx
upstream web_upstream {
    server web:5173;    # Vite dev server for hot reload
    keepalive 32;
}
```

### 5c. Docker Compose files

**Base** (`infra/compose/base.compose.yml`):

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8320:80"               # Must match the port in host nginx map
    volumes:
      - ../nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
      - web
    networks:
      - app-network

  api:
    build:
      context: ../../apps/api
    environment:
      - NODE_ENV=${NODE_ENV}
      - PORT=3000
      # ... other env vars
    networks:
      - app-network

  web:
    build:
      context: ../../apps/web
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**Development override** (`infra/compose/dev.compose.yml`):

```yaml
services:
  nginx:
    volumes:
      - ../nginx/nginx.dev.conf:/etc/nginx/nginx.conf:ro   # Swap to dev config
  web:
    build:
      target: development     # Vite dev server
```

**Production override** (`infra/compose/prod.compose.yml`):

```yaml
services:
  nginx:
    restart: unless-stopped
  api:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
  web:
    restart: unless-stopped
```

## Step 6: Launch the Application

**Development:**

```bash
docker compose -f infra/compose/base.compose.yml -f infra/compose/dev.compose.yml up --build
```

**Production:**

```bash
docker compose -f infra/compose/base.compose.yml -f infra/compose/prod.compose.yml up --build -d
```

Verify:

```bash
curl https://clipboard.dev.marin.cr/api/health
# → {"data":{"status":"ok"}}
```

## Adding a New Project

To deploy a new project (e.g., `myapp.dev.marin.cr` on port 8321):

### 1. Update host Nginx map

Edit `/etc/nginx/sites-available/dev-wildcard` and add one line to the `map` block:

```nginx
map $host $backend_port {
    clipboard.dev.marin.cr    8320;
    knecta.dev.marin.cr       8319;
    myapp.dev.marin.cr        8321;    # ← add this
}
```

Reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 2. Set up Docker Compose for the new project

Use the same pattern: internal Nginx on port 80, exposed as the chosen port (8321).

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8321:80"       # Must match the map entry
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app

  app:
    build: .
    # ...
```

### 3. Done

No DNS changes needed (the wildcard `*.dev.marin.cr` already resolves). No new SSL certificate needed (the wildcard cert covers all subdomains). The new project is immediately available at `https://myapp.dev.marin.cr`.

## Troubleshooting

**502 Bad Gateway:**
- Docker containers not running. Check `docker compose ps`.
- Port mismatch between host Nginx map and Docker Compose `ports`.

**SSL certificate errors:**
- Check cert validity: `sudo certbot certificates`
- Test renewal: `sudo certbot renew --dry-run`
- Ensure Route53 credentials are accessible to root.

**WebSocket connection failures:**
- Verify both tiers forward `Upgrade` and `Connection` headers.
- Check `proxy_read_timeout` is long enough (300s recommended for Socket.IO).

**Large uploads failing:**
- Host Nginx: `client_max_body_size 200m` (or higher)
- Docker Nginx: `client_max_body_size 100m` (or as needed)
- For files larger than these limits, use presigned S3 URLs to bypass the proxy entirely.

## File Reference

| File | Purpose |
|------|---------|
| `/etc/nginx/sites-available/dev-wildcard` | Host reverse proxy — subdomain→port mapping |
| `/etc/letsencrypt/live/dev.marin.cr/` | Wildcard SSL certificate and key |
| `/etc/letsencrypt/renewal/dev.marin.cr.conf` | Certbot renewal config (Route53 DNS) |
| `infra/nginx/nginx.conf` | Docker internal routing (production) |
| `infra/nginx/nginx.dev.conf` | Docker internal routing (development) |
| `infra/compose/base.compose.yml` | Docker Compose base services |
| `infra/compose/dev.compose.yml` | Development overrides |
| `infra/compose/prod.compose.yml` | Production overrides |
