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

**Option A: Install script** (recommended)

```bash
pkg install curl clang
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
```

The installer auto-detects Termux via `$TERMUX_VERSION`, downloads the Termux-native build, and auto-installs Bun via the bundled `install-bun.sh` script (compiles a small ELF loader from C).

**Option B: Manual Bun install + install script**

```bash
# Install Bun first (via ELF loader)
just android-bun-install
# Then install ASD
curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
```

**Option C: Via Bun** (for development)

```bash
just android-bun-install  # Install Bun via ELF loader
git clone --recursive https://github.com/your/project.git
cd your-project
bun install
```

> **Note:** ASD CLI on Termux runs under real Bun via a userland ELF loader (`bun_loader`). The installer automatically sets this up. See [BUN_TERMUX_LOADER.md](./BUN_TERMUX_LOADER.md) for details.

### 3.1 Install Codex CLI (Termux)

Use this if you want the Termux-specific Codex CLI package:

```bash
pkg update && pkg upgrade -y
pkg install nodejs-lts -y

npm -g uninstall @openai/codex || true
npm -g install @mmmbuto/codex-cli-termux

codex --version
codex login
codex
```

### 4. Initialize

```bash
cd your-project
asd init
asd net
```

## How the Termux Build Works

The standard `asd` binary is compiled with Bun (`bun build --compile`) which produces glibc-linked, non-PIE Linux ELF binaries incompatible with Android's Bionic linker. The Termux build instead:

1. Bundles all CLI code into a single JS file (`asd-bundle.js`) via `bun build --target=bun`
2. Runs it under **real Bun** via a userland ELF loader (`bun_loader`)
3. A thin wrapper script (`bin/asd`) ties it together: `bun_loader → bun.real → asd-bundle.js`

The ELF loader intercepts Bun's `execve` calls and redirects the dynamic linker from `/lib/ld-linux-aarch64.so.1` to Bun's bundled `ld-linux` in `~/.bun/lib/`. This lets the unmodified Bun binary run on Android without any API polyfills or bundle patching.

See [BUN_TERMUX_LOADER.md](./BUN_TERMUX_LOADER.md) for technical details on the ELF loader.

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

### Bun not installed

If you see "Error: Bun is not installed", run:
```bash
just android-bun-install
```

Or manually run the bundled installer:
```bash
bash ~/.local/share/asd/scripts/install-bun.sh
```

This requires `clang` (for compiling the ELF loader):
```bash
pkg install clang
```

---

[Back to User Manual](./USER_MANUAL.md)
