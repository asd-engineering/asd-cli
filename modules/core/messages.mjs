#!/usr/bin/env bun
// @ts-check
/** @module core/messages */

// Simple centralized message catalog with tiny templating.
// Intentionally minimal to enable future i18n/a11y upgrades.

const CATALOG = {
  // Generic
  ERR_MISSING_ENV: "Missing required environment variables: {vars}",
  ERR_INVALID_ENV_VALUE: "Invalid value for {name}: '{value}'{reason}",
  ERR_ENV_FILE_NOT_FOUND: "Dotenv file not found at {path}",
  ERR_ENV_KEY_MISSING: "Missing env key '{key}' in {path}",

  // Common domain messages
  ERR_PORT_NAN: "Port must be a number",
  ERR_PREFIX_REQUIRED: "Prefix required (for HTTP named -R)",
  ERR_REMOTE_PORT_INVALID: "Invalid remote bind port",

  // Caddy
  ERR_MISSING_ASD_WORKSPACE_DIR: "Missing ASD_WORKSPACE_DIR",
  ERR_MISSING_ASD_PROJECT_HOST: "Missing ASD_PROJECT_HOST",
  ERR_MISSING_CADDY_PORT_HTTP: "Missing ASD_CADDY_PORT_HTTP",
  ERR_MISSING_CADDY_PORT_HTTPS: "Missing ASD_CADDY_PORT_HTTPS",
  ERR_INVALID_PORT: "Invalid port for {name}: {value}",

  // Misc
  INFO_SAVED_ENV: "Saved {key} to .env",
  ERR_GENERIC: "{message}",
  ERR_MISSING_BINARY: "Missing required binary at {path}",
  ERR_PROTECTED_PORT: "Protected ports detected ({ports}): {message}",
  ERR_HTTP_SERVER_START: "Failed to start HTTP server: {reason}",
  ERR_UNKNOWN_COMMAND: "Unknown command '{cmd}'",
  ERR_JSON_LOAD_FAILED: "Failed to load JSON file at {path}: {reason}",
  ERR_CADDY_API_ERROR: "Caddy API error: {context} ({status})",
  ERR_CADDY_STATIC_DIRS:
    "Missing --config-dir or --services-dir for static config",
  ERR_NO_NETWORK_SPEC: "No network spec provided",
  ERR_CADDY_ONBOARD_ARGS: "runCaddyOnboard requires both 'port' and 'name'.",
  ERR_TUNNEL_VERIFY_FAILED: "Tunnel onboarding aborted: {reason}",
  ERR_TUNNEL_START_FAILED: "Failed to start tunnel process.",
  ERR_ONBOARD_FAILED_FOR: "Onboarding failed for {name}: {reason}",
  ERR_DOCKER_DETECT_FAILED: "Docker detection failed: {reason}",
  // Registry / Schema
  ERR_SCHEMA_VALIDATION: "Schema validation failed for {label}: {reason}",
  ERR_REGISTRY_LOCK_TIMEOUT:
    "Could not acquire registry lock at {path} (waited {ms}ms)",
  ERR_REGISTRY_WRITE_FAILED: "Failed to update service registry: {reason}",
  WARN_INVALID_SELECTION: "Invalid selection. Try again.",
  WARN_ENTER_NUMBER: "⚠️ Enter a number.",
  INFO_NO_SERVICES:
    "\n✅ No active services right now.\n👉 Start an HTTP service and run me again to get going!\n",
  ERR_MISSING_TUNNEL_ENV:
    "Missing env for tunnel: ASD_CLIENT_ID or ASD_TUNNEL_HOST",
  ERR_TUNNEL_TIMEOUT: "Tunnel {url} did not respond in time",
  ERR_HUB_URLS_REQUIRED: "Either ASD_TTYD_URL or ASD_CADDY_URL must be set",
  WARN_WORKSPACE_DIR_UNSET:
    "⚠️  ASD_WORKSPACE_DIR is not set. Skipping .hub file write.",
}

/**
 * Applies `{key}` parameter substitutions to a template string.
 * @function applyParams
 * @param {string} str - The template string.
 * @param {Record<string, any>} [params={}] - Values to substitute.
 * @returns {string}
 */
function applyParams(str, params = {}) {
  if (!params) return str
  return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "")
}

/**
 * Translates a message code into a formatted string.
 * @function t
 * @param {string} code - The message code from the CATALOG.
 * @param {Record<string, string|number>} [params] - Values to substitute into the message template.
 * @returns {string} The formatted message.
 */
export function t(code, params) {
  const tpl = CATALOG[code] || code
  return applyParams(tpl, params)
}

/**
 * Throws an error with a formatted message.
 * @function fail
 * @param {string} code - The message code from the CATALOG.
 * @param {Record<string, string|number>} [params] - Values to substitute into the message template.
 */
export function fail(code, params) {
  throw new Error(t(code, params))
}

/**
 * Returns a formatted informational message.
 * @function info
 * @param {string} code - The message code from the CATALOG.
 * @param {Record<string, string|number>} [params] - Values to substitute into the message template.
 * @returns {string} The formatted message.
 */
export function info(code, params) {
  return t(code, params)
}

// Small helpers used by env validators
/**
 * Validates if a value is a valid TCP/IP port number.
 * @function isPort
 * @param {string|number} v - The value to check.
 * @returns {true|string} Returns `true` if valid, otherwise an error message string.
 */
export function isPort(v) {
  const n = Number(v)
  return (Number.isInteger(n) && n > 0 && n <= 65535) || "not a valid port"
}
