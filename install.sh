#!/usr/bin/env bash
# ASD CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash
#
# Options (via environment variables):
#   INSTALL_DIR  - Custom install directory (default: ~/.local/bin)
#   VERSION      - Install a specific version tag (e.g. VERSION=v2.1.8-beta.1)
#                  Set VERSION=list to show available releases
#   ASD_INSTALL_BASE_URL - Override download base URL (for CI testing with local files)
#                          Supports: file:///path/to/dir, http://..., or /absolute/path
#
# Examples:
#   curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | bash                              # Latest
#   curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | VERSION=v2.1.8-beta.1 bash        # Specific version
#   curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | VERSION=list bash                 # List versions
#
# After installation, update with: asd update

set -euo pipefail

# Configuration - Public repo for distribution (no auth required)
REPO="asd-engineering/asd-cli"
# Fallback to private repo if public doesn't have releases yet
FALLBACK_REPO="asd-engineering/.asd"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
VERSION="${VERSION:-}"
ASD_INSTALL_BASE_URL="${ASD_INSTALL_BASE_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# Atomically place a file into its destination.
#
# `cp -f DEST` truncates the EXISTING inode in place (and, when DEST is a
# symlink, writes through to the real target). On macOS the kernel then
# SIGKILLs ("Killed: 9", instant, zero output) any process that is exec'ing
# or already running that image while it is being rewritten. Two self-hosted
# CI runners sharing one $HOME install to the same global asd/helper paths, so
# runner-A's install repeatedly clobbered runner-B's running `asd test`.
#
# Copy to a temp file in the SAME directory as DEST, then rename(2) over it.
# rename is atomic on a single filesystem: a concurrent exec sees either the
# old or the new complete image — never a half-written one — and a process
# already running keeps its original inode. Verified: in-place cp -f killed
# 195/200 concurrent launches; atomic install killed 0/200.
atomic_install_file() {
  local src="$1" dest="$2" dest_dir tmp
  dest_dir="$(dirname "$dest")"
  mkdir -p "$dest_dir"
  tmp="$(mktemp "$dest_dir/.asd-install.XXXXXX")" || error "mktemp failed in $dest_dir"
  cp -f "$src" "$tmp" || { rm -f "$tmp"; error "copy failed: $src"; }
  chmod +x "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$dest" || { rm -f "$tmp"; error "atomic move failed: $dest"; }
}

