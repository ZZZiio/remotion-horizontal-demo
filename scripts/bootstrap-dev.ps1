param(
  [switch]$Quick,
  [switch]$SkipInstall,
  [switch]$SkipBuild,
  [switch]$SkipChecks,
  [switch]$OpenEditor,
  [switch]$StartEditor,
  [switch]$StartStudio
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $repoRoot

function Write-Step {
  param([string]$Message)
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-Command {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    Write-Host ("[ok] {0} -> {1}" -f $Name, $cmd.Source) -ForegroundColor Green
    return $true
  }
  Write-Host ("[missing] {0}" -f $Name) -ForegroundColor Yellow
  return $false
}

function Invoke-Step {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Args
  )
  Write-Step $Name
  & $Command @Args
}

Write-Step 'Checking toolchain'
$required = 'node','npm'
$optional = 'git','pwsh','python','rg','fd','jq','gh'
$missing = @()
foreach ($tool in $required) {
  if (-not (Test-Command $tool)) { $missing += $tool }
}
foreach ($tool in $optional) {
  [void](Test-Command $tool)
}
if ($missing.Count -gt 0) {
  throw "Missing required tools: $($missing -join ', ')"
}

Write-Step 'Ensuring workspace folders'
foreach ($folder in '.tmp','out') {
  if (-not (Test-Path $folder)) {
    New-Item -ItemType Directory -Path $folder | Out-Null
    Write-Host "created $folder" -ForegroundColor Green
  }
}

$shouldInstall = -not $Quick -and -not $SkipInstall
if ($shouldInstall) {
  Invoke-Step 'Installing npm dependencies' 'npm' @('install')
} elseif (-not (Test-Path 'node_modules')) {
  Invoke-Step 'node_modules missing, running npm install' 'npm' @('install')
} else {
  Write-Step 'Skipping npm install'
}

if (-not $SkipChecks) {
  Invoke-Step 'TypeScript check' 'npm' @('run','check')
  Invoke-Step 'Config normalization test' 'npm' @('run','test:config')
  Invoke-Step 'Voiceover batch match test' 'npm' @('run','test:voiceover-match')
} else {
  Write-Step 'Skipping checks'
}

if (-not $SkipBuild) {
  Invoke-Step 'Editor build' 'npm' @('run','editor:build')
} else {
  Write-Step 'Skipping editor build'
}

if ($OpenEditor) {
  Write-Step 'Opening workspace in VS Code'
  if (Get-Command code -ErrorAction SilentlyContinue) {
    code $repoRoot
  } else {
    Write-Host 'VS Code command not found.' -ForegroundColor Yellow
  }
}

if ($StartEditor) {
  Write-Step 'Starting editor dev server'
  Start-Process pwsh -ArgumentList '-NoExit','-Command',"Set-Location '$repoRoot'; npm run editor"
}

if ($StartStudio) {
  Write-Step 'Starting Remotion studio'
  Start-Process pwsh -ArgumentList '-NoExit','-Command',"Set-Location '$repoRoot'; npm run studio:account"
}

Write-Step 'Bootstrap complete'
Write-Host 'Core flow is ready if node/npm dependencies installed successfully.' -ForegroundColor Green
Write-Host 'Useful next commands:' -ForegroundColor Cyan
Write-Host '  npm run editor' -ForegroundColor Green
Write-Host '  npm run studio:account' -ForegroundColor Green
Write-Host '  npm run render:account' -ForegroundColor Green
Write-Host '  npm run test:voiceover-match' -ForegroundColor Green
