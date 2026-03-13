param(
  [switch]$AutoFix,
  [switch]$NoPause,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $projectRoot

$issues = New-Object System.Collections.Generic.List[object]

function Add-Issue {
  param(
    [ValidateSet('fatal','warn','info')][string]$Level,
    [string]$Code,
    [string]$Message,
    [string]$Fix = ''
  )

  $issues.Add([pscustomobject]@{
    Level = $Level
    Code = $Code
    Message = $Message
    Fix = $Fix
  }) | Out-Null
}

function Write-Section {
  param([string]$Text)
  if (-not $Quiet) {
    Write-Host "`n==> $Text" -ForegroundColor Cyan
  }
}

function Test-Tool {
  param(
    [string]$Name,
    [bool]$Required = $true,
    [string]$Note = ''
  )

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) {
    if (-not $Quiet) {
      Write-Host ('[ok] {0} -> {1}' -f $Name, $cmd.Source) -ForegroundColor Green
    }
    return $true
  }

  $level = if ($Required) { 'fatal' } else { 'warn' }
  $fix = if ($Note) { $Note } else { ('请先安装 {0}，并重新打开本工具。' -f $Name) }
  $code = 'tool:' + $Name
  $message = '缺少命令：' + $Name
  Add-Issue -Level $level -Code $code -Message $message -Fix $fix

  if (-not $Quiet) {
    Write-Host ('[{0}] {1}' -f $level.ToUpperInvariant(), $Name) -ForegroundColor Yellow
  }
  return $false
}

function Ensure-Dir {
  param([string]$PathValue)
  if (-not (Test-Path $PathValue)) {
    New-Item -ItemType Directory -Force -Path $PathValue | Out-Null
    if (-not $Quiet) {
      Write-Host ('[fix] created {0}' -f $PathValue) -ForegroundColor DarkGreen
    }
  }
}

function Test-NodeModules {
  $nodeModulesPath = Join-Path $projectRoot 'node_modules'
  if (Test-Path $nodeModulesPath) {
    if (-not $Quiet) {
      Write-Host '[ok] node_modules exists' -ForegroundColor Green
    }
    return $true
  }

  if ($AutoFix) {
    Write-Section 'node_modules 缺失，自动执行 npm install'
    & npm install
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $nodeModulesPath)) {
      Add-Issue -Level 'fatal' -Code 'node_modules' -Message 'npm install 失败，依赖未安装完成。' -Fix '请手工执行 `npm install`，确认网络和 npm 源正常。'
      return $false
    }

    if (-not $Quiet) {
      Write-Host '[ok] npm install completed' -ForegroundColor Green
    }
    return $true
  }

  Add-Issue -Level 'fatal' -Code 'node_modules' -Message '项目依赖未安装（node_modules 不存在）。' -Fix '请先运行“一键安装项目工具.cmd”或执行 `npm install`。'
  return $false
}

function Test-OpenAIKey {
  $envPath = Join-Path $projectRoot '.env.local'
  $activeKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'Process')

  if (-not $activeKey -and (Test-Path $envPath)) {
    foreach ($raw in Get-Content $envPath -Encoding UTF8) {
      $line = $raw.Trim()
      if ($line -and -not $line.StartsWith('#') -and $line -match '^OPENAI_API_KEY=(.+)$') {
        $activeKey = $Matches[1].Trim().Trim('"').Trim("'")
        break
      }
    }
  }

  if ($activeKey) {
    if (-not $Quiet) {
      Write-Host '[ok] OPENAI_API_KEY detected' -ForegroundColor Green
    }
    return
  }

  Add-Issue -Level 'warn' -Code 'openai-key' -Message '尚未检测到 OPENAI_API_KEY。' -Fix '可以先打开面板，在顶部 OpenAI 配置区保存本地 Key。'
}

