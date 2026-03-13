param(
  [string]$Link,
  [string]$Name,
  [int]$TargetSeconds,
  [string]$Extra,
  [string]$SnapshotFile,
  [string]$ExtraFile,
  [switch]$OpenOutput,
  [switch]$NoClipboard,
  [switch]$NoPause
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

function Show-Usage {
  Write-Host ''
  Write-Host 'Usage: copy a project link, then run this script.' -ForegroundColor Cyan
  Write-Host 'OpenAI credentials can come from the project .env.local file or system env.' -ForegroundColor Yellow
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

$nodeArgs = @('scripts/build-project-json.mjs', '--link', $Link)
if (-not [string]::IsNullOrWhiteSpace($Name)) {
  $nodeArgs += @('--name', $Name)
}
if ($TargetSeconds -gt 0) {
  $nodeArgs += @('--target-seconds', [string]$TargetSeconds)
}
if (-not [string]::IsNullOrWhiteSpace($Extra)) {
  $nodeArgs += @('--extra', $Extra)
}
if (-not [string]::IsNullOrWhiteSpace($SnapshotFile)) {
  $nodeArgs += @('--snapshot-file', $SnapshotFile)
}
if (-not [string]::IsNullOrWhiteSpace($ExtraFile)) {
  $nodeArgs += @('--extra-file', $ExtraFile)
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$output = & node @nodeArgs 2>&1 | ForEach-Object { $_.ToString() } | Out-String
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
if ($exitCode -ne 0) {
  throw $output.Trim()
}

try {
  $result = $output | ConvertFrom-Json
} catch {
  throw "Builder output is not valid JSON:`n$output"
}

$mode = [string]$result.mode
if ($mode -eq 'prompt-only') {
  $promptPath = [string]$result.promptPath
  if (-not (Test-Path $promptPath)) {
    throw "Generated prompt file not found: $promptPath"
  }

  $promptText = Get-Content -Path $promptPath -Raw -Encoding UTF8
  if (-not $NoClipboard) {
    Set-Clipboard -Value $promptText
  }

  Write-Host ''
  Write-Host 'Prompt generated successfully.' -ForegroundColor Green
  Write-Host ("Project: {0}" -f $Name) -ForegroundColor Cyan
  Write-Host ("Link: {0}" -f $Link) -ForegroundColor Cyan
  Write-Host ("Prompt: {0}" -f $promptPath) -ForegroundColor Cyan
  Write-Host 'Next: paste the prompt into ChatGPT, then paste JSON back into the editor.' -ForegroundColor Yellow
  if (-not $NoClipboard) {
    Write-Host 'The prompt has been copied to clipboard.' -ForegroundColor Yellow
  }

  if ($OpenOutput) {
    Invoke-Item $promptPath
  }

  if (-not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to finish'
  }
  exit 0
}

$jsonPath = [string]$result.jsonPath
if (-not (Test-Path $jsonPath)) {
  throw "Generated JSON file not found: $jsonPath"
}

if (-not $NoClipboard) {
  $jsonText = Get-Content -Path $jsonPath -Raw -Encoding UTF8
  Set-Clipboard -Value $jsonText
}

Write-Host ''
Write-Host 'Project JSON generated successfully.' -ForegroundColor Green
Write-Host ("Project: {0}" -f $Name) -ForegroundColor Cyan
Write-Host ("Link: {0}" -f $Link) -ForegroundColor Cyan
Write-Host ("Prompt: {0}" -f $result.promptPath) -ForegroundColor DarkCyan
Write-Host ("JSON: {0}" -f $result.jsonPath) -ForegroundColor Cyan
Write-Host ("Normalized: {0}" -f $result.normalizedPath) -ForegroundColor DarkCyan
Write-Host ("OpenAI raw response: {0}" -f $result.responsePath) -ForegroundColor DarkGray
if (-not $NoClipboard) {
  Write-Host 'The generated JSON has been copied to clipboard.' -ForegroundColor Yellow
}

if ($OpenOutput) {
  Invoke-Item $jsonPath
}

if (-not $NoPause) {
  Write-Host ''
  Read-Host 'Press Enter to finish'
}
