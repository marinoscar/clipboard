# Clipboard CLI (`clipcli`)

A command-line tool for the Clipboard web application that lets you upload files, create text items, share items via public URLs, and download files from the terminal.

**Designed for humans and AI agents.** Every command supports three output modes: human-readable (default), `--json` for machine parsing, and `--quiet` for bare values ideal for shell piping and agent integration.

## Architecture

```
clipcli communicates with the Clipboard API using Personal Access Tokens (PATs):

  ┌─────────────┐     PAT Bearer Auth     ┌─────────────────┐     S3
  │   clipcli    │ ──────────────────────► │  Clipboard API   │ ──────► AWS S3
  │  (Terminal)  │ ◄────────────────────── │  (NestJS/Fastify)│ ◄──────
  └─────────────┘     JSON responses       └─────────────────┘
        │                                         │
        ▼                                         ▼
  ~/.config/clipcli/                         SQLite + Prisma
    auth.json (PAT)                          (Users, Items,
    config.json                               Tokens, Settings)
```

### How it works

1. **Create a PAT** in the Clipboard web UI at Settings > Personal Access Tokens
2. **Authenticate the CLI** with `clipcli auth login` — paste your token
3. **Use the CLI** to copy text, upload files, share items, and more
4. The CLI sends requests to the Clipboard API with the PAT as a Bearer token
5. File uploads go directly to S3 (small files via API, large files via presigned multipart URLs)

---

## Install, Update & Uninstall

Requires **git** and **Node.js >= 18**.

### Install

Run this single command to install `clipcli` on any Linux/macOS machine:

```bash
curl -fsSL https://raw.githubusercontent.com/marinoscar/clipboard/main/tools/clipcli/install.sh | bash
```

This will:
- Check that `git`, `node` (>= 18), and `npm` are installed
- Clone the repository to `~/.clipcli`
- Install dependencies and build the TypeScript source
- Create a global `clipcli` command at `/usr/local/bin/clipcli`
- Create a global `clipcli-update` command for easy updates
- Verify the installation

Once complete, confirm it works:

```bash
clipcli --version
# 1.0.0
```

### Update

To update to the latest version, use any of these methods:

```bash
# Easiest — use the update command (created during install)
clipcli-update

# Or re-run the install command (it detects the existing install and pulls latest)
curl -fsSL https://raw.githubusercontent.com/marinoscar/clipboard/main/tools/clipcli/install.sh | bash

# Or run the local install script directly
~/.clipcli/tools/clipcli/install.sh
```

All three do the same thing: pull the latest code, rebuild, and re-link.

### Uninstall

```bash
# Run locally
~/.clipcli/tools/clipcli/install.sh --uninstall

# Or via curl
curl -fsSL https://raw.githubusercontent.com/marinoscar/clipboard/main/tools/clipcli/install.sh | bash -s -- --uninstall
```

This removes `clipcli` and `clipcli-update` from `/usr/local/bin/`. To also remove the source code and config:

```bash
rm -rf ~/.clipcli           # Remove the cloned repository
rm -rf ~/.config/clipcli    # Remove auth tokens and config
```

### Version

Check the installed version at any time:

```bash
clipcli --version
# 1.0.0
```

The version is defined in `src/version.ts` and follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLIPCLI_INSTALL_DIR` | Override the installation directory | `~/.clipcli` |

### Manual installation

If you prefer not to use the installer:

```bash
git clone https://github.com/marinoscar/clipboard.git ~/.clipcli
cd ~/.clipcli/tools/clipcli
npm install && npm run build
sudo ln -sf "$(pwd)/bin/clipcli.js" /usr/local/bin/clipcli
```

---

## Quick Start

```bash
# 1. (Optional) Set the server URL if not using the default
clipcli config set-url https://clipboard.example.com

# 2. Create a Personal Access Token in the web UI
#    Go to Settings > Personal Access Tokens > Create Token

# 3. Authenticate
clipcli auth login
# → Prompts: "Do you have an existing personal access token? (y/n)"
# → Paste your token

# 4. Copy text to your clipboard
clipcli copy "Hello from the CLI!"

# 5. Upload a file
clipcli upload ./report.pdf

# 6. List your items
clipcli list