function Test-AccountPrompt {
  $candidates = @(
    $env:ACCOUNT_PROMPT_PATH,
    $env:PROJECT_ACCOUNT_PROMPT_PATH,
    'C:\Users\Administrator\Desktop\提示词工程（85分版）.txt',
    (Join-Path $projectRoot '提示词工程（85分版）.txt'),
    (Join-Path $projectRoot 'examples\account-prompt.txt')
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      if (-not $Quiet) {
        Write-Host ('[ok] account prompt -> {0}' -f $candidate) -ForegroundColor Green
      }
      return
    }
  }

  Add-Issue -Level 'warn' -Code 'account-prompt' -Message '未找到账号总提示词文件。' -Fix '请把“提示词工程（85分版）.txt”放到桌面，或配置 ACCOUNT_PROMPT_PATH。'
}

Write-Section 'Checking core toolchain'
$hasNode = Test-Tool -Name 'node' -Required $true -Note '请安装 Node.js 18+，并重新打开本工具。'
$hasNpm = Test-Tool -Name 'npm' -Required $true -Note '请确认 npm 可用，通常随 Node.js 一起安装。'
[void](Test-Tool -Name 'python' -Required $false -Note 'Python 仅用于口播对齐等高级功能，主流程可先不装。')
[void](Test-Tool -Name 'git' -Required $false -Note 'Git 仅用于开发辅助，不影响主流程。')

Write-Section 'Checking workspace'
Ensure-Dir -PathValue (Join-Path $projectRoot '.tmp')
Ensure-Dir -PathValue (Join-Path $projectRoot 'out')
Ensure-Dir -PathValue (Join-Path $projectRoot 'out\prompts')
Ensure-Dir -PathValue (Join-Path $projectRoot 'out\json')
Ensure-Dir -PathValue (Join-Path $projectRoot 'out\videos')
Ensure-Dir -PathValue (Join-Path $projectRoot 'out\panel-data')

if ($hasNode -and $hasNpm) {
  Write-Section 'Checking dependencies'
  [void](Test-NodeModules)
}

Write-Section 'Checking project config'
Test-OpenAIKey
Test-AccountPrompt
if (-not (Test-Path (Join-Path $projectRoot 'editor\dist\index.html'))) {
  Add-Issue -Level 'warn' -Code 'editor-build' -Message '尚未检测到编辑器构建产物 editor/dist/index.html。' -Fix '这不影响面板主流程；如需静态编辑器产物，请执行 `npm run editor:build`。'
}

$fatalIssues = @($issues | Where-Object { $_.Level -eq 'fatal' })
$warnIssues = @($issues | Where-Object { $_.Level -eq 'warn' })
$infoIssues = @($issues | Where-Object { $_.Level -eq 'info' })

Write-Section 'Check summary'
if ($fatalIssues.Count -eq 0 -and $warnIssues.Count -eq 0) {
  Write-Host '首启检查通过，主流程可以使用。' -ForegroundColor Green
} else {
  foreach ($issue in $issues) {
    $color = switch ($issue.Level) {
      'fatal' { 'Red' }
      'warn' { 'Yellow' }
      default { 'Gray' }
    }
    Write-Host ('[{0}] {1}' -f $issue.Level.ToUpperInvariant(), $issue.Message) -ForegroundColor $color
    if ($issue.Fix) {
      Write-Host ('      处理建议：{0}' -f $issue.Fix) -ForegroundColor DarkGray
    }
  }
}

if (-not $Quiet) {
  Write-Host ''
  Write-Host ('Fatal: {0}  Warning: {1}  Info: {2}' -f $fatalIssues.Count, $warnIssues.Count, $infoIssues.Count) -ForegroundColor Cyan
}

if (-not $NoPause -and $fatalIssues.Count -gt 0) {
  Write-Host ''
  Read-Host '发现阻塞问题，请先处理后重试。按 Enter 结束'
}

if (-not $NoPause -and $fatalIssues.Count -eq 0 -and $warnIssues.Count -gt 0 -and -not $Quiet) {
  Write-Host ''
  Read-Host '检查已完成。存在警告但不阻塞主流程。按 Enter 继续'
}

if ($fatalIssues.Count -gt 0) {
  exit 1
}

exit 0


