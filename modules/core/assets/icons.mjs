// @ts-check
/** @module core/assets/icons */

/**
 * Icon descriptor for compact status glyphs used across terminal menus.
 * @typedef {Object} IconSpec
 * @property {string} key Identifier used to look up the icon.
 * @property {string} glyph Emoji or symbol to render in the terminal menu.
 * @property {string} short Short text appended after the glyph for compact status tokens.
 * @property {string} description Human friendly legend entry for tooltips or help text.
 * @property {string} [color] ANSI color prefix applied in TTY menus (e.g. "\u001B[92m").
 */

/**
 * Process status icon descriptors (combines type + state).
 * Format: [type emoji][state emoji] where type = 🐳(container) or 💻(binary)
 * @type {readonly IconSpec[]}
 */
export const NET_STATUS_ICONS = Object.freeze([
  // Binary process states (💻) - tunnel state removed (now in Tunnel column)
  {
    key: "net.status.binary.ok",
    glyph: "💻✅",
    short: "ok",
    description: "running & healthy",
    color: "\u001B[38;2;100;255;120m",
  },
  {
    key: "net.status.binary.warn",
    glyph: "💻⚠️",
    short: "warn",
    description: "unhealthy",
    color: "\u001B[38;2;255;180;60m",
  },
  {
    key: "net.status.binary.stop",
    glyph: "💻⛔",
    short: "stop",
    description: "stopped",
    color: "\u001B[90m",
  },
  {
    key: "net.status.binary.unknown",
    glyph: "💻⚪",
    short: "unk",
    description: "unmonitored",
    color: "\u001B[38;2;150;150;150m",
  },
  {
    key: "net.status.binary.pending",
    glyph: "💻🌀",
    short: "wait",
    description: "starting",
    color: "\u001B[38;2;100;200;255m",
  },
  // Container process states (🐳) - tunnel state removed (now in Tunnel column)
  {
    key: "net.status.container.ok",
    glyph: "🐳✅",
    short: "ok",
    description: "running & healthy",
    color: "\u001B[38;2;100;255;120m",
  },
  {
    key: "net.status.container.warn",
    glyph: "🐳⚠️",
    short: "warn",
    description: "unhealthy",
    color: "\u001B[38;2;255;180;60m",
  },
  {
    key: "net.status.container.stop",
    glyph: "🐳⛔",
    short: "stop",
    description: "stopped",
    color: "\u001B[90m",
  },
  {
    key: "net.status.container.unknown",
    glyph: "🐳⚪",
    short: "unk",
    description: "unmonitored",
    color: "\u001B[38;2;150;150;150m",
  },
  {
    key: "net.status.container.pending",
    glyph: "🐳🌀",
    short: "wait",
    description: "starting",
    color: "\u001B[38;2;100;200;255m",
  },
])

/**
 * Resolve an icon descriptor by key.
 * @function getNetStatusIcon
 * @param {string} key Icon key, e.g. `"net.status.run.ok"`.
 * @returns {IconSpec | null}
 */
export function getNetStatusIcon(key) {
  const match = NET_STATUS_ICONS.find((entry) => entry.key === key)
  return match || null
}

/**
 * Service type icon descriptors.
 * @type {readonly IconSpec[]}
 */
export const SERVICE_TYPE_ICONS = Object.freeze([
  {
    key: "service.type.container",
    glyph: "▣",
    short: "ctr",
    description: "Container (Docker/Compose)",
    color: "\u001B[38;2;100;180;255m",
  },
  {
    key: "service.type.binary",
    glyph: "●",
    short: "bin",
    description: "Binary (native process)",
    color: "\u001B[38;2;180;180;180m",
  },
])

/**
 * Resolve a service type icon descriptor by key.
 * @function getServiceTypeIcon
 * @param {string} key Icon key, e.g. `"service.type.container"`.
 * @returns {IconSpec | null}
 */
export function getServiceTypeIcon(key) {
  const match = SERVICE_TYPE_ICONS.find((entry) => entry.key === key)
  return match || null
}

/**
 * Security status icon descriptors.
 * @type {readonly IconSpec[]}
 */
export const SECURITY_ICONS = Object.freeze([
  {
    key: "security.protected",
    glyph: "🔐",
    short: "auth",
    description: "Protected with authentication (lock+key)",
    color: "\u001B[38;2;100;255;120m",
  },
  {
    key: "security.unprotected",
    glyph: "⚪",
    short: "open",
    description: "No authentication",
    color: "\u001B[38;2;150;150;150m",
  },
])

