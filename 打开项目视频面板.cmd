@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\first-run-check.ps1" -NoPause
if errorlevel 1 (
  echo.
  echo Startup check found blocking issues. Please run "一键安装项目工具.cmd" first.
  echo.
  pause
  exit /b 1
)
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\project-studio-panel.ps1"
