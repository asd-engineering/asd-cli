#!/usr/bin/env bun
// @ts-check
/** @module core/scripts/binary-installer */

import { existsSync, mkdirSync, rmSync, chmodSync, createWriteStream, readFileSync, cpSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { execSync, execFileSync, spawn } from "child_process";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import { resolveAsdDir, resolveBinDir, resolveWorkspaceDir, isWin } from "../helpers/common.mjs";
import { getBinaryChecksum } from "./binary-checksums.mjs";
import { fail } from "../messages.mjs";
import { getCliIcon } from "../assets/icons.mjs";

// Centralized CLI icons
const okIcon = getCliIcon("cli.ok")?.glyph || "✅";
const warnIcon = getCliIcon("cli.warn")?.glyph || "⚠️";
const errIcon = getCliIcon("cli.error")?.glyph || "❌";
const buildIcon = getCliIcon("cli.build")?.glyph || "🔨";
const downloadIcon = getCliIcon("cli.download")?.glyph || "📥";

/**
 * Detect host platform and architecture.
 * @function detectPlatform
 * @returns {{ os: "linux" | "darwin" | "windows", arch: "amd64" | "arm64" | "armv7" | "armv6" | "i686" | "x86_64" | "aarch64", rawArch: string }}
 */
export function detectPlatform() {
  // Map Node.js platform to standard OS names
  const osMap = {
    linux: "linux",
    darwin: "darwin",
    win32: "windows",
  };

  // Map Node.js architecture to binary naming conventions
  const archMap = {
    x64: "amd64",
    arm64: "arm64",
    arm: "armv7",
    ia32: "i686",
  };

  const os = osMap[process.platform] || process.platform;
  const arch = archMap[process.arch] || process.arch;

  // Get the raw arch for binaries that use different naming
  let rawArch = process.arch;
  if (process.platform === "linux") {
    // On Linux, try to get the actual architecture string
    try {
      rawArch = execSync("uname -m", { encoding: "utf8" }).trim();
    } catch {
      // Fall back to Node.js arch
      rawArch = process.arch === "x64" ? "x86_64" : process.arch;
    }
  } else if (process.platform === "darwin") {
    rawArch = process.arch === "x64" ? "x86_64" : process.arch;
  }

  return { os, arch, rawArch };
}

/**
 * Create a temporary directory with cleanup handler.
 * @function createTempDir
 * @param {string} prefix
 * @returns {{ path: string, cleanup: () => void }}
 */
function createTempDir(prefix) {
  const path = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(path, { recursive: true });
  return {
    path,
    cleanup: () => {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Download a file from URL to destination path.
 * @function downloadFile
 * @param {string} url
 * @param {string} destPath
 * @returns {Promise<void>}
 */
async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const fileStream = createWriteStream(destPath);
  // @ts-ignore - Node.js stream types
  await pipeline(response.body, fileStream);
}

/**
 * Compute SHA-256 or SHA-512 hash of a file.
 * @function computeFileHash
 * @param {string} filePath
 * @param {"sha256" | "sha512"} algorithm
 * @returns {string}
 */
function computeFileHash(filePath, algorithm = "sha256") {
  const content = readFileSync(filePath);
  return createHash(algorithm).update(content).digest("hex");
}

/**
 * Verify checksum of downloaded file.
 * @function verifyChecksum
 * @param {string} binary
 * @param {string} version
 * @param {string} platform
 * @param {string} filePath
 * @returns {boolean}
 */
function verifyChecksum(binary, version, platform, filePath) {
  const checksumData = getBinaryChecksum(binary, version, platform);

  if (!checksumData || !checksumData.hash) {
    console.log(`   ${warnIcon} Checksum not available for ${binary}, skipping verification`);
    return true;
  }

  const algorithm = checksumData.algorithm || "sha256";
  const actualHash = computeFileHash(filePath, algorithm);
  const expectedHash = checksumData.hash.toLowerCase();

  if (expectedHash !== actualHash.toLowerCase()) {
    console.error(`   ${errIcon} Checksum mismatch for ${binary}`);
    console.error(`   Expected: ${expectedHash}`);
    console.error(`   Actual:   ${actualHash}`);
    return false;
  }

  console.log(`   ${okIcon} Checksum verified: ${actualHash.slice(0, 16)}...`);
  return true;
}

/**
 * Extract a tar.gz archive.
 * @function extractTarGz
 * @param {string} archivePath
 * @param {string} destDir
 * @param {{ stripComponents?: number }} options
 * @returns {Promise<void>}
 */
async function extractTarGz(archivePath, destDir, options = {}) {
  const args = ["-xzf", archivePath, "-C", destDir];
  if (options.stripComponents) {
    args.push(`--strip-components=${options.stripComponents}`);
  }

  await new Promise((resolve, reject) => {
    const proc = spawn("tar", args, { stdio: "inherit" });
    proc.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`tar exited with ${code}`))));
    proc.on("error", reject);
  });
}

