param(
  [string]$ApiKey,
  [string]$Model = 'gpt-5',
  [switch]$PersistUser,
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
$envPath = Join-Path $projectRoot '.env.local'
$examplePath = Join-Path $projectRoot '.env.local.example'

function Read-SecretText([string]$Prompt) {
  $secure = Read-Host -AsSecureString -Prompt $Prompt
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  Write-Host ''
  Write-Host 'This will save OPENAI_API_KEY to the project-local .env.local file.' -ForegroundColor Cyan
  Write-Host ('Target file: {0}' -f $envPath) -ForegroundColor DarkGray
  Write-Host ''
  $ApiKey = Read-SecretText 'Paste OPENAI_API_KEY'
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  throw 'No OPENAI_API_KEY provided. Cancelled.'
}

$keyTrimmed = $ApiKey.Trim()
$modelTrimmed = if ([string]::IsNullOrWhiteSpace($Model)) { 'gpt-5' } else { $Model.Trim() }

$lines = @(
  '# Project-local OpenAI settings',
  ('OPENAI_API_KEY={0}' -f $keyTrimmed),
  ('OPENAI_MODEL={0}' -f $modelTrimmed)
)

Set-Content -Path $envPath -Value ($lines -join "`r`n") -Encoding UTF8

if (-not (Test-Path $examplePath)) {
  $exampleLines = @(
    '# Copy to .env.local and fill in real values',
    'OPENAI_API_KEY=your_api_key_here',
    'OPENAI_MODEL=gpt-5'
  )
  Set-Content -Path $examplePath -Value ($exampleLines -join "`r`n") -Encoding UTF8
}

$env:OPENAI_API_KEY = $keyTrimmed
$env:OPENAI_MODEL = $modelTrimmed

if ($PersistUser) {
  [Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $keyTrimmed, 'User')
  [Environment]::SetEnvironmentVariable('OPENAI_MODEL', $modelTrimmed, 'User')
}

Write-Host ''
Write-Host 'OpenAI config saved successfully.' -ForegroundColor Green
Write-Host ('Local file: {0}' -f $envPath) -ForegroundColor Cyan
Write-Host ('Model: {0}' -f $modelTrimmed) -ForegroundColor Cyan
Write-Host 'This project will now prefer .env.local over inherited environment variables.' -ForegroundColor Yellow
if ($PersistUser) {
  Write-Host 'User-level environment variables were updated too.' -ForegroundColor Yellow
}

if (-not $NoPause) {
  Write-Host ''
  Read-Host 'Press Enter to finish'
}
