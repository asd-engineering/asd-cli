# ASD CLI Command Reference

**Version:** 2.3.0 | **Last Updated:** 2026-03-06

Complete reference for all ASD CLI commands.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `asd init` | Initialize project workspace |
| `asd run <task>` | Run automation task from asd.yaml |
| `asd expose <port>` | Expose a port with tunnel |
| `asd login` | Login via OAuth |
| `asd login key` | Login with API key (CI/headless) |
| `asd logout` | Sign out |
| `asd auth status` | Show auth status |
| `asd auth whoami` | Show current user |
| `asd auth export` | Export SSH key as env vars |
| `asd auth credentials` | Show all credential sources |
| `asd net` | Open network TUI |
| `asd terminal` | Web terminal management |
| `asd code` | VS Code server management |
| `asd config validate` | Validate asd.yaml configuration |
| `asd skill install` | Install AI assistant skills |
| `asd deps install` | Install managed binaries |
| `asd deps update` | Update binaries to latest versions |
| `asd update` | Update ASD CLI |
| `asd ac install` | Install shell tab-completions |

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
```

### `asd config validate`

Validate `asd.yaml` configuration against the schema.

```bash
asd config validate          # Human-readable output
asd config validate --json   # JSON output (for CI/scripts)
```

**What it checks:**
- Schema validation (required fields, types, structure)
- Service configuration (valid dial addresses, paths)
- Feature flags and plugin references

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

Login to ASD platform via OAuth. Opens a browser for authentication.

```bash
asd login              # Interactive OAuth login
```

After login, tunnel credentials are automatically saved and all `asd expose` / `asd net apply --tunnel` commands work.

### `asd login key`

Login with an API key for headless/CI environments where no browser is available.

```bash
asd login key <api-key>          # Pass key directly
asd login key                    # Interactive prompt (TTY only)
```

The API key can also be provided via `ASD_API_KEY` environment variable.

### `asd logout`

Sign out and clear local credentials.

```bash
asd logout
```

### `asd init --key`

Import an existing SSH key file into the credential registry.

```bash
asd init --key /path/to/private_key                    # Auto-detect key_id from server
asd init --key /path/to/private_key --key-id <uuid>    # Explicit key_id (works offline)
asd init --key /path/to/private_key --server eu1       # Specify server
```

**What it does:**
1. Validates the SSH key file
2. Computes the key fingerprint
3. If `--key-id` is not provided, queries the server to find the matching key
4. Copies the key to `~/.config/asd/tunnel/keys/`
5. Adds the key to the credential registry

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

### `asd net expose`

Manage tunnels for services.

```bash
asd net expose start <service-id>    # Start tunnel
asd net expose start --all           # Start all public services
asd net expose stop <service-id>     # Stop tunnel
asd net expose stop --all            # Stop all tunnels
asd net expose reset                 # Kill all, clear state
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
- `ASD_TTYD_USERNAME` - Login username
- `ASD_TTYD_PASSWORD` - Login password

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

### `asd token create`

Create a tunnel token (credential) for authentication.

```bash
asd token create
```

### `asd token verify`

Verify that current tunnel credentials are valid.

```bash
asd token verify
```

### `asd auth status`

Show current authentication status.

```bash
asd auth status
```

### `asd auth whoami`

Show current user info (email, client ID, org ID, token expiry).

```bash
asd auth whoami
```

### `asd auth credentials`

Show all credential sources and their status.

```bash
asd auth credentials
```

### `asd auth refresh`

Refresh the authentication token.

```bash
asd auth refresh
```

### `asd auth export`

Export SSH key credentials as environment variables for use in Docker or CI.

```bash
asd auth export              # Shell export format
asd auth export --docker     # Docker -e flag format
```

**Shell format output:**
```bash
export ASD_TUNNEL_KEY="<base64-private-key>"
export ASD_TUNNEL_KEY_ID="<key-uuid>"
export ASD_TUNNEL_HOST="tunnel.asd.sh"
export ASD_TUNNEL_PORT="2222"
```

**Docker format output:**
```bash
-e ASD_TUNNEL_KEY="<base64-private-key>" \
-e ASD_TUNNEL_KEY_ID="<key-uuid>" \
-e ASD_TUNNEL_HOST="tunnel.asd.sh" \
-e ASD_TUNNEL_PORT="2222"
```

**Usage examples:**
```bash
# Set env vars in current shell
eval $(asd auth export)

# Pass to Docker
docker run $(asd auth export --docker) my-image asd expose 3000
```

> **Tip:** Use `asd login` to authenticate, `asd auth credentials` to view all credentials.

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

## Skill Commands

AI assistant skill management.

### `asd skill install`

Install skills for Claude Code and OpenAI Codex.

