param(
  [string]$Link,
  [string]$Name,
  [string]$Extra,
  [string]$SnapshotFile,
  [string]$ExtraFile,
  [int]$TargetSeconds,
  [switch]$OpenOutput,
  [switch]$NoClipboard,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

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
  Write-Host 'Usage: copy a GitHub / website link, then run this script.' -ForegroundColor Cyan
  Write-Host 'Manual mode:' -ForegroundColor DarkGray
  Write-Host 'powershell -ExecutionPolicy Bypass -File scripts\build-project-analysis-prompt.ps1 -Link https://github.com/owner/repo' -ForegroundColor DarkGray
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

$nodeArgs = @('scripts/build-project-analysis-prompt.mjs', '--link', $Link)
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

$output = & node @nodeArgs 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  throw $output.Trim()
}

try {
  $result = $output | ConvertFrom-Json
} catch {
  throw "Builder output is not valid JSON:`n$output"
}

if (-not $result.outputPath) {
  throw "Missing output path:`n$output"
}

$outputPath = [string]$result.outputPath
if (-not (Test-Path $outputPath)) {
  throw "Generated prompt file not found: $outputPath"
}

if (-not $NoClipboard) {
  $promptText = Get-Content -Path $outputPath -Raw -Encoding UTF8
  Set-Clipboard -Value $promptText
}

Write-Host ''
Write-Host 'Prompt generated successfully.' -ForegroundColor Green
Write-Host ("Project: {0}" -f $result.projectName) -ForegroundColor Cyan
Write-Host ("Link: {0}" -f $result.projectLink) -ForegroundColor Cyan
Write-Host ("File: {0}" -f $outputPath) -ForegroundColor Cyan
if (-not $NoClipboard) {
  Write-Host 'The final prompt has been copied to clipboard.' -ForegroundColor Yellow
}

if ($OpenOutput) {
  Invoke-Item $outputPath
}

if (-not $NoPause) {
  Write-Host ''
  Read-Host 'Press Enter to finish'
}
