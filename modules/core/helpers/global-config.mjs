// @ts-check
/** @module core/helpers/global-config */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { homedir, platform } from "os"
import { join } from "path"
import { parse, stringify } from "yaml"

/**
 * @typedef {Object} GlobalConfig
 * @property {number} [version]
 * @property {Object} [preferences]
 * @property {boolean} [preferences.auto_install_binaries]
 * @property {"global" | "workspace"} [preferences.bin_location] - Where to install binaries: "global" (default) or "workspace"
 * @property {string[]} [preferences.skip_binaries] - Module names to skip during binary installation
 * @property {boolean} [preferences.show_auth_in_urls] - Show basic auth credentials in URLs (default: true)
 * @property {Object} [tui]
 * @property {"honeywell" | "minimal"} [tui.borderStyle] - TUI table border style: "honeywell" (default, with borders) or "minimal" (no borders)
 * @property {Object} [system]
 * @property {string} [system.bash_path] - Windows: path to bash executable (Git Bash or Busybox)
 * @property {"path" | "git-bash" | "busybox"} [system.bash_source] - Where bash was detected
 */

/**
 * Get the consolidated ASD home directory.
 * All global ASD data (config, binaries, registry) lives in ONE directory per OS.
 *
 * - Linux: $XDG_DATA_HOME/asd or ~/.local/share/asd
 * - macOS: ~/Library/Application Support/asd
 * - Windows: %LOCALAPPDATA%/asd
 *
 * Can be overridden with ASD_HOME environment variable.
 *
 * @function getAsdHome
 * @returns {string} Path to ASD home directory
 */
export function getAsdHome() {
  // Allow override via environment
  const envHome = process.env.ASD_HOME;
  if (envHome && envHome.trim()) {
    return envHome.trim();
  }

  const home = homedir();
  const os = platform();

  if (os === "win32") {
    // Windows: use LOCALAPPDATA
    const localAppData =
      process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    return join(localAppData, "asd");
  }

  if (os === "darwin") {
    // macOS: use Application Support
    return join(home, "Library", "Application Support", "asd")
  }

  // Linux/Unix: use XDG_DATA_HOME or ~/.local/share
  const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
  return join(xdgData, "asd");
}

/**
 * Get the global config directory based on OS.
 * @deprecated Use getAsdHome() - config now lives in consolidated ASD home
 * @returns {string} Path to global config directory (same as ASD home)
 */
export function getGlobalConfigDir() {
  return getAsdHome();
}

/**
 * Get the global data directory based on OS.
 * @deprecated Use getAsdHome() - data now lives in consolidated ASD home
 * @returns {string} Path to global data directory (same as ASD home)
 */
export function getGlobalDataDir() {
  return getAsdHome();
}

/**
 * Get the full path to the global config file.
 * @returns {string} Path to config.yaml
 */
export function getGlobalConfigPath() {
  return join(getAsdHome(), "config.yaml");
}

/**
 * Load the global config file.
 * Returns empty object if file doesn't exist.
 * @returns {GlobalConfig} Parsed config or empty object
 */
export function loadGlobalConfig() {
  const configPath = getGlobalConfigPath()

  if (!existsSync(configPath)) {
    return {}
  }

  try {
    const content = readFileSync(configPath, "utf8")
    const config = parse(content)
    return config || {}
  } catch (err) {
    // Silently return empty on parse errors
    return {}
  }
}

/**
 * Save the global config file.
 * Creates the directory if it doesn't exist.
 * @param {GlobalConfig} config - Config to save
 */
export function saveGlobalConfig(config) {
  const configDir = getAsdHome();
  const configPath = getGlobalConfigPath();

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  // Ensure version is set
  const toWrite = {
    version: 1,
    ...config,
  }

  const content = stringify(toWrite, { indent: 2 })
  writeFileSync(configPath, content, "utf8")
}

/**
 * Get a single setting from global config.
 * @param {string} key - Setting key (supports dot notation for nested: "preferences.auto_install_binaries")
 * @param {any} [defaultValue] - Default value if not found
 * @returns {any} Setting value or default
 */
export function getGlobalSetting(key, defaultValue) {
  const config = loadGlobalConfig()

  // Support dot notation for nested keys
  const parts = key.split(".")
  let value = config

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = value[part]
    } else {
      return defaultValue
    }
  }

  return value
}

/**
 * Set a single setting in global config.
 * @param {string} key - Setting key (supports dot notation)
 * @param {any} value - Value to set
 */
export function setGlobalSetting(key, value) {
  const config = loadGlobalConfig()

  // Support dot notation for nested keys
  const parts = key.split(".")
  let current = config

  // Navigate/create nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {}
    }
    current = current[part]
  }

  // Set the final value
  current[parts[parts.length - 1]] = value

  saveGlobalConfig(config)
}

/**
 * Clear the global config cache (for testing).
 * Currently a no-op since we don't cache.
 */
export function clearGlobalConfigCache() {
  // No-op for now - add caching later if needed
}

/**
 * Get the show_auth_in_urls preference.
 * Priority: global config > default (true)
 * Note: asd.yaml features.show_auth_in_urls takes precedence over this in api.menu.mjs
 * @returns {boolean} Whether to show auth credentials in URLs
 */
export function getShowAuthInUrlsPreference() {
  const config = loadGlobalConfig()
  const value = config?.preferences?.show_auth_in_urls
  // Default to true if not set
  return typeof value === "boolean" ? value : true
}

/**
 * Get the TUI border style preference.
 * @function getTuiBorderStyle
 * @returns {"honeywell" | "minimal"} Border style: "honeywell" (with borders) or "minimal" (no borders)
 */
export function getTuiBorderStyle() {
  return getGlobalSetting("tui.borderStyle", "honeywell")
}

/**
 * Get the detect_services preference.
 * Priority: global config > undefined (not yet set)
 * @function getDetectServicesPreference
 * @returns {boolean | undefined} Whether to auto-detect services, or undefined if not set
 */
export function getDetectServicesPreference() {
  return getGlobalSetting("preferences.detect_services", undefined)
}

/**
 * Set the detect_services preference.
 * @function setDetectServicesPreference
 * @param {boolean} value - Whether to auto-detect services
 */
export function setDetectServicesPreference(value) {
  setGlobalSetting("preferences.detect_services", value)
}
