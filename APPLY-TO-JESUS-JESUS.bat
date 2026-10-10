@echo off
setlocal
cd /d "%~dp0"
echo.
echo TRADE AVATA - SAFE JESUS-JESUS LIVE-READY INSTALLER
echo ----------------------------------------------------
echo This will REFUSE to run if the selected folder is not the exact inspected JESUS-JESUS baseline.
echo It does not delete the existing chart, images, indicators, themes, drawings or recovery files.
echo.
set /p TARGET=Paste the full path to your copied JESUS-JESUS folder: 
if "%TARGET%"=="" goto :end
node scripts\install-into-clone.mjs "%TARGET%"
:end
echo.
pause
