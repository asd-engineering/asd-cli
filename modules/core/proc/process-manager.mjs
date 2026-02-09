#!/usr/bin/env bun
// @ts-check
// modules/core/proc/process-manager.mjs
// Unified, minimal-but-powerful process control for the ASD CLI (Bun).
// Features:
// - Foreground and daemon modes
// - PID file management (stale detection & cleanup)
// - Process group termination (TERM -> KILL escalation)
// - Log file routing (append) with optional console tee (foreground only)
// - Readiness: HTTP 2xx-4xx, TCP port connect, log regex
// - Retry on crash during warmup via minUptimeMs, simple restartPolicy
// - Linux-only "lease" reaper: kill any detached process carrying ASD_RUN_LEASE
//
// Design goals:
// - Small surface, explicit options, portable (Linux-first), no hidden daemons
// - Works with absolute binary path or PATH lookup (via `which`)

import {
  open,
  writeFile,
  readFile,
  rm,
  mkdir,
  stat,
  readdir,
} from "fs/promises"
import { existsSync } from "fs"
import { dirname, isAbsolute } from "path"
import { spawn, spawnSync } from "bun:child_process"
import net from "node:net"
import {
  HTTP_WAIT_TIMEOUT_MS,
  HTTP_WAIT_INTERVAL_MS,
  PORT_WAIT_TIMEOUT_MS,
  PORT_WAIT_INTERVAL_MS,
  LOG_WAIT_TIMEOUT_MS,
  LOG_WAIT_POLL_MS,
  KILL_GENTLE_MS_DEFAULT,
  STARTUP_HEALTHCHECK_DELAY_MS,
} from "../constant.mjs"
import { getCliIcon } from "../assets/icons.mjs"

// Icon constants
const infoIcon = getCliIcon("cli.info")?.glyph || "ℹ️"
const warnIcon = getCliIcon("cli.warn")?.glyph || "⚠️"

const td = new TextDecoder()
/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isLinux = process.platform === "linux"
const isWin = process.platform === "win32"

/**
 * Async check if a filesystem path exists.
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function pathExists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

/**
 * Treat 2xx-4xx HTTP codes as okay for readiness.
 * @param {number} code
 * @returns {boolean}
 */
function okStatus(code) {
  return code >= 200 && code < 500 // treat 401/403/404 as ready-enough admin endpoints
}

/**
 * Probe an HTTP endpoint for readiness.
 * @param {string} url
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function waitForHTTP(
  url,
  { timeoutMs = HTTP_WAIT_TIMEOUT_MS, intervalMs = HTTP_WAIT_INTERVAL_MS } = {},
) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" })
      if (okStatus(res.status)) return true
    } catch {
      // HTTP request failed - service not ready yet
    }
    await sleep(intervalMs)
  }
  return false
}

/**
 * Probe a TCP port for readiness.
 * @param {{ host?: string, port: number }} target
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function waitForPort(
  { host = "127.0.0.1", port },
  { timeoutMs = PORT_WAIT_TIMEOUT_MS, intervalMs = PORT_WAIT_INTERVAL_MS } = {},
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.createConnection({ host, port })
      const onOk = () => {
        socket.destroy()
        resolve(true)
      }
      const onErr = () => {
        socket.destroy()
        resolve(false)
      }
      socket.once("connect", onOk)
      socket.once("error", onErr)
      setTimeout(() => {
        try {
          socket.destroy()
        } catch {
          // Socket already destroyed - cleanup
        }
      }, intervalMs)
    })
    if (ok) return true
    await sleep(intervalMs)
  }
  return false
}

/**
 * Tail a log file until a regex appears or timeout.
 * @param {string} logFile
 * @param {RegExp} regex
 * @param {{ timeoutMs?: number, pollMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
async function waitForLogPattern(
  logFile,
  regex,
  { timeoutMs = LOG_WAIT_TIMEOUT_MS, pollMs = LOG_WAIT_POLL_MS } = {},
) {
  const deadline = Date.now() + timeoutMs
  let offset = 0
  while (Date.now() < deadline) {
    try {
      const buf = await Bun.file(logFile).arrayBuffer()
      const text = new TextDecoder().decode(buf)
      const slice = text.slice(offset)
      offset = text.length
      if (regex.test(slice)) return true
    } catch {
      // Log file not ready yet - keep polling
    }
    await sleep(pollMs)
  }
  return false
}

/**
 * Resolve a binary path via which/where if necessary.
 * @param {string} binaryOrPath
 * @returns {string|null}
 */