# 7. Share an item publicly
clipcli share <item-id>
```

---

## Authentication

clipcli uses **Personal Access Tokens (PATs)** for authentication. PATs are long-lived tokens created in the Clipboard web UI that grant full access to your account.

### Creating a token

1. Log in to the Clipboard web app
2. Go to **Settings** (accessible to all users)
3. Under **Personal Access Tokens**, click **Create Token**
4. Choose a name and expiration:
   - **1 day** — short-lived, ideal for one-off tasks
   - **30 days** — good for regular use
   - **Never** — does not expire (internally set to 100 years)
5. Copy the token immediately — it is shown only once

### Login flow

```bash
clipcli auth login
```

The CLI will ask:

```
Do you have an existing personal access token? (y/n):
```

- **If yes**: Paste your token directly
- **If no**: The CLI displays the URL to the Settings page where you can create one, then prompts you to paste the new token

The token is validated by calling `GET /api/auth/me`. On success, it is saved to `~/.config/clipcli/auth.json` with file permissions `0600` (owner-only).

### Token format

PATs use the prefix `clip_` followed by 32 hex characters:

```
clip_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

The server stores only the SHA-256 hash — the raw token cannot be recovered after creation.

---

## Output Modes

Every command supports three output modes, controlled by global flags:

| Mode | Flag | Description | Use case |
|------|------|-------------|----------|
| **Human** | *(default)* | Rich terminal output with colors, tables, and formatting | Interactive use |
| **JSON** | `--json` | Machine-readable JSON envelope: `{"success": true, "data": ...}` | AI agents, scripts |
| **Quiet** | `-q, --quiet` | Bare essential values, no formatting | Shell piping |

### JSON envelope format

```json
// Success (stdout)
{"success": true, "data": { ... }}

// Error (stderr)
{"success": false, "error": "Human-readable message"}
```

- **Data** goes to `stdout` — pipe to `jq .data` for the payload
- **Errors** go to `stderr` — always visible even when piping stdout

### Examples across modes

```bash
# Human mode (default)
clipcli list
#
# Clipboard Items (42 total, page 1/3)
# ──────────────────────────────────────
#   ID        Type    Content / File                       Size        Created
#   a1b2c3d4  text    Hello from the CLI!                  -           Apr 2
#   e5f6a7b8  file    report.pdf                           2.4 MB      Apr 1
#

# JSON mode
clipcli list --json
# {"success":true,"data":{"items":[...],"total":42,"page":1,"pageSize":20,"totalPages":3}}

# Quiet mode
clipcli list -q
# a1b2c3d4-...
# e5f6a7b8-...
```

---

## Command Reference

### Global Flags

| Flag | Description |
|------|-------------|
| `-V, --version` | Display the current clipcli version |
| `--json` | Output all results as machine-readable JSON. Format: `{"success": true, "data": ...}` or `{"success": false, "error": "..."}`. Errors go to stderr, data to stdout. Parse with `jq .data`. |
| `-q, --quiet` | Minimal output mode. Print only essential values with no formatting. For list commands, prints one ID per line. For copy/upload, prints the item ID. |
| `--server <url>` | Override the Clipboard server URL for this invocation only. Takes precedence over config file and `CLIPCLI_SERVER_URL` environment variable. |
| `--no-color` | Disable all ANSI color codes in output. |
| `-v, --verbose` | Enable verbose logging. Shows HTTP request details and debug info. |

---

### `clipcli auth`

Manage authentication with the Clipboard API.

#### `clipcli auth login`

Authenticate using a Personal Access Token. Interactive prompt guides you through creating or pasting a token.

```bash
clipcli auth login
# Do you have an existing personal access token? (y/n): n
#
# To create a new token:
#   1. Open https://clipboard.marin.cr/settings
#   2. Click "Create Token"
#   3. Copy the generated token
#
# Paste your token: clip_a1b2c3d4...
# Validating token...
#
# Authenticated as user@example.com
#   Name: John Doe
#   Admin: No
#
# Token saved to /home/user/.config/clipcli/auth.json
```

#### `clipcli auth logout`

Remove the stored authentication token from the local machine.

```bash
clipcli auth logout
# Logged out. Token removed from /home/user/.config/clipcli/auth.json
```

#### `clipcli auth status`

Display the current authentication state: email, name, admin status, and server URL.

```bash
clipcli auth status
# Authenticated
#
#   Email:  user@example.com
#   Name:   John Doe
#   Admin:  No
#   Server: https://clipboard.marin.cr

clipcli auth status --json
# {"success":true,"data":{"authenticated":true,"email":"user@example.com","displayName":"John Doe","isAdmin":false,"server":"https://clipboard.marin.cr"}}

clipcli auth status -q
# user@example.com
```

