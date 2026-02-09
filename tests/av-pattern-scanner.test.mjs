// @ts-check
/**
 * AV Pattern Scanner
 *
 * Scans the codebase for code patterns that Windows antivirus engines
 * (BitDefender, Windows Defender, Kaspersky, etc.) commonly flag as
 * malicious via heuristic analysis.
 *
 * These patterns are legitimate in DevOps tooling but trigger false
 * positives when compiled into standalone executables.
 *
 * Run: bun test tests/av-pattern-scanner.test.mjs
 */
import { describe, it, expect } from "bun:test"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dir, "..")

// ── Pattern Definitions ─────────────────────────────────────────────
// Each pattern has a regex, severity, description, and optional allowlist.

/** @typedef {{ id: string, regex: RegExp, severity: "critical"|"high"|"medium", description: string, allow?: { file: string, reason: string }[] }} AVPattern */

/** @type {AVPattern[]} */
const AV_PATTERNS = [
  {
    id: "explicit-cmd-spawn",
    regex: /spawn\(\s*["'`]cmd(?:\.exe)?["'`]/,
    severity: "critical",
    description:
      'Explicit spawn("cmd"/"cmd.exe") — AV heuristic trigger. Use { shell: true } or spawn the executable directly.',
    allow: [],
  },
  {
    id: "explicit-powershell-spawn",
    regex: /spawn\(\s*["'`]powershell(?:\.exe)?["'`]/,
    severity: "critical",
    description:
      'Explicit spawn("powershell") — AV heuristic trigger. Use PowerShell via { shell: true } or extract to a .ps1 script.',
    allow: [],
  },
  {
    id: "detached-hidden-process",
    regex: /detached:\s*true[\s\S]{0,80}stdio:\s*["'`]ignore["'`]/,
    severity: "critical",
    description:
      "detached: true + stdio: ignore — classic malware pattern (hidden background process). Use stdio: 'pipe' or remove detached.",
    allow: [
      {
        file: "modules/core/proc/process-manager.mjs",
        reason: "Legitimate daemon process manager — logs to file descriptor, not truly hidden",
      },
    ],
  },
  {
    id: "detached-hidden-process-reverse",
    regex: /stdio:\s*["'`]ignore["'`][\s\S]{0,80}detached:\s*true/,
    severity: "critical",
    description:
      "stdio: ignore + detached: true (reversed order) — same hidden process pattern.",
    allow: [
      {
        file: "modules/core/proc/process-manager.mjs",
        reason: "Legitimate daemon process manager — logs to file descriptor, not truly hidden",
      },
    ],
  },
  {
    id: "powershell-string-interpolation",
    regex: /(?:exec|execSync)\(\s*[`"'].*?powershell.*?\$\{/,
    severity: "critical",
    description:
      "PowerShell command with string interpolation — command injection risk + AV trigger. Use execFile with argument array.",
    allow: [],
  },
  {
    id: "bash-lc-dynamic",
    regex: /spawn(?:Sync)?\(\s*["'`]bash["'`],\s*\[\s*["'`]-l?c["'`],\s*[`$]/,
    severity: "high",
    description:
      'spawn("bash", ["-c"/"-lc", template]) with dynamic command — prefer { shell: true } or spawn executable directly.',
    allow: [
      {
        file: "modules/ssh-askpass/scripts/askpass-helpers.mjs",
        reason: "which() helper uses static command template with single variable",
      },
      {
        file: "modules/core/proc/process-manager.mjs",
        reason: "which() helper for binary resolution — static pattern",
      },
    ],
  },
  {
    id: "cmd-c-string",
    regex: /["'`]cmd["'`],\s*\[\s*["'`]\/[cC]["'`]/,
    severity: "high",
    description:
      'Explicit ["cmd", ["/c", ...]] argument pattern — AV trigger. Use { shell: true } instead.',
    allow: [],
  },
  {
    id: "eval-usage",
    regex: /\beval\s*\(/,
    severity: "high",
    description:
      "eval() usage — code execution from string, AV trigger + security risk.",
    allow: [
      {
        file: "modules/asd-dashboard/tests/",
        reason: "Playwright $$eval/evaluate — browser API, not Node eval()",
      },
    ],
  },
  {
    id: "base64-command-exec",
    regex: /(?:atob|Buffer\.from)\([\s\S]{0,40}(?:exec|spawn|eval)/,
    severity: "high",
    description:
      "Base64 decode near exec/spawn/eval — obfuscated command execution pattern.",
    allow: [],
  },
  {
    id: "function-constructor",
    regex: /new\s+Function\s*\(/,
    severity: "high",
    description:
      "new Function() — dynamic code generation, AV heuristic trigger.",
    allow: [],
  },
]

// ── File Collection ─────────────────────────────────────────────────

/**
 * Recursively collect source files, skipping node_modules, .git, workspace, dist.
 * @param {string} dir
 * @param {string[]} [acc]
 * @returns {string[]}
 */
function collectFiles(dir, acc = []) {
  const SKIP = new Set([
    "node_modules",
    ".git",
    "workspace",
    "dist",
    "coverage",
    ".next",
    "build",
    "vendor",
  ])
  // Skip the scanner itself (contains pattern description strings that would match)
  const SKIP_FILES = new Set(["av-pattern-scanner.test.mjs"])
  const EXTENSIONS = new Set([".mjs", ".js", ".ts", ".jsx", ".tsx", ".mts"])

  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      collectFiles(full, acc)
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name)) && !SKIP_FILES.has(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

// ── Scanner Logic ───────────────────────────────────────────────────

/**
 * @typedef {{ file: string, line: number, snippet: string, pattern: AVPattern }} Finding */

/**
 * Scan a file for AV-triggering patterns.
 * @param {string} filePath
 * @returns {Finding[]}
 */
function scanFile(filePath) {
  let content
  try {
    content = fs.readFileSync(filePath, "utf8")
  } catch {
    return []
  }

  const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/")
  const lines = content.split("\n")
  /** @type {Finding[]} */
  const findings = []

  for (const pattern of AV_PATTERNS) {
    // Check allowlist
    const isAllowed = (pattern.allow || []).some((a) => relPath.includes(a.file))
    if (isAllowed) continue

    // For multiline patterns, scan the whole content
    if (pattern.regex.source.includes("[\\s\\S]")) {
      const match = pattern.regex.exec(content)
      if (match) {
        // Find the line number of the match
        const before = content.slice(0, match.index)
        const lineNum = before.split("\n").length
        const snippet = lines[lineNum - 1]?.trim().slice(0, 100) || ""
        findings.push({ file: relPath, line: lineNum, snippet, pattern })
      }
      continue
    }

    // For single-line patterns, scan line by line
    for (let i = 0; i < lines.length; i++) {
      if (pattern.regex.test(lines[i])) {
        const snippet = lines[i].trim().slice(0, 100)
        findings.push({ file: relPath, line: i + 1, snippet, pattern })
      }
    }
  }

  return findings
}

/**
 * Run full scan and return categorized findings.
 * @returns {{ critical: Finding[], high: Finding[], medium: Finding[] }}
 */
function runFullScan() {
  const files = collectFiles(ROOT)
  /** @type {Finding[]} */
  const allFindings = []

  for (const file of files) {
    const findings = scanFile(file)
    allFindings.push(...findings)
  }

  return {
    critical: allFindings.filter((f) => f.pattern.severity === "critical"),
    high: allFindings.filter((f) => f.pattern.severity === "high"),
    medium: allFindings.filter((f) => f.pattern.severity === "medium"),
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe("AV Pattern Scanner", () => {
  const results = runFullScan()

  it("should have zero CRITICAL findings (AV will block/quarantine)", () => {
    if (results.critical.length > 0) {
      const report = results.critical
        .map(
          (f) =>
            `  ${f.file}:${f.line} [${f.pattern.id}]\n    ${f.snippet}\n    → ${f.pattern.description}`
        )
        .join("\n\n")
      console.error(`\n\nCRITICAL AV findings:\n\n${report}\n`)
    }
    expect(results.critical).toHaveLength(0)
  })

  it("should have zero HIGH findings (AV may flag as suspicious)", () => {
    if (results.high.length > 0) {
      const report = results.high
        .map(
          (f) =>
            `  ${f.file}:${f.line} [${f.pattern.id}]\n    ${f.snippet}\n    → ${f.pattern.description}`
        )
        .join("\n\n")
      console.warn(`\nHIGH AV findings:\n\n${report}\n`)
    }
    expect(results.high).toHaveLength(0)
  })

  it("should scan at least 100 source files", () => {
    const files = collectFiles(ROOT)
    expect(files.length).toBeGreaterThan(100)
  })
})
