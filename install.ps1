# ASD CLI Installer for Windows
# Usage: irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex
# Or with custom install dir: $env:INSTALL_DIR = "C:\Program Files\asd"; irm ... | iex
#
# Options (via environment variables):
#   INSTALL_DIR  - Custom install directory (default: %LOCALAPPDATA%\asd\bin)
#   VERSION      - Install a specific version tag (e.g. the latest tag from releases)
#                  Set VERSION=list to show available releases
#   ASD_INSTALL_BASE_URL - Override download base URL (for CI testing with local files)
#                          Supports: file:///path, C:\path, or http://...
#
# Examples:
#   irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex                                          # Latest
#   $env:VERSION = "<tag>"; irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex                   # Specific version
#   $env:VERSION = "list"; irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex                   # List versions
#
# After installation, update with: asd update
#
# NOTE: AVX baseline builds are currently Linux-only. Windows does not need
# a baseline build at this time (all supported Windows x64 CPUs have AVX).
# If this changes in the future, add AVX detection here.

$ErrorActionPreference = "Stop"

# Configuration
$Repo = "asd-engineering/asd-cli"
$FallbackRepo = "asd-engineering/.asd"
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$env:LOCALAPPDATA\asd\bin" }
$Platform = "windows-x64"
$ArchiveName = "asd-windows-x64.zip"
$Version = if ($env:VERSION) { $env:VERSION } else { "" }
$InstallBaseUrl = if ($env:ASD_INSTALL_BASE_URL) { $env:ASD_INSTALL_BASE_URL } else { "" }

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Get-AuthHeaders {
    $headers = @{
        "Accept" = "application/vnd.github+json"
        "User-Agent" = "asd-cli-installer"
    }

    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
    } elseif ($env:GH_TOKEN) {
        $headers["Authorization"] = "Bearer $env:GH_TOKEN"
    }

    return $headers
}

function Get-SpecificVersion($RequestedVersion) {
    # Ensure it starts with 'v'
    if (-not $RequestedVersion.StartsWith("v")) {
        $RequestedVersion = "v$RequestedVersion"
    }

    $repos = @($Repo, $FallbackRepo)
    $headers = Get-AuthHeaders

    foreach ($repo in $repos) {
        $apiUrl = "https://api.github.com/repos/$repo/releases/tags/$RequestedVersion"

        try {
            $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
            if ($response.tag_name) {
                $script:ActiveRepo = $repo
                return $response.tag_name
            }
        } catch {
            continue
        }
    }

    Write-Error "Version $RequestedVersion not found. Use `$env:VERSION = 'list'` to see available versions."
}

function Get-LatestVersion {
    $repos = @($Repo, $FallbackRepo)
    $headers = Get-AuthHeaders

    foreach ($repo in $repos) {
        $apiUrl = "https://api.github.com/repos/$repo/releases/latest"

        try {
            $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
            if ($response.tag_name) {
                $script:ActiveRepo = $repo
                return $response.tag_name
            }
        } catch {
            continue
        }
    }

    Write-Error "Failed to fetch latest release. Check your internet connection or set GITHUB_TOKEN for private repos."
}

function Show-AvailableVersions {
    $repos = @($Repo, $FallbackRepo)
    $headers = Get-AuthHeaders

    foreach ($repo in $repos) {
        $apiUrl = "https://api.github.com/repos/$repo/releases?per_page=20"

        try {
            $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
            if ($response.Count -gt 0) {
                Write-Host ""
                Write-Info "Available versions (from $repo):"
                Write-Host ""

                $first = $true
                $exampleTag = ""
                foreach ($release in $response) {
                    $tag = $release.tag_name
                    if ($first) {
                        Write-Host "  $tag  (latest)"
                        $first = $false
                    } else {
                        Write-Host "  $tag"
                        if (-not $exampleTag) { $exampleTag = $tag }
                    }
                }

                Write-Host ""
                Write-Info "Install a specific version:"
                Write-Host "  `$env:VERSION = '$exampleTag'; irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex"
                Write-Host ""
                return
            }
        } catch {
            continue
        }
    }

    Write-Error "Failed to fetch releases. Check your internet connection."
}

