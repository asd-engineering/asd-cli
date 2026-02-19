# ASD CLI on Android (Termux)

Run ASD CLI on Android devices using [Termux](https://termux.dev/).

## Requirements

- Android device (ARM64)
- Termux app from [F-Droid](https://f-droid.org/packages/com.termux/) (recommended)
- Node.js (`pkg install nodejs-lts`)

> **Note:** The Google Play version of Termux may be outdated. F-Droid is recommended.

## Installation

### 1. Install Termux

Download and install Termux from F-Droid.

### 2. Update Packages

```bash
pkg update && pkg upgrade -y
```

### 3. Install ASD

**Option A: Install script** (recommended)

```bash
pkg install nodejs-lts curl
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
```

The installer auto-detects Termux via `$TERMUX_VERSION` and downloads the correct Termux-native build. No Bun required.

**Option B: Via Bun** (for development)

```bash
pkg install bun git
# Clone your project with ASD submodule
git clone --recursive https://github.com/your/project.git
cd your-project
bun install
```

> **Note:** Option A uses the same `install.sh` as all other platforms — it auto-detects Termux and downloads a pre-bundled Node.js script instead of the standard compiled binary. Option B requires Bun and downloads dependencies via `bun install`.

### 4. Initialize

```bash
cd your-project
asd init
asd net
```

## How the Termux Build Works

The standard `asd` binary is compiled with Bun (`bun build --compile`) which produces Linux ELF binaries incompatible with Android. The Termux build instead produces a **single Node.js script** with:

1. A Termux Node.js shebang (`#!/data/data/com.termux/files/usr/bin/node`)
2. A Bun API polyfill (implements `Bun.spawn`, `Bun.file`, `Bun.serve`, etc. using Node.js APIs)
3. All CLI code and dependencies bundled into one file

This runs natively under Termux's Node.js without needing Bun installed.

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

### Node.js version

The Termux build requires Node.js 22+. Check your version:
```bash
node --version
```

If outdated:
```bash
pkg install nodejs-lts
```

---

[Back to User Manual](./USER_MANUAL.md)