# Resolve a path through any symlink chain. `readlink -f` is GNU-only in
# practice (BSD readlink lacked -f until macOS 12.3), so fall back to
# following links by hand, bounded so a symlink cycle can't hang the
# installer.
resolve_symlink() {
  local p="${1:-}"
  [[ -n "$p" ]] || { echo ""; return 0; }
  local out
  if out=$(readlink -f "$p" 2>/dev/null) && [[ -n "$out" ]]; then
    echo "$out"
    return 0
  fi
  local i=0 target
  while [[ -L "$p" && $i -lt 32 ]]; do
    target="$(readlink "$p")"
    case "$target" in
      /*) p="$target" ;;
      *)  p="$(dirname "$p")/$target" ;;
    esac
    i=$((i + 1))
  done
  echo "$p"
}

get_asd_home() {
  if [[ -n "${ASD_HOME:-}" ]]; then
    echo "$ASD_HOME"
    return
  fi
  if [[ "$(uname -s)" == "Darwin" ]]; then
    echo "$HOME/Library/Application Support/asd"
  else
    echo "${XDG_DATA_HOME:-$HOME/.local/share}/asd"
  fi
}

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

  local result="${os}-${arch}"

  # Linux x64: check if CPU supports AVX2 instructions
  # Bun's default x64 binary requires AVX2 (Haswell/2013+ CPUs).
  # Older CPUs without AVX2 will segfault. Use the baseline build (SSE4.2/Nehalem).
  if [[ "$result" == "linux-x64" ]]; then
    if [[ -f /proc/cpuinfo ]] && ! grep -q ' avx2 ' /proc/cpuinfo 2>/dev/null; then
      # warn to stderr — this function returns via stdout echo
      warn "CPU does not support AVX2 instructions. Using baseline (compatible) build." >&2
      warn "Consider upgrading to a newer CPU for better performance." >&2
      result="linux-x64-baseline"
    fi
  fi

  echo "$result"
}

# List available releases from GitHub
list_versions() {
  local repos=("${REPO}" "${FALLBACK_REPO}")
  local auth_header=""

  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    auth_header="Authorization: Bearer ${GITHUB_TOKEN}"
  elif [[ -n "${GH_TOKEN:-}" ]]; then
    auth_header="Authorization: Bearer ${GH_TOKEN}"
  fi

  for repo in "${repos[@]}"; do
    local api_url="https://api.github.com/repos/${repo}/releases?per_page=20"
    local response

    if [[ -n "$auth_header" ]]; then
      response=$(curl -fsSL -H "Accept: application/vnd.github+json" -H "$auth_header" "$api_url" 2>/dev/null) || continue
    else
      response=$(curl -fsSL -H "Accept: application/vnd.github+json" "$api_url" 2>/dev/null) || continue
    fi

    local tags
    tags=$(echo "$response" | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)

    if [[ -n "$tags" ]]; then
      echo ""
      info "Available versions (from $repo):"
      echo ""
      local first=true
      local example_tag=""
      while IFS= read -r tag; do
        if $first; then
          echo "  $tag  (latest)"
          first=false
        else
          echo "  $tag"
          [[ -z "$example_tag" ]] && example_tag="$tag"
        fi
      done <<< "$tags"
      echo ""
      info "Install a specific version:"
      echo "  curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.sh | VERSION=${example_tag:-$tag} bash"
      echo ""
      return 0
    fi
  done

  error "Failed to fetch releases. Check your internet connection."
}

# Get release tag — uses VERSION env var if set, otherwise fetches latest
# Tries public repo first, falls back to private repo
# Outputs two lines: version\nrepo (to avoid subshell variable loss)
get_version() {
  # If VERSION is explicitly set, validate it exists and use it
  if [[ -n "$VERSION" ]]; then
    # Ensure it starts with 'v'
    [[ "$VERSION" != v* ]] && VERSION="v${VERSION}"

    local repos=("${REPO}" "${FALLBACK_REPO}")
    local auth_header=""

    if [[ -n "${GITHUB_TOKEN:-}" ]]; then
      auth_header="Authorization: Bearer ${GITHUB_TOKEN}"
    elif [[ -n "${GH_TOKEN:-}" ]]; then
      auth_header="Authorization: Bearer ${GH_TOKEN}"
    fi

    for repo in "${repos[@]}"; do
      local api_url="https://api.github.com/repos/${repo}/releases/tags/${VERSION}"
      local http_code

      if [[ -n "$auth_header" ]]; then
        http_code=$(curl -fsSL -o /dev/null -w '%{http_code}' -H "Accept: application/vnd.github+json" -H "$auth_header" "$api_url" 2>/dev/null) || continue
      else
        http_code=$(curl -fsSL -o /dev/null -w '%{http_code}' -H "Accept: application/vnd.github+json" "$api_url" 2>/dev/null) || continue
      fi

      if [[ "$http_code" == "200" ]]; then
        echo "$VERSION"
        echo "$repo"
        return 0
      fi
    done

    error "Version $VERSION not found. Use VERSION=list to see available versions."
  fi

  # No VERSION set — fetch latest
  local repos=("${REPO}" "${FALLBACK_REPO}")
  local auth_header=""

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
      echo "$tag"
      echo "$repo"
      return 0
    fi
  done

  error "Failed to fetch latest release. Check your internet connection or set GITHUB_TOKEN for private repos."
}

# Minimal Termux install when no pre-built Termux archive exists anywhere.
# Falls back to npm install which ships the JS source (no native compilation needed).
_install_minimal_termux() {
  local version="$1"
  local repo="$2"

  # npm install is the reliable fallback — the npm package contains JS source
  # that runs under Node.js without native compilation
  if command -v npm &>/dev/null; then
    info "Installing via npm (fallback for missing Termux archive)..."
    local npm_version="${version#v}"  # strip leading v
    if npm install -g "@asd-engineering/cli@$npm_version" 2>/dev/null || \
       npm install -g "@asd-engineering/cli@latest" 2>/dev/null; then
      info "✅ ASD CLI installed via npm (minimal — Node.js runtime)"
      info "   Version: $(asd --version 2>/dev/null || echo "$version")"
      echo ""
      warn "Native binaries (caddy, ttyd, code-server) are not bundled."
      warn "Install them manually: pkg install caddy ttyd"
      echo ""
      warn "When a Termux build becomes available, re-run this installer"
      warn "to get the full package with all binaries."
      return 0
    fi
    warn "npm install failed — trying source clone fallback..."
  fi

  # Last resort: clone the public repo and create a Node.js entry point
  if command -v git &>/dev/null && command -v node &>/dev/null; then
    local asd_home
    asd_home="$(get_asd_home)"
    local asd_src="$asd_home/src"
    info "Cloning ASD CLI source for Node.js execution..."

    if git clone --depth 1 "https://github.com/${repo}.git" "$asd_src" 2>/dev/null; then
      mkdir -p "$INSTALL_DIR"
      local node_bin
      node_bin=$(command -v node)
      cat > "$INSTALL_DIR/asd" <<WRAPPER
#!/data/data/com.termux/files/usr/bin/bash
set -eu
exec "$node_bin" "$asd_src/cli.ts" "\$@"
WRAPPER
      chmod +x "$INSTALL_DIR/asd"

      info "✅ ASD CLI installed (source — Node.js runtime)"
      info "   Location: $INSTALL_DIR/asd"
      echo ""
      warn "This is a source install without pre-built binaries."
      warn "Install helpers manually: pkg install caddy ttyd"
      return 0
    fi
  fi

  error "No Termux package found and fallback installation failed.
Ensure Node.js and npm are installed: pkg install nodejs-lts
Then try: npm install -g @asd-engineering/cli
Or check https://github.com/asd-engineering/asd-cli/releases"
}

# Download and install
install_asd() {
  # Handle VERSION=list
  if [[ "$VERSION" == "list" ]]; then
    list_versions
    exit 0
  fi

  local platform version download_url archive_name tmp_dir

  platform=$(detect_platform)
  info "Detected platform: $platform"

  # Termux: install required packages
  if [[ "$platform" == "termux-arm64" ]]; then
    info "Installing Termux dependencies..."
    local termux_pkgs=()

    # Core requirement — Termux builds run under Node.js
    command -v node &>/dev/null || termux_pkgs+=(nodejs-lts)

    # Helper binaries (not in CI tarball)
    command -v caddy &>/dev/null || termux_pkgs+=(caddy)
    command -v ttyd &>/dev/null || termux_pkgs+=(ttyd)

    if [[ ${#termux_pkgs[@]} -gt 0 ]]; then
      info "Installing: ${termux_pkgs[*]}"
      pkg install -y "${termux_pkgs[@]}" || warn "Some packages failed to install"
    fi

    if ! command -v node &>/dev/null; then
      error "Node.js is required for Termux. Install it with: pkg install nodejs-lts"
    fi
    info "Node.js: $(node --version)"
  fi

  # Resolve version and download URL
  if [[ -n "$ASD_INSTALL_BASE_URL" ]]; then
    version="${VERSION:-local}"
    [[ "$version" != v* && "$version" != "local" ]] && version="v${version}"
    ACTIVE_REPO="local"
    info "Using local install source: $ASD_INSTALL_BASE_URL"
    info "Version: $version"
  else
    # get_version outputs two lines: version\nrepo
    local version_output
    version_output=$(get_version)
    version=$(echo "$version_output" | head -1)
    ACTIVE_REPO=$(echo "$version_output" | tail -1)
    [[ -z "$version" ]] && error "Could not determine version"
    if [[ -n "$VERSION" ]]; then
      info "Requested version: $version"
    else
      info "Latest version: $version"
    fi
    info "Source: ${ACTIVE_REPO:-$REPO}"
  fi

  # Construct archive name and download URL
  local repo_for_download="${ACTIVE_REPO:-$REPO}"
  if [[ "$platform" == "windows-x64" ]]; then
    archive_name="asd-windows-x64.zip"
  else
    archive_name="asd-${platform}.tar.gz"
  fi

  if [[ -n "$ASD_INSTALL_BASE_URL" ]]; then
    download_url="${ASD_INSTALL_BASE_URL%/}/${archive_name}"
  else
    download_url="https://github.com/${repo_for_download}/releases/download/${version}/${archive_name}"
  fi

  # Create install directory
  mkdir -p "$INSTALL_DIR"

  # Download and extract
  tmp_dir=$(mktemp -d)
  trap "rm -rf $tmp_dir" EXIT

  info "Downloading $archive_name..."

  # Helper: download with optional auth
  # For private repos, GitHub browser URLs redirect to a CDN that strips auth headers.
  # Use the API asset endpoint instead when a token is available and the URL is a
  # github.com releases/download URL.
  _download() {
    local url="$1" dest="$2"

    # Local file path (absolute or file:// URI)
    local local_path=""
    if [[ "$url" == file://* ]]; then
      local_path="${url#file://}"
    elif [[ "$url" == /* && -f "$url" ]]; then
      local_path="$url"
    fi

    if [[ -n "$local_path" ]]; then
      if [[ -f "$local_path" ]]; then
        cp "$local_path" "$dest"
        return 0
      fi
      return 1
    fi

    local token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

    if [[ -n "$token" ]]; then
      # Try API-based download first for github.com release URLs
      # Pattern: https://github.com/OWNER/REPO/releases/download/TAG/ASSET
      if [[ "$url" =~ ^https://github\.com/([^/]+)/([^/]+)/releases/download/([^/]+)/(.+)$ ]]; then
        local owner="${BASH_REMATCH[1]}" repo_name="${BASH_REMATCH[2]}" tag="${BASH_REMATCH[3]}" asset="${BASH_REMATCH[4]}"
        local api_url="https://api.github.com/repos/${owner}/${repo_name}/releases/tags/${tag}"
        local release_json
        release_json=$(curl -fsSL -H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" "$api_url" 2>/dev/null) || release_json=""
        if [[ -n "$release_json" ]]; then
          local asset_url
          asset_url=$(echo "$release_json" | grep -o "\"browser_download_url\": *\"[^\"]*/${asset}\"" | cut -d'"' -f4)
          if [[ -n "$asset_url" ]]; then
            # Download via API with octet-stream accept to get the binary directly
            local asset_id
            asset_id=$(echo "$release_json" | grep -B5 "\"name\": *\"${asset}\"" | grep -o '"id": *[0-9]*' | head -1 | grep -o '[0-9]*')
            if [[ -n "$asset_id" ]]; then
              curl -fsSL -H "Authorization: Bearer ${token}" -H "Accept: application/octet-stream" \
                "https://api.github.com/repos/${owner}/${repo_name}/releases/assets/${asset_id}" \
                -o "$dest" 2>/dev/null && return 0
            fi
          fi
        fi
      fi
      # Fallback to direct URL with auth
      curl -fsSL -H "Authorization: Bearer ${token}" -H "Accept: application/octet-stream" "$url" -o "$dest" 2>/dev/null
    else
      curl -fsSL "$url" -o "$dest" 2>/dev/null
    fi
  }

  if ! _download "$download_url" "$tmp_dir/$archive_name"; then
    if [[ "$platform" == "termux-arm64" ]]; then
      # Termux asset may be missing if phone was offline during release.
      # Search previous releases for the most recent one that has it.
      warn "Termux package not available in $version — searching previous releases..."
      local found_version=""
      local auth_header=""
      [[ -n "${GITHUB_TOKEN:-}" ]] && auth_header="Authorization: Bearer ${GITHUB_TOKEN}"
      [[ -n "${GH_TOKEN:-}" ]] && auth_header="Authorization: Bearer ${GH_TOKEN}"

      # Paginated search: check up to 300 releases (10 pages x 30 per page)
      local page=1
      local max_pages=10
      while [[ $page -le $max_pages && -z "$found_version" ]]; do
        local api_url="https://api.github.com/repos/${repo_for_download}/releases?per_page=30&page=$page"
        local releases_json
        if [[ -n "$auth_header" ]]; then
          releases_json=$(curl -fsSL -H "Accept: application/vnd.github+json" -H "$auth_header" "$api_url" 2>/dev/null) || releases_json=""
        else
          releases_json=$(curl -fsSL -H "Accept: application/vnd.github+json" "$api_url" 2>/dev/null) || releases_json=""
        fi

        [[ -z "$releases_json" ]] && break

        # Parse release tags and check each for the termux asset
        local tags
        tags=$(echo "$releases_json" | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)
        local tag_count=0
        while IFS= read -r prev_tag; do
          [[ -z "$prev_tag" ]] && continue
          tag_count=$((tag_count + 1))
          [[ "$prev_tag" == "$version" ]] && continue
          local prev_url="https://github.com/${repo_for_download}/releases/download/${prev_tag}/${archive_name}"
          if _download "$prev_url" "$tmp_dir/$archive_name"; then
            found_version="$prev_tag"
            warn "Using Termux package from $found_version (latest available)"
            break
          fi
        done <<< "$tags"

        # If fewer than 30 results, no more pages
        [[ $tag_count -lt 30 ]] && break
        page=$((page + 1))
      done

      if [[ -z "$found_version" ]]; then
        warn "No Termux package found in any release."
        warn "Installing minimal ASD CLI (Node.js wrapper only)..."
        warn "Native binaries (caddy, ttyd, code-server) won't be pre-bundled."
        warn "Install them manually: pkg install caddy ttyd"
        echo ""
        _install_minimal_termux "$version" "$repo_for_download"
        return 0
      fi
    elif [[ "$repo_for_download" == "$REPO" ]]; then
      error "Download failed. Binary may not be available for '${platform}'.
