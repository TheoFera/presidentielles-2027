@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est nécessaire pour lancer le serveur multijoueur.
  pause
  exit /b 1
)
set HOST=0.0.0.0
echo Ouvrez http://ADRESSE-IP-DE-CET-ORDINATEUR:2027 sur les autres appareils du même réseau.
echo Les adresses de cet ordinateur sont affichées ci-dessous :
ipconfig | findstr /i "IPv4"
node scripts/serve.mjs --open
pause
