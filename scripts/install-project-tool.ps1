param(
  [switch]$Quick,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

function Write-Step {
  param([string]$Text)
  Write-Host "`n==> $Text" -ForegroundColor Cyan
}

try {
  Write-Step '项目工具一键安装开始'
  Write-Host '这会检查 Node/npm、安装依赖、运行基础检查，并做首启体检。' -ForegroundColor Yellow

  $bootstrapArgs = @('-NoLogo','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'bootstrap-dev.ps1'))
  if ($Quick) {
    $bootstrapArgs += '-Quick'
  }
  & powershell.exe @bootstrapArgs
  if ($LASTEXITCODE -ne 0) {
    throw 'bootstrap-dev.ps1 执行失败。'
  }

  Write-Step '执行首启检查'
  & powershell.exe -NoLogo -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'first-run-check.ps1') -AutoFix -NoPause
  if ($LASTEXITCODE -ne 0) {
    throw '首启检查未通过，请先处理阻塞问题。'
  }

  Write-Step '安装完成'
  Write-Host '现在你可以直接双击“打开项目视频面板.cmd”开始使用。' -ForegroundColor Green
  Write-Host ('项目路径：{0}' -f $projectRoot) -ForegroundColor DarkCyan
} catch {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to finish'
  }
  exit 1
}

if (-not $NoPause) {
  Write-Host ''
  Read-Host '安装已完成，按 Enter 结束'
}
