@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -ExecutionPolicy Bypass -File "scripts\install-project-tool.ps1"
