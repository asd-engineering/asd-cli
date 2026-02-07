# ASD CLI Command Reference

**Version:** 2.0.2 | **Last Updated:** 2026-02-02

Complete reference for all ASD CLI commands.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `asd init` | Initialize project workspace |
| `asd run <task>` | Run automation task from asd.yaml |
| `asd expose <port>` | Expose a port with tunnel |
| `asd login` | Login for tunnels (coming soon) |
| `asd net` | Open network TUI |
| `asd terminal` | Web terminal management |
| `asd code` | VS Code server management |
| `asd update` | Update ASD CLI |

---

## Core Commands

### `asd init`

Initialize a project workspace with configuration and binaries.

```bash
asd init              # Interactive setup
asd init --yes        # Accept all defaults
asd init --skip-binaries  # Skip binary downloads
```

**What it does:**
1. Creates `asd.yaml` configuration file
2. Creates `.asd/workspace/` directory
3. Downloads helper binaries (Caddy, ttyd, code-server)
4. Sets up `.env` from template
5. Optionally discovers running services

### `asd env-init`

Manage environment variables in `.env` file.

```bash
asd env-init              # Merge with existing .env
asd env-init --override   # Replace entire .env
asd env-init --yes        # Non-interactive mode
```

### `asd run <task>`

Run an automation task defined in `asd.yaml`. This is the simplest way to start your development environment.

```bash
asd run dev               # Run the 'dev' task
asd run prod              # Run the 'prod' task
asd run start             # Run the 'start' task
asd run                   # Show available tasks
```

**What it does:**
1. Reads `automation:` section from `asd.yaml`
2. Starts the specified task in the background
3. Shows rich output with service status and tunnel URLs

**Example asd.yaml:**
```yaml
automation:
  dev:
    - run: "pnpm dev"
      background: true
  prod:
    - run: "pnpm build && pnpm preview"
      background: true
```

**Options:**
- `--follow` or `-f`: Follow logs after starting
- `--json`: Output JSON format

**See also:** `asd up` for more advanced options like `--env` flag.

### `asd login`

> **Coming soon:** CLI-based login will be available in the next release.

