@echo off
setlocal enabledelayedexpansion

:: ASD CLI Installer for Windows (Pure CMD - no PowerShell)
:: Usage: curl -fsSL https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.cmd -o %TEMP%\install.cmd && %TEMP%\install.cmd
::
:: Uses only curl + tar (built into Windows 10+)
:: Supports GITHUB_TOKEN for private repos
::
:: After installation, update with: asd update
::
:: NOTE: AVX baseline builds are currently Linux-only. Windows does not need
:: a baseline build at this time (all supported Windows x64 CPUs have AVX).
:: If this changes in the future, add AVX detection here.

:: ── Configuration ──
set "REPO=asd-engineering/asd-cli"
set "FALLBACK_REPO=asd-engineering/.asd"
set "PLATFORM=windows-x64"
set "ARCHIVE=asd-%PLATFORM%.zip"

if defined INSTALL_DIR (
    set "BIN_DIR=%INSTALL_DIR%"
) else (
    set "BIN_DIR=%LOCALAPPDATA%\asd\bin"
)
if defined ASD_HOME (
    set "ASD_DIR=%ASD_HOME%"
) else (
    set "ASD_DIR=%LOCALAPPDATA%\asd"
)
set "TEMP_DIR=%TEMP%\asd-install-%RANDOM%"

:: ── Auth token ──
set "AUTH_TOKEN="
if defined GITHUB_TOKEN set "AUTH_TOKEN=%GITHUB_TOKEN%"
if defined GH_TOKEN if not defined AUTH_TOKEN set "AUTH_TOKEN=%GH_TOKEN%"

set "INSTALL_ERROR=0"

echo [INFO] ASD CLI Installer (Windows)
echo [INFO] Detected platform: %PLATFORM%

:: ── Create directories ──
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"
if not exist "%ASD_DIR%" mkdir "%ASD_DIR%"
mkdir "%TEMP_DIR%" 2>nul

:: ── Download ──
:: Uses GitHub's /releases/latest/download/ redirect (no JSON parsing needed)
:: Try public repo first, fall back to private repo with auth

set "ACTIVE_REPO="

echo [INFO] Checking %REPO% for releases...
curl -fsSL -o "%TEMP_DIR%\%ARCHIVE%" "https://github.com/%REPO%/releases/latest/download/%ARCHIVE%" 2>nul
if not errorlevel 1 (
    set "ACTIVE_REPO=%REPO%"
    goto :downloaded
)

echo [INFO] Trying fallback %FALLBACK_REPO%...
if defined AUTH_TOKEN (
    curl -fsSL -H "Authorization: Bearer %AUTH_TOKEN%" -o "%TEMP_DIR%\%ARCHIVE%" "https://github.com/%FALLBACK_REPO%/releases/latest/download/%ARCHIVE%" 2>nul
) else (
    curl -fsSL -o "%TEMP_DIR%\%ARCHIVE%" "https://github.com/%FALLBACK_REPO%/releases/latest/download/%ARCHIVE%" 2>nul
)
if errorlevel 1 (
    echo [ERROR] Download failed. Check your internet connection or set GITHUB_TOKEN for private repos.
    set "INSTALL_ERROR=1"
    goto :cleanup
)
set "ACTIVE_REPO=%FALLBACK_REPO%"

:downloaded
echo [INFO] Source: %ACTIVE_REPO%

:: ── Extract ──
:: Use Windows system tar (libarchive, handles zip) — Git's GNU tar can't extract zip
:: Use pushd to avoid drive letter colon in paths (tar interprets C: as remote host)
echo [INFO] Extracting...
pushd "%TEMP_DIR%"
"%SystemRoot%\System32\tar.exe" -xf "%ARCHIVE%"
if errorlevel 1 (
    popd
    echo [ERROR] Extraction failed. Ensure Windows 10+ with built-in tar.
    set "INSTALL_ERROR=1"
    goto :cleanup
)
popd

