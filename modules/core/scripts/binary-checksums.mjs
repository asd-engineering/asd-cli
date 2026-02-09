// @ts-check
/** @module core/scripts/binary-checksums */

/**
 * Internal registry of validated binary checksums.
 *
 * This file tracks binaries that have been validated to work with our stack.
 * For binaries with upstream checksums (ttyd, caddy), those are the source of truth.
 * For binaries without upstream checksums (codeserver, mitmproxy), this registry is used.
 *
 * Use `bun .asd/cli.mjs binary-sync` to populate/update checksums.
 *
 * @constant {Object} BINARY_CHECKSUMS
 */
export const BINARY_CHECKSUMS = {
  /**
   * Caddy reverse proxy (upstream: SHA-512)
   * @see https://github.com/caddyserver/caddy/releases
   */
  caddy: {
    "2.7.4": {
      linux_amd64: {
        hash: "68cc53c79b88da5f1a33f5a1e1da7fbac5ad041380e91e27663b44e0cb2d8e07e08690295e86e9e65a37472b52f7d95f84f383ee0b8f3d5e1bd4b755d3990e6a", // Populated by binary-sync
        algorithm: "sha512",
        validated: "2025-11-22",
        notes: "Verified against upstream checksums",
      },
      linux_arm64: {
        hash: "",
        algorithm: "sha512",
        validated: null,
        notes: "Upstream checksums available at GitHub releases",
      },
    },
  },

  /**
   * TTYD terminal over HTTP (upstream: SHA-256)
   * @see https://github.com/tsl0922/ttyd/releases
   */
  ttyd: {
    "1.7.7": {
      linux_amd64: {
        hash: "8a217c968aba172e0dbf3f34447218dc015bc4d5e59bf51db2f2cd12b7be4f55", // Populated by binary-sync
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "Verified against upstream checksums",
      },
      linux_arm64: {
        hash: "b38acadd89d1d396a0f5649aa52c539edbad07f4bc7348b27b4f4b7219dd4165",
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "Verified against upstream checksums",
      },
    },
  },

  /**
   * Code-server (no upstream checksums)
   * @see https://github.com/coder/code-server/releases
   */
  codeserver: {
    "4.96.2": {
      linux_amd64: {
        hash: "cdbc5a92c87c63bb8fe13552b46d2d0afaa762193ddabe4c96df8f59690ffd76", // Populated by binary-sync
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "No upstream checksums - manual validation",
      },
      linux_arm64: {
        hash: "",
        algorithm: "sha256",
        validated: null,
        notes: "No upstream checksums - manual validation required",
      },
    },
    "4.102.3": {
      linux_amd64: {
        hash: "636bd7d398f691fafe06d320d91b2371f6dd7b6c6a523ea9c5b92148aad7050b", // Populated by binary-sync
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "No upstream checksums - manual validation",
      },
      linux_arm64: {
        hash: "",
        algorithm: "sha256",
        validated: null,
        notes: "No upstream checksums - manual validation required",
      },
    },
  },

  /**
   * Mitmproxy (no upstream checksums)
   * @see https://github.com/mitmproxy/mitmproxy/releases
   */
  mitmproxy: {
    "11.0.2": {
      linux_amd64: {
        hash: "e433cc38f8b2fbb11e4f9719cbe8094bbc407e80d8872dfd89b9528d0a8f8917", // Populated by binary-sync
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "No upstream checksums - manual validation",
      },
    },
    "12.1.1": {
      linux_amd64: {
        hash: "cdbc5a92c87c63bb8fe13552b46d2d0afaa762193ddabe4c96df8f59690ffd76", // Populated by binary-sync
        algorithm: "sha256",
        validated: "2025-11-22",
        notes: "No upstream checksums - manual validation",
      },
    },
  },

  /**
   * DbGate database management GUI
   * @see https://github.com/dbgate/dbgate/releases
   */
  dbgate: {
    "6.8.2": {
      linux_amd64: {
        hash: "b5e56f4fe3d0f8da8bede2d63b47d56d0bd6149f1eba5da33af0837592e5fc01",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "Verified against upstream checksums - linux_x64.tar.gz",
      },
      linux_arm64: {
        hash: "2a2974f408270a16b662d70f40187ccec90b6cf30b5e08d1b14320d4c392abc9",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "Verified against upstream checksums - linux_arm64.AppImage",
      },
      darwin_amd64: {
        hash: "3a28acb60f8d6d93d4d6a196751ec91709bcc60b3d84b45b942669b9282e94df",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "Verified against upstream checksums - mac_x64.zip",
      },
      darwin_arm64: {
        hash: "4a9da889e6070953c50b03f9486121037e92f8bac024d599136104b57c1fd35d",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "Verified against upstream checksums - mac_arm64.zip",
      },
    },
  },

  /**
   * GitHub CLI (upstream: SHA-256)
   * @see https://github.com/cli/cli/releases
   */
  gh: {
    "2.83.2": {
      linux_amd64: {
        hash: "ca6e7641214fbd0e21429cec4b64a7ba626fd946d8f9d6d191467545b092015e",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "GitHub CLI v2.83.2 linux amd64 tarball",
      },
      linux_arm64: {
        hash: "b1a0c0a0fcf18524e36996caddc92a062355ed014defc836203fe20fba75a38e",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "GitHub CLI v2.83.2 linux arm64 tarball",
      },
      darwin_amd64: {
        hash: "6f1712519ccc768946791dc97da407bf188582345b73fef3d604d050ebf6f614",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "GitHub CLI v2.83.2 macOS amd64 zip",
      },
      darwin_arm64: {
        hash: "ba3e0396ebbc8da17256144ddda503e4e79c8b502166335569f8390d6b75fa8d",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "GitHub CLI v2.83.2 macOS arm64 zip",
      },
      windows_amd64: {
        hash: "b95bf2d953e3bf497bb2c0aed97ffcc5ed8471b80f0920d663a92a6111f05135",
        algorithm: "sha256",
        validated: "2026-01-13",
        notes: "GitHub CLI v2.83.2 windows amd64 zip",
      },
    },
  },

  /**
   * ASD Tunnel server (built from ext/asd-tunnel submodule)
   * Note: Binary is built from source, no upstream checksums
   * @see ext/asd-tunnel (Go source)
   */
  "asd-tunnel": {
    "1.0.0": {
      linux_amd64: {
        hash: "", // Built from source
        algorithm: "sha256",
        validated: null,
        notes: "Built from ext/asd-tunnel submodule",
      },
      linux_arm64: {
        hash: "",
        algorithm: "sha256",
        validated: null,
        notes: "Built from ext/asd-tunnel submodule",
      },
    },
  },
}

