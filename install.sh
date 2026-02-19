#!/usr/bin/env bash
# ASD CLI Installer - Always installs latest version
# Usage: curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
# Or with custom install dir: curl -fsSL ... | INSTALL_DIR=/usr/local/bin bash
#
# This script will:
# 1. Auto-detect your OS and architecture
# 2. Download the latest ASD CLI binary
# 3. Install to ~/.local/bin (or custom INSTALL_DIR)
# 4. Remind you to add to PATH if needed
#
# After installation, update with: asd update

set -euo pipefail

# Configuration - Public repo for distribution (no auth required)
REPO="asd-engineering/asd-cli"
# Fallback to private repo if public doesn't have releases yet
FALLBACK_REPO="asd-engineering/.asd"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# Detect platform
detect_platform() {
  local os arch
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)

  case "$os" in
    linux)  os="linux" ;;
    darwin) os="darwin" ;;
    mingw*|msys*|cygwin*) os="windows" ;;
    *) error "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) error "Unsupported architecture: $arch" ;;
  esac

  # Only arm64 supported on macOS
  if [[ "$os" == "darwin" && "$arch" == "x64" ]]; then
    arch="x64"  # Intel Mac
  fi

  # Detect Termux on Android — standard Linux binaries won't work
  # (Android requires PIE + Bionic libc, not glibc)
  if [[ "$os" == "linux" && "$arch" == "arm64" && -n "${TERMUX_VERSION:-}" ]]; then
    echo "termux-arm64"
    return
  fi

  echo "${os}-${arch}"
}

# Get latest release tag using GitHub API
# Tries public repo first, falls back to private repo
get_latest_version() {
  local repos=("${REPO}" "${FALLBACK_REPO}")
  local auth_header=""

  # Use GITHUB_TOKEN if available (for private repos)
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header="Authorization: Bearer ${GITHUB_TOKEN}"
  elif [[ -n "${GH_TOKEN:-}" ]]; then
    auth_header="Authorization: Bearer ${GH_TOKEN}"
  fi

  for repo in "${repos[@]}"; do
    local api_url="https://api.github.com/repos/${repo}/releases?per_page=1"
    local response

    if [[ -n "$auth_header" ]]; then
      response=$(curl -fsSL -H "Accept: application/vnd.github+json" -H "$auth_header" "$api_url" 2>/dev/null) || continue
    else
      response=$(curl -fsSL -H "Accept: application/vnd.github+json" "$api_url" 2>/dev/null) || continue
    fi

    local tag
    tag=$(echo "$response" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)

    if [[ -n "$tag" ]]; then
      # Export the repo that worked for download URL construction
      ACTIVE_REPO="$repo"
      echo "$tag"
      return 0
    fi
  done

  error "Failed to fetch latest release. Check your internet connection or set GITHUB_TOKEN for private repos."
}

