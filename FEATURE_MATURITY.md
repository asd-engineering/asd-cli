# ASD CLI Feature Maturity Assessment

**Version:** 1.1.0 | **Last Updated:** 2026-01-31 | **Status:** ACTIVE

This document tracks the maturity level of ASD CLI features, helping users understand what's production-ready versus experimental.

---

## Maturity Levels

| Status | Symbol | Description |
|--------|--------|-------------|
| Production | ✅ | Battle-tested, full test coverage, recommended for all users |
| Stable | 🟢 | Working reliably, good test coverage, safe to use |
| Beta | 🟡 | Functional but limited, may have rough edges |
| Alpha | 🟠 | Early implementation, not for production use |
| Planned | ⏳ | Documented but not implemented or incomplete |

---

## Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| `asd init` | ✅ | Full workspace setup, binary installation, project detection |
| `asd net` (TUI) | ✅ | Interactive service management, health checks, navigation |
| `asd net apply` | ✅ | Configuration application, Caddy + tunnel setup |
| `asd.yaml` config | ✅ | Schema validation, service definitions, features |
| Health checks | ✅ | Multi-level cascade (tunnel → HTTP → TCP → process) |
| Service registry | ✅ | JSON-based state, upsert/remove/mark operations |
| Dynamic port allocation | ✅ | Avoids conflicts, persists to .env |

---

## Tunneling & Exposure

| Feature | Status | Notes |
|---------|--------|-------|
| `asd expose <port>` | 🟢 | Quick one-command exposure, Caddy + tunnel |
| `asd tunnel auth` | 🟡 | Token status check; CLI login coming soon |
| `asd net tunnel start/stop` | 🟢 | Per-service tunnel control |
| Public tunnels | 🟢 | Subdomain-based URLs via asd-tunnel binary |
| Tunnel modes (caddy/direct) | 🟡 | Mode switching works, limited testing |

---

## Built-in Services

| Service | Command | Status | Notes |
|---------|---------|--------|-------|
| Caddy Proxy | `asd caddy` | ✅ | Reverse proxy, path/host routing, TLS |
| VS Code Server | `asd code` | 🟢 | Start/stop works, menu functional |
| Web Terminal | `asd terminal` | 🟢 | ttyd-based, port persistence |
| Database UI | `asd database` | 🟢 | DbGate GUI, basic start/stop |
| Network Inspector | `asd inspect` | 🟠 | **Standalone only** - see below |

### Note on `asd inspect`

**Current Status:** 🟠 Alpha (Standalone service only)

**What works now:**
- `asd inspect start` → Starts mitmproxy web UI
- `asd inspect stop` → Stops the service
- Service registers in `asd net` TUI
- Web UI accessible at `http://localhost:<port>/`
- Password protection via `ASD_BASIC_AUTH_PASSWORD`

**Not yet implemented:**
- Traffic routing through proxy
- TUI integration for "Inspect Traffic" action
- Caddy proxy chain for automatic interception
- Per-service inspection toggles

**Current usage:** Configure your application to use `localhost:8080` as proxy manually.

---

## GitHub Integration

| Feature | Status | Notes |
|---------|--------|-------|
| `asd gh setup` | 🟡 | Workflow installation |
| `asd gh terminal` | 🟡 | Remote terminal via GitHub Actions |
| `asd gh list/runs` | 🟡 | Workflow listing |

---

## Project Management

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-project registry | 🟡 | Project switching, defaults |
| Plugin system | 🟠 | Only Supabase plugin implemented |
| `asd supabase` plugin | 🟡 | Bootstrap, start/stop, service extraction |

---

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Linux (x64) | ✅ | Primary platform, full CI coverage |
| macOS (x64/ARM) | ✅ | Tested in CI |
| Windows (x64) | 🟢 | Binary works, some path edge cases |
| Android (Termux/ARM64) | 🟡 | All binaries verified, see [um_termux.md](./um_termux.md) |

---

## Testing Infrastructure

- Unit tests: ~1000+ passing
- Integration tests: YAML automation runner
- Cross-platform CI: GitHub Actions matrix (ubuntu, macos, windows)
- Docker tests: Isolated reproducible environment

---

## Feature Graduation Path

Features progress through maturity levels as they gain:

1. **Alpha → Beta**: Basic functionality complete, some test coverage
2. **Beta → Stable**: Good test coverage, documentation, no known major bugs
3. **Stable → Production**: Full test coverage, battle-tested, recommended for all

---

## Changelog

### v1.1.0 (2026-01-31)

- Comprehensive feature maturity assessment
- Added maturity levels legend with emoji indicators
- Documented all core features, tunneling, services, and platform support
- Clarified `asd inspect` limitations (standalone only)
- Added feature graduation path

### v1.0.0 (2026-01-21)

- Initial feature maturity documentation
- Cross-platform binary verification complete

---

[Back to User Manual](./USER_MANUAL.md)
