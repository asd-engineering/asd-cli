// @ts-check
/**
 * Unit tests for binary-installer.mjs
 *
 * Tests pure functions and platform detection without network I/O.
 * Run: bun test tests/binary-installer.test.mjs
 */
import { describe, it, expect } from "bun:test"
import {
  detectPlatform,
  getAvailableBinaries,
  getBinaryConfig,
} from "../modules/core/scripts/binary-installer.mjs"

// ── detectPlatform() ──────────────────────────────────────────────

describe("detectPlatform", () => {
  it("should return an object with os, arch, rawArch", () => {
    const p = detectPlatform()
    expect(p).toHaveProperty("os")
    expect(p).toHaveProperty("arch")
    expect(p).toHaveProperty("rawArch")
  })

  it("should map process.platform to standard OS name", () => {
    const p = detectPlatform()
    const expected = { linux: "linux", darwin: "darwin", win32: "windows" }
    expect(p.os).toBe(expected[process.platform] || process.platform)
  })

  it("should map process.arch to standard arch name", () => {
    const p = detectPlatform()
    const archMap = { x64: "amd64", arm64: "arm64", arm: "armv7", ia32: "i686" }
    expect(p.arch).toBe(archMap[process.arch] || process.arch)
  })

  it("should return a non-empty rawArch string", () => {
    const p = detectPlatform()
    expect(typeof p.rawArch).toBe("string")
    expect(p.rawArch.length).toBeGreaterThan(0)
  })

  // Windows-specific assertions
  if (process.platform === "win32") {
    it("should return os=windows on Windows", () => {
      expect(detectPlatform().os).toBe("windows")
    })

    it("should return amd64 on x64 Windows", () => {
      if (process.arch === "x64") {
        expect(detectPlatform().arch).toBe("amd64")
      }
    })
  }
})

// ── getAvailableBinaries() ────────────────────────────────────────

describe("getAvailableBinaries", () => {
  it("should return an array of binary names", () => {
    const bins = getAvailableBinaries()
    expect(Array.isArray(bins)).toBe(true)
    expect(bins.length).toBeGreaterThan(0)
  })

  it("should include core binaries", () => {
    const bins = getAvailableBinaries()
    expect(bins).toContain("caddy")
    expect(bins).toContain("ttyd")
    expect(bins).toContain("gh")
  })

  it("should include Windows-relevant binaries", () => {
    const bins = getAvailableBinaries()
    expect(bins).toContain("busybox")
  })
})

// ── getBinaryConfig() ─────────────────────────────────────────────

describe("getBinaryConfig", () => {
  it("should return config for known binaries", () => {
    const cfg = getBinaryConfig("caddy")
    expect(cfg).toBeDefined()
    expect(cfg.defaultVersion).toBeTruthy()
    expect(typeof cfg.buildUrl).toBe("function")
    expect(typeof cfg.install).toBe("function")
  })

  it("should return undefined for unknown binary", () => {
    expect(getBinaryConfig("nonexistent")).toBeUndefined()
  })

  // ── URL generation tests ──────────────────────────────────────

  describe("buildUrl", () => {
    it("caddy: should generate .zip URL for Windows", () => {
      const cfg = getBinaryConfig("caddy")
      const url = cfg.buildUrl("2.7.4", "windows", "amd64", "x86_64")
      expect(url).toContain("windows")
      expect(url).toEndWith(".zip")
    })

    it("caddy: should generate .tar.gz URL for Linux", () => {
      const cfg = getBinaryConfig("caddy")
      const url = cfg.buildUrl("2.7.4", "linux", "amd64", "x86_64")
      expect(url).toEndWith(".tar.gz")
    })

    it("ttyd: should generate .win32.exe URL for Windows", () => {
      const cfg = getBinaryConfig("ttyd")
      const url = cfg.buildUrl("1.7.7", "windows", "amd64", "x86_64")
      expect(url).toContain("ttyd.win32.exe")
    })

    it("gh: should generate Windows zip URL", () => {
      const cfg = getBinaryConfig("gh")
      const url = cfg.buildUrl("2.83.2", "windows", "amd64", "x86_64")
      expect(url).toContain("windows_amd64.zip")
    })

    it("busybox: should return URL only for Windows", () => {
      const cfg = getBinaryConfig("busybox")
      expect(cfg.buildUrl("FRP-5467", "windows", "amd64", "x86_64")).toBeTruthy()
      expect(cfg.buildUrl("FRP-5467", "linux", "amd64", "x86_64")).toBeNull()
    })

    it("codeserver: should return null for Windows", () => {
      const cfg = getBinaryConfig("codeserver")
      expect(cfg.buildUrl("4.108.2", "windows", "amd64", "x86_64")).toBeNull()
    })
  })
})
