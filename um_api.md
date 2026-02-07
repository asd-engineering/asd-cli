# ASD API Reference

**Version:** 2.0.2 | **Last Updated:** 2026-02-03

Programmatic access to ASD tunnel services.

---

## Authentication Methods

### Method 1: Ephemeral Token (Quick Testing)

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

### Method 2: Tunnel Token (CI/CD & Longer Sessions)

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

| Variable | Description |
|----------|-------------|
| `ASD_TUNNEL_TOKEN` | Tunnel authentication token |
| `ASD_TUNNEL_USER` | Tunnel username |
| `ASD_TUNNEL_HOST` | Server hostname (optional, auto-detected) |
| `ASD_TUNNEL_PORT` | Server SSH port (optional, default 2223) |

---

> **Note:** CLI-based login (`asd login`) is coming in the next release.

---

[Back to User Manual](./USER_MANUAL.md)
