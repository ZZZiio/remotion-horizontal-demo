param(
  [string]$Link,
  [string]$Name,
  [int]$TargetSeconds,
  [string]$Extra,
  [string]$SnapshotFile,
  [string]$ExtraFile,
  [switch]$OpenFolder,
  [switch]$NoPause,
  [switch]$KeepJsonOnly
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

trap {
  Write-Host ''
  Write-Host $_.Exception.Message -ForegroundColor Red
  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to finish'
  }
  exit 1
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Get-LinkFromClipboard {
  try {
    $raw = Get-Clipboard -Raw
  } catch {
    return $null
  }

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  $match = [regex]::Match($raw, 'https?://[^\s"''<>]+')
  if ($match.Success) {
    return $match.Value.Trim()
  }

  return $null
}

function Get-ProjectNameFromLink {
  param([string]$ProjectLink)

  if ([string]::IsNullOrWhiteSpace($ProjectLink)) {
    return $null
  }

  try {
    $uri = [System.Uri]$ProjectLink
    $segments = $uri.AbsolutePath.Trim('/') -split '/'
    if ($segments.Length -gt 0) {
      return ($segments[-1] -replace '\.git$', '')
    }
  } catch {
  }

  return (($ProjectLink -split '[\\/]')[-1] -replace '\.git$', '')
}

function Sanitize-FileName {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return 'project'
  }

  $sanitized = $Value -replace '[<>:"/\\|?*]+', '-' -replace '\s+', '-' -replace '-+', '-'
  $sanitized = $sanitized.Trim('-')
  if ([string]::IsNullOrWhiteSpace($sanitized)) {
    return 'project'
  }

  return $sanitized
}

function Show-Usage {
  Write-Host ''
  Write-Host 'Usage: copy a project link, then run this script.' -ForegroundColor Cyan
  Write-Host 'It will generate JSON, render MP4, and open the output folder.' -ForegroundColor Yellow
  Write-Host ''
}

if ([string]::IsNullOrWhiteSpace($Link)) {
  $Link = Get-LinkFromClipboard
}

if ([string]::IsNullOrWhiteSpace($Link)) {
  Show-Usage
  $Link = Read-Host 'No link found in clipboard. Paste project link'
}

if ([string]::IsNullOrWhiteSpace($Link)) {
  throw 'No project link provided. Cancelled.'
}

if ([string]::IsNullOrWhiteSpace($Name)) {
  $Name = Get-ProjectNameFromLink -ProjectLink $Link
}

$jsonArgs = @('scripts/build-project-json.mjs', '--link', $Link)
if (-not [string]::IsNullOrWhiteSpace($Name)) {
  $jsonArgs += @('--name', $Name)
}
if ($TargetSeconds -gt 0) {
  $jsonArgs += @('--target-seconds', [string]$TargetSeconds)
}
if (-not [string]::IsNullOrWhiteSpace($Extra)) {
  $jsonArgs += @('--extra', $Extra)
}
if (-not [string]::IsNullOrWhiteSpace($SnapshotFile)) {
  $jsonArgs += @('--snapshot-file', $SnapshotFile)
}
if (-not [string]::IsNullOrWhiteSpace($ExtraFile)) {
  $jsonArgs += @('--extra-file', $ExtraFile)
}

Write-Host ''
Write-Host 'Step 1/2: Generating project JSON...' -ForegroundColor Cyan
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$jsonOutput = & node @jsonArgs 2>&1 | ForEach-Object { $_.ToString() } | Out-String
$jsonExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($jsonExitCode -ne 0) {
  throw $jsonOutput.Trim()
}

try {
  $jsonResult = $jsonOutput | ConvertFrom-Json
} catch {
  throw "JSON builder output is not valid JSON:`n$jsonOutput"
}

$mode = [string]$jsonResult.mode
if ($mode -eq 'prompt-only') {
  $promptPath = [string]$jsonResult.promptPath
  if ($promptPath -and (Test-Path $promptPath)) {
    $promptText = Get-Content -Path $promptPath -Raw -Encoding UTF8
    Set-Clipboard -Value $promptText
  }

  Write-Host ''
  Write-Host 'OpenAI key not found. Prompt generated and copied to clipboard.' -ForegroundColor Yellow
  Write-Host 'Next: paste the prompt into ChatGPT, then paste JSON into the editor to render.' -ForegroundColor Cyan
  if ($promptPath) {
    Write-Host ("Prompt: {0}" -f $promptPath) -ForegroundColor DarkCyan
  }

  if ($OpenFolder -and $promptPath -and (Test-Path $promptPath)) {
    Invoke-Item (Split-Path -Parent $promptPath)
  }

  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to finish'
  }
  exit 0
}

$jsonPath = [string]$jsonResult.jsonPath
if (-not (Test-Path $jsonPath)) {
  throw "Generated JSON file not found: $jsonPath"
}

if ($KeepJsonOnly) {
  Write-Host ''
  Write-Host 'JSON generated successfully.' -ForegroundColor Green
  Write-Host ("JSON: {0}" -f $jsonPath) -ForegroundColor Cyan
  if ($OpenFolder) {
    Invoke-Item (Split-Path -Parent $jsonPath)
  }
  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to finish'
  }
  exit 0
}

$safeName = Sanitize-FileName -Value $Name
$outputDir = Join-Path $projectRoot 'out\videos'
$outputPath = Join-Path $outputDir ($safeName + '.mp4')
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

Write-Host ''
Write-Host 'Step 2/2: Rendering MP4...' -ForegroundColor Cyan
if ($env:RENDER_SEGMENTS -eq '1') {
  Write-Host 'Segment render enabled: will reuse cached segments.' -ForegroundColor DarkCyan
}
$renderScript = 'scripts/render-account-from-json.mjs'
if ($env:RENDER_SEGMENTS -eq '1') {
  $renderScript = 'scripts/render-account-segments.mjs'
}

$renderArgs = @($renderScript, $jsonPath, $outputPath)
$ErrorActionPreference = 'Continue'
$null = & node @renderArgs 2>&1 | ForEach-Object { $_.ToString(); $_.ToString() | Write-Host }
$renderExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($renderExitCode -ne 0) {
  throw 'Render failed. See messages above.'
}

if (-not (Test-Path $outputPath)) {
  throw "Render finished but output MP4 was not found: $outputPath"
}

Write-Host ''
Write-Host 'Video rendered successfully.' -ForegroundColor Green
Write-Host ("Project: {0}" -f $Name) -ForegroundColor Cyan
Write-Host ("JSON: {0}" -f $jsonPath) -ForegroundColor DarkCyan
Write-Host ("MP4: {0}" -f $outputPath) -ForegroundColor Cyan

if ($OpenFolder) {
  Invoke-Item $outputDir
} else {
  Start-Process explorer.exe "/select,`"$outputPath`""
}

if (-not $NoPause) {
  Write-Host ''
  Read-Host 'Press Enter to finish'
}
