#!/usr/bin/env bun
// @ts-check
// modules/core/helpers/common.mjs
/** @module core/helpers/common */
import { join, dirname, isAbsolute } from "path";
import { tmpdir } from "os";
import { mkdir } from "fs/promises";
import { existsSync, mkdirSync, realpathSync } from "fs";
import { loadGlobalConfig, getAsdHome } from "./global-config.mjs";
import { getCliIcon } from "../assets/icons.mjs";

// Icon constants
const warnIcon = getCliIcon("cli.warn")?.glyph || "⚠️";

// Warning flags to prevent spam (show only once per session)
let pathMisconfigurationWarned = false;

// Re-export getAsdHome for convenience
export { getAsdHome };

/**
 * OS flag indicating Windows platform.
 * @const {boolean} isWin
 */
export const isWin = process.platform === "win32"

/**
 * Ensures a directory exists (mkdir -p semantics).
 * @function ensureDir
 * @param {string} p
 * @returns {Promise<string>} The same path.
 */
export async function ensureDir(p) {
  await mkdir(p, { recursive: true })
  return p
}

/**
 * Resolves module state directory within the workspace.
 * Always returns an absolute path.
 * @function moduleDir
 * @param {string} name - Module name.
 * @returns {string}
 */
export function moduleDir(name) {
  // Use resolveWorkspaceDir() for consistent absolute path resolution
  // This handles test sandboxes, relative paths, and all deployment modes
  return join(resolveWorkspaceDir(), name)
}

/**
 * Resolves a module binary path (adds .exe on Windows).
 * Always returns an absolute path.
 * Handles special cases like codeserver which has a different structure.
 * @function moduleBinPath
 * @param {string} moduleName
 * @param {string} [binName] - Binary name (defaults to moduleName)
 * @returns {string}
 */
export function moduleBinPath(moduleName, binName) {
  const ext = isWin ? ".exe" : ""

  // Special case: codeserver has a different directory structure
  // Binary-installer puts it in global data dir: ~/.local/share/asd/code-server/
  // Check global location first, fall back to workspace for backwards compatibility
  if (moduleName === "codeserver") {
    const binDir = resolveBinDir()
    const globalDataDir = dirname(binDir)
    const globalPath = join(globalDataDir, "code-server", "bin", `code-server${ext}`)
    if (existsSync(globalPath)) {
      return globalPath
    }
    // Fallback to legacy workspace location
    return join(
      resolveWorkspaceDir(),
      "code",
      "code-server",
      "bin",
      `code-server${ext}`,
    )
  }

  // Standard binaries live in bin directory
  const file = `${binName || moduleName}${ext}`
  return join(resolveBinDir(), file)
}

/**
 * Resolves the absolute path to the CLI entry point.
 * @function resolveCliEntry
 * @returns {string}
 */
export function resolveCliEntry() {
  // V2 uses bin/asd.ts, V1 used cli.ts
  return join(resolveAsdDir(), "bin", "asd.ts")
}

/**
 * Resolves the root modules directory.
 * @function getModulesRoot
 * @returns {string}
 */
export function getModulesRoot() {
  return join(resolveAsdDir(), "modules")
}

/**
 * Resolves a specific module directory.
 * @function getModule
 * @param {string} name
 * @returns {string}
 */
export function getModule(name) {
  return join(getModulesRoot(), name)
}

/**
 * @typedef {Object} ProjectTypeInfo
 * @property {"asd-yaml" | "git" | "none"} type - Detected project type
 * @property {boolean} hasAsdYaml - Whether asd.yaml exists
 * @property {boolean} hasAsdDir - Whether .asd/ directory exists
 * @property {boolean} hasGit - Whether .git/ directory exists
 */

/**
 * Detect project type at given path.
 * Checks for asd.yaml, .asd/ directory, and .git/ directory.
 * @function detectProjectType
 * @param {string} dir - Directory to check
 * @returns {ProjectTypeInfo}
 */
export function detectProjectType(dir) {
  const hasAsdYaml = existsSync(join(dir, "asd.yaml"));
  const hasAsdDir = existsSync(join(dir, ".asd"));
  const hasGit = existsSync(join(dir, ".git"));

  // Priority: asd-yaml > git > none
  if (hasAsdYaml) {
    return { type: "asd-yaml", hasAsdYaml, hasAsdDir, hasGit };
  }
  if (hasGit) {
    return { type: "git", hasAsdYaml, hasAsdDir, hasGit };
  }
  return { type: "none", hasAsdYaml, hasAsdDir, hasGit };
}