function resolveBinary(binaryOrPath) {
  if (!binaryOrPath) return null
  // Use isAbsolute() for cross-platform support (handles both / and \ paths)
  if (isAbsolute(binaryOrPath) && existsSync(binaryOrPath))
    return binaryOrPath

  // Platform-specific PATH lookup
  if (isWin) {
    // Windows: use 'where' command
    const out = spawnSync("where", [binaryOrPath], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    const path = td.decode(out.stdout).trim().split(/\r?\n/)[0] // Take first result
    return path || null
  }

  // Unix: use bash -c (not -lc) to avoid profile scripts resetting PATH
  // which can cause binary resolution failures on self-hosted runners
  const out = spawnSync("bash", ["-c", `which ${binaryOrPath} || true`], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  const path = td.decode(out.stdout).trim()
  return path || null
}

/**
 * Ensure directory for a file path exists.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function ensureFileDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

// ---------- Process group handling ----------
/**
 * Check if a process id is alive.
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Kill a process and optionally its group with TERM then KILL.
 * @param {number} pid
 * @param {{ gentleMs?: number, killGroup?: boolean }} [opts]
 * @returns {Promise<void>}
 */
async function killProcessTree(
  pid,
  { gentleMs = KILL_GENTLE_MS_DEFAULT, killGroup = true } = {},
) {
  if (isWin) {
    // Windows: use taskkill for process termination
    // /T = terminate child processes (tree kill)
    // /F = force termination
    try {
      const args = killGroup ? ["/PID", String(pid), "/T"] : ["/PID", String(pid)]
      spawnSync("taskkill", args, { stdio: "ignore" })
    } catch {
      // Process may have exited
    }
    await sleep(gentleMs)
    try {
      const args = killGroup ? ["/PID", String(pid), "/T", "/F"] : ["/PID", String(pid), "/F"]
      spawnSync("taskkill", args, { stdio: "ignore" })
    } catch {
      // Process may have exited
    }
    return
  }

  // Unix: use signals for process termination
  // All kills wrapped in try-catch: process may have exited between checks
  try {
    if (killGroup) process.kill(-pid, "SIGTERM")
  } catch {
    // Process group may not exist
  }
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // Process may have exited
  }
  await sleep(gentleMs)
  try {
    if (killGroup) process.kill(-pid, "SIGKILL")
  } catch {
    // Process group may not exist
  }
  try {
    process.kill(pid, "SIGKILL")
  } catch {
    // Process may have exited
  }
}

// ---------- Linux lease reaper ----------
/**
 * Linux-only: check if a process carries a given env lease key=value.
 * @param {number} pid
 * @param {string} key
 * @param {string} val
 * @returns {Promise<boolean>}
 */
async function _procHasLease(pid, key, val) {
  if (!isLinux) return false
  try {
    const buf = await Bun.file(`/proc/${pid}/environ`).arrayBuffer()
    const txt = new TextDecoder().decode(buf)
    const kv = `${key}=${val}`
    return txt.split("\0").includes(kv)
  } catch {
    return false
  }
}

/**
 * Linux-only: reap detached processes carrying a lease env var.
 * @param {{ key:string, value:string, excludePids?: number[] }} opts
 * @returns {Promise<Array<{pid:number, cmdline:string}>>}
 */
async function reapByEnv(
  { key = "", value = "", excludePids = /** @type {number[]} */ ([]) } = {
    key: "",
    value: "",
    excludePids: [],
  },
) {
  if (!isLinux) return []
  const victims = []
  const skip = new Set(excludePids || [])
  let dirents = []
  try {
    dirents = await readdir("/proc", { withFileTypes: true })
  } catch {
    return victims
  }
  for (const d of dirents) {
    if (!d.isDirectory()) continue
    const pid = Number(d.name)
    if (!Number.isFinite(pid) || pid < 2) continue
    if (skip.has(pid)) continue
    if (!(await _procHasLease(pid, key, value))) continue

    try {
      await killProcessTree(pid, {
        gentleMs: KILL_GENTLE_MS_DEFAULT,
        killGroup: !isWin,
      })
      let cmd = ""
      try {
        const out = spawnSync(
          "bash",
          ["-lc", `tr '\\0' ' ' </proc/${pid}/cmdline 2>/dev/null`],
          {
            stdio: ["ignore", "pipe", "pipe"],
          },
        )
        cmd = td.decode(out.stdout).trim()
      } catch {
        // cmdline may not be readable - process may have exited
      }
      victims.push({ pid, cmdline: cmd })
    } catch {
      // kill() may fail if process exited between discovery and kill
    }
  }
  return victims
}

// ---------- Core manager ----------
/**
 * ProcessManager provides foreground and daemon process control with readiness.
 */
export class ProcessManager {
  /**
   * Readiness predicates the manager waits for after starting a daemon.
   * @typedef {Object} Readiness
   * @property {string|string[]} [http]
   * @property {{ host: string, port: number }|Array<{host:string,port:number}>} [port]
   * @property {{ file: string, regex: RegExp|string, timeoutMs?: number }} [log]
   * @property {{ timeoutMs?: number, intervalMs?: number }} [httpOptions]
   * @property {{ timeoutMs?: number, intervalMs?: number }} [portOptions]
   */

  /**
   * Options accepted by startDaemon to control spawn, logging and readiness.
   * @typedef {Object} StartDaemonOptions
   * @property {string} [name]
   * @property {string} binary
   * @property {string[]} [args]
   * @property {NodeJS.ProcessEnv} [env]
   * @property {string} [cwd]
   * @property {string} pidFile
   * @property {string} logFile
   * @property {Readiness} [readiness]
   * @property {number} [minUptimeMs]
   * @property {"never"|"on-failure"} [restartPolicy]
   */
  /**
   * Start a **daemon** (detached) and (optionally) wait for readiness.
   * Returns { status, pid, alive, ready }.
   */
  /**
   * Start a daemon and wait for optional readiness.
   * @param {StartDaemonOptions} [opts]
   * @returns {Promise<{ status:'started'|'already-running'|'failed', pid:number, alive:boolean, ready?:boolean }>}
   */
  static async startDaemon(
    /** @type {StartDaemonOptions} */ {
      name = "service",
      binary,
      args = [],
      env = process.env,
      cwd = process.cwd(),
      pidFile,
      logFile,
      readiness = {},
      minUptimeMs = 1200,
      restartPolicy = "never",
    } = /** @type {StartDaemonOptions} */ ({}),
  ) {
    if (!pidFile || !logFile)
      throw new Error("startDaemon requires pidFile and logFile")
    await ensureFileDir(pidFile)
    await ensureFileDir(logFile)

    // Stale PID handling
    if (await pathExists(pidFile)) {
      const raw = (await readFile(pidFile, "utf8")).trim()
      const oldPid = Number.parseInt(raw, 10)
      if (Number.isFinite(oldPid) && oldPid > 1 && isAlive(oldPid)) {
        const cmd = await this._procName(oldPid)
        console.log(
          `${infoIcon}  ${name}: already running (pid=${oldPid}${cmd ? `, cmd=${cmd}` : ""})`,
        )
        return {
          status: "already-running",
          pid: oldPid,
          alive: true,
          ready: true,
        }
      }
      await rm(pidFile, { force: true })
    }

    const binPath = resolveBinary(binary)
    if (!binPath) throw new Error(`Binary not found: ${binary}`)

    const fd = await open(logFile, "a")
    const startedAt = Date.now()
    const proc = spawn(binPath, args, {
      cwd,
      env,
      detached: true, // new process group
      stdio: ["ignore", fd.fd, fd.fd], // append logs
    })

    await writeFile(pidFile, `${proc.pid}\n`)
    proc.unref()

    // Short health check
    await sleep(STARTUP_HEALTHCHECK_DELAY_MS)
    let alive = isAlive(proc.pid)
    if (!alive) {
      await rm(pidFile, { force: true })
      return { status: "failed", pid: proc.pid, alive: false }
    }

    const ok = await this._waitReadiness(readiness)
    if (!ok) {
      const diedEarly =
        !isAlive(proc.pid) && Date.now() - startedAt < minUptimeMs
      if (restartPolicy === "on-failure" && diedEarly) {
        console.warn(`${warnIcon}  ${name}: retrying once due to early crash`)
        return await this.startDaemon({
          name,
          binary,
          args,
          env,
          cwd,
          pidFile,
          logFile,
          readiness,
          minUptimeMs,
          restartPolicy: "never",
        })
      }
      return { status: "started", pid: proc.pid, alive: true, ready: false }
    }

    return { status: "started", pid: proc.pid, alive: true, ready: true }
  }

  /**
   * Start a **foreground** command with robust cleanup trap.
   * Returns the Bun Process (await .exited for exit code).
   */
  /**
   * Start a foreground command with cleanup; returns Bun subprocess.
   * @param {{ cmd: string, env?: NodeJS.ProcessEnv, cwd?: string, logFile?: string, printPrefix?: string }} opts
   * @returns {Promise<any>}
   */
  static async startForeground(
    /** @type {{ cmd: string, env?: NodeJS.ProcessEnv, cwd?: string, logFile?: string, printPrefix?: string }} */ {
      cmd,
      env = process.env,
      cwd = process.cwd(),
      logFile,
      printPrefix,
    } = /** @type {any} */ ({}),
  ) {
    if (!cmd || !cmd.trim()) throw new Error("startForeground requires a 'cmd'")

    let proc
    if (isWin) {
      // Windows: use cmd /c for command execution
      // Note: Windows doesn't have bash's trap/signal handling, so cleanup is simpler
      const cmdArgs = logFile
        ? `${cmd} 2>&1 | tee -a "${logFile}"`  // Note: tee may not exist on Windows
        : cmd
      proc = Bun.spawn(["cmd", "/c", cmdArgs], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    } else {
      // Unix: Preserve PATH from parent process since bash -lc may source profile scripts
      // that reset PATH (e.g., on self-hosted CI runners where bun is in ~/.bun/bin)
      const pathValue = env?.PATH || process.env.PATH || ""
      const escapedPath = pathValue.replace(/'/g, "'\\''")
      const wrapper = `
export PATH='${escapedPath}'
set -Eeuo pipefail
trap 'trap - TERM INT EXIT; kill -- -$$ >/dev/null 2>&1 || true' TERM INT EXIT
${logFile ? `(${cmd}) | tee -a "${logFile}"` : cmd}
`.trim()

      proc = Bun.spawn(["bash", "-lc", wrapper], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    }

    const tag = printPrefix ? `[${printPrefix}]` : ""
    const pump = async (stream, isErr = false) => {
      const r = stream.getReader()
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await r.read()
        if (done) break
        const text = dec.decode(value)
        ;(isErr ? process.stderr : process.stdout).write(
          tag ? `${tag} ${text}` : text,
        )
      }
    }
    pump(proc.stdout, false)
    pump(proc.stderr, true)

    return proc
  }

  /**
   * Stop a daemon via pidFile. Signals TERM then KILL, removes pidFile.
   */
  /**
   * Stop a daemon via pidFile; removes the pid file.
   * @param {string} pidFile
   * @param {{ gentleMs?: number, killGroup?: boolean }} [opts]
   * @returns {Promise<{ stopped:boolean, pid?:number, reason?:string, error?:string }>}
   */
  static async stopByPidFile(
    pidFile,
    { gentleMs = KILL_GENTLE_MS_DEFAULT, killGroup = true } = {},
  ) {
    try {
      const raw = await readFile(pidFile, "utf8")
      const pid = Number.parseInt(String(raw).trim(), 10)
      if (!Number.isFinite(pid) || pid <= 1)
        throw new Error(`invalid pid in ${pidFile}`)
      await killProcessTree(pid, { gentleMs, killGroup: !isWin && killGroup })
      await rm(pidFile, { force: true })
      return { stopped: true, pid }
    } catch (e) {
      const code =
        e && typeof e === "object" && "code" in e
          ? /** @type {any} */ (e).code
          : undefined
      const msg =
        e && typeof e === "object" && "message" in e
          ? /** @type {any} */ (e).message
          : String(e)
      if (code === "ENOENT") return { stopped: false, reason: "no-pidfile" }
      return { stopped: false, error: msg }
    }
  }

  /** Kill a process (and optionally its group). */
  /**
   * Kill a process (and optionally its group).
   * @param {number} pid
   * @param {{ gentleMs?: number, killGroup?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  static async killTree(pid, opts = {}) {
    return killProcessTree(pid, opts)
  }

  /**
   * Linux-only: reap any processes that still carry a given env lease key/value.
   * @param {object} root0
   * @param {string} root0.key
   * @param {string} root0.value
   * @param {number[]} [root0.excludePids]
   * @returns {Promise<Array<{ pid:number, cmdline:string }>>}
   */
  static async reapByEnv(
    /** @type {{ key: string, value: string, excludePids?: number[] }} */ {
      key,
      value,
      excludePids = [],
    } = /** @type {any} */ ({ key: "", value: "", excludePids: [] }),
  ) {
    return reapByEnv({ key, value, excludePids })
  }

  // ---------- private helpers ----------
  /**
   * Internal: wait for declared readiness conditions.
   * @param {any} readiness
   * @returns {Promise<boolean>}
   */
  static async _waitReadiness(readiness = {}) {
    const tasks = []

    if (readiness.http) {
      const urls = Array.isArray(readiness.http)
        ? readiness.http
        : [readiness.http]
      for (const u of urls)
        tasks.push(waitForHTTP(u, readiness.httpOptions || {}))
    }

    if (readiness.port) {
      const ports = Array.isArray(readiness.port)
        ? readiness.port
        : [readiness.port]
      for (const p of ports)
        tasks.push(waitForPort(p, readiness.portOptions || {}))
    }

    if (readiness.log && readiness.log.file && readiness.log.regex) {
      const rx =
        readiness.log.regex instanceof RegExp
          ? readiness.log.regex
          : new RegExp(String(readiness.log.regex), "m")
      tasks.push(
        waitForLogPattern(readiness.log.file, rx, {
          timeoutMs: readiness.log.timeoutMs ?? LOG_WAIT_TIMEOUT_MS,
        }),
      )
    }

    if (typeof readiness.custom === "function") {
      tasks.push(readiness.custom())
    }

    if (tasks.length === 0) return true
    const results = await Promise.all(tasks.map(async (t) => !!(await t)))
    return results.every(Boolean)
  }

  /**
   * Internal: best-effort process command name.
   * @param {number} pid
   * @returns {Promise<string|null>}
   */
  static async _procName(pid) {
    try {
      if (isWin) {
        // Windows: use wmic or tasklist to get process name
        const out = spawnSync(
          "wmic",
          ["process", "where", `ProcessId=${pid}`, "get", "CommandLine", "/format:list"],
          { stdio: ["ignore", "pipe", "pipe"] },
        )
        const text = td.decode(out.stdout).trim()
        // Parse "CommandLine=..." format
        const match = text.match(/CommandLine=(.+)/i)
        return match ? match[1].trim() : null
      }

      // Unix: use ps command
      const out = spawnSync(
        "bash",
        ["-lc", `ps -o command= -p ${pid} 2>/dev/null || true`],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      )
      return td.decode(out.stdout).trim() || null
    } catch {
      return null
    }
  }
}
