# ASD API Reference

**Version:** 2.1.0 | **Last Updated:** 2026-03-06

Programmatic access to ASD tunnel services.

---

## Authentication Methods

### Method 1: CLI Login (Interactive)

Login via OAuth from the command line:

```bash
asd login           # Opens browser for OAuth
asd login key <key> # API key login (headless/CI)
```

After login, all tunnel commands work automatically.

### Method 2: SSH Key (Docker & Containers)

Use your existing SSH key in Docker containers or new environments.

**Volume mount:**
```bash
docker run -v ~/.config/asd/tunnel:/root/.config/asd/tunnel:ro my-image
```

**Environment variables:**
```bash
# Export credentials from host
eval $(asd auth export)

# Pass to Docker
docker run \
  -e ASD_TUNNEL_KEY="$ASD_TUNNEL_KEY" \
  -e ASD_TUNNEL_KEY_ID="$ASD_TUNNEL_KEY_ID" \
  -e ASD_TUNNEL_HOST="$ASD_TUNNEL_HOST" \
  -e ASD_TUNNEL_PORT="$ASD_TUNNEL_PORT" \
  my-image asd expose 3000

# Or use the Docker flag format
docker run $(asd auth export --docker) my-image asd expose 3000
```

**Import existing key:**
```bash
asd init --key /path/to/private_key                 # Auto-detect key_id
asd init --key /path/to/private_key --key-id <uuid> # Explicit key_id
```

### Method 3: Ephemeral Token (Quick Testing)

Get 5-minute credentials instantly. **No account required.**

```bash
curl -X POST https://asd.engineer/functions/v1/create-ephemeral-token
```

**Response:**
```json
{
  "tunnel_client_id": "guest-xyz123",
  "tunnel_client_secret": "abc123def456...",
  "expires_at": "2026-02-03T12:05:00Z",
  "tunnel_host": "s1.eu1.asd.engineer",
  "tunnel_port": 2223,
  "limits": {
    "max_uptime_minutes": 5,
    "max_connections_per_hour": 10
  }
}
```

**Use the credentials:**
```bash
export ASD_TUNNEL_TOKEN="abc123def456..."
export ASD_TUNNEL_USER="guest-xyz123"
asd expose 3000
```

### Method 4: Tunnel Token (CI/CD & Longer Sessions)

For automation and longer-running tunnels:

1. Create account at [asd.host](https://asd.host)
2. Go to **Account → Tunnel Tokens → Create**
3. Copy your credentials

**Set in `.env` or environment:**
```bash
ASD_TUNNEL_TOKEN=your-token-from-dashboard
ASD_TUNNEL_USER=your-user-id
```

**Use in CI/CD:**
```yaml
# GitHub Actions example
env:
  ASD_TUNNEL_TOKEN: ${{ secrets.ASD_TUNNEL_TOKEN }}
  ASD_TUNNEL_USER: ${{ secrets.ASD_TUNNEL_USER }}
```

---

## Endpoints

### Create Ephemeral Token

**No authentication required.**

```
POST https://asd.engineer/functions/v1/create-ephemeral-token
Content-Type: application/json
```

**Response fields:**

| Field | Description |
|-------|-------------|
| `tunnel_client_id` | Username for tunnel connection |
| `tunnel_client_secret` | Token for tunnel connection |
| `expires_at` | Token expiration (5 minutes) |
| `tunnel_host` | Server hostname |
| `tunnel_port` | Server SSH port |
| `limits` | Usage limits for this token |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `create-ephemeral-token` | 10 requests/hour per IP |

---

## Error Responses

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "retry_after": 3600
}
```

---

## Environment Variables

**Credential resolution (priority order — first match wins):**

| Priority | Variables | Description |
|----------|-----------|-------------|
| 1 | `ASD_TUNNEL_TOKEN` + `ASD_TUNNEL_USER` | Token auth (CI/CD, dashboard tokens) |
| 2 | `ASD_TUNNEL_KEY` + `ASD_TUNNEL_KEY_ID` | SSH key via env var (Docker, containers) |
| 3 | *OAuth credentials* | Stored in `~/.config/asd/tunnel/` after `asd login` |
| 4 | *Credential registry* | SSH keys/tokens from `asd login key` or `asd init --key` |
| 5 | `ASD_CLIENT_ID` + `ASD_CLIENT_SECRET` | Ephemeral tokens (quick testing) |

**Login (not part of credential resolution):**

| Variable | Description |
|----------|-------------|
| `ASD_API_KEY` | API key for `asd login key` command |

**Connection (optional, auto-detected):**

| Variable | Description |
|----------|-------------|
| `ASD_TUNNEL_HOST` | Server hostname |
| `ASD_TUNNEL_PORT` | Server SSH port (default 2222) |

---

[Back to User Manual](./USER_MANUAL.md)