/**
 * Get checksum for a binary if available in the registry.
 * @function getBinaryChecksum
 * @param {string} binary - Binary name (e.g., "caddy", "ttyd")
 * @param {string} version - Version string (e.g., "2.7.4")
 * @param {string} platform - Platform identifier (e.g., "linux_amd64")
 * @returns {Object|null} Checksum data or null if not found
 */
export function getBinaryChecksum(binary, version, platform) {
  const binaryData = BINARY_CHECKSUMS[binary]
  if (!binaryData) return null

  const versionData = binaryData[version]
  if (!versionData) return null

  const platformData = versionData[platform]
  if (!platformData) return null

  return platformData
}

/**
 * Update checksum in the registry (used by binary-sync command).
 * Note: This modifies the in-memory object. Persistence handled by binary-sync.
 * @function updateBinaryChecksum
 * @param {string} binary - Binary name
 * @param {string} version - Version string
 * @param {string} platform - Platform identifier
 * @param {Object} data - Checksum data { hash, algorithm, validated, notes }
 * @returns {boolean} True if update successful
 */
export function updateBinaryChecksum(binary, version, platform, data) {
  if (!BINARY_CHECKSUMS[binary]) {
    BINARY_CHECKSUMS[binary] = {}
  }
  if (!BINARY_CHECKSUMS[binary][version]) {
    BINARY_CHECKSUMS[binary][version] = {}
  }

  BINARY_CHECKSUMS[binary][version][platform] = {
    hash: data.hash || "",
    algorithm: data.algorithm || "sha256",
    validated: data.validated || new Date().toISOString().split("T")[0],
    notes: data.notes || "",
  }

  return true
}