# Download and install
install_asd() {
  local platform version download_url archive_name tmp_dir

  platform=$(detect_platform)
  info "Detected platform: $platform"

  # Termux build requires Node.js
  if [[ "$platform" == "termux-arm64" ]]; then
    if ! command -v node &>/dev/null; then
      error "Node.js is required for Termux. Install it with: pkg install nodejs-lts"
    fi
    info "Node.js: $(node --version)"
  fi

  # Initialize ACTIVE_REPO (will be set by get_latest_version)
  ACTIVE_REPO=""
  version=$(get_latest_version)
  [[ -z "$version" ]] && error "Could not determine latest version"
  info "Latest version: $version"
  info "Source: ${ACTIVE_REPO:-$REPO}"

  # Construct download URL using the repo that had releases
  local repo_for_download="${ACTIVE_REPO:-$REPO}"
  if [[ "$platform" == "windows-x64" ]]; then
    archive_name="asd-windows-x64.zip"
  else
    archive_name="asd-${platform}.tar.gz"
  fi
  download_url="https://github.com/${repo_for_download}/releases/download/${version}/${archive_name}"

  # Create install directory
  mkdir -p "$INSTALL_DIR"

  # Download and extract
  tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  info "Downloading $archive_name..."

  # Add auth header for private repos
  local curl_opts="-fsSL"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    curl_opts="$curl_opts -H \"Authorization: Bearer ${GITHUB_TOKEN}\""
    curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/octet-stream" "$download_url" -o "$tmp_dir/$archive_name" || error "Download failed"
  elif [[ -n "${GH_TOKEN:-}" ]]; then
    curl -fsSL -H "Authorization: Bearer ${GH_TOKEN}" -H "Accept: application/octet-stream" "$download_url" -o "$tmp_dir/$archive_name" || error "Download failed"
  else
    if ! curl -fsSL "$download_url" -o "$tmp_dir/$archive_name" 2>/dev/null; then
      if [[ "$repo_for_download" == "$REPO" ]]; then
        error "Download failed. Binary may not be available for '${platform}'.
Available platforms: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, termux-arm64.
See https://github.com/asd-engineering/asd-cli/releases"
      else
        error "Download failed. For private repos, set GITHUB_TOKEN."
      fi
    fi
  fi

  info "Extracting to $INSTALL_DIR..."
  if [[ "$archive_name" == *.zip ]]; then
    unzip -q -o "$tmp_dir/$archive_name" -d "$tmp_dir/extracted"
    # Find bin directory (may be at root or inside a subdirectory like asd-linux-x64/)
    local bin_dir
    bin_dir=$(find "$tmp_dir/extracted" -type d -name "bin" | head -1)
    [[ -z "$bin_dir" ]] && error "No bin/ directory found in archive"
    cp -f "$bin_dir/"* "$INSTALL_DIR/"
  else
    tar -xzf "$tmp_dir/$archive_name" -C "$tmp_dir"
    # Find bin directory (may be at root or inside a subdirectory like asd-linux-x64/)
    local bin_dir
    bin_dir=$(find "$tmp_dir" -type d -name "bin" ! -path "$INSTALL_DIR/*" | head -1)
    [[ -z "$bin_dir" ]] && error "No bin/ directory found in archive"
    cp -f "$bin_dir/"* "$INSTALL_DIR/"
  fi

  # Install assets to global ASD home
  local asd_home="${ASD_HOME:-$HOME/.local/share/asd}"

  # Dashboard
  local dashboard_dir
  dashboard_dir=$(find "$tmp_dir" -type d -name "dist" -path "*/dashboard/dist" | head -1)
  if [[ -n "$dashboard_dir" ]]; then
    mkdir -p "$asd_home/dashboard"
    rm -rf "$asd_home/dashboard/dist"
    cp -r "$dashboard_dir" "$asd_home/dashboard/dist"
    info "Dashboard installed to $asd_home/dashboard/dist"
  fi

  # Modules (manifests, configs, templates)
  local modules_dir
  modules_dir=$(find "$tmp_dir" -type d -name "modules" -maxdepth 3 | head -1)
  if [[ -n "$modules_dir" ]]; then
    rm -rf "$asd_home/modules"
    cp -r "$modules_dir" "$asd_home/modules"
    info "Modules installed to $asd_home/modules/"
  fi

  # Make executable
  chmod +x "$INSTALL_DIR/asd" 2>/dev/null || true

  # Verify installation
  if [[ -x "$INSTALL_DIR/asd" ]]; then
    info "✅ ASD CLI installed successfully!"
    info "   Location: $INSTALL_DIR/asd"
    info "   Version: $("$INSTALL_DIR/asd" --version 2>/dev/null || echo "$version")"
    echo ""
    info "To update in the future, run:"
    echo "   asd update"
    echo ""

    # Check if in PATH
    if ! command -v asd &>/dev/null; then
      warn "~/.local/bin is not in your PATH. Add this to your shell config:"
      echo ""
      echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
      info "Then restart your shell or run: source ~/.bashrc"
    fi
  else
    error "Installation failed - binary not found"
  fi
}

# Run installer
install_asd
