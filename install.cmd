@echo off
:: ASD CLI Installer for Windows
:: Delegates to PowerShell installer (bypass AMSI via saved file)
:: Usage: curl -fsSL https://asd.host/install.cmd -o %TEMP%\install.cmd && %TEMP%\install.cmd

echo [INFO] ASD CLI Installer (Windows)
echo.

:: Download the PowerShell installer to a file (avoids AMSI pipe detection)
set "PS_INSTALLER=%TEMP%\asd-install-%RANDOM%.ps1"

curl.exe -fsSL -o "%PS_INSTALLER%" "https://raw.githubusercontent.com/asd-engineering/asd-cli/main/install.ps1"
if errorlevel 1 (
    curl.exe -fsSL -o "%PS_INSTALLER%" "https://asd.host/install.ps1"
)
if errorlevel 1 (
    echo [ERROR] Failed to download installer. Check your internet connection.
    exit /b 1
)

:: Run the saved script (file execution is less flagged than irm pipe)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_INSTALLER%"
set "EXIT_CODE=%ERRORLEVEL%"

:: Cleanup
del "%PS_INSTALLER%" 2>nul

exit /b %EXIT_CODE%