---

### `clipcli copy`

Create a text clipboard item from a command-line argument or stdin.

```bash
# From argument
clipcli copy "Hello, world!"
# Created item a1b2c3d4-... (text)

# Multiple words (joined with spaces)
clipcli copy This is a note
# Created item e5f6a7b8-... (text)

# From stdin (pipe)
echo "Piped content" | clipcli copy
cat README.md | clipcli copy
curl -s https://example.com | clipcli copy

# Capture the item ID
ID=$(clipcli copy "my data" -q)
echo "Created: $ID"
```

**Stdin detection:** If no text argument is provided and stdin is not a TTY (i.e., data is piped), the CLI reads from stdin. If stdin is a TTY and no argument is given, it prints an error.

---

### `clipcli list`

List clipboard items with filtering and pagination.

| Flag | Description | Default |
|------|-------------|---------|
| `--type <type>` | Filter by type: `text`, `image`, `file`, `media` | all |
| `--status <status>` | Filter by status: `active`, `archived`, `deleted` | `active` |
| `--search <term>` | Search content and filenames | |
| `--page <n>` | Page number | `1` |
| `--page-size <n>` | Items per page (max 100) | `20` |
| `--sort <field>` | Sort field: `createdAt`, `updatedAt`, `fileName` | `createdAt` |
| `--order <dir>` | Sort order: `asc`, `desc` | `desc` |
| `--favorites` | Show only favorited items | |

```bash
# List recent items
clipcli list

# Filter by type
clipcli list --type file

# Search
clipcli list --search "report"

# Combined filters
clipcli list --type file --search "2026" --page-size 50

# Archived items
clipcli list --status archived

# JSON output for scripting
clipcli list --json | jq '.data.items[] | {id, type, fileName}'
```

---

### `clipcli get`

Get detailed information about a specific clipboard item.

```bash
# Get item details
clipcli get a1b2c3d4-e5f6-...
#
# Clipboard Item
# ──────────────
#   ID:       a1b2c3d4-e5f6-...
#   Type:     text
#   Status:   active
#   Created:  Apr 2, 2026, 2:30 PM
#   Updated:  Apr 2, 2026, 2:30 PM
#   Favorite: No
#   Public:   No
#
#   Content:
#   Hello from the CLI!

# Quiet mode: prints content for text items, ID for files
clipcli get <id> -q
# Hello from the CLI!

# JSON mode
clipcli get <id> --json
```

---

### `clipcli delete`

Soft-delete a clipboard item (sets status to "deleted").

```bash
clipcli delete <id>
# Deleted item a1b2c3d4-...

clipcli delete <id> -q
# a1b2c3d4-...
```

---

### `clipcli upload`

Upload a file to the clipboard. Automatically selects the upload strategy based on file size:

- **< 100 MB**: Direct multipart form upload to the API
- **>= 100 MB**: S3 multipart upload (presigned URLs, chunked transfer)

```bash
# Upload a file
clipcli upload ./screenshot.png
# Uploading: screenshot.png (1.2 MB, image/png)
#
# Uploaded: a1b2c3d4-...
#   File: screenshot.png
#   Size: 1.2 MB
#   Type: image/png

# Upload a large file (automatic multipart)
clipcli upload ./video.mp4
# Uploading: video.mp4 (2.1 GB, video/mp4)
# Using multipart upload for large file...
# Parts: 22, Part size: 100.0 MB
#   Part 1/22 (100.0 MB)...
#   Part 2/22 (100.0 MB)...
#   ...
# Completing multipart upload...
#
# Uploaded: e5f6a7b8-...

# Capture the item ID
ID=$(clipcli upload ./report.pdf -q)
```

**Supported MIME types** are detected from file extension. Common types include:
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- Documents: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
- Media: `.mp3`, `.wav`, `.mp4`, `.webm`, `.mov`, `.avi`
- Text: `.txt`, `.html`, `.css`, `.js`, `.json`, `.xml`, `.csv`, `.md`
- Archives: `.zip`, `.gz`, `.tar`
- Unknown extensions default to `application/octet-stream`

---

### `clipcli download`

Download a file item to a local path.

