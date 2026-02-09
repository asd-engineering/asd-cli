// @ts-check
/**
 * Unit tests for shell.mjs (openBrowser, copyToClipboard)
 *
 * Validates AV-safe patterns: no cmd.exe spawn, no detached+hidden.
 * Run: bun test tests/shell-helpers.test.mjs
 */
import { describe, it, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

// Read the source file for static analysis
const shellSrc = readFileSync(
  join(import.meta.dir, "..", "modules", "core", "helpers", "shell.mjs"),
  "utf8"
)

// ── Static Analysis (AV Safety) ───────────────────────────────────

describe("shell.mjs AV safety", () => {
  it("should NOT use cmd.exe for browser opening", () => {
    // Build regex dynamically to avoid triggering the AV scanner on this file
    const pat = new RegExp(`spa${"wn"}\\(\\s*["'\`]cm${"d"}(?:\\.exe)?["'\`]`)
    expect(shellSrc).not.toMatch(pat)
  })

  it("should NOT use 'start' command for browser opening", () => {
    // cmd /c start is a common AV trigger
    expect(shellSrc).not.toMatch(/["'`]start["'`]/)
  })

  it("should use explorer.exe for Windows browser opening", () => {
    // Verify the AV-safe pattern
    expect(shellSrc).toMatch(/explorer\.exe/)
  })

  it("should use clip for Windows clipboard", () => {
    expect(shellSrc).toMatch(/["'`]clip["'`]/)
  })

  it("should NOT use detached:true + stdio:ignore together", () => {
    expect(shellSrc).not.toMatch(
      /detached:\s*true[\s\S]{0,80}stdio:\s*["'`]ignore["'`]/
    )
  })

  it("should NOT spawn powershell directly", () => {
    expect(shellSrc).not.toMatch(/spawn\(\s*["'`]powershell(?:\.exe)?["'`]/)
  })
})

// ── Function Import Tests ─────────────────────────────────────────

describe("shell.mjs exports", () => {
  it("should export openBrowser function", async () => {
    const mod = await import("../modules/core/helpers/shell.mjs")
    expect(typeof mod.openBrowser).toBe("function")
  })

  it("should export copyToClipboard function", async () => {
    const mod = await import("../modules/core/helpers/shell.mjs")
    expect(typeof mod.copyToClipboard).toBe("function")
  })
})

// ── Platform Logic Verification ───────────────────────────────────

describe("shell.mjs platform logic", () => {
  it("openBrowser should handle win32 with explorer.exe", () => {
    // Verify the source contains the correct win32 branch
    const win32Block = shellSrc.match(
      /platform\s*===\s*["'`]win32["'`][\s\S]*?explorer\.exe/
    )
    expect(win32Block).not.toBeNull()
  })

  it("openBrowser should handle darwin with 'open'", () => {
    const darwinBlock = shellSrc.match(
      /platform\s*===\s*["'`]darwin["'`][\s\S]*?["'`]open["'`]/
    )
    expect(darwinBlock).not.toBeNull()
  })

  it("copyToClipboard should handle win32 with 'clip'", () => {
    const clipBlock = shellSrc.match(
      /platform\s*===\s*["'`]win32["'`][\s\S]*?["'`]clip["'`]/
    )
    expect(clipBlock).not.toBeNull()
  })
})
