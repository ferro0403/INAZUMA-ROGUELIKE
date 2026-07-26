@echo off
setlocal
cd /d "%~dp0"
set "PORT=8020"
start "Inazuma Roguelike Server 8020" /min py -m http.server %PORT% --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/?build=scambio-8020"
endlocal
