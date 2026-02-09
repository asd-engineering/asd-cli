// @ts-check
/** @module core/helpers/shell */

import { spawn } from "child_process"

/**
 * Open URL in default browser.
 * Cross-platform support for macOS, Windows, and Linux.
 * Falls back to printing the URL if browser cannot be opened (headless servers).
 * @function openBrowser
 * @param {string} url - URL to open
 * @returns {void}
 */
export function openBrowser(url) {
  const platform = process.platform

  let cmd
  let args
  if (platform === "darwin") {
    cmd = "open"
    args = [url]
  } else if (platform === "win32") {
    cmd = "explorer.exe"
    args = [url]
  } else {
    // Linux - try xdg-open
    cmd = "xdg-open"
    args = [url]
  }

  try {
    const proc = spawn(cmd, args, { stdio: "ignore" })
    proc.unref()
  } catch {
    // xdg-open not available (headless server) - print URL instead
    console.log(`Open in browser: ${url}`)
  }
}

/**
 * Copy text to clipboard.
 * Cross-platform support for macOS, Windows, and Linux.
 * @function copyToClipboard
 * @param {string} text - Text to copy
 * @returns {Promise<void>}
 */
export async function copyToClipboard(text) {
  const platform = process.platform

  let cmd
  let args
  if (platform === "darwin") {
    cmd = "pbcopy"
    args = []
  } else if (platform === "win32") {
    cmd = "clip"
    args = []
  } else {
    // Linux - try xclip
    cmd = "xclip"
    args = ["-selection", "clipboard"]
  }

  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] })
    proc.stdin?.write(text)
    proc.stdin?.end()
    proc.on("close", () => resolve(undefined))
    proc.on("error", () => resolve(undefined))
  })
}
