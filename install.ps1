# ASD CLI Installer for Windows
# Usage: irm https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1 | iex
# Or with custom install dir: $env:INSTALL_DIR = "C:\Program Files\asd"; irm ... | iex
#
# This script will:
# 1. Download the latest ASD CLI binary
# 2. Install to %LOCALAPPDATA%\asd\bin (or custom INSTALL_DIR)
# 3. Add to PATH if needed
#
# After installation, update with: asd update

$ErrorActionPreference = "Stop"

# Configuration
$Repo = "asd-engineering/asd-cli"
$FallbackRepo = "asd-engineering/.asd"
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$env:LOCALAPPDATA\asd\bin" }
$Platform = "windows-x64"
$ArchiveName = "asd-windows-x64.zip"

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

function Get-LatestVersion {
    $repos = @($Repo, $FallbackRepo)
    $headers = @{
        "Accept" = "application/vnd.github+json"
        "User-Agent" = "asd-cli-installer"
    }

    # Add auth if available
    if ($env:GITHUB_TOKEN) {
        $headers["Authorization"] = "Bearer $env:GITHUB_TOKEN"
    } elseif ($env:GH_TOKEN) {
        $headers["Authorization"] = "Bearer $env:GH_TOKEN"
    }

    foreach ($repo in $repos) {
        $apiUrl = "https://api.github.com/repos/$repo/releases/latest"

        try {
            $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -ErrorAction Stop
            if ($response.tag_name) {
                $script:ActiveRepo = $repo
                return $response.tag_name
            }
        } catch {
            # Try next repo
            continue
        }
    }

    Write-Error "Failed to fetch latest release. Check your internet connection or set GITHUB_TOKEN for private repos."
}

function Install-Asd {
    Write-Info "Detected platform: $Platform"

    # Get latest version
    $version = Get-LatestVersion
    if (-not $version) {
        Write-Error "Could not determine latest version"
    }

    Write-Info "Latest version: $version"
    Write-Info "Source: $ActiveRepo"

    # Construct download URL
    $downloadUrl = "https://github.com/$ActiveRepo/releases/download/$version/$ArchiveName"

    # Create install directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Create temp directory
    $tmpDir = Join-Path $env:TEMP "asd-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    try {
        $archivePath = Join-Path $tmpDir $ArchiveName
        $extractDir = Join-Path $tmpDir "extracted"

        Write-Info "Downloading $ArchiveName..."
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

        Write-Info "Extracting..."
        Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force

        # Copy binary to install directory
        $sourceBin = Join-Path $extractDir "bin\asd.exe"
        if (-not (Test-Path $sourceBin)) {
            $sourceBin = Join-Path $extractDir "asd.exe"
        }

        if (-not (Test-Path $sourceBin)) {
            Write-Error "Binary not found in archive"
        }

        $destBin = Join-Path $InstallDir "asd.exe"
        Copy-Item -Path $sourceBin -Destination $destBin -Force

        # Also copy helper binaries if present
        $binDir = Join-Path $extractDir "bin"
        if (Test-Path $binDir) {
            Get-ChildItem -Path $binDir -Filter "*.exe" | ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $InstallDir -Force
            }
        }

        # Verify installation
        if (Test-Path $destBin) {
            Write-Info "ASD CLI installed successfully!"
            Write-Info "   Location: $destBin"

            try {
                $installedVersion = & $destBin --version 2>$null
                Write-Info "   Version: $installedVersion"
            } catch {
                Write-Info "   Version: $version"
            }

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

                # Offer to add to PATH
                $addToPath = Read-Host "Add to PATH now? (y/n)"
                if ($addToPath -eq "y" -or $addToPath -eq "Y") {
                    $newPath = "$currentPath;$InstallDir"
                    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
                    $env:PATH = "$env:PATH;$InstallDir"
                    Write-Info "Added to PATH. Restart your terminal for changes to take effect."
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
