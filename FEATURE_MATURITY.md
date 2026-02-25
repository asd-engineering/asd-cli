# ASD CLI Feature Maturity Assessment

**Version:** 1.6.0 | **Last Updated:** 2026-02-25 | **Status:** ACTIVE

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
| `asd config validate` | 🟢 | Schema validation with `--json` output |
| `asd skill install/list/status` | 🟢 | AI assistant skill management |
| `asd deps install/update` | 🟢 | Binary dependency management, version checking, checksum verification |
| `asd ac install/remove/status` | 🟢 | Shell tab-completion for bash, zsh, fish |

---

## Tunneling & Exposure

| Feature | Status | Notes |
|---------|--------|-------|
| `asd expose <port>` | 🟢 | Quick one-command exposure, Caddy + tunnel |
| `asd auth status` | 🟡 | Credential status check |
| `asd net expose start/stop` | 🟢 | Per-service tunnel control |
| Public tunnels | 🟢 | Subdomain-based URLs via asd-tunnel binary |
| Tunnel modes (caddy/direct) | 🟡 | Mode switching works, limited testing |

---

## Built-in Services

| Service | Command | Status | Notes |
|---------|---------|--------|-------|
| Dashboard | `asd net` (TUI) | 🟢 | Auto-bundled, health monitoring |
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

## Vault — Secret Management

| Feature | Status | Notes |
|---------|--------|-------|
| `asd vault set/get/delete` | 🟠 | Core CRUD operations, encrypted at rest (pgsodium) |
| `asd vault list` | 🟠 | Metadata listing (name, category, scope) |
| `asd vault import/export` | 🟠 | Bulk directory-based import/export |
| `asd vault inject` | 🟠 | Template substitution with `asd://` references |
| `asd vault run` | 🟠 | Process execution with secrets as env vars |
| Personal/org scopes | 🟠 | Per-user and shared organisation secrets |
| Web dashboard | 🟠 | View metadata at `/workspace/vault/` |
| Plan-based quotas | 🟠 | Free: 0, Developer: 10, Pro: 50, Scale: 200 |

> **Alpha:** Ready for testing. Requires `asd login` for authentication. API and CLI flags may change between releases.

---

## CI Watcher — Autonomous Co-Developer

| Feature | Status | Notes |
|---------|--------|-------|
| `just ci-watch-start/stop` | 🟡 | systemd timer, 10-min polling interval |
| CI failure detection | 🟡 | Polls `gh run list`, matches HEAD SHA |
| Claude Code auto-fix | 🟡 | Spawns agent in tmux with Docker-only test isolation |
| Desktop notifications | 🟡 | notify-send on failure detection and fix result |
| Lockfile + stale cleanup | 🟡 | 30-min timeout, prevents duplicate runs |

> **Beta:** Functional end-to-end. Requires Claude Code CLI with OAuth auth on host. All test execution isolated in Docker.

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
| Windows (x64) | 🟢 | Binary works, AV-hardened (VERSIONINFO, pattern scanning, Defender CI) |
| Android (Termux/ARM64) | 🟡 | All binaries verified, see [um_termux.md](./um_termux.md) |

---

## Testing Infrastructure

- Cross-platform CI: GitHub Actions matrix (ubuntu, macos, windows)

---

## Windows Security & AV Prevention

| Measure | Status | Notes |
|---------|--------|-------|
| AV pattern scanner | ✅ | 20+ patterns blocked in CI (LOLBins, shell spawning, process hiding) |
| Windows Defender CI scan | ✅ | Compiled exe scanned in CI before merge |
| VERSIONINFO injection | ✅ | rcedit patches ProductName, CompanyName, etc. in release pipeline |
| VirusTotal scanning | 🟢 | Automated scan of release binaries (optional, needs `VT_API_KEY`) |
| Azure Trusted Signing | 🟡 | Infrastructure ready, degrades gracefully without secrets |
| AV submission checklist | ✅ | Release summary includes Microsoft/BitDefender false positive links |

---

## Feature Graduation Path

Features progress through maturity levels as they gain:

1. **Alpha → Beta**: Basic functionality complete, some test coverage
2. **Beta → Stable**: Good test coverage, documentation, no known major bugs
3. **Stable → Production**: Full test coverage, battle-tested, recommended for all

---

## Changelog

### v1.7.0 (2026-02-25)

- Added CI Watcher — Autonomous Co-Developer section (🟡 Beta)
- Background systemd service that monitors CI and spawns Claude Code to auto-fix failures

### v1.6.0 (2026-02-25)

- Added `asd deps install/update` to Core Features (🟢 Stable)
- Binary dependency management with checksum verification and GitHub rate limit protection

### v1.5.0 (2026-02-25)

- Added `asd ac` shell autocomplete to Core Features (🟢 Stable)
- Supports bash, zsh, and fish with auto-detection

### v1.4.0 (2026-02-19)

- Added Dashboard to Built-in Services (🟢 Stable)
- Added `asd config validate` and `asd skill` to Core Features
- Updated unit test count to ~1700+

### v1.3.0 (2026-02-10)

- Added Windows Security & AV Prevention section
- Updated Windows (x64) status notes with AV-hardening details
- Documented VERSIONINFO injection, Defender CI scan, VirusTotal, Azure Trusted Signing

### v1.2.0 (2026-02-07)

- Added Vault secret management section (Alpha status)
- All vault features marked 🟠 Alpha — ready for testing

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