Available platforms: linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, termux-arm64.
See https://github.com/asd-engineering/asd-cli/releases"
    else
      error "Download failed. For private repos, set GITHUB_TOKEN."
    fi
  fi

  info "Extracting to $INSTALL_DIR..."
  if [[ "$archive_name" == *.zip ]]; then
    unzip -q -o "$tmp_dir/$archive_name" -d "$tmp_dir/extracted"
    # Find top-level bin directory (exclude code-server/node_modules nested bin dirs)
    local bin_dir
    bin_dir=$(find "$tmp_dir/extracted" -maxdepth 3 -type d -name "bin" ! -path "*/code-server/*" ! -path "*/node_modules/*" | head -1)
    [[ -z "$bin_dir" ]] && error "No bin/ directory found in archive"
    for f in "$bin_dir/"*; do
      [[ -e "$f" ]] || continue
      atomic_install_file "$f" "$INSTALL_DIR/$(basename "$f")"
    done
  else
    tar -xzf "$tmp_dir/$archive_name" -C "$tmp_dir"
    # Find top-level bin directory (exclude code-server/node_modules nested bin dirs)
    local bin_dir
    bin_dir=$(find "$tmp_dir" -maxdepth 2 -type d -name "bin" ! -path "*/code-server/*" ! -path "*/node_modules/*" ! -path "$INSTALL_DIR/*" | head -1)
    [[ -z "$bin_dir" ]] && error "No bin/ directory found in archive"
    for f in "$bin_dir/"*; do
      [[ -e "$f" ]] || continue
      atomic_install_file "$f" "$INSTALL_DIR/$(basename "$f")"
    done

    # Install bundled code-server runtime if present (Linux/macOS bundles)
    local code_server_root asd_home_cs
    code_server_root=$(find "$tmp_dir" -type d -path "*/code-server/bin" | head -1 | sed 's#/bin$##')
    if [[ -n "$code_server_root" ]]; then
      asd_home_cs=$(get_asd_home)
      mkdir -p "$asd_home_cs"
      rm -rf "$asd_home_cs/code-server"
      cp -Rf "$code_server_root" "$asd_home_cs/code-server"
      chmod +x "$asd_home_cs/code-server/bin/code-server" 2>/dev/null || true
      info "Installed bundled code-server to: $asd_home_cs/code-server"
    fi

    # Copy bundled helper binaries to ASD global bin dir
    local asd_bin_dir
    asd_bin_dir="$(get_asd_home)/bin"
    mkdir -p "$asd_bin_dir"
    for helper_bin in caddy ttyd asd-tunnel; do
      if [[ -f "$bin_dir/$helper_bin" ]]; then
        atomic_install_file "$bin_dir/$helper_bin" "$asd_bin_dir/$helper_bin"
        info "Installed $helper_bin to $asd_bin_dir/"
      fi
    done
  fi

  # Install assets to global ASD home (must match CLI's getAsdHome() logic)
  local asd_home="${ASD_HOME:-}"
  if [[ -z "$asd_home" ]]; then
    case "$(uname -s)" in
      Darwin) asd_home="$HOME/Library/Application Support/asd" ;;
      *)      asd_home="${XDG_DATA_HOME:-$HOME/.local/share}/asd" ;;
    esac
  fi

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
    mkdir -p "$asd_home"
    rm -rf "$asd_home/modules"
    cp -r "$modules_dir" "$asd_home/modules"
    info "Modules installed to $asd_home/modules/"
  fi

  # Termux: verify Node.js is available (Termux builds run under Node.js, not Bun)
  if [[ "$platform" == "termux-arm64" ]]; then
    if ! command -v node &>/dev/null; then
      warn "Node.js is required but not installed. Install with: pkg install nodejs-lts"
    fi
  fi

  # Deduplicate: move asd binary to ASD_HOME/bin/ and symlink from INSTALL_DIR
  # This ensures `asd update` and `just global-install` always update the same file
  local asd_bin_home
  asd_bin_home="$(get_asd_home)/bin"
  mkdir -p "$asd_bin_home"
  if [[ -f "$INSTALL_DIR/asd" && ! -L "$INSTALL_DIR/asd" ]]; then
    mv -f "$INSTALL_DIR/asd" "$asd_bin_home/asd"
    chmod +x "$asd_bin_home/asd"
    ln -sf "$asd_bin_home/asd" "$INSTALL_DIR/asd"
    # Termux: move runtime files alongside the wrapper (it resolves symlinks to find them)
    for runtime_file in asd-bundle.js asd-node.js; do
      if [[ -f "$INSTALL_DIR/$runtime_file" ]]; then
        mv -f "$INSTALL_DIR/$runtime_file" "$asd_bin_home/$runtime_file"
      fi
    done
  fi

  # Verify installation
  if [[ -x "$INSTALL_DIR/asd" ]]; then
    info "✅ ASD CLI installed successfully!"
    info "   Location: $asd_bin_home/asd (symlinked from $INSTALL_DIR/asd)"
    info "   Version: $("$INSTALL_DIR/asd" --version 2>/dev/null || echo "$version")"
    echo ""
    info "To update in the future, run:"
    echo "   asd update"
    echo ""

    # Check if in PATH.
    #
    # `command -v asd` succeeding is NOT proof the install is reachable: an
    # older `asd` sitting in a directory that comes earlier in PATH (e.g.
    # $PREFIX/bin on Termux, /usr/local/bin elsewhere) keeps resolving and
    # the user silently keeps running the stale binary — including its
    # broken `asd update`. Compare the RESOLVED target instead.
    local on_path_asd resolved_installed resolved_on_path
    on_path_asd="$(command -v asd 2>/dev/null || true)"
    resolved_installed="$(resolve_symlink "$INSTALL_DIR/asd")"
    resolved_on_path="$(resolve_symlink "$on_path_asd")"

    if [[ -n "$on_path_asd" && "$resolved_on_path" != "$resolved_installed" ]]; then
      warn "Another 'asd' shadows this install and will be used instead:"
      echo ""
      echo "    on PATH:   $on_path_asd -> $resolved_on_path"
      echo "    installed: $INSTALL_DIR/asd -> $resolved_installed"
      echo ""
      warn "Point the shadowing entry at this install (recommended):"
      echo ""
      echo "  ln -sfn \"$resolved_installed\" \"$on_path_asd\""
      echo ""
      warn "...or remove it and put $INSTALL_DIR ahead of it in PATH."
      echo ""
    elif [[ -z "$on_path_asd" ]]; then
      # Detect shell RC file
      local shell_rc="$HOME/.bashrc"
      case "${SHELL:-}" in
        */zsh)  shell_rc="$HOME/.zshrc" ;;
        */fish) shell_rc="" ;;
        */bash)
          if [[ "$(uname -s)" == "Darwin" ]]; then
            shell_rc="$HOME/.bash_profile"
          fi
          ;;
      esac

      if [[ -z "$shell_rc" ]]; then
        # fish shell
        warn "~/.local/bin is not in your PATH. Run this to fix it:"
        echo ""
        echo "  fish_add_path ~/.local/bin"
      else
        warn "~/.local/bin is not in your PATH. Run this to fix it:"
        echo ""
        echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> $shell_rc && source $shell_rc"
      fi
      echo ""
    fi
  else
    error "Installation failed - binary not found"
  fi
}

# Run installer
install_asd
