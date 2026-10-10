@echo off
setlocal
set /p TARGET=Paste the full path to the upgraded JESUS-JESUS folder: 
if "%TARGET%"=="" goto :end
cd /d "%TARGET%"
node scripts\verify-live-ready.mjs
:end
echo.
pause
