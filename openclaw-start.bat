@echo off
chcp 65001 > nul
set "OPENCLAW_ROOT=C:\Users\user\OneDrive\openclaw"
cd /d "%OPENCLAW_ROOT%"

set "PATH=%LOCALAPPDATA%\pnpm;%APPDATA%\npm;%PATH%"

echo [OpenClaw] Restarting Gateway...

pnpm openclaw gateway stop >nul 2>&1
timeout /t 2 /nobreak > nul

start "OpenClaw Gateway" /min pnpm openclaw gateway run

echo [OpenClaw] Gateway started in background.
timeout /t 5 /nobreak > nul
echo Done.
pause
