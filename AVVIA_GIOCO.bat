@echo off
cd /d "%~dp0"
start "Inazuma Roguelike Server" /min py -m http.server 8000
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"