```bash
# Download to current directory (uses original filename)
clipcli download <id>
# Downloading: report.pdf (2.4 MB)
#
# Saved to: /home/user/report.pdf
#   Size: 2.4 MB

# Download to a specific path
clipcli download <id> ./output/my-report.pdf

# Quiet mode: prints the saved path
clipcli download <id> -q
# /home/user/report.pdf
```

---

### `clipcli download-url`

Get a signed download URL for a file item. The URL is temporary (typically valid for 1 hour).

```bash
# Get the download URL
clipcli download-url <id>
# https://s3.amazonaws.com/bucket/clipboard/...?X-Amz-Signature=...

# Quiet mode (same output — just the URL)
clipcli download-url <id> -q

# Use with curl
curl -o file.pdf "$(clipcli download-url <id> -q)"
```

---

### `clipcli share`

Enable public sharing for a clipboard item. Returns a public URL that anyone can access without authentication.

```bash
clipcli share <id>
# Share URL: https://clipboard.marin.cr/share/a1b2c3d4e5f6...

# Quiet mode: just the URL
clipcli share <id> -q
# https://clipboard.marin.cr/share/a1b2c3d4e5f6...
```

---

### `clipcli unshare`

Disable public sharing for a clipboard item. The public URL will stop working.

```bash
clipcli unshare <id>
# Sharing disabled for item a1b2c3d4-...
```

---

### `clipcli share-info`

Check the sharing status and URL for an item.

```bash
clipcli share-info <id>
#
# Share Info
# ──────────
#   ID:        a1b2c3d4-...
#   Public:    Yes
#   Share URL: https://clipboard.marin.cr/share/a1b2c3d4e5f6...

# Quiet mode: prints URL if shared, "not_shared" otherwise
clipcli share-info <id> -q
# https://clipboard.marin.cr/share/a1b2c3d4e5f6...
```

---

### `clipcli config`

View and manage CLI configuration.

#### `clipcli config show`

Display current configuration with source information.

```bash
clipcli config show
#
# Configuration
# ─────────────
#   Server URL: https://clipboard.marin.cr (default)
#   Config Dir: /home/user/.config/clipcli
#   Config File: /home/user/.config/clipcli/config.json
#   Auth File: /home/user/.config/clipcli/auth.json

# Quiet mode: just the server URL
clipcli config show -q
# https://clipboard.marin.cr
```

#### `clipcli config set-url <url>`

Set the Clipboard server URL. Saved to the config file.

```bash
clipcli config set-url https://my-clipboard.example.com
# Server URL set to: https://my-clipboard.example.com
```

#### `clipcli config reset`

Reset configuration to defaults. Preserves auth tokens.

```bash
clipcli config reset
# Configuration reset to defaults
```

---

## AI Agent Integration

clipcli is designed for AI agents. Here are common patterns:

### Capture IDs for chaining

```bash
# Upload a file and immediately share it
ID=$(clipcli upload ./report.pdf -q)
URL=$(clipcli share "$ID" -q)
echo "Shared at: $URL"
```

### Process JSON output

```bash
# Get all item IDs as a list
clipcli list --json | jq -r '.data.items[].id'

# Get the content of the latest text item
clipcli list --type text --page-size 1 --json | jq -r '.data.items[0].content'

# Count items by type
clipcli list --json | jq '.data.items | group_by(.type) | map({type: .[0].type, count: length})'
```

### Pipe content

```bash
# Pipe command output to clipboard
ls -la | clipcli copy
git diff | clipcli copy
curl -s https://api.example.com/data | clipcli copy

# Copy and share in one pipeline
echo "shared data" | clipcli copy -q | xargs clipcli share -q
```

### Error handling in scripts

```bash
#!/bin/bash
set -e

# Check auth status
if ! clipcli auth status -q >/dev/null 2>&1; then
  echo "Not authenticated. Run: clipcli auth login" >&2
  exit 1
fi

# Upload with error handling
if ID=$(clipcli upload "$1" -q 2>/dev/null); then
  URL=$(clipcli share "$ID" -q)
  echo "$URL"
else
  echo "Upload failed" >&2
  exit 1
fi
```

### Using with a different server

```bash
# Per-invocation override
clipcli --server https://staging.example.com list --json

# Environment variable
export CLIPCLI_SERVER_URL=https://staging.example.com
clipcli list
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLIPCLI_SERVER_URL` | Clipboard server URL | `https://clipboard.marin.cr` |
| `CLIPCLI_CONFIG_DIR` | Config directory path | `~/.config/clipcli` |

