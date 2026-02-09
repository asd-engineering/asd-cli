# ASD CLI on Android (Termux)

Run ASD CLI on Android devices using [Termux](https://termux.dev/).

## Requirements

- Android device (ARM64)
- Termux app from [F-Droid](https://f-droid.org/packages/com.termux/) (recommended)

> **Note:** The Google Play version of Termux may be outdated. F-Droid is recommended.

## Installation

### 1. Install Termux

Download and install Termux from F-Droid.

### 2. Update Packages

```bash
pkg update && pkg upgrade -y
```

### 3. Install ASD

```bash
pkg install curl
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
```

### 4. Initialize

```bash
cd your-project
asd init
asd net
```

## Termux-Specific Notes

### File System

| Path | Description |
|------|-------------|
| `~` | `/data/data/com.termux/files/home` |
| External storage | Run `termux-setup-storage` first |

### Binary Storage

Binaries are stored in Termux's home directory:
```
~/.local/share/asd/bin/
```

### Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| `asd net` TUI | Works | Full ANSI color support |
| `asd init` | Works | All ARM64 binaries install |
| `asd net open` | Limited | No browser integration |
| `asd tunnel` | Works | Requires authentication |
| SSH keys | Works | Stored in `~/.ssh/` |

### Terminal Colors

If colors don't display correctly:
```bash
export TERM=xterm-256color
```

Add to `~/.bashrc` for persistence.

## Verified Binaries

All helper binaries have ARM64 variants that install automatically:

- Caddy (reverse proxy)
- ttyd (web terminal)
- DbGate (database manager)
- GitHub CLI
- mitmproxy (network inspector)

## Troubleshooting

### "Permission denied" on binaries

```bash
chmod +x ~/.local/share/asd/bin/*
```

### Storage access

Enable storage access for external files:
```bash
termux-setup-storage
```

### Network issues

Termux may need wake lock for background connections:
```bash
termux-wake-lock
```

---

[Back to User Manual](./README.md)