/**
 * Resolve a security icon descriptor by key.
 * @function getSecurityIcon
 * @param {string} key Icon key, e.g. `"security.protected"`.
 * @returns {IconSpec | null}
 */
export function getSecurityIcon(key) {
  const match = SECURITY_ICONS.find((entry) => entry.key === key)
  return match || null
}

/**
 * CLI status icon descriptors for general command output.
 * Use getCliIcon("cli.xxx") to retrieve icons for consistent CLI output.
 * @type {readonly IconSpec[]}
 */
export const CLI_STATUS_ICONS = Object.freeze([
  // === Status Icons ===
  {
    key: "cli.ok",
    glyph: "✅",
    short: "ok",
    description: "Success/Completed",
  },
  {
    key: "cli.warn",
    glyph: "⚠️",
    short: "warn",
    description: "Warning/Skipped",
  },
  {
    key: "cli.error",
    glyph: "❌",
    short: "err",
    description: "Error/Failed",
  },
  {
    key: "cli.info",
    glyph: "ℹ️",
    short: "info",
    description: "Information",
  },

  // === Action Icons ===
  {
    key: "cli.start",
    glyph: "🚀",
    short: "start",
    description: "Starting/Launch",
  },
  {
    key: "cli.stop",
    glyph: "🛑",
    short: "stop",
    description: "Stop/Cancel",
  },
  {
    key: "cli.skip",
    glyph: "⏭️",
    short: "skip",
    description: "Skipped",
  },
  {
    key: "cli.wait",
    glyph: "⏳",
    short: "wait",
    description: "Waiting/Loading",
  },
  {
    key: "cli.refresh",
    glyph: "🔄",
    short: "refresh",
    description: "Refresh/Reset/Reload",
  },
  {
    key: "cli.run",
    glyph: "▶️",
    short: "run",
    description: "Run/Execute",
  },

  // === Operation Icons ===
  {
    key: "cli.download",
    glyph: "📥",
    short: "dl",
    description: "Downloading",
  },
  {
    key: "cli.build",
    glyph: "🔨",
    short: "build",
    description: "Building",
  },
  {
    key: "cli.install",
    glyph: "📦",
    short: "pkg",
    description: "Package/Installing",
  },
  {
    key: "cli.config",
    glyph: "🔧",
    short: "cfg",
    description: "Config/Setup/Tools",
  },
  {
    key: "cli.cleanup",
    glyph: "🧹",
    short: "clean",
    description: "Cleanup/Sweep",
  },
  {
    key: "cli.delete",
    glyph: "🗑️",
    short: "del",
    description: "Delete/Remove",
  },
  {
    key: "cli.reuse",
    glyph: "♻️",
    short: "reuse",
    description: "Reuse/Recycle",
  },

  // === Output Icons ===
  {
    key: "cli.summary",
    glyph: "📊",
    short: "sum",
    description: "Summary/Report",
  },
  {
    key: "cli.list",
    glyph: "📋",
    short: "list",
    description: "List/Clipboard",
  },
  {
    key: "cli.tip",
    glyph: "💡",
    short: "tip",
    description: "Tip/Hint",
  },
  {
    key: "cli.note",
    glyph: "📝",
    short: "note",
    description: "Note/Write/Log",
  },

  // === File/Path Icons ===
  {
    key: "cli.folder",
    glyph: "📁",
    short: "dir",
    description: "Directory/Folder",
  },
  {
    key: "cli.file",
    glyph: "📄",
    short: "file",
    description: "File",
  },

  // === Network Icons ===
  {
    key: "cli.web",
    glyph: "🌐",
    short: "web",
    description: "Web/Globe/URL",
  },
  {
    key: "cli.link",
    glyph: "🔗",
    short: "link",
    description: "Link/Connection",
  },
  {
    key: "cli.tunnel",
    glyph: "📡",
    short: "tunnel",
    description: "Tunnel/Satellite",
  },

  // === Security Icons ===
  {
    key: "cli.secure",
    glyph: "🔐",
    short: "auth",
    description: "Security/Auth/Lock",
  },
  {
    key: "cli.lock",
    glyph: "🔒",
    short: "lock",
    description: "Locked/HTTPS",
  },
  {
    key: "cli.shield",
    glyph: "🛡️",
    short: "shield",
    description: "Protected/Shield",
  },

  // === Search/Check Icons ===
  {
    key: "cli.search",
    glyph: "🔍",
    short: "search",
    description: "Search/Scan/Check",
  },
  {
    key: "cli.target",
    glyph: "🎯",
    short: "target",
    description: "Target/Goal",
  },

  // === Service/Tool Icons ===
  {
    key: "cli.terminal",
    glyph: "🖥️",
    short: "term",
    description: "Terminal/Desktop",
  },
  {
    key: "cli.code",
    glyph: "💻",
    short: "code",
    description: "VS Code/Computer",
  },
  {
    key: "cli.database",
    glyph: "🗄️",
    short: "db",
    description: "Database",
  },
  {
    key: "cli.gear",
    glyph: "⚙️",
    short: "gear",
    description: "Settings/Gear",
  },
  {
    key: "cli.home",
    glyph: "🏠",
    short: "home",
    description: "Home/Local",
  },

  // === Additional Context Icons ===
  {
    key: "cli.github",
    glyph: "🐙",
    short: "gh",
    description: "GitHub/Git",
  },
  {
    key: "cli.empty",
    glyph: "📭",
    short: "empty",
    description: "Empty/No results",
  },
  {
    key: "cli.location",
    glyph: "📍",
    short: "loc",
    description: "Location/Pin",
  },
  {
    key: "cli.remote",
    glyph: "🌍",
    short: "remote",
    description: "Remote/World",
  },
  {
    key: "cli.pause",
    glyph: "⏸️",
    short: "pause",
    description: "Pause/Wait for input",
  },
  {
    key: "cli.unlock",
    glyph: "🔓",
    short: "unlock",
    description: "Unlocked/Open",
  },
  {
    key: "cli.save",
    glyph: "💾",
    short: "save",
    description: "Save/Disk",
  },
  {
    key: "cli.add",
    glyph: "➕",
    short: "add",
    description: "Add/Plus",
  },
  {
    key: "cli.blocked",
    glyph: "⛔",
    short: "block",
    description: "Blocked/No entry",
  },
  {
    key: "cli.inspect",
    glyph: "🔎",
    short: "inspect",
    description: "Inspect/Examine",
  },
  {
    key: "cli.branch",
    glyph: "🔀",
    short: "branch",
    description: "Branch/Git",
  },
  {
    key: "cli.edit",
    glyph: "✏️",
    short: "edit",
    description: "Edit/Pencil",
  },
  {
    key: "cli.copy",
    glyph: "📋",
    short: "copy",
    description: "Copy/Clipboard",
  },
  {
    key: "cli.clock",
    glyph: "🕐",
    short: "time",
    description: "Time/Clock",
  },
  {
    key: "cli.check",
    glyph: "✓",
    short: "chk",
    description: "Check mark (plain)",
  },
  {
    key: "cli.cross",
    glyph: "✗",
    short: "x",
    description: "Cross mark (plain)",
  },
  {
    key: "cli.arrow",
    glyph: "→",
    short: "arr",
    description: "Arrow/Flow",
  },
  {
    key: "cli.bullet",
    glyph: "•",
    short: "dot",
    description: "Bullet point",
  },

  // === High-frequency Icons ===
  {
    key: "cli.wifi",
    glyph: "🛜",
    short: "wifi",
    description: "Network/WiFi signal",
  },
  {
    key: "cli.sleep",
    glyph: "😴",
    short: "sleep",
    description: "Sleep/Idle/Inactive",
  },
  {
    key: "cli.spin",
    glyph: "🌀",
    short: "spin",
    description: "Loading/Spinning/Processing",
  },
  {
    key: "cli.open",
    glyph: "📂",
    short: "open",
    description: "Open folder/Expanded",
  },
  {
    key: "cli.docker",
    glyph: "🐳",
    short: "docker",
    description: "Docker/Container",
  },
  {
    key: "cli.tools",
    glyph: "🛠️",
    short: "tools",
    description: "Tools/Maintenance",
  },
  {
    key: "cli.point",
    glyph: "👉",
    short: "point",
    description: "Point/Highlight",
  },
])

/**
 * Resolve a CLI status icon descriptor by key.
 * @function getCliIcon
 * @param {string} key Icon key, e.g. `"cli.ok"`.
 * @returns {IconSpec | null}
 */
export function getCliIcon(key) {
  const match = CLI_STATUS_ICONS.find((entry) => entry.key === key)
  return match || null
}

/**
 * Get all icon sets for legend generation.
 * @function getAllIcons
 * @returns {{ status: readonly IconSpec[], type: readonly IconSpec[], security: readonly IconSpec[], cli: readonly IconSpec[] }}
 */
export function getAllIcons() {
  return {
    status: NET_STATUS_ICONS,
    type: SERVICE_TYPE_ICONS,
    security: SECURITY_ICONS,
    cli: CLI_STATUS_ICONS,
  }
}
