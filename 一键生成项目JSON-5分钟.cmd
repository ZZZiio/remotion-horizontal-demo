@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\build-project-json.ps1" -OpenOutput -TargetSeconds 300
if errorlevel 1 (
  echo.
  echo Failed. Please check the error above.
) else (
  echo.
  echo Done. If no OpenAI key, the prompt was copied; otherwise JSON was copied.
)
echo.
pause