/**
 * Resolve the absolute project root that contains `.asd/`.
 * Walks up from cwd until a directory containing .asd is found.
 * @function resolveProjectRoot
 * @param {string} [startDir=process.cwd()]
 * @returns {string}
 */
export function resolveProjectRoot(startDir = process.cwd()) {
  const envRoot = process.env.PROJECT_DIR
  if (envRoot && existsSync(envRoot)) {
    // Apply same .asd detection logic to PROJECT_DIR
    // (handles case where PROJECT_DIR is set to .asd/ itself)
    if (envRoot.endsWith("/.asd") || envRoot.endsWith("\\.asd")) {
      // V1: main.just or cli.ts, V2: bin/asd.ts - this indicates we're inside .asd
      if (
        existsSync(join(envRoot, "main.just")) ||
        existsSync(join(envRoot, "cli.ts")) ||
        existsSync(join(envRoot, "bin", "asd.ts"))
      ) {
        // Only go up if parent is a REAL project (has its own asd.yaml OR its .asd subdir
        // points to a DIFFERENT directory than envRoot - not the same directory we're in)
        const parent = dirname(envRoot)
        const parentAsdDir = join(parent, ".asd")
        // A real parent project has .asd pointing elsewhere OR has asd.yaml
        const isRealParent = existsSync(parent) && (
          existsSync(join(parent, "asd.yaml")) ||
          (existsSync(parentAsdDir) && realpathSync(parentAsdDir) !== realpathSync(envRoot))
        )
        if (isRealParent) {
          return parent
        }
        // Standalone mode - we ARE the project root
        return envRoot
      }
    }
    return envRoot
  }

  let dir = startDir
  for (let i = 0; i < 50; i++) {
    // Standalone mode: if we are already inside .asd, go up one level
    try {
      if (dir.endsWith("/.asd") || dir.endsWith("\\.asd")) {
        // V1: main.just or cli.ts, V2: bin/asd.ts - this indicates we're inside .asd
        if (
          existsSync(join(dir, "main.just")) ||
          existsSync(join(dir, "cli.ts")) ||
          existsSync(join(dir, "bin", "asd.ts"))
        ) {
          // Only go up if parent is a REAL project (has its own asd.yaml OR its .asd subdir
          // points to a DIFFERENT directory than dir - not the same directory we're in)
          const parent = dirname(dir)
          const parentAsdDir = join(parent, ".asd")
          const isRealParent = existsSync(parent) && (
            existsSync(join(parent, "asd.yaml")) ||
            (existsSync(parentAsdDir) && realpathSync(parentAsdDir) !== realpathSync(dir))
          )
          if (isRealParent) {
            return parent
          }
          // Standalone mode - we ARE the project root
          return dir
        }
      }
    } catch {}
    // Normal case: project folder that contains a .asd directory
    if (existsSync(join(dir, ".asd"))) return dir
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return startDir
}

/**
 * Absolute path to the .asd directory.
 * @function resolveAsdDir
 * @param {string} [startDir=process.cwd()]
 * @returns {string}
 */
export function resolveAsdDir(startDir = process.cwd()) {
  // Prefer explicit environment variables if available
  const envExplicit = process.env.ASD_DIR_PATH || process.env.ASD_DIR
  if (envExplicit && existsSync(envExplicit)) return envExplicit

  // PROJECT_DIR can either be the project root or already be the .asd dir (standalone mode)
  const projectDir = process.env.PROJECT_DIR
  if (projectDir) {
    try {
      // If it already looks like .asd (has modules), return as-is
      if (existsSync(join(projectDir, "modules"))) return projectDir
      const maybe = join(projectDir, ".asd")
      if (existsSync(maybe)) return maybe
    } catch {}
  }

  const root = resolveProjectRoot(startDir)
  // If root itself is already .asd (standalone mode), don't append .asd
  if (existsSync(join(root, "modules"))) return root
  return join(root, ".asd")
}

/**
 * Absolute path to the workspace directory, ensuring it exists.
 * Priority: SANDBOX_DIR (test mode) > ASD_WORKSPACE_DIR > project/.asd/workspace or project/workspace
 * @function resolveWorkspaceDir
 * @param {string} [startDir=process.cwd()]
 * @returns {string}
 */
export function resolveWorkspaceDir(startDir = process.cwd()) {
  // 1) Sandbox/execution dir takes priority in test mode
  const sb = process.env.SANDBOX_DIR || process.env.EXECUTION_DIR
  if (sb && sb.trim()) {
    const dir = join(sb.trim(), ".asd", "workspace")
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return dir
  }

  // 2) Explicit env (resolve relative paths to absolute)
  const env = process.env.ASD_WORKSPACE_DIR || process.env.WORKSPACE_DIR
  const projectRoot = resolveProjectRoot(startDir)
  const asdDir = resolveAsdDir(startDir)
  let dir
  if (env && env.trim()) {
    const trimmed = env.trim()
    // If relative path, resolve from project root (not cwd)
    // Use isAbsolute() for cross-platform support (handles D:\ on Windows)
    if (!isAbsolute(trimmed)) {
      dir = join(projectRoot, trimmed)
    } else {
      dir = trimmed
    }
  } else {
    // 3) Determine workspace location based on installation mode
    // Check if project has a .asd submodule
    const projectAsdDir = join(projectRoot, ".asd")
    const hasLocalAsd = existsSync(projectAsdDir) && existsSync(join(projectAsdDir, "modules"))

    if (hasLocalAsd) {
      // Submodule mode: workspace in .asd/workspace (within the project)
      dir = join(projectAsdDir, "workspace")
    } else if (asdDir !== projectRoot && asdDir !== projectAsdDir) {
      // Global CLI mode: ASD_DIR points to CLI installation (e.g., /app or /usr/local/lib/asd)
      // Workspace should be in the project directory, not in the CLI installation
      dir = join(projectRoot, "workspace")
    } else {
      // Standalone mode or same directory: use asdDir/workspace
      dir = join(asdDir, "workspace")
    }
  }

  // Safeguard: detect doubled .asd paths which indicate misconfiguration
  // Skip check for GitHub Actions where repo is named ".asd"
  // Linux: /work/.asd/.asd or /home/runner/work/.asd/.asd
  // Windows: D:\a\.asd\.asd or similar
  const isGitHubAsdRepo =
    dir.includes("/work/.asd/.asd") ||
    dir.includes("\\work\\.asd\\.asd") ||
    /[A-Z]:\\a\\.asd\\.asd/i.test(dir)  // Windows: D:\a\.asd\.asd
  if (
    !isGitHubAsdRepo &&
    !pathMisconfigurationWarned &&
    (dir.includes(".asd/.asd") || dir.includes(".asd\\.asd"))
  ) {
    pathMisconfigurationWarned = true;
    console.error(`
╔════════════════════════════════════════════════════════════════════╗
║ ${warnIcon}  PATH MISCONFIGURATION DETECTED                                  ║
║                                                                    ║
║ Workspace path contains doubled ".asd/.asd" which is incorrect:   ║
║ ${dir.slice(0, 60)}${dir.length > 60 ? "..." : ""}
║                                                                    ║
║ This usually means stale env vars in .env file.                   ║
║ Check for: SANDBOX_DIR, EXECUTION_DIR, PROJECT_DIR                ║
║                                                                    ║
║ Quick fix: Remove these vars from .env or run:                    ║
║   grep -vE "^(SANDBOX_DIR|EXECUTION_DIR|PROJECT_DIR)=" .env > .env.tmp && mv .env.tmp .env
╚════════════════════════════════════════════════════════════════════╝
`)
  }

  // Auto-create workspace structure with common subdirectories
  const subdirs = ["logs", "network", "tunnels"];
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    // Create standard subdirectories
    for (const subdir of subdirs) {
      const subpath = join(dir, subdir);
      if (!existsSync(subpath)) {
        mkdirSync(subpath, { recursive: true });
      }
    }
  }
  return dir;
}

