@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  for /d %%P in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*") do (
    for /d %%N in ("%%P\node-v*-win-x64") do (
      if exist "%%N\node.exe" set "PATH=%%N;%PATH%"
    )
  )
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org/ and try again.
  exit /b 1
)

if not defined PORT set "PORT=4173"

if not exist "node_modules\ws\package.json" (
  echo Installing ROAD FM server dependency...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

echo Starting ROAD FM at http://localhost:%PORT%
node server.js