/**
 * Extract a zip archive.
 * @function extractZip
 * @param {string} archivePath
 * @param {string} destDir
 * @returns {Promise<void>}
 */
async function extractZip(archivePath, destDir) {
  if (process.platform === "win32") {
    execFileSync("powershell.exe", [
      "-NoProfile", "-Command",
      "Expand-Archive", "-Path", archivePath, "-DestinationPath", destDir, "-Force",
    ], { stdio: "inherit" });
  } else {
    await new Promise((resolve, reject) => {
      const proc = spawn("unzip", ["-q", archivePath, "-d", destDir], { stdio: "inherit" });
      proc.on("exit", (code) => (code === 0 ? resolve(undefined) : reject(new Error(`unzip exited with ${code}`))));
      proc.on("error", reject);
    });
  }
}

/**
 * Install a file to destination with correct permissions.
 * @function installFile
 * @param {string} src
 * @param {string} dest
 * @param {number} mode
 */
function installFile(src, dest, mode = 0o755) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Use copy instead of move to handle cross-device scenarios
  const content = readFileSync(src);
  const { writeFileSync } = require("fs");
  writeFileSync(dest, content, { mode });
}

/**
 * Copy directory recursively (cross-platform).
 * @function copyDir
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  // Use Node.js cpSync for cross-platform compatibility
  cpSync(src, dest, { recursive: true });
}

/**
 * Create a symlink.
 * @function createSymlink
 * @param {string} target
 * @param {string} linkPath
 */
function createSymlink(target, linkPath) {
  const linkDir = dirname(linkPath);
  if (!existsSync(linkDir)) {
    mkdirSync(linkDir, { recursive: true });
  }
  if (existsSync(linkPath)) {
    rmSync(linkPath, { force: true });
  }
  const { symlinkSync } = require("fs");
  symlinkSync(target, linkPath);
}

// =============================================================================
// Binary Configuration Registry
// =============================================================================

/**
 * @typedef {Object} BinaryConfig
 * @property {string} versionEnv - Environment variable for version
 * @property {string} defaultVersion - Default version if env not set
 * @property {(version: string, os: string, arch: string, rawArch: string) => string | null} buildUrl - Function to build download URL
 * @property {(version: string, os: string, arch: string) => string} platformId - Function to build platform identifier for checksums
 * @property {(binDir: string, workspaceDir: string, tempDir: string, downloadPath: string, version: string, os: string, arch: string) => Promise<{ installed: string[] }>} install - Installation function
 */