For now, get tunnel credentials via:
- **Quick testing:** `curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token`
- **CI/CD:** Create tunnel token at [asd.host](https://asd.host) → Account → Tunnel Tokens

### `asd update`

Update ASD CLI to the latest version.

```bash
asd update           # Update to latest
asd update --check   # Check for updates only
asd update --force   # Force reinstall
```

---

## Expose Commands

Quick port exposure with tunnels.

### `asd expose <port>`

Expose a local port instantly.

```bash
asd expose 3000                    # Basic exposure
asd expose 3000 --name myapp       # Named tunnel (prefix in URL)
asd expose 3000 --local-only       # No tunnel, local Caddy only
asd expose 3000 myapp --direct     # Direct tunnel, skip Caddy
```

**Options:**

| Option | Description |
|--------|-------------|
| `--name <name>` | Name prefix for tunnel URL |
| `--local-only` | No tunnel, local Caddy routing only |
| `--direct` | Direct tunnel, skip Caddy proxy |

**Output:**
```
Local:  http://localhost:3000
Caddy:  http://myapp.localhost
Tunnel: https://myapp-abc123.cicd.eu1.asd.engineer
```

The `--name` option sets a prefix. The full URL is always `<name>-<client-id>.cicd.eu1.asd.engineer`.

**Interactive prompts:** When running in a terminal, prompts for binary installation or login if needed.

### `asd expose list`

List all exposed services with tunnel URLs.

```bash
asd expose list
```

**Output:**
```
myapp
    Port:     3000
    Local:    http://myapp.localhost
    Tunnel:   https://myapp-abc123.cicd.eu1.asd.engineer
    Status:   ✅ Online
    Uptime:   🕐 2h 15m
```

### `asd expose stop`

Stop an exposed service.

```bash
asd expose stop myapp    # Stop by name
asd expose stop 3000     # Stop by port
```

---

## Network Commands

Network management and TUI.

### `asd net`

Open the interactive network TUI.

```bash
asd net
```

**TUI Controls:**
| Key | Action |
|-----|--------|
| `Tab` | Cycle tabs (Services, Projects, Logs) |
| `Enter` | Actions menu for selected service |
| `Ctrl+R` | Refresh health checks |
| `Ctrl+Q` | Quit |
| `↑/↓` | Navigate services |

### `asd net apply`

Apply network configuration.

```bash
asd net apply              # Apply all (Caddy routes)
asd net apply --caddy      # Start Caddy reverse proxy
asd net apply --tunnel     # Start tunnels for services
asd net apply --ids svc1,svc2  # Apply specific services only
```

### `asd net refresh`

Refresh service detection and health checks.

```bash
asd net refresh
```

### `asd net discover`

Discover running services.

```bash
asd net discover
```

### `asd net tunnel`

Manage tunnels for services.

```bash
asd net tunnel start <service-id>    # Start tunnel
asd net tunnel start --all           # Start all public services
asd net tunnel stop <service-id>     # Stop tunnel
asd net tunnel stop --all            # Stop all tunnels
asd net tunnel reset                 # Kill all, clear state
```

### `asd net start/stop`

Start or stop a service.

```bash
asd net start <service-id>
asd net stop <service-id>
```

### `asd net open`

Open service URL in browser.

```bash
asd net open <service-id>
```

### `asd net remove`

Remove service from registry.

```bash
asd net remove <service-id>
```

### `asd net clean`

Remove stale registry entries.

```bash
asd net clean
```

### `asd net reset`

Full registry reset.

```bash
asd net reset
```

---

## Service Commands

Built-in service management.

### `asd terminal`

Web terminal (ttyd) management.

```bash
asd terminal          # Interactive menu
asd terminal start    # Start ttyd
asd terminal stop     # Stop ttyd
```

**Required environment:**
- `TTYD_USERNAME` - Login username
- `TTYD_PASSWORD` - Login password

### `asd code`

VS Code server (code-server) management.

```bash
asd code          # Interactive menu
asd code start    # Start code-server
asd code stop     # Stop code-server
```

### `asd database`

Database UI (DbGate) management.

```bash
asd database          # Interactive menu
asd database start    # Start DbGate
asd database stop     # Stop DbGate
```

### `asd inspect`

Network inspector (mitmproxy) - Alpha.

```bash
asd inspect          # Interactive menu
asd inspect start    # Start mitmproxy
asd inspect stop     # Stop mitmproxy
```

---

## Caddy Commands

Local reverse proxy management.

### `asd caddy start`

Start Caddy reverse proxy.

```bash
asd caddy start
```

### `asd caddy stop`

Stop Caddy reverse proxy.

```bash
asd caddy stop
```

### `asd caddy restart`

Restart Caddy.

```bash
asd caddy restart
```

### `asd caddy config`

Show current Caddy configuration.

```bash
asd caddy config
```

---

## Tunnel Authentication

Get tunnel credentials for `asd expose` and other tunnel commands.

### Method 1: Ephemeral Token (Quick Testing)

No account needed. Get 5-minute credentials:

```bash
curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token
```

Set the returned values:
```bash
export ASD_TUNNEL_TOKEN=<tunnel_client_secret>
export ASD_TUNNEL_USER=<tunnel_client_id>
asd expose 3000
```

### Method 2: Tunnel Token (CI/CD)

1. Create account at [asd.host](https://asd.host)
2. Go to Account → Tunnel Tokens → Create
3. Set in `.env` or environment:

```bash
ASD_TUNNEL_TOKEN=your-token
ASD_TUNNEL_USER=your-user-id
```

### `asd tunnel auth status`

Show current authentication status.

```bash
asd tunnel auth status
```

> **Note:** CLI-based login (`asd tunnel auth login`) is coming in the next release.

---

## GitHub Integration

Remote development via GitHub Actions.

### `asd gh`

Show GitHub integration menu.

```bash
asd gh
```

### `asd gh setup`

Install GitHub workflow files.

```bash
asd gh setup
```

### `asd gh terminal`

Start remote terminal session in GitHub Actions.

```bash
asd gh terminal
```

### `asd gh list`

List recent workflow runs.

```bash
asd gh list
```

### `asd gh runs`

Show active workflow runs.

```bash
asd gh runs
```

### `asd gh active`

Check for active sessions.

```bash
asd gh active
```

### `asd gh stop`

Stop running session.

```bash
asd gh stop
```

### `asd gh login`

Configure GitHub authentication.

```bash
asd gh login
```

---

## Logs

View service logs.

### `asd logs <service>`

View logs for a service.

```bash
asd logs caddy      # Caddy proxy logs
asd logs tunnel     # Tunnel logs
asd logs ttyd       # Terminal logs
```

Logs are stored in `.asd/workspace/logs/`.

---

## Global Options

Available for all commands:

| Option | Description |
|--------|-------------|
| `--help` | Show help for command |
| `--version` | Show version |

---

## Environment Variables

Key environment variables for ASD:

| Variable | Description |
|----------|-------------|
| `ASD_DEBUG=1` | Enable debug logging |
| `ASD_VERBOSE=1` | Enable verbose output |
| `ASD_BIN_LOCATION` | Binary storage: `global` or `workspace` |

**Service credentials:**

| Service | Variables |
|---------|-----------|
| Basic Auth | `ASD_BASIC_AUTH_USERNAME`, `ASD_BASIC_AUTH_PASSWORD` |
| ttyd | `TTYD_USERNAME`, `TTYD_PASSWORD`, `TTYD_PORT` |
| code-server | `ASD_CODESERVER_AUTH`, `ASD_CODESERVER_PASSWORD`, `ASD_CODESERVER_PORT` |

---

## Command Status

| Status | Meaning |
|--------|---------|
| ✅ | Production - fully tested |
| 🟢 | Stable - works reliably |
| 🟡 | Beta - functional, may have rough edges |
| 🟠 | Alpha - experimental |

| Command | Status |
|---------|--------|
| `asd init` | ✅ |
| `asd run` | 🟢 |
| `asd net` | ✅ |
| `asd net apply` | ✅ |
| `asd expose` | 🟢 |
| `asd login` / `asd tunnel auth` | 🟢 |
| `asd terminal` | 🟢 |
| `asd code` | 🟢 |
| `asd database` | 🟢 |
| `asd caddy` | ✅ |
| `asd gh` | 🟡 |
| `asd inspect` | 🟠 |

---

## Related Documentation

- [User Manual](./USER_MANUAL.md) - Complete beginner guide
- [Services](./um_service.md) - Service details
- [asd.yaml](./um_asd_yaml.md) - Configuration reference
- [Feature Maturity](./FEATURE_MATURITY.md) - What's production-ready

---

[Back to User Manual](./USER_MANUAL.md)