:: Archive may extract to asd-<platform>/ subdir or flat into TEMP_DIR
if exist "%TEMP_DIR%\asd-%PLATFORM%\bin\asd.exe" (
    set "EXTRACT_ROOT=%TEMP_DIR%\asd-%PLATFORM%"
) else if exist "%TEMP_DIR%\bin\asd.exe" (
    set "EXTRACT_ROOT=%TEMP_DIR%"
) else (
    echo [ERROR] asd.exe not found in archive.
    set "INSTALL_ERROR=1"
    goto :cleanup
)

:: ── Install binaries ──
echo [INFO] Installing binaries to %BIN_DIR%...
copy /y "%EXTRACT_ROOT%\bin\*.exe" "%BIN_DIR%\" >nul 2>nul

:: ── Install modules ──
if exist "%EXTRACT_ROOT%\modules" (
    echo [INFO] Installing modules...
    if exist "%ASD_DIR%\modules" rmdir /s /q "%ASD_DIR%\modules"
    xcopy /s /e /q /y "%EXTRACT_ROOT%\modules\*" "%ASD_DIR%\modules\" >nul
    echo [INFO] Modules installed to %ASD_DIR%\modules\
)

:: ── Install dashboard ──
:: Check both possible locations: dashboard/dist/ or modules/dashboard/assets/dist/
set "DASH_SRC="
if exist "%EXTRACT_ROOT%\dashboard\dist" set "DASH_SRC=%EXTRACT_ROOT%\dashboard\dist"
if exist "%EXTRACT_ROOT%\modules\dashboard\assets\dist" set "DASH_SRC=%EXTRACT_ROOT%\modules\dashboard\assets\dist"

if defined DASH_SRC (
    echo [INFO] Installing dashboard...
    if exist "%ASD_DIR%\dashboard\dist" rmdir /s /q "%ASD_DIR%\dashboard\dist"
    if not exist "%ASD_DIR%\dashboard" mkdir "%ASD_DIR%\dashboard"
    xcopy /s /e /q /y "!DASH_SRC!\*" "%ASD_DIR%\dashboard\dist\" >nul
    echo [INFO] Dashboard installed to %ASD_DIR%\dashboard\dist\
)

:: ── Install templates ──
if exist "%EXTRACT_ROOT%\templates" (
    echo [INFO] Installing templates...
    if exist "%ASD_DIR%\templates" rmdir /s /q "%ASD_DIR%\templates"
    xcopy /s /e /q /y "%EXTRACT_ROOT%\templates\*" "%ASD_DIR%\templates\" >nul
    echo [INFO] Templates installed to %ASD_DIR%\templates\
)

:: ── Verify installation ──
if exist "%BIN_DIR%\asd.exe" (
    echo [INFO] ASD CLI installed successfully!
    echo [INFO]    Location: %BIN_DIR%\asd.exe

    "%BIN_DIR%\asd.exe" --version >"%TEMP%\asd_ver.txt" 2>nul
    if not errorlevel 1 (
        set /p ASD_VER=<"%TEMP%\asd_ver.txt"
        echo [INFO]    Version: !ASD_VER!
    )
    del "%TEMP%\asd_ver.txt" 2>nul

    echo.
    echo [INFO] To update in the future, run:
    echo    asd update
    echo.
) else (
    echo [ERROR] Installation failed - asd.exe not found after copy.
    set "INSTALL_ERROR=1"
    goto :cleanup
)

:: ── PATH check ──
echo %PATH% | findstr /i /c:"%BIN_DIR%" >nul 2>nul
if errorlevel 1 (
    echo [WARN] %BIN_DIR% is not in your PATH.
    echo.
    echo   To add it permanently, run in CMD as administrator:
    echo.
    echo     setx PATH "%%PATH%%;%BIN_DIR%"
    echo.
    echo   Or for this session only:
    echo.
    echo     set "PATH=%%PATH%%;%BIN_DIR%%"
    echo.
)

:cleanup
:: ── Cleanup ──
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%" 2>nul

endlocal & exit /b %INSTALL_ERROR%