function Install-Asd {
    # Handle VERSION=list
    if ($Version -eq "list") {
        Show-AvailableVersions
        return
    }

    Write-Info "Detected platform: $Platform"

    # Get version — specific or latest
    if ($InstallBaseUrl) {
        $resolvedVersion = if ($Version) { $Version } else { "local" }
        if ($resolvedVersion -ne "local" -and -not $resolvedVersion.StartsWith("v")) {
            $resolvedVersion = "v$resolvedVersion"
        }
        $script:ActiveRepo = "local"
        Write-Info "Using local install source: $InstallBaseUrl"
        Write-Info "Version: $resolvedVersion"
    } elseif ($Version) {
        $resolvedVersion = Get-SpecificVersion $Version
        Write-Info "Requested version: $resolvedVersion"
    } else {
        $resolvedVersion = Get-LatestVersion
        Write-Info "Latest version: $resolvedVersion"
    }

    if (-not $resolvedVersion) {
        Write-Error "Could not determine version"
    }

    if (-not $InstallBaseUrl) {
        Write-Info "Source: $ActiveRepo"
    }

    # Construct download URL
    if ($InstallBaseUrl) {
        $downloadUrl = "$($InstallBaseUrl.TrimEnd('\').TrimEnd('/'))/$ArchiveName"
    } else {
        $downloadUrl = "https://github.com/$ActiveRepo/releases/download/$resolvedVersion/$ArchiveName"
    }

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Pre-install reap: stop any lingering asd-spawned processes that would
    # lock the target binaries we're about to overwrite. PR #279 hit:
    #   Copy-Item ... caddy.exe: The process cannot access the file because
    #   it is being used by another process.
    # The previous e2e run (or a leaked test) left caddy.exe (or asd/ttyd/
    # asd-tunnel) holding the file. Win32 file handles block overwrite even
    # with -Force. Reap them here so install is always idempotent — matches
    # the orphan-reap pattern release.yml's e2e-windows uses post-test
    # (release.yml:~1990, "Reap asd-spawned orphans"). Best-effort: no error
    # if the process isn't there.
    foreach ($lockedExe in @('asd', 'caddy', 'ttyd', 'asd-tunnel', 'busybox')) {
        $procs = Get-Process -Name $lockedExe -ErrorAction SilentlyContinue
        if ($procs) {
            Write-Info "Reaping $($procs.Count) lingering $lockedExe process(es) holding install-dir files"
            $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }
    # Brief settle for the OS to release the file handles.
    Start-Sleep -Milliseconds 250

    # Create temp directory
    $tmpDir = Join-Path $env:TEMP "asd-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $archivePath = Join-Path $tmpDir $ArchiveName
        $extractDir = Join-Path $tmpDir "extracted"

        Write-Info "Downloading $ArchiveName..."

        # Local file path or remote URL
        $isLocalPath = $false
        $localPath = ""
        if ($downloadUrl -match '^file://') {
            $localPath = $downloadUrl -replace '^file://', ''
            $isLocalPath = $true
        } elseif ($downloadUrl -match '^[A-Za-z]:\\' -or ($downloadUrl -match '^/' -and (Test-Path $downloadUrl -ErrorAction SilentlyContinue))) {
            $localPath = $downloadUrl
            $isLocalPath = $true
        }

        if ($isLocalPath) {
            if (-not (Test-Path $localPath)) {
                Write-Error "Local archive not found: $localPath"
            }
            Copy-Item -Path $localPath -Destination $archivePath -Force
        } else {
            $headers = @{
                "Accept" = "application/octet-stream"
                "User-Agent" = "asd-cli-installer"
            }

            if ($env:GITHUB_TOKEN) {
                $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
            } elseif ($env:GH_TOKEN) {
                $headers["Authorization"] = "Bearer $env:GH_TOKEN"
            }

            Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath -Headers $headers
        }

        Write-Info "Extracting..."
        Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force

        # Copy binary to install directory (search subdirectory structure)
        $sourceBin = Get-ChildItem -Path $extractDir -Recurse -Filter "asd.exe" | Select-Object -First 1
        if (-not $sourceBin) {
            Write-Error "Binary not found in archive"
        }

        $destBin = Join-Path $InstallDir "asd.exe"
        Copy-Item -Path $sourceBin.FullName -Destination $destBin -Force

        # Also copy helper binaries if present (check subdirectory structure too)
        $binDir = Join-Path $extractDir "bin"
        if (-not (Test-Path $binDir)) {
            $binDir = Get-ChildItem -Path $extractDir -Directory | ForEach-Object {
                Join-Path $_.FullName "bin"
            } | Where-Object { Test-Path $_ } | Select-Object -First 1
        }
        if ($binDir -and (Test-Path $binDir)) {
            Get-ChildItem -Path $binDir -Filter "*.exe" | ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $InstallDir -Force
            }
        }

        # Install assets to global ASD home
        $asdHome = if ($env:ASD_HOME) { $env:ASD_HOME } else { "$env:LOCALAPPDATA\asd" }

        # Find and install modules
        $modulesDir = Get-ChildItem -Path $extractDir -Directory -Recurse -Depth 2 |
            Where-Object { $_.Name -eq "modules" } | Select-Object -First 1
        if ($modulesDir) {
            $destModules = Join-Path $asdHome "modules"
            New-Item -ItemType Directory -Path $asdHome -Force | Out-Null
            if (Test-Path $destModules) { Remove-Item -Path $destModules -Recurse -Force }
            Copy-Item -Path $modulesDir.FullName -Destination $destModules -Recurse
            Write-Info "Modules installed to $destModules\"
        }

        # Find and install dashboard
        $dashboardDist = Get-ChildItem -Path $extractDir -Directory -Recurse -Depth 3 |
            Where-Object { $_.Name -eq "dist" -and $_.Parent.Name -eq "dashboard" } | Select-Object -First 1
        if ($dashboardDist) {
            $destDashboard = Join-Path $asdHome "dashboard\dist"
            New-Item -ItemType Directory -Path (Join-Path $asdHome "dashboard") -Force | Out-Null
            if (Test-Path $destDashboard) { Remove-Item -Path $destDashboard -Recurse -Force }
            Copy-Item -Path $dashboardDist.FullName -Destination $destDashboard -Recurse
            Write-Info "Dashboard installed to $destDashboard\"
        }

        # Verify installation
        if (Test-Path $destBin) {
            Write-Info "ASD CLI installed successfully!"
            Write-Info "   Location: $destBin"

            $installedVersion = & $destBin --version 2>$null
            if ($LASTEXITCODE -eq 0 -and $installedVersion) {
                Write-Info "   Version: $installedVersion"
            } else {
                Write-Info "   Version: $resolvedVersion"
            }
            # The version probe is informational; do not let a native exit code
            # from older/broken --version handling fail an otherwise valid install.
            $global:LASTEXITCODE = 0

            Write-Host ""
            Write-Info "To update in the future, run:"
            Write-Host "   asd update"
            Write-Host ""

            # Check if in PATH
            $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
            if ($currentPath -notlike "*$InstallDir*") {
                Write-Warn "$InstallDir is not in your PATH."
                Write-Host ""
                Write-Host "To add it permanently, run this in PowerShell (admin):"
                Write-Host ""
                Write-Host "   `$path = [Environment]::GetEnvironmentVariable('PATH', 'User')"
                Write-Host "   [Environment]::SetEnvironmentVariable('PATH', `"`$path;$InstallDir`", 'User')"
                Write-Host ""
                Write-Host "Or add it for this session only:"
                Write-Host "   `$env:PATH += `";$InstallDir`""
                Write-Host ""

                # Offer to add to PATH (only in interactive mode)
                if ([Environment]::UserInteractive -and -not $env:CI) {
                    $addToPath = Read-Host "Add to PATH now? (y/n)"
                    if ($addToPath -eq "y" -or $addToPath -eq "Y") {
                        $newPath = "$currentPath;$InstallDir"
                        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
                        $env:PATH = "$env:PATH;$InstallDir"
                        Write-Info "Added to PATH. Restart your terminal for changes to take effect."
                    }
                }
            }
        } else {
            Write-Error "Installation failed - binary not found"
        }
    } finally {
        # Cleanup
        if (Test-Path $tmpDir) {
            Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# Run installer
Install-Asd