/**
 * Absolute path to the legacy Caddy config dir.
 * @function resolveCaddyConfigDir
 * @returns {string}
 */
export function resolveCaddyConfigDir() {
  return join(resolveAsdDir(), "config")
}

/**
 * Absolute path to the project-level .asd.json file.
 * @function resolveAsdJson
 * @returns {string}
 */
export function resolveAsdJson() {
  return join(resolveProjectRoot(), ".asd.json")
}

/**
 * Resolve the global bin directory for centralized binaries.
 * - Linux: $XDG_DATA_HOME/asd/bin or ~/.local/share/asd/bin
 * - macOS: ~/Library/Application Support/asd/bin
 * - Windows: %LOCALAPPDATA%/asd/bin
 * @function resolveGlobalBinDir
 * @returns {string}
 */
export function resolveGlobalBinDir() {
  return join(getAsdHome(), "bin");
}

/**
 * Get the configured bin location preference.
 * Priority: ASD_BIN_LOCATION env > global config > default ("global")
 * @function getBinLocation
 * @returns {"global" | "workspace"}
 */
export function getBinLocation() {
  // Priority: env var > global config > default
  const env = process.env.ASD_BIN_LOCATION;
  if (env === "workspace" || env === "global") return env;

  // Check global config
  const config = loadGlobalConfig();
  const configValue = config?.preferences?.bin_location;
  if (configValue === "workspace" || configValue === "global") return configValue;

  // Default: global (centralized binaries)
  return "global";
}

