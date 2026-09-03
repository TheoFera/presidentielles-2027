@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 ou plus récent est nécessaire pour lancer le prototype.
  pause
  exit /b 1
)
node scripts/serve.mjs --open
pause