**Priority for server URL:** `--server` flag > `CLIPCLI_SERVER_URL` env > config file > default.

### Config File

Stored at `~/.config/clipcli/config.json`:

```json
{
  "serverUrl": "https://clipboard.marin.cr"
}
```

### Auth Token

Stored at `~/.config/clipcli/auth.json` with permissions `0600` (owner read/write only):

```json
{
  "token": "clip_a1b2c3d4e5f6...",
  "serverUrl": "https://clipboard.marin.cr"
}
```

---

## Security

- **Token storage**: PATs stored at `~/.config/clipcli/auth.json` with file permissions `0600` (owner-only read/write)
- **No secrets in CLI args**: The token is read interactively during login, never passed as a command-line argument
- **Hashed server-side**: The API stores only SHA-256 hashes of PATs — the raw token cannot be recovered
- **Revocable**: Tokens can be revoked at any time from the web UI (Settings > Personal Access Tokens)
- **Expiration options**: 1 day, 30 days, or never — choose based on your security needs
- **Token prefix**: All PATs start with `clip_` for easy identification and to distinguish them from JWTs

---

## Development

```bash
# Build
npm -w tools/clipcli run build

# Watch mode (rebuilds on changes)
npm -w tools/clipcli run dev

# Type check
npm -w tools/clipcli run typecheck

# Run directly (after build)
node tools/clipcli/bin/clipcli.js --help
```

### Project Structure

```
tools/clipcli/
├── bin/clipcli.js          # Entry point (shebang script)
├── install.sh              # Installer (works via curl pipe and locally)
├── src/
│   ├── index.ts            # Commander setup, global flags, help examples
│   ├── version.ts          # Version constant (single source of truth)
│   ├── commands/           # Command implementations
│   │   ├── auth.ts         # login, logout, status
│   │   ├── clipboard.ts    # list, get, copy, delete
│   │   ├── upload.ts       # upload (small + S3 multipart)
│   │   ├── download.ts     # download, download-url
│   │   ├── share.ts        # share, unshare, share-info
│   │   └── config.ts       # show, set-url, reset
│   ├── lib/                # Business logic
│   │   ├── api-client.ts   # HTTP client with PAT Bearer auth
│   │   ├── auth-store.ts   # Token persistence (~/.config/clipcli/)
│   │   └── formatters.ts   # Human-readable output (tables, key-value)
│   └── utils/              # Shared utilities
│       ├── config.ts       # Configuration management
│       ├── output.ts       # OutputManager (json/quiet/human modes)
│       └── types.ts        # TypeScript interfaces
├── package.json
└── tsconfig.json
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI framework (commands, options, help generation) |
| `chalk` | ANSI color output |

### Adding a new command

1. Create `src/commands/mycommand.ts` with a `registerMyCommand(program)` function
2. Use the `getOutput(cmd)` pattern for output mode detection
3. Use `output.result(data, humanFn, quietFn)` for all output
4. Register in `src/index.ts`
5. Add help examples to the `addHelpText` block

---

## API Endpoints Used

The CLI communicates with these Clipboard API endpoints:

| Endpoint | CLI Command | Description |
|----------|-------------|-------------|
| `GET /api/auth/me` | `auth login`, `auth status` | Validate token, get user info |
| `GET /api/clipboard` | `list` | List items (paginated, filtered) |
| `GET /api/clipboard/:id` | `get`, `share-info`, `download` | Get item details |
| `POST /api/clipboard` | `copy` | Create text item |
| `DELETE /api/clipboard/:id` | `delete` | Soft-delete item |
| `POST /api/clipboard/upload` | `upload` (small files) | Multipart file upload |
| `POST /api/clipboard/upload/init` | `upload` (large files) | Initiate S3 multipart |
| `GET /api/clipboard/upload/:id/url` | `upload` (large files) | Get presigned part URL |
| `POST /api/clipboard/upload/:id/part` | `upload` (large files) | Record uploaded part |
| `POST /api/clipboard/upload/:id/complete` | `upload` (large files) | Finalize multipart upload |
| `GET /api/clipboard/:id/download` | `download`, `download-url` | Get signed download URL |
| `POST /api/clipboard/:id/share` | `share` | Enable sharing |
| `DELETE /api/clipboard/:id/share` | `unshare` | Disable sharing |