/**
 * Absolute path to the bin directory (for downloaded binaries).
 * Priority: ASD_BIN_DIR env > ASD_BIN_LOCATION config > default global
 * @function resolveBinDir
 * @returns {string}
 */
export function resolveBinDir() {
  // First priority: explicit ASD_BIN_DIR env var (used in CI/workflows)
  const explicitDir = process.env.ASD_BIN_DIR;
  if (explicitDir && explicitDir.trim()) {
    // Don't create - CI installs binaries there, we just read from it
    return explicitDir.trim();
  }

  const location = getBinLocation();

  if (location === "workspace") {
    // Per-project workspace bin (legacy behavior)
    const workspace = resolveWorkspaceDir();
    const binDir = join(workspace, "bin");
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    return binDir;
  }

  // Default: global bin directory
  const globalBin = resolveGlobalBinDir();
  if (!existsSync(globalBin)) mkdirSync(globalBin, { recursive: true });
  return globalBin;
}

/**
 * Resolve path to bundled binary for current platform.
 * Checks for pre-compiled binary in dist/bin/<os>-<arch>/ first,
 * then falls back to global bin directory.
 *
 * Platform mapping:
 * - process.platform: linux, darwin, win32
 * - process.arch: x64, arm64
 *
 * Binary naming convention in dist/bin/:
 * - linux-amd64/asd-tunnel
 * - linux-arm64/asd-tunnel
 * - darwin-amd64/asd-tunnel
 * - darwin-arm64/asd-tunnel
 * - windows-amd64/asd-tunnel.exe
 *
 * @function resolveBundledBinary
 * @param {string} name - Binary name (e.g., "asd-tunnel")
 * @returns {string | null} Absolute path to binary, or null if not found
 */
export function resolveBundledBinary(name) {
  const platform = process.platform; // linux, darwin, win32
  const arch = process.arch; // x64, arm64

  // Map Node.js platform/arch to our naming convention
  const osMap = { linux: "linux", darwin: "darwin", win32: "windows" };
  const archMap = { x64: "amd64", arm64: "arm64" };

  const os = osMap[platform];
  const cpuArch = archMap[arch];

  if (!os || !cpuArch) {
    // Unsupported platform, fallback to global bin
    const fallback = join(resolveBinDir(), isWin ? `${name}.exe` : name);
    return existsSync(fallback) ? fallback : null;
  }

  const ext = platform === "win32" ? ".exe" : "";

  // Check bundled location first (within the package)
  const asdDir = resolveAsdDir();
  const bundledPath = join(asdDir, "dist", "bin", `${os}-${cpuArch}`, `${name}${ext}`);

  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  // Fallback to global bin directory
  const globalPath = join(resolveBinDir(), `${name}${ext}`);
  if (existsSync(globalPath)) {
    return globalPath;
  }

  // Fallback to workspace bin (legacy location)
  const workspacePath = join(resolveWorkspaceDir(), "bin", `${name}${ext}`);
  if (existsSync(workspacePath)) {
    return workspacePath;
  }

  // Binary not found
  return null;
}

/**
 * Check if a bundled binary exists for the current platform.
 * @function hasBundledBinary
 * @param {string} name - Binary name (e.g., "asd-tunnel")
 * @returns {boolean}
 */
export function hasBundledBinary(name) {
  return resolveBundledBinary(name) !== null;
}

/**
 * Absolute path to a workspace log file.
 * @function resolveLogPath
 * @param {string} filename
 * @returns {string}
 */
export function resolveLogPath(filename) {
  const workspace = resolveWorkspaceDir()
  const logsDir = join(workspace, "logs")
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })
  return join(logsDir, filename)
}

