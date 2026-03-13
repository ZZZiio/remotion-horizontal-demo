@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\build-project-analysis-prompt.ps1" -TargetSeconds 300 -OpenOutput
if errorlevel 1 (
  echo.
  echo Failed. Please check the error above.
) else (
  echo.
  echo Done. The final prompt has been copied to clipboard.
)
echo.
pause
