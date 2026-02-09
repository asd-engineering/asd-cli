// @ts-check
/**
 * Windows Integration Tests
 *
 * End-to-end tests for binary installation on Windows.
 * Downloads real binaries and verifies they work.
 *
 * These tests hit the network and take time — run after unit tests pass.
 * Run: bun test tests/windows-integration.test.mjs --timeout 120000
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { existsSync, mkdirSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { execFileSync } from "child_process"

// Skip entirely on non-Windows
const isWindows = process.platform === "win32"

// Create isolated temp directories so tests don't pollute workspace
const TEST_ROOT = join(tmpdir(), `asd-win-integ-${Date.now()}`)
const TEST_BIN_DIR = join(TEST_ROOT, "bin")
const TEST_WORKSPACE_DIR = join(TEST_ROOT, "workspace")

// Set env vars BEFORE importing binary-installer so it resolves paths to our temp dirs
process.env.ASD_BIN_DIR = TEST_BIN_DIR
process.env.ASD_WORKSPACE_DIR = TEST_WORKSPACE_DIR

const { installBinary, detectPlatform } = await import(
  "../modules/core/scripts/binary-installer.mjs"
)

beforeAll(() => {
  mkdirSync(TEST_BIN_DIR, { recursive: true })
  mkdirSync(TEST_WORKSPACE_DIR, { recursive: true })
})

afterAll(() => {
  // Clean up temp directories
  try {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors (file locks on Windows)
  }
  delete process.env.ASD_BIN_DIR
  delete process.env.ASD_WORKSPACE_DIR
})

// ── Platform Detection (integration sanity) ───────────────────────

describe("Platform detection (integration)", () => {
  it("should detect current platform correctly", () => {
    const p = detectPlatform()
    if (isWindows) {
      expect(p.os).toBe("windows")
    }
    // On CI, x64 is the norm
    if (process.arch === "x64") {
      expect(p.arch).toBe("amd64")
    }
  })
})

// ── Binary Installation ───────────────────────────────────────────

describe("Binary installation (Windows)", () => {
  // Caddy — downloads a .zip, extracts caddy.exe
  it(
    "should install caddy and produce a working .exe",
    async () => {
      if (!isWindows) return

      const result = await installBinary("caddy", { force: true })
      expect(result.error).toBeUndefined()
      expect(result.installed).toBe(true)
      expect(result.paths.length).toBeGreaterThan(0)

      const caddyExe = result.paths[0]
      expect(caddyExe).toEndWith(".exe")
      expect(existsSync(caddyExe)).toBe(true)

      // Verify the binary actually runs
      const version = execFileSync(caddyExe, ["version"], {
        encoding: "utf8",
        timeout: 10000,
      }).trim()
      expect(version).toMatch(/v?\d+\.\d+/)
    },
    60000
  )

  // GitHub CLI — downloads a .zip with subdirectory structure
  it(
    "should install gh and produce a working .exe",
    async () => {
      if (!isWindows) return

      const result = await installBinary("gh", { force: true })
      expect(result.error).toBeUndefined()
      expect(result.installed).toBe(true)
      expect(result.paths.length).toBeGreaterThan(0)

      const ghExe = result.paths[0]
      expect(ghExe).toEndWith(".exe")
      expect(existsSync(ghExe)).toBe(true)

      // Verify the binary runs
      const version = execFileSync(ghExe, ["--version"], {
        encoding: "utf8",
        timeout: 10000,
      }).trim()
      expect(version).toMatch(/gh version \d+\.\d+/)
    },
    60000
  )

  // ttyd — single .exe download (no archive)
  it(
    "should install ttyd and produce an .exe file",
    async () => {
      if (!isWindows) return

      const result = await installBinary("ttyd", { force: true })
      expect(result.error).toBeUndefined()
      expect(result.installed).toBe(true)
      expect(result.paths.length).toBeGreaterThan(0)

      const ttydExe = result.paths[0]
      expect(ttydExe).toEndWith(".exe")
      expect(existsSync(ttydExe)).toBe(true)
    },
    60000
  )

  // busybox — Windows-only, creates busybox.exe + bash.cmd wrapper
  it(
    "should install busybox with bash.cmd wrapper",
    async () => {
      if (!isWindows) return

      const result = await installBinary("busybox", { force: true })
      expect(result.error).toBeUndefined()
      expect(result.installed).toBe(true)

      // Should have created both files
      expect(existsSync(join(TEST_BIN_DIR, "busybox.exe"))).toBe(true)
      expect(existsSync(join(TEST_BIN_DIR, "bash.cmd"))).toBe(true)
    },
    60000
  )
})

// ── Error Handling ────────────────────────────────────────────────

describe("Installer error handling", () => {
  it("should return error for unknown binary", async () => {
    const result = await installBinary("nonexistent-binary-xyz")
    expect(result.installed).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it("codeserver should be skipped on Windows (no Windows build)", async () => {
    if (!isWindows) return

    const result = await installBinary("codeserver", { force: true })
    // codeserver has no Windows build, buildUrl returns null → skipped
    expect(result.skipped).toBe(true)
    expect(result.installed).toBe(false)
  })
})