/**
 * Workspace directory resolution specifically for logging contexts.
 * Always returns an absolute path.
 * @function resolveWorkspaceDirForLogs
 * @param {{ jsonFilePath?: string }} [opts]
 * @returns {string}
 */
export function resolveWorkspaceDirForLogs(opts = {}) {
  const jsonFilePath =
    opts && typeof opts === "object" ? opts.jsonFilePath : undefined

  // 1) Sandbox/execution dir takes priority in test mode
  const sb = process.env.SANDBOX_DIR || process.env.EXECUTION_DIR
  if (sb && sb.trim()) return join(sb.trim(), "workspace")

  // 2) Explicit env (resolve relative paths to absolute)
  const envWs = process.env.ASD_WORKSPACE_DIR
  if (envWs && envWs.trim()) {
    const trimmed = envWs.trim()
    // Use isAbsolute() for cross-platform support (handles D:\ on Windows)
    if (!isAbsolute(trimmed)) {
      // Relative path - resolve from project root
      return join(resolveProjectRoot(), trimmed)
    }
    return trimmed
  }

  // 3) JSON file location (menu configs)
  if (jsonFilePath && String(jsonFilePath).trim())
    return join(dirname(String(jsonFilePath).trim()), ".asd", "workspace")

  // 4) OS tmp
  return join(tmpdir(), `asd-workspace-${process.pid}`)
}

/**
 * Check if Docker is available and accessible.
 * @function isDockerAvailable
 * @param {number} [timeoutMs=3000] - Timeout in milliseconds
 * @returns {Promise<boolean>}
 */
export async function isDockerAvailable(timeoutMs = 3000) {
  try {
    const proc = Bun.spawn(["docker", "info"], {
      stdout: "ignore",
      stderr: "ignore",
    })
    // Race against timeout to prevent hanging in CI when Docker is unavailable
    const result = await Promise.race([
      proc.exited.then((code) => code === 0),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ])
    // Kill process if it's still running after timeout
    try {
      proc.kill()
    } catch {
      // Process may have already exited
    }
    return result
  } catch {
    return false
  }
}

/**
 * Environment variables that should NOT be set in .env files.
 * These are runtime/test artifacts that can cause path resolution issues.
 */
const FORBIDDEN_ENV_VARS = [
  "SANDBOX_DIR",
  "EXECUTION_DIR",
  // PROJECT_DIR is allowed in some contexts but not when it points to .asd/
]

/**
 * Validate environment configuration and warn about common issues.
 * Call this during CLI startup to catch misconfigurations early.
 * @function validateEnvironment
 * @param {{ silent?: boolean }} [opts]
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateEnvironment(opts = {}) {
  const warnings = []
  const silent = opts.silent ?? false

  // Check for stale test env vars
  for (const key of FORBIDDEN_ENV_VARS) {
    const val = process.env[key]
    if (val) {
      warnings.push(
        `${key} is set to "${val}" - this may cause path resolution issues. ` +
          `Remove it from .env if present.`,
      )
    }
  }

  // Check if PROJECT_DIR points to .asd/ directory (common misconfiguration)
  const projectDir = process.env.PROJECT_DIR
  if (
    projectDir &&
    (projectDir.endsWith("/.asd") || projectDir.endsWith("\\.asd"))
  ) {
    warnings.push(
      `PROJECT_DIR="${projectDir}" points to .asd/ directory. ` +
        `This should point to the project root, not the .asd subdirectory.`,
    )
  }

  // Validate workspace path doesn't have doubled .asd
  // Skip check for GitHub Actions where repo is named ".asd" (creates /work/.asd/.asd)
  try {
    const ws = resolveWorkspaceDir()
    const isGitHubAsdRepo = ws.includes("/work/.asd/.asd")
    if (
      !isGitHubAsdRepo &&
      (ws.includes(".asd/.asd") || ws.includes(".asd\\.asd"))
    ) {
      warnings.push(
        `Workspace path "${ws}" contains doubled ".asd/.asd" - check env configuration.`,
      )
    }
  } catch {
    // Ignore errors during validation
  }

  // Print warnings unless silent
  if (!silent && warnings.length > 0) {
    console.warn(`\n${warnIcon}  Environment configuration warnings:`)
    for (const w of warnings) {
      console.warn(`   • ${w}`)
    }
    console.warn("")
  }

  return { valid: warnings.length === 0, warnings }
}