/** @type {Record<string, BinaryConfig>} */
const BINARY_CONFIGS = {
  caddy: {
    versionEnv: "ASD_CADDY_VERSION",
    defaultVersion: "2.7.4",
    buildUrl: (version, os, arch, rawArch) => {
      // Strip leading 'v' from version
      const v = version.replace(/^v/, "");
      const platform = os === "darwin" ? "mac" : os;

      // Map architecture for Caddy
      let caddyArch;
      switch (rawArch) {
        case "x86_64": caddyArch = "amd64"; break;
        case "aarch64":
        case "arm64": caddyArch = "arm64"; break;
        case "armv6l": caddyArch = "armv6"; break;
        case "armv7l": caddyArch = "armv7"; break;
        default: caddyArch = arch;
      }

      if (os === "windows") {
        return `https://github.com/caddyserver/caddy/releases/download/v${v}/caddy_${v}_windows_${caddyArch}.zip`;
      }
      return `https://github.com/caddyserver/caddy/releases/download/v${v}/caddy_${v}_${platform}_${caddyArch}.tar.gz`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      const ext = os === "windows" ? ".exe" : "";
      const destPath = join(binDir, `caddy${ext}`);

      if (os === "windows") {
        await extractZip(downloadPath, tempDir);
        installFile(join(tempDir, `caddy${ext}`), destPath);
      } else {
        await extractTarGz(downloadPath, tempDir);
        installFile(join(tempDir, "caddy"), destPath);
      }

      return { installed: [destPath] };
    },
  },

  ttyd: {
    versionEnv: "ASD_TTYD_VERSION",
    defaultVersion: "1.7.7",
    buildUrl: (version, os, arch, rawArch) => {
      // TTYD uses raw architecture names
      let ttydAsset;
      if (os === "linux") {
        switch (rawArch) {
          case "x86_64": ttydAsset = "ttyd.x86_64"; break;
          case "aarch64": ttydAsset = "ttyd.aarch64"; break;
          case "armv7l": ttydAsset = "ttyd.armhf"; break;
          case "armv6l": ttydAsset = "ttyd.arm"; break;
          case "i686": ttydAsset = "ttyd.i686"; break;
          case "s390x": ttydAsset = "ttyd.s390x"; break;
          case "mips": ttydAsset = "ttyd.mips"; break;
          case "mips64": ttydAsset = "ttyd.mips64"; break;
          case "mipsel": ttydAsset = "ttyd.mipsel"; break;
          case "mips64el": ttydAsset = "ttyd.mips64el"; break;
          default: return null;
        }
      } else if (os === "darwin") {
        ttydAsset = rawArch === "arm64" ? "ttyd.aarch64" : "ttyd.x86_64";
      } else if (os === "windows") {
        // Windows has ttyd.win32.exe
        ttydAsset = "ttyd.win32.exe";
      } else {
        return null;
      }

      return `https://github.com/tsl0922/ttyd/releases/download/${version}/${ttydAsset}`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      const ext = os === "windows" ? ".exe" : "";
      const destPath = join(binDir, `ttyd${ext}`);
      installFile(downloadPath, destPath);
      return { installed: [destPath] };
    },
  },

  gh: {
    versionEnv: "ASD_GH_VERSION",
    defaultVersion: "2.83.2",
    buildUrl: (version, os, arch, rawArch) => {
      let ghAsset;
      if (os === "linux") {
        ghAsset = rawArch === "aarch64" || arch === "arm64"
          ? `gh_${version}_linux_arm64.tar.gz`
          : `gh_${version}_linux_amd64.tar.gz`;
      } else if (os === "darwin") {
        ghAsset = arch === "arm64"
          ? `gh_${version}_macOS_arm64.zip`
          : `gh_${version}_macOS_amd64.zip`;
      } else {
        ghAsset = `gh_${version}_windows_amd64.zip`;
      }

      return `https://github.com/cli/cli/releases/download/v${version}/${ghAsset}`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      const ext = os === "windows" ? ".exe" : "";
      const destPath = join(binDir, `gh${ext}`);

      if (os === "linux") {
        await extractTarGz(downloadPath, tempDir);
      } else {
        await extractZip(downloadPath, tempDir);
      }

      // Find gh binary - check for subdirectory first, then flat extraction
      const { readdirSync } = require("fs");
      const entries = readdirSync(tempDir);
      const ghDir = entries.find((e) => e.startsWith("gh_"));

      let ghBinPath;
      if (ghDir) {
        // Subdirectory structure: gh_x.x.x_os_arch/bin/gh
        ghBinPath = join(tempDir, ghDir, "bin", `gh${ext}`);
      } else if (entries.includes("bin")) {
        // Flat structure: bin/gh (Windows zip)
        ghBinPath = join(tempDir, "bin", `gh${ext}`);
      } else {
        throw new Error("Could not find gh binary in extracted files");
      }

      installFile(ghBinPath, destPath);
      return { installed: [destPath] };
    },
  },

  mitmproxy: {
    versionEnv: "ASD_MITMPROXY_VERSION",
    defaultVersion: "12.1.1",
    buildUrl: (version, os, arch, rawArch) => {
      let mpArch;
      if (os === "linux") {
        mpArch = rawArch === "aarch64" || arch === "arm64" ? "aarch64" : "x86_64";
      } else if (os === "darwin") {
        mpArch = arch === "arm64" ? "arm64" : "x86_64";
      } else {
        mpArch = "x86_64";
      }

      if (os === "windows") {
        return `https://downloads.mitmproxy.org/${version}/mitmproxy-${version}-windows-x86_64.zip`;
      }
      const platform = os === "darwin" ? "macos" : "linux";
      return `https://downloads.mitmproxy.org/${version}/mitmproxy-${version}-${platform}-${mpArch}.tar.gz`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      const ext = os === "windows" ? ".exe" : "";

      if (os === "windows") {
        await extractZip(downloadPath, binDir);
        return {
          installed: [
            join(binDir, "mitmproxy.exe"),
            join(binDir, "mitmdump.exe"),
            join(binDir, "mitmweb.exe"),
          ],
        };
      }

      await extractTarGz(downloadPath, tempDir);

      const binaries = ["mitmproxy", "mitmdump", "mitmweb"];
      const installed = [];
      for (const bin of binaries) {
        const destPath = join(binDir, bin);
        installFile(join(tempDir, bin), destPath);
        installed.push(destPath);
      }

      return { installed };
    },
  },

  dbgate: {
    versionEnv: "ASD_DBGATE_VERSION",
    defaultVersion: "6.8.2",
    buildUrl: (version, os, arch, rawArch) => {
      if (os === "linux") {
        if (rawArch === "aarch64" || arch === "arm64") {
          return `https://github.com/dbgate/dbgate/releases/download/v${version}/dbgate-${version}-linux_arm64.AppImage`;
        }
        return `https://github.com/dbgate/dbgate/releases/download/v${version}/dbgate-${version}-linux_x64.tar.gz`;
      } else if (os === "darwin") {
        const macArch = arch === "arm64" ? "arm64" : "x64";
        return `https://github.com/dbgate/dbgate/releases/download/v${version}/dbgate-${version}-mac_${macArch}.zip`;
      } else {
        return `https://github.com/dbgate/dbgate/releases/download/v${version}/dbgate-${version}-win_x64.exe`;
      }
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch, rawArch) => {
      if (os === "linux") {
        const isAppImage = rawArch === "aarch64" || arch === "arm64";
        const destPath = join(binDir, "dbgate");

        if (isAppImage) {
          // ARM64: AppImage is self-contained
          installFile(downloadPath, destPath);
        } else {
          // x64: tar.gz with directory structure
          await extractTarGz(downloadPath, tempDir);

          // Find extracted directory
          const { readdirSync } = require("fs");
          const entries = readdirSync(tempDir);
          const dbgateDir = entries.find((e) => e.startsWith("dbgate-"));

          if (!dbgateDir) {
            throw new Error("Could not find extracted dbgate directory");
          }

          // Install to workspace
          const dbgateInstallDir = join(workspaceDir, "dbgate");
          copyDir(join(tempDir, dbgateDir), dbgateInstallDir);

          // Create symlink in bin
          createSymlink(join(dbgateInstallDir, "dbgate"), destPath);
        }

        return { installed: [destPath] };
      } else if (os === "darwin") {
        const dbgateDir = join(workspaceDir, "dbgate");
        await extractZip(downloadPath, dbgateDir);

        // Create launcher script
        const launcherPath = join(binDir, "dbgate");
        const { writeFileSync } = require("fs");
        writeFileSync(launcherPath, `#!/usr/bin/env bash\nopen "${dbgateDir}/DbGate.app" "$@"\n`, { mode: 0o755 });

        return { installed: [launcherPath] };
      } else {
        // Windows: standalone exe
        const destPath = join(workspaceDir, "dbgate", "dbgate.exe");
        const destDir = dirname(destPath);
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        installFile(downloadPath, destPath);
        return { installed: [destPath] };
      }
    },
  },

  codeserver: {
    versionEnv: "ASD_CODE_SERVER_VERSION",
    defaultVersion: "4.108.2",
    buildUrl: (version, os, arch, rawArch) => {
      // code-server doesn't provide Windows builds
      if (os === "windows") return null;

      let csArch;
      switch (rawArch) {
        case "x86_64":
        case "x64": csArch = "amd64"; break;
        case "arm64":
        case "aarch64": csArch = "arm64"; break;
        case "armv7l": csArch = "armv7l"; break;
        default: csArch = arch;
      }
      const platform = os === "darwin" ? "macos" : "linux";
      return `https://github.com/coder/code-server/releases/download/v${version}/code-server-${version}-${platform}-${csArch}.tar.gz`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      // Code-server installs to global data dir (parallel to bin/), not workspace
      // e.g., ~/.local/share/asd/code-server/ instead of ~/.local/share/asd/bin/
      const globalDataDir = dirname(binDir); // ~/.local/share/asd/
      const installDir = join(globalDataDir, "code-server");

      if (!existsSync(installDir)) {
        mkdirSync(installDir, { recursive: true });
      }

      if (os === "windows") {
        await extractZip(downloadPath, tempDir);

        // Find extracted directory
        const { readdirSync } = require("fs");
        const entries = readdirSync(tempDir);
        const csDir = entries.find((e) => e.startsWith("code-server-"));

        if (!csDir) {
          throw new Error("Could not find extracted code-server directory");
        }

        copyDir(join(tempDir, csDir), installDir);
        return { installed: [join(installDir, "bin", "code-server.cmd")] };
      }

      // Linux/macOS: tar.gz with --strip-components=1
      await extractTarGz(downloadPath, installDir, { stripComponents: 1 });

      return { installed: [join(installDir, "bin", "code-server")] };
    },
  },

  tunnel: {
    versionEnv: "ASD_TUNNEL_VERSION",
    defaultVersion: "main",
    buildUrl: (version, os, arch) => {
      // If submodule exists, return null to trigger build-from-source path
      try {
        const asdDir = process.cwd(); // Will be resolved properly in install()
        const tunnelSrc = join(asdDir, "ext", "asd-tunnel");
        if (existsSync(tunnelSrc) && existsSync(join(tunnelSrc, "go.mod"))) {
          return null; // Build from source
        }
      } catch { /* ignore */ }
      // GitHub release asset naming: asd-tunnel-{os}-{arch}[.exe]
      const ext = os === "windows" ? ".exe" : "";
      return `https://github.com/asd-engineering/asd-tunnel/releases/download/${version}/asd-tunnel-${os}-${arch}${ext}`;
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      const ext = os === "windows" ? ".exe" : "";
      const destPath = join(binDir, `asd-tunnel${ext}`);

      // First, try to build from source if submodule exists (dev mode)
      try {
        const asdDir = resolveAsdDir();
        const tunnelSrc = join(asdDir, "ext", "asd-tunnel");

        if (existsSync(tunnelSrc) && existsSync(join(tunnelSrc, "go.mod"))) {
          // Check for Go
          let goAvailable = false;
          try {
            execSync("go version", { stdio: "pipe" });
            goAvailable = true;
          } catch {
            // Go not installed - offer to install via winget (Windows only)
            if (os === "windows") {
              try {
                execSync("winget --version", { stdio: "pipe" });

                const { ask, isNonInteractive } = await import("../helpers/prompt.mjs");
                if (!isNonInteractive()) {
                  console.log(`   ${warnIcon} Go is required to build asd-tunnel from source.`);
                  const answer = await ask("   Install Go via winget? [Y/n]: ");
                  if (!answer || answer.toLowerCase() !== "n") {
                    console.log(`   ${buildIcon} Installing Go...`);
                    execSync("winget install GoLang.Go --accept-package-agreements --accept-source-agreements", { stdio: "inherit" });
                    console.log(`   ${okIcon} Go installed. You may need to restart your terminal for PATH changes.`);
                    // Try to use Go after install (may not work without PATH refresh)
                    try {
                      execSync("go version", { stdio: "pipe" });
                      goAvailable = true;
                    } catch {
                      console.log(`   ${warnIcon} Go installed but not in PATH yet. Falling back to pre-built binary...`);
                    }
                  }
                }
              } catch {
                // winget not available, fall through to download
              }
            }

            if (!goAvailable) {
              console.log(`   ${warnIcon} Go not installed, downloading pre-built binary...`);
            }
          }

          if (goAvailable) {
            // Build the binary
            console.log(`   ${buildIcon} Building asd-tunnel from source...`);
            execSync(`go build -o "${destPath}" .`, { cwd: tunnelSrc, stdio: "inherit" });
            if (os !== "windows") {
              chmodSync(destPath, 0o755);
            }

            // Copy templates if needed (Linux/macOS only)
            if (os !== "windows") {
              const templatesDir = join(workspaceDir, "tunnel", "templates");
              const srcTemplates = join(tunnelSrc, "templates");

              if (!existsSync(join(templatesDir, "console.tmpl")) && existsSync(srcTemplates)) {
                mkdirSync(templatesDir, { recursive: true });
                copyDir(srcTemplates, templatesDir);
                console.log(`   ${okIcon} Templates installed -> ${templatesDir}`);
              }
            }

            return { installed: [destPath] };
          }
        }
      } catch {
        // Submodule not available, proceed with download
      }

      // Download pre-built binary from GitHub releases
      if (!downloadPath || !existsSync(downloadPath)) {
        console.log(`   ${warnIcon} Download failed - no binary available`);
        return { installed: [], skipped: true };
      }

      // Move binary to destination
      const { renameSync } = await import("fs");
      mkdirSync(dirname(destPath), { recursive: true });
      renameSync(downloadPath, destPath);
      if (os !== "windows") {
        chmodSync(destPath, 0o755);
      }

      console.log(`   ${okIcon} asd-tunnel installed -> ${destPath}`);
      return { installed: [destPath] };
    },
  },

  busybox: {
    versionEnv: "ASD_BUSYBOX_VERSION",
    defaultVersion: "FRP-5467",
    buildUrl: (version, os, arch) => {
      // Busybox-w32 is only for Windows
      if (os !== "windows") return null;
      return arch === "amd64"
        ? "https://frippery.org/files/busybox/busybox64.exe"
        : "https://frippery.org/files/busybox/busybox.exe";
    },
    platformId: (version, os, arch) => `${os}_${arch}`,
    install: async (binDir, workspaceDir, tempDir, downloadPath, version, os, arch) => {
      if (os !== "windows") {
        console.log(`   ${warnIcon} Busybox is only needed on Windows, skipping`);
        return { installed: [], skipped: true };
      }

      const busyboxPath = join(binDir, "busybox.exe");
      const bashCmdPath = join(binDir, "bash.cmd");

      // Copy busybox.exe
      installFile(downloadPath, busyboxPath);
      console.log(`   ${okIcon} Busybox installed -> ${busyboxPath}`);

      // Create bash.cmd wrapper script
      const bashCmdContent = `@echo off
setlocal
set "BUSYBOX=%~dp0busybox.exe"
if "%~1"=="-c" (
    "%BUSYBOX%" sh -c %2 %3 %4 %5 %6 %7 %8 %9
) else if "%~1"=="-uc" (
    "%BUSYBOX%" sh -c %2 %3 %4 %5 %6 %7 %8 %9
) else (
    "%BUSYBOX%" sh %*
)
`;
      const { writeFileSync } = require("fs");
      writeFileSync(bashCmdPath, bashCmdContent);
      console.log(`   ${okIcon} bash.cmd wrapper created -> ${bashCmdPath}`);

      return { installed: [busyboxPath, bashCmdPath] };
    },
  },
};

