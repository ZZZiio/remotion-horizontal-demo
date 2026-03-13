@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\build-project-video.ps1" -OpenFolder
if errorlevel 1 (
  echo.
  echo Failed. Please check the error above.
) else (
  echo.
  echo Done. If no OpenAI key, only prompt was generated.
)
echo.
pause