```bash
asd skill install            # Install for current project
asd skill install --global   # Install globally
asd skill install --yes      # Non-interactive
```

### `asd skill list`

List available ASD skills.

```bash
asd skill list
```

### `asd skill status`

Check installation status of skills.

```bash
asd skill status
```

---

## Dependency Management

Manage ASD's binary dependencies (Caddy, ttyd, code-server, gh, etc.).

### `asd deps install`

Install all managed binaries, or a specific one.

```bash
asd deps install                  # Install all
asd deps install caddy            # Install specific binary
asd deps install --force          # Force reinstall even if present
```

**What it does:**
1. Downloads binaries from upstream (GitHub releases, official sites)
2. Verifies integrity via SHA-256/SHA-512 checksums
3. Installs to global location (`~/.local/share/asd/bin/`)

### `asd deps update`

Update all binaries to their latest upstream versions, or a specific one.

```bash
asd deps update                   # Update all outdated binaries
asd deps update caddy             # Update specific binary
```

**What it does:**
1. Checks each binary's latest version on GitHub
2. Downloads and verifies new versions
3. Shows summary of what was updated

**Note:** Results are cached for 10 minutes to avoid excessive API calls. Uses `gh` CLI for authenticated requests when available.

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

## Autocomplete

Shell tab-completion for all ASD commands.

### `asd ac install`

Install shell completions. Auto-detects your shell, or specify one.

```bash
asd ac install          # Auto-detect (bash/zsh/fish)
asd ac install bash     # Install for bash
asd ac install zsh      # Install for zsh
asd ac install fish     # Install for fish
```

After installing, open a new terminal (or `source ~/.bashrc`) and use Tab to complete:

```
asd ca<TAB>        → caddy
asd caddy <TAB>    → start  stop  restart  config
```

### `asd ac remove`

Remove shell completions.

```bash
asd ac remove           # Remove for detected shell
asd ac remove bash      # Remove for bash
```

### `asd ac status`

Show autocomplete installation status across all shells.

```bash
asd ac status
```

### `asd ac refresh`

Refresh the completions cache (run after installing new commands or plugins).

```bash
asd ac refresh
```

---

## Command Suggestions

If you mistype a command, ASD will suggest similar commands:

```
$ asd deos
Unknown command: deos

  Did you mean?

    deps install    Install managed binaries (--binary <name>, --force)
    deps update     Update a binary to latest upstream version

  Run 'asd --help' to see available commands.
```

If you mistype a subcommand within a valid group, ASD shows available subcommands:

```
$ asd caddy strat
  Usage: asd caddy <command>

  Available commands:

    start    Start Caddy reverse proxy
    stop     Stop Caddy reverse proxy
    restart  Restart Caddy
    config   Show Caddy configuration
```

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

**Tunnel authentication:**

| Variable | Description |
|----------|-------------|
| `ASD_API_KEY` | API key for headless login (`asd login key`) |
| `ASD_TUNNEL_TOKEN` | Tunnel token (from dashboard) |
| `ASD_TUNNEL_USER` | Tunnel username |
| `ASD_TUNNEL_KEY` | Base64-encoded SSH private key (for Docker/CI) |
| `ASD_TUNNEL_KEY_ID` | SSH key UUID (required with `ASD_TUNNEL_KEY`) |
| `ASD_TUNNEL_HOST` | Tunnel server hostname (optional, auto-detected) |
| `ASD_TUNNEL_PORT` | Tunnel server SSH port (optional, default 2222) |

**Service credentials:**

| Service | Variables |
|---------|-----------|
| Basic Auth | `ASD_BASIC_AUTH_USERNAME`, `ASD_BASIC_AUTH_PASSWORD` |
| ttyd | `ASD_TTYD_USERNAME`, `ASD_TTYD_PASSWORD`, `ASD_TTYD_PORT` |
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
| `asd login` / `asd login key` | 🟢 |
| `asd auth status/whoami/export` | 🟢 |
| `asd terminal` | 🟢 |
| `asd code` | 🟢 |
| `asd database` | 🟢 |
| `asd caddy` | ✅ |
| `asd config validate` | 🟢 |
| `asd token create/verify` | 🟢 |
| `asd skill install/list/status` | 🟢 |
| `asd gh` | 🟡 |
| `asd inspect` | 🟠 |
| `asd deps install/update` | 🟢 |
| `asd ac install/remove/status/refresh` | 🟢 |

---

## Related Documentation

- [User Manual](./USER_MANUAL.md) - Complete beginner guide
- [Services](./um_service.md) - Service details
- [asd.yaml](./um_asd_yaml.md) - Configuration reference
- [Feature Maturity](./FEATURE_MATURITY.md) - What's production-ready

---

[Back to User Manual](./USER_MANUAL.md)