// =============================================================================
// Main Installation Functions
// =============================================================================

/**
 * Install a single binary.
 * @function installBinary
 * @param {string} name - Binary name (e.g., "caddy", "ttyd")
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ installed: boolean, skipped: boolean, paths: string[], error?: string }>}
 */
export async function installBinary(name, options = {}) {
  const config = BINARY_CONFIGS[name];
  if (!config) {
    return { installed: false, skipped: false, paths: [], error: `Unknown binary: ${name}` };
  }

  const { os, arch, rawArch } = detectPlatform();
  const binDir = resolveBinDir();
  const workspaceDir = resolveWorkspaceDir();

  // Get version from env or default
  const version = (process.env[config.versionEnv] || config.defaultVersion).replace(/^v/, "");

  // Check if already installed (for standard binaries)
  const checkPaths = getExpectedPaths(name, binDir, workspaceDir, os);
  if (!options.force && checkPaths.some((p) => existsSync(p))) {
    const existingPath = checkPaths.find((p) => existsSync(p));
    console.log(`   ${okIcon} Already present at ${existingPath}, skipping`);
    return { installed: false, skipped: true, paths: [existingPath] };
  }

  // Build download URL
  const url = config.buildUrl(version, os, arch, rawArch);

  if (!url) {
    // Special case: tunnel is built from source
    if (name === "tunnel") {
      const temp = createTempDir("tunnel");
      try {
        const result = await config.install(binDir, workspaceDir, temp.path, "", version, os, arch, rawArch);
        return { installed: result.installed.length > 0, skipped: result.skipped || false, paths: result.installed };
      } finally {
        temp.cleanup();
      }
    }
    // No build available for this platform - mark as skipped with message
    console.log(`   ${warnIcon} Not available for ${os}/${arch}`);
    return { installed: false, skipped: true, paths: [] };
  }

  console.log(`   ${downloadIcon} ${url}`);

  const temp = createTempDir(name);
  try {
    // Determine download filename - use correct extension for Windows Expand-Archive
    const isTarGz = url.endsWith(".tar.gz");
    const isZip = url.endsWith(".zip");
    const ext = isTarGz ? ".tar.gz" : isZip ? ".zip" : "";
    const downloadPath = join(temp.path, `${name}${ext}`);

    // Download
    await downloadFile(url, downloadPath);

    // Verify checksum
    const platformId = config.platformId(version, os, arch);
    if (!verifyChecksum(name, version, platformId, downloadPath)) {
      return { installed: false, skipped: false, paths: [], error: "Checksum verification failed" };
    }

    // Install
    const result = await config.install(binDir, workspaceDir, temp.path, downloadPath, version, os, arch, rawArch);

    return { installed: true, skipped: false, paths: result.installed };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { installed: false, skipped: false, paths: [], error: errMsg };
  } finally {
    temp.cleanup();
  }
}

