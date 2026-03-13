@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\setup-openai-key.ps1"
if errorlevel 1 (
  echo.
  echo Failed. Please check the error above.
) else (
  echo.
  echo Done. OpenAI local config is ready.
)
echo.
pause
