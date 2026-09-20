@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Le lanceur habituel ouvre désormais aussi le jeu au réseau Wi-Fi.
call "Lancer le jeu.cmd"