/**
 * Get expected installation paths for a binary (for checking if already installed).
 *
 * TODO: Refactor to have each module export its binary path expectations.
 * The module-specific path logic here (codeserver, dbgate, tunnel) couples
 * the core installer to specific module implementations. Consider moving
 * this to modules/{name}/config/binary.mjs or modules/{name}/manifest.json.
 * See: https://github.com/asd-engineering/.asd/issues/117
 *
 * @function getExpectedPaths
 * @param {string} name
 * @param {string} binDir
 * @param {string} workspaceDir
 * @param {string} os
 * @returns {string[]}
 */
function getExpectedPaths(name, binDir, workspaceDir, os) {
  const ext = os === "windows" ? ".exe" : "";

  switch (name) {
    case "codeserver": {
      // Code-server is in global data dir parallel to bin/
      const globalDataDir = dirname(binDir);
      return [
        join(globalDataDir, "code-server", "bin", os === "windows" ? "code-server.cmd" : "code-server"),
        // Fallback: check old workspace location for backwards compatibility
        join(workspaceDir, "code", "code-server", "bin", os === "windows" ? "code-server.cmd" : "code-server"),
      ];
    }
    case "dbgate":
      if (os === "darwin") {
        return [join(workspaceDir, "dbgate", "DbGate.app")];
      } else if (os === "windows") {
        return [join(workspaceDir, "dbgate", "dbgate.exe")];
      }
      return [join(binDir, "dbgate")];
    case "tunnel":
      return [join(binDir, `asd-tunnel${ext}`)];
    case "mitmproxy":
      return [join(binDir, `mitmproxy${ext}`)];
    case "busybox":
      // Busybox is Windows-only, check for both .exe and wrapper
      if (os === "windows") {
        return [join(binDir, "busybox.exe"), join(binDir, "bash.cmd")];
      }
      return [];
    default:
      return [join(binDir, `${name}${ext}`)];
  }
}

/**
 * Get list of all available binaries.
 * @function getAvailableBinaries
 * @returns {string[]}
 */
export function getAvailableBinaries() {
  return Object.keys(BINARY_CONFIGS);
}

/**
 * Get binary configuration.
 * @function getBinaryConfig
 * @param {string} name
 * @returns {BinaryConfig | undefined}
 */
export function getBinaryConfig(name) {
  return BINARY_CONFIGS[name];
}
