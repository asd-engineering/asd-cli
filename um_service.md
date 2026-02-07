# ASD CLI Services

**Version:** 2.0.2 | **Last Updated:** 2026-02-02

Built-in services for remote development: web terminal, VS Code, database UI, and network inspection.

---

## Service Overview

| Service | Command | Status | What It Does |
|---------|---------|--------|--------------|
| VS Code Server | `asd code` | 🟢 Stable | Browser-based IDE |
| Web Terminal | `asd terminal` | 🟢 Stable | Shell access via browser |
| Database UI | `asd database` | 🟢 Stable | Visual database manager |
| Network Inspector | `asd inspect` | 🟠 Alpha | HTTP traffic debugging |

---

## Web Terminal (`asd terminal`)

Browser-based terminal access powered by [ttyd](https://github.com/tsl0922/ttyd).

### What You Get

- Full shell session in any browser
- Works on desktop, tablet, mobile
- No SSH client needed
- Tunnelable for remote access

### Quick Start

```bash
# 1. Set credentials in .env
TTYD_USERNAME=admin
TTYD_PASSWORD=your-secure-password

# 2. Start
asd terminal start

# 3. Access (run for menu)
asd terminal

# 4. Stop when done
asd terminal stop
```

### Access URLs

After starting, you get three access methods:

| Method | URL Format | Use Case |
|--------|------------|----------|
| **Local** | `http://localhost:<port>/` | Same machine |
| **Caddy** | `http://asd.localhost/asde/ttyd/` | Local network |
| **Tunnel** | `https://hub-xxx.cicd.eu1.asd.engineer/asde/ttyd/` | Anywhere |

The `asd terminal` menu shows all URLs with the correct port and credentials.

### Configuration

All settings via environment variables (`.env`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TTYD_USERNAME` | Yes | - | Login username |
| `TTYD_PASSWORD` | Yes | - | Login password |
| `TTYD_PORT` | No | (auto) | Port number |
| `TTYD_SHELL_CMD` | No | `bash` | Shell to run |
| `TTYD_CWD` | No | workspace | Starting directory |
| `TTYD_PATH` | No | `/` | URL path prefix |

**Example `.env`:**

```bash
TTYD_USERNAME=developer
TTYD_PASSWORD=dev-secret-123
TTYD_SHELL_CMD=zsh
```

### Remote Access

To access your terminal from anywhere:

```bash
# Start terminal
asd terminal start

# Enable tunnel (if not already)
asd net apply --tunnel

# Get the URL
asd terminal
# Look for "Tunnel:" URL in the menu
```

Share the tunnel URL and credentials with anyone who needs access.

### Security

**ttyd provides shell access - treat credentials seriously:**

- Use strong passwords (12+ characters)
- Don't share credentials publicly
- Stop the service when not needed
- Monitor who has access

When project-level basic auth is enabled, ttyd routes through Caddy get additional protection.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing username/password" | Set `TTYD_USERNAME` and `TTYD_PASSWORD` in `.env` |
| "Port in use" | `asd terminal stop` or kill the process on that port |
| "Binary not found" | Run `asd init` to reinstall binaries |
| "Can't connect via tunnel" | Check `asd net` - ensure hub service has tunnel URL |
| "Connection drops" | Check network stability; tunnels auto-reconnect |

---

## VS Code Server (`asd code`)

Browser-based VS Code powered by [code-server](https://github.com/coder/code-server).

### What You Get

- Full VS Code experience in browser
- Extension support (Open VSX marketplace)
- Integrated terminal
- Git integration
- Settings sync

### Quick Start

```bash
# 1. Start
asd code start

# 2. Access (run for menu)
asd code

# 3. Stop when done
asd code stop
```

### Access URLs

| Method | URL Format | Use Case |
|--------|------------|----------|
| **Local** | `http://localhost:<port>/` | Same machine |
| **Caddy** | `http://asd.localhost/asde/codeserver/` | Local network |
| **Tunnel** | `https://hub-xxx.cicd.eu1.asd.engineer/asde/codeserver/` | Anywhere |

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ASD_CODESERVER_PORT` | No | (auto) | Port number |
| `ASD_CODESERVER_AUTH` | No | `none` | Auth mode: `none` or `password` |
| `ASD_CODESERVER_PASSWORD` | No* | - | Password (*required if auth=password) |
| `ASD_CODESERVER_WORKSPACE` | No | project root | Folder to open |
| `ASD_CODESERVER_ADDR` | No | `127.0.0.1:<port>` | Full bind address |

**For local-only access (no auth):**

```bash
ASD_CODESERVER_AUTH=none
```

**For remote access (with auth):**

```bash
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=your-secure-password
```

### Remote Access

```bash
# Enable password authentication in .env
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=your-secure-password

# Start code-server
asd code start

# Enable tunnel
asd net apply --tunnel

# Get the URL
asd code
# Look for "Tunnel:" URL in the menu
```

### Extensions

code-server uses the [Open VSX](https://open-vsx.org/) marketplace, not Microsoft's marketplace.

**Most popular extensions are available:**
- ESLint, Prettier, GitLens
- Language support (Python, Go, Rust, etc.)
- Themes and icon packs

**Some Microsoft-specific extensions are not available:**
- GitHub Copilot (use alternatives like Continue or Codeium)
- Remote Development extensions (you're already remote!)
- Live Share

### Security

**code-server provides code editing AND terminal access:**

- Use `password` auth for any remote access
- Strong passwords (12+ characters)
- Project-level basic auth adds another layer
- Stop when not actively developing

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "Can't install extension" | Check Open VSX - extension may not be available |
| "Port in use" | `asd code stop` or kill the process |
| "Auth failing" | Verify `ASD_CODESERVER_AUTH` and password in `.env` |
| "Slow/laggy" | Close unused tabs; check network connection |
| "Extensions not loading" | Clear extension cache: remove `.asd/workspace/code/data/extensions` |

---

## Database UI (`asd database`)

Visual database management powered by [DbGate](https://dbgate.org/).

### What You Get

- Connect to multiple database types
- Visual query builder
- Data export/import
- Schema browser and editor

### Supported Databases

- PostgreSQL
- MySQL / MariaDB
- SQLite
- MongoDB
- SQL Server
- Redis
- More...

### Quick Start

```bash
# Start
asd database start

# Access (opens browser)
asd database

# Stop
asd database stop
```

### Access URLs

| Method | URL Format |
|--------|------------|
| **Local** | `http://localhost:<port>/` |
| **Caddy** | `http://asd.localhost/asde/dbgate/` |
| **Tunnel** | Via hub tunnel path |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ASD_DBGATE_PORT` | (auto) | Port number |

Database connections are configured within DbGate's UI - no additional env vars needed.

### Security Notes

- DbGate has access to your database credentials
- Use basic auth if exposing via tunnel
- Don't leave running when not needed

---

## Network Inspector (`asd inspect`)

HTTP/HTTPS traffic debugging powered by [mitmproxy](https://mitmproxy.org/).

### Status: 🟠 Alpha

**Current limitations:**
- Standalone service only
- No automatic traffic routing
- Manual proxy configuration required

### What Works Now

```bash
# Start mitmproxy web UI
asd inspect start

# Access the web interface
asd inspect

# Stop
asd inspect stop
```

### Current Usage

mitmproxy runs as a standalone proxy. To inspect traffic:

1. Start the inspector: `asd inspect start`
2. Configure your app to use the proxy: `http://localhost:8080`
3. View traffic in the web UI

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ASD_MITMPROXY_PORT` | 8080 | Proxy port |
| `ASD_BASIC_AUTH_PASSWORD` | - | Web UI password |

### What's Not Implemented Yet

- Automatic traffic routing via Caddy
- Per-service inspection toggles in TUI
- Transparent proxy mode
- TLS certificate auto-installation

---

## Plugins

Plugins extend ASD with additional network services from external tools.

### How Plugins Work

Plugins are modules that define network services via a `net.manifest.yaml` file. When enabled:

1. ASD loads the plugin's service definitions
2. Detects which plugin services are running
3. Registers them in the network registry
4. Creates Caddy routes automatically

### Enabling Plugins

Add plugins to your `asd.yaml`:

```yaml
project:
  name: "my-app"
  plugins: [supabase]           # Enable one or more plugins
```

Then apply the configuration:

```bash
asd net apply --caddy
```

### Supabase Plugin

The Supabase plugin integrates local Supabase development services.

**Services provided:**

| Service ID | Default Port | Description |
|------------|--------------|-------------|
| `supabase:studio` | 54323 | Database GUI (Studio) |
| `supabase:kong` | 54321 | API Gateway (Kong) |
| `supabase:mailpit` | 54324 | Email testing UI |

**Quick start:**

```bash
# 1. Enable plugin in asd.yaml
project:
  plugins: [supabase]

# 2. Start Supabase + extract credentials
asd plugin:supabase:bootstrap

# 3. View services in TUI
asd net
```

**Commands:**

| Command | Description |
|---------|-------------|
| `asd plugin:supabase:bootstrap` | Start Supabase + extract env vars |
| `asd plugin:supabase:start` | Start Supabase services |
| `asd plugin:supabase:stop` | Stop Supabase services |
| `asd plugin:supabase:extract` | Extract env vars to .env |

**Environment extraction:**

The `bootstrap` and `extract` commands parse Supabase CLI output and save to `.env`:

```bash
# Keys extracted automatically:
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_API_URL_LOCAL=http://127.0.0.1:54321
SUPABASE_DB_URL_LOCAL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_S3_ACCESS_KEY_ID=...
SUPABASE_S3_SECRET_ACCESS_KEY=...
SUPABASE_JWT_SECRET=...
```

**Accessing Supabase services:**

After setup, services appear in the TUI with these access patterns:

| Method | Studio URL |
|--------|------------|
| Local | `http://localhost:54323` |
| Caddy | `http://asd.localhost/asde/supabase-studio/` |
| Tunnel | Via hub tunnel (if `public: true`) |

**Service overlays:**

Customize plugin services in `asd.yaml`:

```yaml
network:
  services:
    supabase:studio:              # Overlay (no dial - uses plugin default)
      paths: ["/studio"]          # Custom path
      public: true                # Enable tunnel
```

### Plugin Service Detection

Plugin services are detected using health checks defined in their manifest:

```yaml
# Example from plugin's net.manifest.yaml
services:
  my-service:
    dial: "127.0.0.1:3000"
    healthCheck:
      type: "http"                # or "tcp"
      path: "/health"
      interval: 30
```

Services are automatically registered when:
1. The plugin is enabled in `asd.yaml`
2. The service is running and healthy
3. `asd net refresh` detects the service

### Available Plugins

| Plugin | Status | Description |
|--------|--------|-------------|
| `supabase` | 🟢 Stable | Local Supabase integration |

More plugins planned for future releases.

---

## Service Management

### Starting Services

**Interactive menu:**

```bash
asd terminal      # Shows status, URLs, and actions
asd code          # Shows status, URLs, and actions
asd database      # Shows status, URLs, and actions
```

**Direct start:**

```bash
asd terminal start
asd code start
asd database start
```

### Stopping Services

```bash
asd terminal stop
asd code stop
asd database stop
```

### Checking Status

```bash
asd net           # TUI shows all services
asd net refresh   # Update health status
```

### Service Registration

When services start, they register in the network registry:
- Appear in `asd net` TUI
- Get Caddy routes automatically
- Accessible via path-based URLs

---

## Port Allocation

Services use dynamic port allocation by default:

1. If `*_PORT` env var is set, use that port
2. Otherwise, allocate a random available port
3. Save allocated port to `.env` for persistence

This prevents port conflicts between services and allows multiple instances.

**To use a fixed port:**

```bash
# In .env
TTYD_PORT=7681
ASD_CODESERVER_PORT=8080
```

---

## Tips

- **First time?** Run `asd init` to install all service binaries
- **Service missing?** Check that binaries downloaded during init
- **Can't access remotely?** Ensure tunnel is active (`asd net apply --tunnel`)
- **Credentials not working?** Check `.env` file, not shell environment

---

## Related Documentation

- [User Manual](./USER_MANUAL.md) - Complete beginner guide
- [Command Reference](./um_commands.md) - All CLI commands
- [Feature Maturity](./FEATURE_MATURITY.md) - What's production-ready
- [Basic Auth](./BASIC_AUTH.md) - Authentication details

---

[Back to User Manual](./USER_MANUAL.md)
