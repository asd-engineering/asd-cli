#!/usr/bin/env bun
// @ts-check
// Centralized timing/tuning constants for the ASD CLI

// General tiny timers
// CI environments are slower than local; Codex is extremely slow
const isCI = process.env.CI === "true"
const isCodex = !!process.env.CODEX_PROXY_CERT
export const SLOW_ENV_FACTOR = isCodex ? 10 : isCI ? 2 : 1
export const PROMPT_POLL_MS = 10
export const SLEEP_SHORT_MS = 50
export const STARTUP_HEALTHCHECK_DELAY_MS = 50
export const BG_PROC_EXIT_WAIT_MS = 100 * SLOW_ENV_FACTOR

// Environment-aware test timing (CI vs local)
// CI environments are slower, so we use higher timeouts/delays
export const IS_CI = process.env.CI === "true"
export const TEST_CADDY_STARTUP_DELAY_MS = IS_CI ? 3000 : 1000
export const TEST_CADDY_WAITFOR_TIMEOUT_MS = IS_CI ? 10000 : 5000
export const TEST_INTEGRATION_TIMEOUT_HIGH_S = 15 // Allow 15s for heavy integration tests

// HTTP polling defaults
export const HTTP_WAIT_TIMEOUT_MS = 200 * SLOW_ENV_FACTOR
export const HTTP_WAIT_INTERVAL_MS = 50

// TCP port polling defaults
export const PORT_WAIT_TIMEOUT_MS = 200 * SLOW_ENV_FACTOR
export const PORT_WAIT_INTERVAL_MS = 50

// Log pattern polling defaults
export const LOG_WAIT_TIMEOUT_MS = 200 * SLOW_ENV_FACTOR
export const LOG_WAIT_POLL_MS = 50

// Generic poll-until-available defaults (automation)
export const POLL_UNTIL_AVAILABLE_TIMEOUT_MS = 3000 * SLOW_ENV_FACTOR
export const POLL_UNTIL_AVAILABLE_INTERVAL_MS = 100
export const QUICK_POLL_TIMEOUT_MS = 100 * SLOW_ENV_FACTOR

// Process termination grace periods
export const KILL_GENTLE_MS_DEFAULT = 100 * SLOW_ENV_FACTOR // general gentle wait
export const KILL_GENTLE_MS_SIGINT = 200 * SLOW_ENV_FACTOR // when stopping on SIGINT semantics
export const KILL_GENTLE_MS_STOP_DAEMON = 600 * SLOW_ENV_FACTOR // extra grace on explicit stop

// Network verification specific timeouts
export const NET_VERIFY_POLL_TIMEOUT_MS = 3000 * SLOW_ENV_FACTOR
export const NET_UI_OPEN_TIMEOUT_MS = 400 * SLOW_ENV_FACTOR
export const NET_UI_TUNNEL_TIMEOUT_MS = 500 * SLOW_ENV_FACTOR

// Tunnels
// Tunnels can take a bit longer in CI; keep within typical test timeHigh
export const WAIT_FOR_TUNNEL_TIMEOUT_MS = 6000 * SLOW_ENV_FACTOR

// Health check timeouts
export const HEALTH_CHECK_CUSTOM_TIMEOUT_MS =
  Number(process.env.ASD_HEALTH_CUSTOM_TIMEOUT_MS) || 1000 // 1s for custom shell scripts
export const HEALTH_CHECK_HTTP_TIMEOUT_MS =
  Number(process.env.ASD_HEALTH_HTTP_TIMEOUT_MS) || 500 // 500ms for HTTP checks

// Health markers
export const RECENT_HEALTHY_MS = 5 * 60 * 1000 // 5 minutes

// Reporting/sandbox limits (migrated from constants.mjs)
export const LOG_TAIL_MAX_BYTES = 128 * 1024 // 128KB
export const LOG_TAIL_MAX_LINES = 2000
export const FILE_HEAD_MAX_BYTES = 16 * 1024 // 16KB
export const FILE_TAIL_MAX_BYTES = 64 * 1024 // 64KB
export const SANDBOX_MAX_FILES = 200 // non-log files captured
export const SANDBOX_MAX_LOGS = 50 // logs discovered under workspace/logs
export const SANDBOX_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // skip files > 5MB
export const SANDBOX_MAX_LOG_FILE_BYTES =
  Number(process.env.ASD_SANDBOX_MAX_LOG_BYTES) || 10 * 1024 * 1024 // 10MB default, adjustable via env
export const SANDBOX_EXCLUDE_DIRS = [
  ".git",
  "node_modules",
  "local",
  "codeserver",
  "code-server",
  ".cache",
  "test-runs", // Exclude test reports to prevent recursive artifact copies
  "test-sandbox", // Exclude test sandboxes to prevent recursive copies
  "bin", // Exclude binaries (large files, not useful in reports)
  "logs", // Exclude logs directory (can be GB in size)
]
export const TEXT_EXT_ALLOWLIST = [
  ".log",
  ".out",
  ".err",
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".config",
  ".env",
  ".sh",
  ".bash",
  ".zsh",
  ".caddy",
  ".conf.d",
]
export const LOG_DIR_NAME = "logs"
