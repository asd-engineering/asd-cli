# ASD CLI User Manual

**Version:** 2.0.2 | **Last Updated:** 2026-02-02

Share local services over HTTPS with anyone, anywhere. No port forwarding, no firewall rules, no certificates to manage.

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Quick Start](#2-quick-start)
3. [Understanding HTTPS Tunnels](#3-understanding-https-tunnels)
4. [Three Ways to Create Tunnels](#4-three-ways-to-create-tunnels)
5. [Web Terminal (ttyd)](#5-web-terminal-ttyd)
6. [VS Code Server (codeserver)](#6-vs-code-server-codeserver)
7. [Security & Authentication](#7-security--authentication)
8. [Access Patterns](#8-access-patterns)
9. [Troubleshooting](#9-troubleshooting)
10. [Reference Links](#10-reference-links)
11. [Tunnel Protocols](#11-tunnel-protocols)
12. [Plugins & Extensibility](#12-plugins--extensibility)
13. [Resources & Community](#13-resources--community)

---

## 1. Welcome

### What ASD Does

ASD CLI creates secure HTTPS tunnels from your local machine to the internet. With one command, you can:

- Share a local development server with a teammate
- Receive webhook callbacks from external APIs (payment providers, CI/CD pipelines, etc.)
- Access your terminal or VS Code from any browser
- Demo your work without deploying

### Who It's For

- **Developers** sharing work-in-progress with teammates
- **Teams** needing remote access to development environments
- **Anyone** who wants to access local services from anywhere

### What You'll Learn

This manual teaches you how to:

1. Expose any local port as a public HTTPS URL
2. Run a web-based terminal (ttyd) for remote shell access
3. Run VS Code in a browser (code-server) for remote development
4. Secure your services with authentication

### OS & Platform Support

ASD CLI is cross-platform. For detailed feature status, see [FEATURE_MATURITY.md](./FEATURE_MATURITY.md).

**Quick Status:**
- **Linux** - Primary platform, extensively tested
- **macOS/Windows** - Functional, actively improving
- **Android (Termux)** - Supported, see [um_termux.md](./um_termux.md)

> **Contributing:** Found an issue on your platform? We welcome bug reports and
> contributions at our GitHub repository.

### What is Tunneling?

ASD creates secure tunnels from your local machine to the internet.

**HTTP Tunneling** (default):
- Web apps, REST APIs, WebSockets
- Your service stays local, gets public HTTPS URL
- Zero port-forwarding on your firewall

**TCP Tunneling** (via direct SSH):
- Databases (PostgreSQL, MySQL, Redis)
- SSH servers, custom protocols
- Use direct SSH: `ssh -p 2223 -R 5432:localhost:5432 user@tunnel.asd.sh`
- Note: `asd expose` is HTTP-only; TCP requires direct SSH commands

**Key Use Cases:**
- Share localhost with teammates in 30 seconds
- Expose services in Docker/K8s containers
- Create terminal access (ttyd) to any machine
- Test webhooks from external services

---

## 2. Quick Start

Get a public URL in seconds.

### Step 1: Install

| Platform | Command |
|----------|---------|
| Linux/macOS | `curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh \| bash` |
| Windows (Admin PowerShell) | `irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 \| iex` |

**Windows Terminal Recommendation:**

For the best experience on Windows, we recommend:

| Terminal | Status | Notes |
|----------|--------|-------|
| **Git Bash** | Recommended | Full Unix compatibility, best support |
| Windows Terminal + PowerShell | Tested | Works well, some path edge cases |
| CMD.exe | Not recommended | Limited functionality |

Git Bash comes with [Git for Windows](https://git-scm.com/download/win) and provides
a Unix-like environment that matches our documentation examples.

> **Note:** PowerShell support is actively being improved. If you encounter issues,
> please report them at our GitHub repository.

### Step 2: Start Your Local Server

Run any local server. Example with Python:

```bash
python -m http.server 3000
```

Or Node.js:

```bash
npx serve -p 3000
```

### Step 3: Expose It

```bash
asd expose 3000
```

You'll see output like:

```
Local:  http://localhost:3000
Caddy:  http://app.localhost
Tunnel: https://app-abc123.cicd.eu1.asd.engineer
```

**That's it!** Share the tunnel URL with anyone. It's HTTPS, secure, and works from anywhere.

### First-Time Setup

Before using tunnels, you need credentials. Choose one:

**Quick testing (no account):**
```bash
# Get 5-minute ephemeral credentials
curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token
# Use the returned tunnel_client_id and tunnel_client_secret
```

**For longer sessions:** Create tunnel credentials at [asd.host](https://asd.host) → Account → Tunnel Tokens, then set in `.env`:
```bash
ASD_TUNNEL_TOKEN=your-token
ASD_TUNNEL_USER=your-user
```

> **Note:** CLI-based login (`asd login`) is coming in the next release.

---

## 3. Understanding HTTPS Tunnels

### How It Works

When you run `asd expose 3000`, here's what happens:

```mermaid
flowchart LR
    subgraph Your Computer
        A[localhost:3000]
    end
    subgraph ASD Cloud
        B[asd.engineer<br/>HTTPS + auto-cert]
    end
    subgraph Anyone
        C[User Browser]
    end
    A -->|SSH tunnel| B
    C -->|HTTPS| B
```

1. ASD creates an SSH tunnel from your machine to the ASD cloud
2. ASD cloud provides a public HTTPS URL with automatic certificates
3. Anyone with the URL can access your local service securely

### Tunnel URL Format

Your tunnel URL looks like:

```
https://<prefix>-<client-id>.<region>.asd.engineer
        ^^^^^^^  ^^^^^^^^^^  ^^^^^^
           |          |         |
      Your name   Unique ID   Server location
       (optional)
```

Example: `https://myapp-x7k9m2.cicd.eu1.asd.engineer`

### What You Get Automatically

- **HTTPS** - Encrypted connection, no certificate setup needed
- **Public URL** - Accessible from anywhere on the internet
- **Firewall bypass** - No port forwarding or router configuration
- **Instant setup** - Works in seconds, not hours

### Tunnel Lifetime

Tunnel duration varies by plan. Tunnels auto-reconnect if connection drops.

See [asd.host/pricing](https://asd.host/pricing) for current plan details.

---

## 4. Three Ways to Create Tunnels

Choose the method that fits your workflow:

| Need | Method | Complexity |
|------|--------|------------|
| Share something RIGHT NOW | `asd expose` | Simplest |
| Daily development workflow | `asd.yaml` config | Medium |
| CI/CD automation | Tunnel tokens | Advanced |

### Method 1: Quick Expose (`asd expose`)

The fastest way to share a local port.

**Basic usage:**

```bash
asd expose 3000
```

**With a custom name:**

```bash
asd expose 3000 --name myapp
# Result: https://myapp-abc123.cicd.eu1.asd.engineer
```

The `--name` sets a prefix. The URL is always `<name>-<client-id>.cicd.eu1.asd.engineer`.

**Direct tunnel (skip Caddy):**

```bash
asd expose 3000 myapp --direct
# Creates tunnel directly without local Caddy proxy
```

Use `--direct` when you only need the public tunnel URL and don't need local routing through Caddy.

**Managing exposed services:**

```bash
asd expose list           # List all exposed services (shows tunnel URLs!)
asd expose stop myapp     # Stop by name
asd expose stop 3000      # Stop by port
```

**Example `asd expose list` output:**

```
myapp
    Port:     3000
    Local:    http://myapp.localhost
    Tunnel:   https://myapp-abc123.cicd.eu1.asd.engineer
    Status:   ✅ Online
    Uptime:   🕐 2h 15m
```

**Interactive prompts:**

When running in a terminal, `asd expose` will interactively prompt you if:
- The tunnel binary needs to be installed
- You need to login to create tunnels

This makes first-time setup seamless without pre-configuration.

**When to use:** Quick demos, one-off sharing, testing webhooks.

### Method 2: Project Config (`asd.yaml`)

For ongoing development, define services in your project.

**Setup:**

```bash
cd your-project
asd init                  # Creates asd.yaml and workspace
```

**Edit `asd.yaml`:**

```yaml
version: 1
project:
  name: "my-app"

network:
  services:
    frontend:
      dial: "127.0.0.1:3000"
      host: "app.localhost"      # Local hostname
      public: true               # Enable tunnel
      subdomain: "frontend"      # Tunnel subdomain prefix

    api:
      dial: "127.0.0.1:8080"
      paths: ["/api"]            # Path-based routing
      public: true
      subdomain: "api"
```

**Apply and start:**

```bash
asd net apply --caddy --tunnel
asd net                   # Open TUI dashboard
```

**TUI Controls:**

| Key | Action |
|-----|--------|
| `Tab` | Cycle tabs (Services, Projects, Logs) |
| `Enter` | Actions menu for selected service |
| `Ctrl+R` | Refresh health status |
| `Ctrl+Q` | Quit |
| Arrow keys | Navigate services |

**When to use:** Daily development, team projects, multiple services.

---

## 5. Web Terminal (ttyd)

Access your terminal from any browser, anywhere.

### What is ttyd?

ttyd gives you a full shell session in your web browser. Perfect for:

- Remote debugging from your phone
- Sharing terminal access with teammates
- Accessing your dev machine from anywhere

### Quick Start

**1. Set credentials** (in `.env` or environment):

```bash
TTYD_USERNAME=admin
TTYD_PASSWORD=your-secure-password
```

**2. Start the terminal:**

```bash
asd terminal start
```

**3. Access it:**

| Method | URL |
|--------|-----|
| Local Direct | `http://localhost:<port>/` |
| Via Caddy | `http://asd.localhost/asde/ttyd/` |
| Via Tunnel | `https://xxx.cicd.eu1.asd.engineer/asde/ttyd/` |

**4. Stop when done:**

```bash
asd terminal stop
```

### Three Ways to Access

After starting, `asd terminal` shows you a menu with all access URLs:

```
Terminal (ttyd) - Web Terminal Access
=====================================
Status: Running on port 7681

Access URLs:
  Local:  http://admin:***@localhost:7681/
  Caddy:  http://asd.localhost/asde/ttyd/
  Tunnel: https://hub-abc123.cicd.eu1.asd.engineer/asde/ttyd/

Actions:
  [1] Open in browser
  [2] Copy tunnel URL
  [3] Stop terminal
```

| Access Method | When to Use |
|---------------|-------------|
| **Local Direct** | On the same machine |
| **Caddy Route** | Local network, other devices on LAN |
| **Tunnel** | Remote access from anywhere |

### Configuration

All ttyd settings go in your `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `TTYD_PORT` | (auto) | Port number (auto-assigned if not set) |
| `TTYD_USERNAME` | (required) | Login username |
| `TTYD_PASSWORD` | (required) | Login password |
| `TTYD_SHELL_CMD` | `bash` | Shell to run (`bash`, `zsh`, `fish`) |
| `TTYD_CWD` | workspace | Starting directory |
| `TTYD_PATH` | `/` | URL path prefix |

**Example `.env`:**

```bash
TTYD_USERNAME=developer
TTYD_PASSWORD=dev-secret-123
TTYD_SHELL_CMD=zsh
```

### Remote Access Setup

To access your terminal from anywhere:

**1. Start terminal and tunnel:**

```bash
asd terminal start
asd net apply --tunnel
```

**2. Get the tunnel URL:**

```bash
asd terminal
# Shows tunnel URL in the menu
```

**3. Share the URL** - Anyone with the URL and credentials can access your terminal.

### Security Notes

**ttyd is security-sensitive.** It provides full shell access to your machine.

- **Always use strong passwords** - At least 12 characters, mixed case/numbers
- **Don't share credentials** - Give each user their own account if possible
- **Use tunnels carefully** - Anyone with the URL + password has shell access
- **Stop when not needed** - `asd terminal stop`

When project-level authentication is enabled, ttyd automatically gets protected.

### Troubleshooting

**"Missing username or password":**

```bash
# Set in .env:
TTYD_USERNAME=admin
TTYD_PASSWORD=your-password
```

**"Port already in use":**

```bash
asd terminal stop
# Or manually: kill the process using the port
lsof -i :7681 | grep ttyd
kill <pid>
```

**"Can't connect via tunnel":**

```bash
# Ensure tunnel is active:
asd net                   # Check hub service has tunnel URL
asd net apply --tunnel    # Re-apply if needed
```

**"Binary not found":**

```bash
asd init                  # Re-downloads binaries
```

---

## 6. VS Code Server (codeserver)

Run Visual Studio Code in your browser with full extension support.

### What is codeserver?

code-server runs VS Code in a browser. Get the full VS Code experience from any device:

- Edit code on a tablet or Chromebook
- Use your powerful desktop from a laptop
- Share a development environment with teammates

### Quick Start

**1. Start code-server:**

```bash
asd code start
```

**2. Access it:**

| Method | URL |
|--------|-----|
| Local Direct | `http://localhost:<port>/` |
| Via Caddy | `http://asd.localhost/asde/codeserver/` |
| Via Tunnel | `https://xxx.cicd.eu1.asd.engineer/asde/codeserver/` |

**3. Stop when done:**

```bash
asd code stop
```

### Three Ways to Access

Same pattern as ttyd. Run `asd code` for the interactive menu:

```
VS Code Server - Browser-based IDE
==================================
Status: Running on port 8080

Access URLs:
  Local:  http://localhost:8080/
  Caddy:  http://asd.localhost/asde/codeserver/
  Tunnel: https://hub-abc123.cicd.eu1.asd.engineer/asde/codeserver/

Actions:
  [1] Open in browser
  [2] Copy tunnel URL
  [3] Stop code-server
```

### Configuration

Configure in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ASD_CODESERVER_PORT` | (auto) | Port number |
| `ASD_CODESERVER_AUTH` | `none` | Auth mode: `none` or `password` |
| `ASD_CODESERVER_PASSWORD` | - | Password (when auth=password) |
| `ASD_CODESERVER_WORKSPACE` | project root | Folder to open |

**Example `.env`:**

```bash
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=vscode-secret-123
```

**No authentication (local only):**

```bash
ASD_CODESERVER_AUTH=none
# Safe for local-only access
```

### Remote Access Setup

**1. Enable password authentication:**

```bash
# In .env:
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=your-secure-password
```

**2. Start code-server and tunnel:**

```bash
asd code start
asd net apply --tunnel
```

**3. Get the tunnel URL:**

```bash
asd code
# Shows tunnel URL in menu
```

### Features

code-server provides the full VS Code experience:

- **Extensions** - Install from Open VSX marketplace
- **Integrated Terminal** - Full shell access
- **Git Integration** - Full source control
- **Settings Sync** - Your preferences everywhere
- **Multiple Files** - Tabs, split views, everything

### Security Notes

**code-server is security-sensitive.** It provides code editing and terminal access.

- **Use password auth for remote access** - Set `ASD_CODESERVER_AUTH=password`
- **Strong passwords** - At least 12 characters
- **Project-level auth** - Enable `basic_auth` in `asd.yaml` for extra protection
- **Stop when not needed** - `asd code stop`

### Authentication Layers

code-server can have two authentication layers:

1. **Caddy basic auth** - Protects the route (browser login prompt)
2. **codeserver internal auth** - Application-level password

**Known limitation:** When using Caddy basic auth (`basic_auth` in `asd.yaml`), the credentials are NOT forwarded to code-server. Caddy strips the Authorization header before proxying.

This means:
- Caddy validates the user at the gateway
- code-server doesn't know who logged in via Caddy

**Recommendation for remote access:**

Use code-server's internal authentication instead of (or in addition to) Caddy basic auth:

```bash
# In .env
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=your-secure-password
```

This ensures code-server manages its own session, regardless of Caddy's auth layer.

### Troubleshooting

**"Can't install extensions":**

code-server uses Open VSX, not the Microsoft marketplace. Most popular extensions are available, but some Microsoft-specific ones aren't.

**"Port conflict":**

```bash
asd code stop
# Or kill manually:
lsof -i :8080 | grep code-server
kill <pid>
```

**"Authentication failing":**

```bash
# Check your auth settings:
grep ASD_CODESERVER .env

# Ensure you're using the right password
```

**"Slow performance":**

- Close unused tabs and terminals
- Disable unnecessary extensions
- Use a stable network connection

---

## 7. Security & Authentication

Protect your services from unauthorized access.

### Security Levels

ASD provides three levels of security:

| Level | Who Can Access | When to Use |
|-------|----------------|-------------|
| **No Auth** | Anyone with URL | Local development, testing |
| **Basic Password** | Anyone with URL + password | Remote access, demos |
| **Tunnel Tokens** | Authenticated users | CI/CD, automation |

```mermaid
flowchart LR
    subgraph "Level 1: No Auth"
        A1[Anyone with URL]
    end
    subgraph "Level 2: Basic Auth"
        A2[URL + Password]
    end
    subgraph "Level 3: Tunnel Tokens"
        A3[Authenticated Users]
    end
    A1 --> Local[Local Dev]
    A2 --> Remote[Remote Access]
    A3 --> CI[CI/CD Automation]
```

### Level 1: Open Access (Default)

When you expose without service auth:

```bash
asd expose 3000
# → https://myapp-abc123.cicd.eu1.asd.engineer
```

Your **local** service on localhost:3000 becomes accessible via a **public HTTPS URL**.

Traffic flow: Internet → HTTPS → SSH tunnel (encrypted) → Caddy → your service

**Good for:** Quick demos, teammate collaboration, trusted sharing

**Add password for:** Sensitive data, long-running tunnels, public demos

**Safe for:**
- Local-only access (`localhost`)
- Trusted networks
- Quick demos where you can rotate the URL

**Not safe for:**
- Services with sensitive data
- Long-running tunnels
- Production environments

### Level 2: Basic Password Protection

Add HTTP Basic Authentication to your services.

**Project-wide authentication:**

```yaml
# asd.yaml
network:
  caddy:
    basic_auth:
      enabled: true
      realm: "My Project"
```

**Set credentials in `.env`:**

```bash
ASD_BASIC_AUTH_USERNAME=admin
ASD_BASIC_AUTH_PASSWORD=your-secure-password-here
```

**What users see:**

When accessing your service, browsers show a login dialog asking for username and password.

**Per-service override:**

```yaml
# asd.yaml
network:
  caddy:
    basic_auth:
      enabled: true

  services:
    public-api:
      dial: "127.0.0.1:3000"
      basic_auth:
        enabled: false    # No auth for this service

    admin-panel:
      dial: "127.0.0.1:8080"
      basic_auth:
        enabled: true
        realm: "Admin Only"
```

### Security-Sensitive Services

Some services are automatically treated as security-sensitive:

| Service | Default Behavior |
|---------|------------------|
| ttyd | Always requires credentials |
| codeserver | Recommends password auth |

These services provide shell or code access - they should **always** have authentication when publicly accessible.

**ttyd credentials:**

```bash
TTYD_USERNAME=admin
TTYD_PASSWORD=your-ttyd-password
```

**codeserver credentials:**

```bash
ASD_CODESERVER_AUTH=password
ASD_CODESERVER_PASSWORD=your-code-password
```

### Level 3: Tunnel Tokens (Automation)

For CI/CD pipelines and automation, use tunnel tokens from the web dashboard.

**Method 1: Ephemeral Token (Quick Testing)**

No account needed. Get 5-minute credentials instantly:

```bash
curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token

# Response includes:
# - tunnel_client_id: "guest-xyz123"
# - tunnel_client_secret: "abc123..."
# - expires_at: 5 minutes from now
```

**Method 2: Tunnel Token (CI/CD & Longer Sessions)**

1. Sign up at [asd.host](https://asd.host)
2. Go to Account → Tunnel Tokens → Create
3. Set credentials in `.env` or CI secrets:

```bash
ASD_TUNNEL_TOKEN=your-token-from-dashboard
ASD_TUNNEL_USER=your-user-id
asd expose 3000
```

> **Note:** CLI-based login (`asd login`) is coming in the next release.

### Choosing the Right Level

| Scenario | Recommended |
|----------|-------------|
| Local development | No auth |
| Quick demo (< 1 hour) | No auth (URL is secret enough) |
| Remote access to your machine | Basic password |
| Sharing with teammates | Basic password |
| CI/CD pipelines | Tunnel tokens |
| Production | Don't use ASD tunnels! |

### Password Best Practices

For `ASD_BASIC_AUTH_PASSWORD`, `TTYD_PASSWORD`, and `ASD_CODESERVER_PASSWORD`:

- **Minimum 12 characters**
- **Mix of letters, numbers, symbols**
- **Never reuse passwords**
- **Don't commit to git** - Use `.env` (already gitignored)

**Generate a strong password:**

```bash
openssl rand -base64 24
# Example output: K7mX9pQr2sT8vW1yB4cF6dH3
```

---

## 8. Access Patterns

Every ASD service can be accessed three ways.

### Caddy as Security Layer

ASD uses Caddy as a local reverse proxy **between** the tunnel and your services:

```
Internet → ASD Cloud → SSH Tunnel → Caddy (local) → Your Service
                                       ↑
                                  Security layer
```

**Currently Available:**
- ✅ HTTPS on all Caddy routes
- ✅ HTTP Basic Authentication (password protection)
- ✅ Health check endpoints
- ✅ Request routing (host + path based)

**Configuration:**
```yaml
network:
  caddy:
    basic_auth:
      enabled: true
```

**ASD Caddy Client:** ASD includes npm tooling for Caddy API configuration.

### Future Authentication (Roadmap)

These are planned but **not yet implemented**:
- ⏳ OIDC (OpenID Connect)
- ⏳ JWT validation at edge
- ⏳ LDAP / Active Directory
- ⏳ 2FA / MFA enforcement
- ⏳ Edge authentication (ASD Cloud level)

For current options, see [BASIC_AUTH.md](./BASIC_AUTH.md).

### Overview

| Pattern | URL Example | Use Case |
|---------|-------------|----------|
| **Local Direct** | `http://localhost:3000` | Same machine |
| **Caddy Route** | `http://asd.localhost/myapp/` | Local network, LAN |
| **Tunnel Remote** | `https://myapp-abc123.cicd.eu1.asd.engineer/` | Anywhere |

```mermaid
flowchart TB
    subgraph Access Patterns
        direction TB
        L[Local Direct<br/>localhost:3000]
        C[Caddy Route<br/>app.localhost]
        T[Tunnel Remote<br/>app-xxx.asd.engineer]
    end

    L --> App[Your App]
    C --> Caddy[Caddy :80] --> App
    T --> Cloud[ASD Cloud] --> Tunnel[SSH Tunnel] --> Caddy
```

### Pattern 1: Local Direct

Direct connection to the service port.

```
http://localhost:<port>/
```

**Example:** `http://localhost:3000/`

**When to use:**
- Developing on the same machine
- Maximum performance (no proxy)
- Debugging network issues

**How it works:**
```
Browser --> localhost:3000 --> Your App
```

### Pattern 2: Caddy Routes

Access through the local Caddy reverse proxy.

**Host-based routing:**

```
http://<service>.localhost/
```

Example: `http://myapp.localhost/`

**Path-based routing:**

```
http://asd.localhost/<path>/
```

Example: `http://asd.localhost/api/`

Built-in services use the `/asde/` path prefix:
- ttyd: `http://asd.localhost/asde/ttyd/`
- codeserver: `http://asd.localhost/asde/codeserver/`

**When to use:**
- Multiple services with nice URLs
- Testing with realistic hostnames
- Accessing from other devices on LAN

**How it works:**
```
Browser --> Caddy (:80) --> localhost:3000 --> Your App
```

### Pattern 3: Tunnel Remote

Access through the public HTTPS tunnel.

```
https://<prefix>-<id>.cicd.eu1.asd.engineer/
```

Example: `https://myapp-abc123.cicd.eu1.asd.engineer/`

**When to use:**
- Remote access from anywhere
- Sharing with external users
- Testing webhooks from external services
- Accessing from mobile devices

**How it works:**
```
Browser --> ASD Cloud --> SSH Tunnel --> Caddy --> Your App
                         (encrypted)
```

### Built-in Service URLs

| Service | Local | Caddy | Tunnel |
|---------|-------|-------|--------|
| Your app | `http://localhost:3000` | `http://myapp.localhost` | `https://myapp-xxx.cicd.eu1.asd.engineer` |
| ttyd | `http://localhost:7681` | `http://asd.localhost/asde/ttyd/` | `https://hub-xxx.../asde/ttyd/` |
| codeserver | `http://localhost:8080` | `http://asd.localhost/asde/codeserver/` | `https://hub-xxx.../asde/codeserver/` |

### Finding Your URLs

**For quick expose:**

```bash
asd expose 3000
# Output shows all URLs
```

**For project services:**

```bash
asd net
# TUI shows all service URLs
```

**For built-in services:**

```bash
asd terminal    # Shows ttyd URLs
asd code        # Shows codeserver URLs
```

---

## 9. Troubleshooting

### Common Issues

<details>
<summary><strong>Command not found: asd</strong></summary>

The CLI isn't installed or not in PATH.

```bash
# Reinstall
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash

# Or check PATH
echo $PATH
```
</details>

<details>
<summary><strong>Port already in use</strong></summary>

Another process is using the port.

```bash
# Find what's using the port
lsof -i :3000

# Kill it
kill <pid>

# Or use a different port
asd expose 3001
```
</details>

<details>
<summary><strong>Tunnel not connecting</strong></summary>

Authentication or network issues.

```bash
# Check auth status
asd tunnel auth status

# Re-login
asd login

# Reset tunnels
asd net tunnel reset
```
</details>

<details>
<summary><strong>Service not appearing in TUI</strong></summary>

Registry out of sync.

```bash
# Refresh services
asd net refresh

# Or full reset
rm .asd/workspace/network/registry.json
asd net apply
```
</details>

<details>
<summary><strong>Caddy won't start</strong></summary>

Caddy configuration issue.

```bash
# Stop and remove state
asd caddy stop
rm -rf .asd/workspace/caddy/

# Restart
asd caddy start
asd net apply
```
</details>

<details>
<summary><strong>Full Reset (Nuclear Option)</strong></summary>

When everything is broken:

```bash
# Stop all processes
pkill -f "caddy run"
pkill -f "asd-tunnel"

# Remove all state
rm -rf .asd/workspace/

# Reinitialize
asd init
asd net apply --caddy --tunnel
```
</details>

<details>
<summary><strong>Debug Mode</strong></summary>

Enable verbose logging:

```bash
ASD_DEBUG=1 asd net apply
```
</details>

<details>
<summary><strong>View Logs</strong></summary>

```bash
asd logs caddy      # Caddy proxy logs
asd logs tunnel     # Tunnel logs

# Logs are in .asd/workspace/logs/
```
</details>

### Getting Help

- **GitHub Issues:** https://github.com/asd-engineering/asd-cli/issues
- **Documentation:** https://asd.host/docs

---

## 10. Reference Links

### Command Reference

Quick reference of most-used commands:

| Command | Description |
|---------|-------------|
| `asd init` | Initialize project workspace |
| `asd expose <port>` | Expose a port instantly |
| `asd login` | Login for tunnels (coming soon) |
| `asd net` | Open network TUI |
| `asd net apply` | Apply configuration |
| `asd terminal` | Web terminal menu |
| `asd code` | VS Code server menu |
| `asd update` | Update ASD CLI |

Full command reference: [um_commands.md](./um_commands.md)

### Configuration Reference

- **asd.yaml options:** [um_asd_yaml.md](./um_asd_yaml.md)
- **Basic auth details:** [BASIC_AUTH.md](./BASIC_AUTH.md)
- **Tunnel architecture:** [TUNNELING.md](./TUNNELING.md)

### Service Reference

- **All services:** [um_service.md](./um_service.md)
- **Feature maturity:** [FEATURE_MATURITY.md](./FEATURE_MATURITY.md)

### Platform Guides

- **Android/Termux:** [um_termux.md](./um_termux.md)

### Status Legend

Throughout the documentation:

| Symbol | Meaning |
|--------|---------|
| ✅ | Production - fully tested, recommended |
| 🟢 | Stable - works reliably |
| 🟡 | Beta - functional, may have rough edges |
| 🟠 | Alpha - experimental |

---

## 11. Tunnel Protocols

ASD supports different tunnel protocols for different use cases.

### HTTP Tunneling (Default)

Most services use HTTP tunneling over ports 80 and 443:

- Web applications
- REST APIs
- WebSocket connections (like ttyd)
- GraphQL endpoints

HTTP tunnels are the default and require no special configuration:

```yaml
# asd.yaml - HTTP tunnel (default)
network:
  services:
    my-app:
      dial: "127.0.0.1:3000"
      public: true              # Creates HTTPS tunnel
```

### TCP Tunneling

TCP port forwarding works via direct SSH commands. Any port other than 80/443 is forwarded as raw TCP.

**Use cases:**
- Databases (PostgreSQL, MySQL, Redis)
- SSH servers
- Custom binary protocols
- Game servers

**Examples:**

```bash
# Expose PostgreSQL on a random public port
ssh -p 2223 -R 5432:localhost:5432 $ASD_CLIENT_ID@tunnel.asd.sh

# Expose MySQL
ssh -p 2223 -R 3306:localhost:3306 $ASD_CLIENT_ID@tunnel.asd.sh

# Expose Redis
ssh -p 2223 -R 6379:localhost:6379 $ASD_CLIENT_ID@tunnel.asd.sh
```

The server assigns a random public port and reports it back in the SSH session output.

**Note:** The `asd expose` command currently supports HTTP tunnels only. For TCP:
- Use direct SSH forwarding as shown above
- Authenticate via `asd login` first to get credentials

**Private TCP aliases** (e.g., `ssh -R mydb:5432:localhost:5432 ...`) require the `--tcp-aliases` flag on the server. ASD public servers have this disabled for security. Self-hosted servers can enable it.

### Tunnel Protocol Comparison

| Protocol | Ports | Use Case | Encryption |
|----------|-------|----------|------------|
| HTTP/HTTPS | 80, 443 | Web apps, APIs, WebSockets | TLS via Caddy |
| TCP | Any (random assigned) | Databases, SSH, custom | SSH tunnel encryption |
| TCP Alias | Private (self-hosted only) | Team-only access | SSH tunnel + no public port |

### WebSocket Support

WebSocket connections work automatically through HTTP tunnels. This is how ttyd (web terminal) works:

1. Browser connects via HTTPS to tunnel URL
2. HTTP connection upgrades to WebSocket
3. Caddy's reverse proxy handles the upgrade correctly
4. Real-time bidirectional communication established

**No special configuration needed** - Caddy's `vulcand/oxy` forwarding library handles WebSocket upgrades transparently.

**Example: ttyd WebSocket flow:**

```
Browser --HTTPS--> Tunnel --> Caddy --WS--> ttyd:7681
                              (upgrade handled)
```

### When to Use Each

| Scenario | Protocol | Example |
|----------|----------|---------|
| Web app demo | HTTP | `asd expose 3000` |
| API testing | HTTP | `public: true` in asd.yaml |
| Database access | TCP | `ssh -R 5432:localhost:5432 ...` |
| SSH access | TCP | `ssh -R 22:localhost:22 ...` |
| Team-only database | TCP Alias | Self-hosted with `--tcp-aliases` |

### Tips & Tricks: Faster Connections

#### Direct OpenSSH (Advanced)

For maximum control, you can bypass `asd` and connect directly via OpenSSH:

```bash
# Using sshpass for non-interactive auth
sshpass -p "$ASD_CLIENT_SECRET" ssh \
  -o PreferredAuthentications=password \
  -o StrictHostKeyChecking=no \
  -p 2223 \
  -R "myapp:80:localhost:3000" \
  "$ASD_CLIENT_ID@s1.eu1.asd.engineer"
```

**When to use:**
- CI/CD pipelines needing minimal dependencies
- Custom scripting scenarios
- Debugging connection issues

#### API Token Requests

You can request tokens programmatically via the ASD API:

```bash
# Request an ephemeral token (5-minute TTL, no auth required)
curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token \
  -H "Content-Type: application/json"
```

For authenticated API access with longer-lived tokens, see [API Reference](./um_api.md).

---

## 12. Plugins & Extensibility

ASD's functionality can be extended through modules and plugins.

### Modules vs Plugins

ASD has two extension mechanisms:

| Aspect | Modules | Plugins |
|--------|---------|---------|
| **What they do** | Add CLI commands | Add network services |
| **Scope** | User actions | Service discovery, routing |
| **Registration** | `registerCommand()` | `net.manifest.yaml` |
| **Example** | `asd caddy start` | Supabase dashboard in TUI |

**Key insight:** Plugins are networking extensions inside modules. They define services that appear in `asd net` automatically.

### Built-in Modules

| Module | Commands | What It Does |
|--------|----------|--------------|
| `caddy` | `start`, `stop`, `restart` | Local reverse proxy |
| `terminal` | `start`, `stop` | Web-based terminal (ttyd) |
| `code` | `start`, `stop` | VS Code in browser |
| `database` | `start`, `stop` | Database UI (DbGate) |
| `tunnel` | `auth`, `registry` | Tunnel management |

### The Supabase Plugin

The Supabase plugin is an example of how plugins extend ASD's networking.

**Enable in asd.yaml:**

```yaml
project:
  name: "my-app"
  plugins: [supabase]           # Enable plugin
```

**What you get:**

When enabled, the Supabase plugin:
1. Detects running Supabase services
2. Registers them in the network
3. Creates Caddy routes for each service
4. Makes them available in the `asd net` TUI

**Plugin-provided services:**

| Service | Port | Description |
|---------|------|-------------|
| `supabase:studio` | 54323 | Database GUI |
| `supabase:kong` | 54321 | API Gateway |
| `supabase:mailpit` | 54324 | Email testing UI |

**Plugin commands:**

```bash
# Bootstrap Supabase + extract env vars
asd plugin:supabase:bootstrap

# Start/stop Supabase services
asd plugin:supabase:start
asd plugin:supabase:stop

# Extract environment variables
asd plugin:supabase:extract
```

**Automatic environment extraction:**

The `bootstrap` command extracts credentials from Supabase and adds them to `.env`:

```bash
PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_API_URL_LOCAL=http://127.0.0.1:54321
SUPABASE_DB_URL_LOCAL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
# ... and more
```

### Package Manifests (Monorepo Support)

For monorepo projects, ASD can auto-discover services from package subdirectories. Each package can define its own `net.manifest.yaml`.

**Directory structure:**

```
my-project/
├── asd.yaml
├── packages/
│   ├── api/
│   │   └── net.manifest.yaml    # Auto-discovered
│   ├── web/
│   │   └── net.manifest.yaml    # Auto-discovered
│   └── admin/
│       └── net.manifest.yaml    # Auto-discovered
```

**Configuration priority:**

| Priority | Method | Example |
|----------|--------|---------|
| 1 (highest) | Environment variable | `ASD_PACKAGE_MANIFESTS_DIR=services` |
| 2 | asd.yaml config | `project.package_manifests_dir: "apps"` |
| 3 (default) | Default directory | `packages/` (if exists) |

**Example asd.yaml:**

```yaml
version: 1
project:
  name: "my-monorepo"
  package_manifests_dir: "apps"   # Look in apps/ instead of packages/
```

**When to use:** Monorepos, microservices, or projects where teams manage their own service definitions independently.

### How Plugins Work

Plugins define a network manifest (`net.manifest.yaml`) that tells ASD:
1. What services the plugin provides
2. How to detect if services are running
3. What routes to create in Caddy

When you run `asd net apply`, ASD:
1. Reads enabled plugins from `asd.yaml`
2. Loads their manifests
3. Checks which services are running
4. Registers healthy services in the network
5. Creates Caddy routes

### Creating Custom Plugins

Plugins live in `modules/<name>/` and need:

```
modules/my-plugin/
├── index.mjs                   # Register commands
├── scripts/
│   ├── cli.mjs                 # CLI registration
│   └── api.mjs                 # Business logic
└── net.manifest.yaml           # Network services
```

**Example `net.manifest.yaml`:**

```yaml
services:
  my-db:
    dial: "127.0.0.1:3306"
    description: "My Database"
    healthCheck:
      type: "tcp"
```

### Future Plugin Ideas

As ASD grows, plugins could be added for:

- **Redis** - Session management, caching
- **Meilisearch** - Full-text search
- **MinIO** - S3-compatible storage
- **Keycloak** - Authentication server
- **Temporal** - Workflow orchestration

---

## 13. Resources & Community

### Open Source

ASD is built on open source principles. Key components:

- **SvelteKit Starter**: We're building on [CMSaasStarter](https://github.com/scosman/CMSaasStarter),
  a production-ready SvelteKit + Supabase + Stripe template.

- **ASD Open Source Edition**: We plan to release an open source version of ASD
  with full integration. Contact us if you need it sooner!

### Get in Touch

- **GitHub Issues**: Report bugs, request features
- **Contact**: hello@asd.engineer

---

## Quick Reference Card

**Install:**
```bash
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
```

**Expose a port:**
```bash
asd expose 3000
```

**Web terminal:**
```bash
TTYD_USERNAME=admin TTYD_PASSWORD=secret asd terminal start
```

**VS Code:**
```bash
asd code start
```

**Stop everything:**
```bash
asd terminal stop
asd code stop
asd expose stop 3000
```

---

*For detailed technical reference, see the documents in `.asd/docs/`.*
