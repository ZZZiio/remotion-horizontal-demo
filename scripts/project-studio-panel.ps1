Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env.local'
$codexEnvPath = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\.env'
$crsBaseUrl = 'https://ls.xingchentech.asia/openai'
$promptsDir = Join-Path $projectRoot 'out\prompts'
$jsonDir = Join-Path $projectRoot 'out\json'
$videosDir = Join-Path $projectRoot 'out\videos'
$dataDir = Join-Path $projectRoot 'out\panel-data'
$historyPath = Join-Path $dataDir 'history.json'
$queuePath = Join-Path $dataDir 'queue.json'
$failedQueuePath = Join-Path $dataDir 'queue-failed.json'
foreach ($dir in @($promptsDir,$jsonDir,$videosDir,$dataDir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

function Load-EnvFile {
  $map=@{}
  foreach($filePath in @($codexEnvPath, $envPath)){
    if (!(Test-Path $filePath)) { continue }
    foreach($raw in Get-Content $filePath -Encoding UTF8){
    $line=$raw.Trim(); if(!$line -or $line.StartsWith('#')){continue}
    if($line.StartsWith('export ')){$line=$line.Substring(7).Trim()}
    $i=$line.IndexOf('='); if($i -le 0){continue}
    $key=$line.Substring(0,$i).Trim(); $val=$line.Substring($i+1).Trim().Trim('"').Trim("'")
    if($key){$map[$key]=$val; [Environment]::SetEnvironmentVariable($key,$val,'Process')}
    }
  }
  return $map
}
function Save-EnvFile([string]$apiKey,[string]$model){
  $keyVal=$apiKey.Trim()
  if([string]::IsNullOrWhiteSpace($keyVal)){ return }
  $modelVal = if([string]::IsNullOrWhiteSpace($model)){
    if($keyVal.StartsWith('cr_')){'gpt-5.4'}else{'gpt-5'}
  }else{$model.Trim()}
  $lines=@('# Project-local model settings',"OPENAI_MODEL=$modelVal")
  if($keyVal.StartsWith('cr_')){ 
    $lines+="CRS_OAI_KEY=$keyVal"
    $lines+="OPENAI_BASE_URL=$crsBaseUrl"
  } else { 
    $lines+="OPENAI_API_KEY=$keyVal" 
  }
  $lines | Set-Content $envPath -Encoding UTF8
  Load-EnvFile | Out-Null
}
function Derive-ProjectName([string]$link){
  if([string]::IsNullOrWhiteSpace($link)){return ''}
  try{$u=[System.Uri]$link;$seg=$u.AbsolutePath.Trim('/') -split '/'; if($seg.Length -gt 0){return ($seg[-1] -replace '\.git$','')}}catch{}
  return ((($link -split '[\\/]')[-1]) -replace '\.git$','')
}
function Sanitize-FileName([string]$value){
  if([string]::IsNullOrWhiteSpace($value)){return 'project'}
  $v=($value -replace '[<>:"/\\|?*]+','-' -replace '\s+','-' -replace '-+','-').Trim('-')
  if([string]::IsNullOrWhiteSpace($v)){'project'}else{$v}
}
function Read-JsonArray([string]$path){
  if(!(Test-Path $path)){return @()}
  try{$parsed=(Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json); if($parsed -is [System.Array]){@($parsed)}elseif($parsed){@($parsed)}else{@()}}catch{@()}
}
function Write-JsonArray([string]$path,[object[]]$items){ $items | ConvertTo-Json -Depth 6 | Set-Content $path -Encoding UTF8 }
function To-Item($item){ [pscustomobject]@{Name=[string]($item.Name);Link=[string]($item.Link);Extra=[string]($item.Extra);AddedAt=[string]($item.AddedAt);LastRunAt=[string]($item.LastRunAt);PromptPath=[string]($item.PromptPath);JsonPath=[string]($item.JsonPath);VideoPath=[string]($item.VideoPath);Status=[string]($item.Status);LastError=[string]($item.LastError)} }
$queueItems=@(Read-JsonArray $queuePath | % { To-Item $_ })
$historyItems=@(Read-JsonArray $historyPath | % { To-Item $_ })
$failedQueueItems=@(Read-JsonArray $failedQueuePath | % { To-Item $_ })
$script:historyViewItems=@($historyItems)
function Save-Queue{ Write-JsonArray $queuePath $queueItems }
function Save-History{ Write-JsonArray $historyPath $historyItems }
function Save-FailedQueue{ Write-JsonArray $failedQueuePath $failedQueueItems }
function Extract-Links([string]$text){ if([string]::IsNullOrWhiteSpace($text)){return @()}; @(([regex]::Matches($text,'https?://[^\s"''<>]+') | % {$_.Value.Trim()}) | Select-Object -Unique) }
function Read-AnyText([string]$path){ try{Get-Content $path -Raw -Encoding UTF8}catch{ try{Get-Content $path -Raw}catch{''} } }
function Links-FromFile([string]$path){
  if(!(Test-Path $path)){return @()}
  $ext=[IO.Path]::GetExtension($path).ToLowerInvariant(); $content=Read-AnyText $path
  if($ext -eq '.url'){ $u=($content -split "`r?`n" | ? {$_ -match '^URL='} | select -First 1); if($u){ return @($u.Substring(4).Trim()) } }
  Extract-Links $content
}
function Add-QueueItems([string[]]$links,[string]$extra){
  $clean=@($links | ? {$_ -and $_.Trim()} | Select-Object -Unique)
  foreach($link in $clean){
    $name=Derive-ProjectName $link
    $item=[pscustomobject]@{Name=$name;Link=$link.Trim();Extra=$extra;AddedAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');LastRunAt='';PromptPath='';JsonPath='';VideoPath=''}
    $existing=@($queueItems | ? {$_.Link -eq $item.Link})
    if($existing.Count -gt 0){ $queueItems=@($queueItems | ? {$_.Link -ne $item.Link}) }
    $script:queueItems=@($queueItems + $item)
  }
  Save-Queue; Refresh-QueueList
  return $clean.Count
}
function Add-HistoryItem($item){
  $new=To-Item $item
  if([string]::IsNullOrWhiteSpace($new.LastRunAt)){$new.LastRunAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss')}
  if([string]::IsNullOrWhiteSpace($new.Status)){
    if($new.VideoPath){ $new.Status='video' }
    elseif($new.LastError){ $new.Status='failed' }
    elseif($new.JsonPath){ $new.Status='json' }
    else { $new.Status='record' }
  }
  $script:historyItems=@($new + @($historyItems | ? {$_.Link -ne $new.Link})) | Select-Object -First 50
  Save-History; Refresh-HistoryList
}
function Add-HistoryFailure([string]$stage,$item,[string]$error){
  if($null -eq $item){ return }
  $prefix=if([string]::IsNullOrWhiteSpace($stage)){''}else{"$stage："}
  Add-HistoryItem ([pscustomobject]@{Name=[string]$item.Name;Link=[string]$item.Link;Extra=[string]$item.Extra;AddedAt=[string]$item.AddedAt;LastRunAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');PromptPath=[string]$item.PromptPath;JsonPath=[string]$item.JsonPath;VideoPath=[string]$item.VideoPath;Status='failed';LastError=($prefix + $error)})
}
function Remember-FailedQueueItem($item,[string]$error){
  if($null -eq $item){ return }
  $failed=To-Item ([pscustomobject]@{Name=[string]$item.Name;Link=[string]$item.Link;Extra=[string]$item.Extra;AddedAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');LastRunAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');PromptPath=[string]$item.PromptPath;JsonPath=[string]$item.JsonPath;VideoPath=[string]$item.VideoPath;Status='failed';LastError=[string]$error})
  $script:failedQueueItems=@($failed + @($failedQueueItems | ? {$_.Link -ne $failed.Link})) | Select-Object -First 30
  Save-FailedQueue
  if(Get-Command Refresh-FailedQueueState -ErrorAction SilentlyContinue){ Refresh-FailedQueueState }
}
function Remove-FailedQueueItem([string]$link){
  if([string]::IsNullOrWhiteSpace($link)){ return }
  $script:failedQueueItems=@($failedQueueItems | ? {$_.Link -ne $link})
  Save-FailedQueue
  if(Get-Command Refresh-FailedQueueState -ErrorAction SilentlyContinue){ Refresh-FailedQueueState }
}

$form = New-Object Windows.Forms.Form
$form.Text='项目视频傻瓜面板'; $form.StartPosition='CenterScreen'; $form.Size=New-Object Drawing.Size(1180,820); $form.MinimumSize=New-Object Drawing.Size(1180,820); $form.Font=New-Object Drawing.Font('Microsoft YaHei UI',9); $form.AllowDrop=$true; $form.BackColor=[Drawing.Color]::FromArgb(243,246,251)
$form.AutoScaleMode = 'None'
$uiFont = New-Object Drawing.Font('Microsoft YaHei UI',9)
$uiFontSmall = New-Object Drawing.Font('Microsoft YaHei UI',8)
$uiFontBold = New-Object Drawing.Font('Microsoft YaHei UI',9,[Drawing.FontStyle]::Bold)
$uiFontTitle = New-Object Drawing.Font('Microsoft YaHei UI',16,[Drawing.FontStyle]::Bold)
$primaryColor = [Drawing.Color]::FromArgb(38,132,255)
$primaryHover = [Drawing.Color]::FromArgb(29,112,245)
$surfaceColor = [Drawing.Color]::FromArgb(255,255,255)
$borderColor = [Drawing.Color]::FromArgb(220,226,235)
$mutedText = [Drawing.Color]::FromArgb(90,102,120)
$inputBack = [Drawing.Color]::White
$inputBorder = [Drawing.Color]::FromArgb(205,214,226)

function Set-ButtonStyle([Windows.Forms.Button]$btn,[bool]$primary=$false){
  if(!$btn){ return }
  $btn.FlatStyle = 'Flat'
  $btn.FlatAppearance.BorderSize = 1
  $btn.FlatAppearance.BorderColor = if($primary){$primaryColor} else {$borderColor}
  $btn.BackColor = if($primary){$primaryColor} else {$surfaceColor}
  $btn.ForeColor = if($primary){[Drawing.Color]::White} else {[Drawing.Color]::FromArgb(35,38,43)}
  $btn.Font = if($primary){$uiFontBold} else {$uiFont}
}
function Set-InputStyle($control){
  if(!$control){ return }
  $control.Font = $uiFont
  if($control -is [Windows.Forms.TextBox] -or $control -is [Windows.Forms.ComboBox]){
    $control.BackColor = $inputBack
    $control.ForeColor = [Drawing.Color]::FromArgb(32,35,40)
  }
}
function Style-Group([Windows.Forms.GroupBox]$group){
  if(!$group){ return }
  $group.Font = $uiFontBold
  $group.BackColor = $surfaceColor
  $group.ForeColor = [Drawing.Color]::FromArgb(45,55,70)
}
$y=16
$head=New-Object Windows.Forms.Label; $head.Text='复制链接 → 生成 JSON → 渲染 MP4'; $head.Font=$uiFontTitle; $head.AutoSize=$true; $head.Location=New-Object Drawing.Point(18,$y); $form.Controls.Add($head)
$y+=34
$tip=New-Object Windows.Forms.Label; $tip.Text='支持最近项目历史、拖入 txt/url 文件、自动播放视频、批量链接队列'; $tip.AutoSize=$true; $tip.ForeColor=$mutedText; $tip.Location=New-Object Drawing.Point(20,$y); $form.Controls.Add($tip)

$keyGroup=New-Object Windows.Forms.GroupBox; $keyGroup.Text='1. 模型配置'; $keyGroup.Location=New-Object Drawing.Point(18,72); $keyGroup.Size=New-Object Drawing.Size(1128,92); $form.Controls.Add($keyGroup)
Style-Group $keyGroup
$keyBox=New-Object Windows.Forms.TextBox; $keyBox.Location=New-Object Drawing.Point(16,46); $keyBox.Size=New-Object Drawing.Size(700,26); $keyBox.UseSystemPasswordChar=$true; $keyGroup.Controls.Add($keyBox); Set-InputStyle $keyBox
$modelBox=New-Object Windows.Forms.TextBox; $modelBox.Location=New-Object Drawing.Point(730,46); $modelBox.Size=New-Object Drawing.Size(120,26); $modelBox.Text='gpt-5.4'; $keyGroup.Controls.Add($modelBox); Set-InputStyle $modelBox
$saveKeyButton=New-Object Windows.Forms.Button; $saveKeyButton.Text='保存 Key'; $saveKeyButton.Location=New-Object Drawing.Point(864,43); $saveKeyButton.Size=New-Object Drawing.Size(92,30); $keyGroup.Controls.Add($saveKeyButton); Set-ButtonStyle $saveKeyButton $true
$toggleKeyButton=New-Object Windows.Forms.Button; $toggleKeyButton.Text='显示'; $toggleKeyButton.Location=New-Object Drawing.Point(966,43); $toggleKeyButton.Size=New-Object Drawing.Size(80,30); $keyGroup.Controls.Add($toggleKeyButton); Set-ButtonStyle $toggleKeyButton
$keyStatus=New-Object Windows.Forms.Label; $keyStatus.AutoSize=$true; $keyStatus.Location=New-Object Drawing.Point(16,24); $keyStatus.ForeColor=$mutedText; $keyGroup.Controls.Add($keyStatus)

$projectGroup=New-Object Windows.Forms.GroupBox; $projectGroup.Text='2. 当前项目'; $projectGroup.Location=New-Object Drawing.Point(18,176); $projectGroup.Size=New-Object Drawing.Size(1128,160); $projectGroup.AllowDrop=$true; $form.Controls.Add($projectGroup)
Style-Group $projectGroup
$linkBox=New-Object Windows.Forms.TextBox; $linkBox.Location=New-Object Drawing.Point(16,42); $linkBox.Size=New-Object Drawing.Size(810,26); $linkBox.AllowDrop=$true; $projectGroup.Controls.Add($linkBox); Set-InputStyle $linkBox
$pasteButton=New-Object Windows.Forms.Button; $pasteButton.Text='粘贴链接'; $pasteButton.Location=New-Object Drawing.Point(840,39); $pasteButton.Size=New-Object Drawing.Size(100,30); $projectGroup.Controls.Add($pasteButton); Set-ButtonStyle $pasteButton
$clearButton=New-Object Windows.Forms.Button; $clearButton.Text='清空'; $clearButton.Location=New-Object Drawing.Point(948,39); $clearButton.Size=New-Object Drawing.Size(90,30); $projectGroup.Controls.Add($clearButton); Set-ButtonStyle $clearButton
$nameBox=New-Object Windows.Forms.TextBox; $nameBox.Location=New-Object Drawing.Point(16,92); $nameBox.Size=New-Object Drawing.Size(280,26); $projectGroup.Controls.Add($nameBox); Set-InputStyle $nameBox
$targetSecondsLabel=New-Object Windows.Forms.Label; $targetSecondsLabel.Text='目标时长'; $targetSecondsLabel.AutoSize=$true; $targetSecondsLabel.Location=New-Object Drawing.Point(312,95); $projectGroup.Controls.Add($targetSecondsLabel)
$targetSecondsBox=New-Object Windows.Forms.ComboBox; $targetSecondsBox.Location=New-Object Drawing.Point(372,92); $targetSecondsBox.Size=New-Object Drawing.Size(170,26); $targetSecondsBox.DropDownStyle='DropDownList'; $targetSecondsBox.Items.AddRange(@('60 秒（默认短视频）','300 秒（约 5 分钟）')); $targetSecondsBox.SelectedIndex=0; $projectGroup.Controls.Add($targetSecondsBox); Set-InputStyle $targetSecondsBox
$renderProfileLabel=New-Object Windows.Forms.Label; $renderProfileLabel.Text='导出档位'; $renderProfileLabel.AutoSize=$true; $renderProfileLabel.Location=New-Object Drawing.Point(548,95); $renderProfileLabel.ForeColor=$mutedText; $projectGroup.Controls.Add($renderProfileLabel)
$renderProfileBox=New-Object Windows.Forms.ComboBox; $renderProfileBox.Location=New-Object Drawing.Point(612,92); $renderProfileBox.Size=New-Object Drawing.Size(140,26); $renderProfileBox.DropDownStyle='DropDownList'; $renderProfileBox.Items.AddRange(@('标准（项目分辨率）','性能 720p / 24fps')); $renderProfileBox.SelectedIndex=0; $projectGroup.Controls.Add($renderProfileBox); Set-InputStyle $renderProfileBox
$extraBox=New-Object Windows.Forms.TextBox; $extraBox.Location=New-Object Drawing.Point(760,92); $extraBox.Size=New-Object Drawing.Size(302,52); $extraBox.Multiline=$true; $projectGroup.Controls.Add($extraBox); Set-InputStyle $extraBox
$autoPlayCheck=New-Object Windows.Forms.CheckBox; $autoPlayCheck.Text='生成后自动播放视频'; $autoPlayCheck.Location=New-Object Drawing.Point(16,124); $autoPlayCheck.Size=New-Object Drawing.Size(170,24); $autoPlayCheck.Checked=$true; $autoPlayCheck.Font=$uiFont; $projectGroup.Controls.Add($autoPlayCheck)
$dragTip=New-Object Windows.Forms.Label; $dragTip.Text='拖入 .txt / .md / .url 文件到窗口，可自动提取链接并加入队列'; $dragTip.AutoSize=$true; $dragTip.ForeColor=$mutedText; $dragTip.Location=New-Object Drawing.Point(190,126); $projectGroup.Controls.Add($dragTip)

$actionGroup=New-Object Windows.Forms.GroupBox; $actionGroup.Text='3. 当前项目动作'; $actionGroup.Location=New-Object Drawing.Point(18,348); $actionGroup.Size=New-Object Drawing.Size(1128,74); $form.Controls.Add($actionGroup)
Style-Group $actionGroup
$promptButton=New-Object Windows.Forms.Button; $promptButton.Text='生成最终提示词'; $promptButton.Location=New-Object Drawing.Point(16,28); $promptButton.Size=New-Object Drawing.Size(140,30); $actionGroup.Controls.Add($promptButton); Set-ButtonStyle $promptButton
$jsonButton=New-Object Windows.Forms.Button; $jsonButton.Text='生成项目 JSON'; $jsonButton.Location=New-Object Drawing.Point(168,28); $jsonButton.Size=New-Object Drawing.Size(130,30); $actionGroup.Controls.Add($jsonButton); Set-ButtonStyle $jsonButton
$videoButton=New-Object Windows.Forms.Button; $videoButton.Text='一键生成视频'; $videoButton.Location=New-Object Drawing.Point(310,28); $videoButton.Size=New-Object Drawing.Size(130,30); $actionGroup.Controls.Add($videoButton); Set-ButtonStyle $videoButton $true
$queueCurrentButton=New-Object Windows.Forms.Button; $queueCurrentButton.Text='加入批量队列'; $queueCurrentButton.Location=New-Object Drawing.Point(452,28); $queueCurrentButton.Size=New-Object Drawing.Size(120,30); $actionGroup.Controls.Add($queueCurrentButton); Set-ButtonStyle $queueCurrentButton
$openPromptsButton=New-Object Windows.Forms.Button; $openPromptsButton.Text='提示词'; $openPromptsButton.Location=New-Object Drawing.Point(640,28); $openPromptsButton.Size=New-Object Drawing.Size(90,30); $actionGroup.Controls.Add($openPromptsButton); Set-ButtonStyle $openPromptsButton
$openJsonButton=New-Object Windows.Forms.Button; $openJsonButton.Text='JSON'; $openJsonButton.Location=New-Object Drawing.Point(736,28); $openJsonButton.Size=New-Object Drawing.Size(74,30); $actionGroup.Controls.Add($openJsonButton); Set-ButtonStyle $openJsonButton
$openVideosButton=New-Object Windows.Forms.Button; $openVideosButton.Text='视频'; $openVideosButton.Location=New-Object Drawing.Point(816,28); $openVideosButton.Size=New-Object Drawing.Size(74,30); $actionGroup.Controls.Add($openVideosButton); Set-ButtonStyle $openVideosButton
$refreshButton=New-Object Windows.Forms.Button; $refreshButton.Text='刷新状态'; $refreshButton.Location=New-Object Drawing.Point(956,28); $refreshButton.Size=New-Object Drawing.Size(90,30); $actionGroup.Controls.Add($refreshButton); Set-ButtonStyle $refreshButton

$queueGroup=New-Object Windows.Forms.GroupBox; $queueGroup.Text='4. 批量链接队列'; $queueGroup.Location=New-Object Drawing.Point(18,434); $queueGroup.Size=New-Object Drawing.Size(550,280); $form.Controls.Add($queueGroup)
Style-Group $queueGroup
$queueFailureModeLabel=New-Object Windows.Forms.Label; $queueFailureModeLabel.Text='失败处理'; $queueFailureModeLabel.AutoSize=$true; $queueFailureModeLabel.Location=New-Object Drawing.Point(16,31); $queueFailureModeLabel.ForeColor=$mutedText; $queueGroup.Controls.Add($queueFailureModeLabel)
$queueFailureModeBox=New-Object Windows.Forms.ComboBox; $queueFailureModeBox.Location=New-Object Drawing.Point(74,27); $queueFailureModeBox.Size=New-Object Drawing.Size(126,26); $queueFailureModeBox.DropDownStyle='DropDownList'; $queueFailureModeBox.Items.AddRange([object[]]@('失败时询问','失败跳过继续','失败即停')); $queueFailureModeBox.SelectedIndex=0; $queueGroup.Controls.Add($queueFailureModeBox); Set-InputStyle $queueFailureModeBox
$retryFailedQueueButton=New-Object Windows.Forms.Button; $retryFailedQueueButton.Text='回填失败项'; $retryFailedQueueButton.Location=New-Object Drawing.Point(210,26); $retryFailedQueueButton.Size=New-Object Drawing.Size(92,26); $queueGroup.Controls.Add($retryFailedQueueButton); Set-ButtonStyle $retryFailedQueueButton
$rerunFailedQueueButton=New-Object Windows.Forms.Button; $rerunFailedQueueButton.Text='只重跑失败项'; $rerunFailedQueueButton.Location=New-Object Drawing.Point(308,26); $rerunFailedQueueButton.Size=New-Object Drawing.Size(104,26); $queueGroup.Controls.Add($rerunFailedQueueButton); Set-ButtonStyle $rerunFailedQueueButton
$failedQueueHint=New-Object Windows.Forms.Label; $failedQueueHint.AutoSize=$true; $failedQueueHint.Location=New-Object Drawing.Point(418,31); $failedQueueHint.ForeColor=$mutedText; $queueGroup.Controls.Add($failedQueueHint)
$queueList=New-Object Windows.Forms.ListBox; $queueList.Location=New-Object Drawing.Point(16,56); $queueList.Size=New-Object Drawing.Size(518,176); $queueList.Font=$uiFont; $queueGroup.Controls.Add($queueList)
$runQueueButton=New-Object Windows.Forms.Button; $runQueueButton.Text='执行全部队列'; $runQueueButton.Location=New-Object Drawing.Point(16,240); $runQueueButton.Size=New-Object Drawing.Size(110,28); $queueGroup.Controls.Add($runQueueButton); Set-ButtonStyle $runQueueButton $true
$loadQueueButton=New-Object Windows.Forms.Button; $loadQueueButton.Text='载入选中项'; $loadQueueButton.Location=New-Object Drawing.Point(136,240); $loadQueueButton.Size=New-Object Drawing.Size(100,28); $queueGroup.Controls.Add($loadQueueButton); Set-ButtonStyle $loadQueueButton
$removeQueueButton=New-Object Windows.Forms.Button; $removeQueueButton.Text='移除选中'; $removeQueueButton.Location=New-Object Drawing.Point(246,240); $removeQueueButton.Size=New-Object Drawing.Size(90,28); $queueGroup.Controls.Add($removeQueueButton); Set-ButtonStyle $removeQueueButton
$clearQueueButton=New-Object Windows.Forms.Button; $clearQueueButton.Text='清空队列'; $clearQueueButton.Location=New-Object Drawing.Point(344,240); $clearQueueButton.Size=New-Object Drawing.Size(90,28); $queueGroup.Controls.Add($clearQueueButton); Set-ButtonStyle $clearQueueButton
$importClipboardQueueButton=New-Object Windows.Forms.Button; $importClipboardQueueButton.Text='导入剪贴板'; $importClipboardQueueButton.Location=New-Object Drawing.Point(440,240); $importClipboardQueueButton.Size=New-Object Drawing.Size(94,28); $queueGroup.Controls.Add($importClipboardQueueButton); Set-ButtonStyle $importClipboardQueueButton

$historyGroup=New-Object Windows.Forms.GroupBox; $historyGroup.Text='5. 最近项目历史'; $historyGroup.Location=New-Object Drawing.Point(596,434); $historyGroup.Size=New-Object Drawing.Size(550,280); $form.Controls.Add($historyGroup)
Style-Group $historyGroup
$historySearchLabel=New-Object Windows.Forms.Label; $historySearchLabel.Text='搜索'; $historySearchLabel.AutoSize=$true; $historySearchLabel.Location=New-Object Drawing.Point(16,31); $historySearchLabel.ForeColor=$mutedText; $historyGroup.Controls.Add($historySearchLabel)
$historySearchBox=New-Object Windows.Forms.TextBox; $historySearchBox.Location=New-Object Drawing.Point(56,27); $historySearchBox.Size=New-Object Drawing.Size(150,26); $historyGroup.Controls.Add($historySearchBox); Set-InputStyle $historySearchBox
$historySortLabel=New-Object Windows.Forms.Label; $historySortLabel.Text='排序'; $historySortLabel.AutoSize=$true; $historySortLabel.Location=New-Object Drawing.Point(214,31); $historySortLabel.ForeColor=$mutedText; $historyGroup.Controls.Add($historySortLabel)
$historySortBox=New-Object Windows.Forms.ComboBox; $historySortBox.Location=New-Object Drawing.Point(252,27); $historySortBox.Size=New-Object Drawing.Size(120,26); $historySortBox.DropDownStyle='DropDownList'; $historySortBox.Items.AddRange([object[]]@('按时间：新到旧','按时间：旧到新')); $historySortBox.SelectedIndex=0; $historyGroup.Controls.Add($historySortBox); Set-InputStyle $historySortBox
$historyFilterLabel=New-Object Windows.Forms.Label; $historyFilterLabel.Text='筛选'; $historyFilterLabel.AutoSize=$true; $historyFilterLabel.Location=New-Object Drawing.Point(382,31); $historyFilterLabel.ForeColor=$mutedText; $historyGroup.Controls.Add($historyFilterLabel)
$historyFilterBox=New-Object Windows.Forms.ComboBox; $historyFilterBox.Location=New-Object Drawing.Point(420,27); $historyFilterBox.Size=New-Object Drawing.Size(114,26); $historyFilterBox.DropDownStyle='DropDownList'; $historyFilterBox.Items.AddRange([object[]]@('全部','仅看有视频','仅看失败项')); $historyFilterBox.SelectedIndex=0; $historyGroup.Controls.Add($historyFilterBox); Set-InputStyle $historyFilterBox
$historyList=New-Object Windows.Forms.ListBox; $historyList.Location=New-Object Drawing.Point(16,56); $historyList.Size=New-Object Drawing.Size(518,176); $historyList.Font=$uiFont; $historyGroup.Controls.Add($historyList)
$useHistoryButton=New-Object Windows.Forms.Button; $useHistoryButton.Text='载入当前'; $useHistoryButton.Location=New-Object Drawing.Point(16,240); $useHistoryButton.Size=New-Object Drawing.Size(82,28); $historyGroup.Controls.Add($useHistoryButton); Set-ButtonStyle $useHistoryButton
$requeueHistoryButton=New-Object Windows.Forms.Button; $requeueHistoryButton.Text='进队列'; $requeueHistoryButton.Location=New-Object Drawing.Point(106,240); $requeueHistoryButton.Size=New-Object Drawing.Size(74,28); $historyGroup.Controls.Add($requeueHistoryButton); Set-ButtonStyle $requeueHistoryButton
$rerenderHistoryButton=New-Object Windows.Forms.Button; $rerenderHistoryButton.Text='重渲染'; $rerenderHistoryButton.Location=New-Object Drawing.Point(188,240); $rerenderHistoryButton.Size=New-Object Drawing.Size(78,28); $historyGroup.Controls.Add($rerenderHistoryButton); Set-ButtonStyle $rerenderHistoryButton
$historyDetailButton=New-Object Windows.Forms.Button; $historyDetailButton.Text='失败详情'; $historyDetailButton.Location=New-Object Drawing.Point(274,240); $historyDetailButton.Size=New-Object Drawing.Size(78,28); $historyDetailButton.Enabled=$false; $historyGroup.Controls.Add($historyDetailButton); Set-ButtonStyle $historyDetailButton
$openHistoryVideoButton=New-Object Windows.Forms.Button; $openHistoryVideoButton.Text='打开视频'; $openHistoryVideoButton.Location=New-Object Drawing.Point(360,240); $openHistoryVideoButton.Size=New-Object Drawing.Size(78,28); $historyGroup.Controls.Add($openHistoryVideoButton); Set-ButtonStyle $openHistoryVideoButton
$clearHistoryButton=New-Object Windows.Forms.Button; $clearHistoryButton.Text='清空'; $clearHistoryButton.Location=New-Object Drawing.Point(446,240); $clearHistoryButton.Size=New-Object Drawing.Size(88,28); $historyGroup.Controls.Add($clearHistoryButton); Set-ButtonStyle $clearHistoryButton
$historyToolTip=New-Object Windows.Forms.ToolTip; $historyToolTip.AutoPopDelay=20000; $historyToolTip.InitialDelay=250; $historyToolTip.ReshowDelay=100; $historyToolTip.ShowAlways=$true

$statusBox=New-Object Windows.Forms.RichTextBox; $statusBox.Location=New-Object Drawing.Point(18,726); $statusBox.Size=New-Object Drawing.Size(1128,76); $statusBox.ReadOnly=$true; $statusBox.BackColor=[Drawing.Color]::FromArgb(12,18,28); $statusBox.ForeColor=[Drawing.Color]::FromArgb(220,235,250); $statusBox.Font=New-Object Drawing.Font('Consolas',9); $form.Controls.Add($statusBox)
function Append-Status([string]$text){ $statusBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] $text`r`n"); $statusBox.SelectionStart=$statusBox.TextLength; $statusBox.ScrollToCaret(); [System.Windows.Forms.Application]::DoEvents() }
function Refresh-FailedQueueState{ if($failedQueueHint){ $failedQueueHint.Text="失败缓存：$($failedQueueItems.Count) 项" }; if($retryFailedQueueButton){ $retryFailedQueueButton.Enabled = $failedQueueItems.Count -gt 0 }; if($rerunFailedQueueButton){ $rerunFailedQueueButton.Enabled = $failedQueueItems.Count -gt 0 } }
function Refresh-QueueList{ $queueList.Items.Clear(); foreach($item in $queueItems){ [void]$queueList.Items.Add("$($item.Name)  |  $($item.Link)") }; Refresh-FailedQueueState }
function Parse-TimeValue([string]$value){ $dt=[datetime]::MinValue; if([datetime]::TryParse($value,[ref]$dt)){$dt}else{[datetime]::MinValue} }
function Test-HasVideo($item){ return [bool]($item.VideoPath -and (Test-Path $item.VideoPath)) }
function Show-HistoryFailureDetails($item){ if($null -eq $item -or [string]::IsNullOrWhiteSpace([string]$item.LastError)){ [Windows.Forms.MessageBox]::Show('这个历史项没有失败详情。','提示','OK','Information')|Out-Null; return }; [Windows.Forms.MessageBox]::Show([string]$item.LastError,"失败详情 - $([string]$item.Name)",'OK','Warning')|Out-Null }
function Refresh-HistoryFailureTip{ $item=Selected-HistoryItem; if($historyDetailButton){ $historyDetailButton.Enabled = ($null -ne $item -and -not [string]::IsNullOrWhiteSpace([string]$item.LastError)) }; if($historyToolTip){ if($null -ne $item -and -not [string]::IsNullOrWhiteSpace([string]$item.LastError)){ $historyToolTip.SetToolTip($historyList,[string]$item.LastError) } else { $historyToolTip.SetToolTip($historyList,'') } } }
function Refresh-HistoryList{
  $selectedLink=''
  if($historyList.SelectedIndex -ge 0 -and $historyList.SelectedIndex -lt $historyViewItems.Count){ $selectedLink=[string]$historyViewItems[$historyList.SelectedIndex].Link }
  $historyList.Items.Clear()
  $query=if($historySearchBox){$historySearchBox.Text.Trim()}else{''}
  $items=@($historyItems)
  if($query){
    $pattern=$query.ToLowerInvariant()
    $items=@($items | ? {
      ([string]$_.Name).ToLowerInvariant().Contains($pattern) -or
      ([string]$_.Link).ToLowerInvariant().Contains($pattern) -or
      ([string]$_.Extra).ToLowerInvariant().Contains($pattern) -or
      ([string]$_.LastError).ToLowerInvariant().Contains($pattern)
    })
  }
  $filterMode=if($historyFilterBox -and $historyFilterBox.SelectedItem){ [string]$historyFilterBox.SelectedItem } else { '全部' }
  if($filterMode -eq '仅看有视频'){
    $items=@($items | ? { Test-HasVideo $_ })
  } elseif($filterMode -eq '仅看失败项'){
    $items=@($items | ? { [string]$_.Status -eq 'failed' })
  }
  $sortMode=if($historySortBox -and $historySortBox.SelectedItem){ [string]$historySortBox.SelectedItem } else { '按时间：新到旧' }
  if($sortMode -eq '按时间：旧到新'){
    $items=@($items | Sort-Object @{ Expression = { Parse-TimeValue ([string]$_.LastRunAt) } })
  } else {
    $items=@($items | Sort-Object @{ Expression = { Parse-TimeValue ([string]$_.LastRunAt) } } -Descending)
  }
  $script:historyViewItems=@($items)
  foreach($item in $historyViewItems){
    if([string]$item.Status -eq 'failed'){ $mark='[失败]' }
    elseif(Test-HasVideo $item){ $mark='[有视频]' }
    elseif($item.JsonPath){ $mark='[仅JSON]' }
    else { $mark='[仅记录]' }
    [void]$historyList.Items.Add("$mark $($item.Name)  |  $($item.LastRunAt)")
  }
  if($selectedLink){
    for($i=0;$i -lt $historyViewItems.Count;$i++){
      if([string]$historyViewItems[$i].Link -eq $selectedLink){ $historyList.SelectedIndex=$i; break }
    }
  }
  Refresh-HistoryFailureTip
}
function Refresh-KeyStatus{
  $vals=Load-EnvFile
  $active=[Environment]::GetEnvironmentVariable('OPENAI_API_KEY','Process')
  $crs=[Environment]::GetEnvironmentVariable('CRS_OAI_KEY','Process')
  if($vals.ContainsKey('CRS_OAI_KEY')){$keyBox.Text=[string]$vals['CRS_OAI_KEY']}
  elseif($vals.ContainsKey('OPENAI_API_KEY')){$keyBox.Text=[string]$vals['OPENAI_API_KEY']}
  if($vals.ContainsKey('OPENAI_MODEL')){$modelBox.Text=[string]$vals['OPENAI_MODEL']}
  $currentKey = if($crs){$crs}else{$active}
  if($currentKey){
    $masked=if($currentKey.Length -gt 10){ '{0}...{1}' -f $currentKey.Substring(0,6),$currentKey.Substring($currentKey.Length-4)}else{'已配置'}
    $label = if($crs){'CRS'}else{'OpenAI'}
    $keyStatus.Text="当前可用（$label）：$masked"
  } else {
    $keyStatus.Text='当前未检测到可用 Key'
  }
}
function Busy([bool]$flag){ foreach($btn in @($promptButton,$jsonButton,$videoButton,$queueCurrentButton,$runQueueButton,$saveKeyButton,$rerenderHistoryButton,$retryFailedQueueButton,$rerunFailedQueueButton,$historyDetailButton)){ if($btn){ $btn.Enabled = -not $flag -or ($btn -eq $historyDetailButton -and $flag -eq $false) } }; $form.UseWaitCursor=$flag; [System.Windows.Forms.Application]::DoEvents(); if(-not $flag){ Refresh-FailedQueueState; Refresh-HistoryFailureTip } }
function Node-Run([string[]]$args,[string]$title){ Append-Status("$title：开始"); Busy $true; try{$lines=& node @args 2>&1 | % {$_.ToString()}; $code=$LASTEXITCODE; $text=($lines -join "`r`n").Trim(); if($text){ foreach($line in $text -split "`r?`n"){ if($line){Append-Status($line)} } }; if($code -ne 0){ $detail=if($text){$text}else{"退出码：$code"}; throw "$title 失败：`r`n$detail" }; Append-Status("$title：完成"); return $text } finally { Busy $false } }
function Ensure-Input{ if(!$linkBox.Text.Trim()){ try{$raw=Get-Clipboard -Raw; $links=Extract-Links $raw; if($links.Count -gt 0){$linkBox.Text=$links[0]}}catch{} }; if(!$linkBox.Text.Trim()){ [Windows.Forms.MessageBox]::Show('请先输入或粘贴项目链接。','提示','OK','Warning')|Out-Null; return $false }; if(!$nameBox.Text.Trim()){$nameBox.Text=Derive-ProjectName $linkBox.Text}; return $true }
function Current-TargetSeconds{ if($targetSecondsBox -and $targetSecondsBox.SelectedIndex -eq 1){ 300 } else { 60 } }
function Current-RenderProfile{ if($renderProfileBox -and $renderProfileBox.SelectedIndex -eq 1){ 'performance' } else { 'standard' } }
function Current-Item{ [pscustomobject]@{Name=$nameBox.Text.Trim();Link=$linkBox.Text.Trim();TargetSeconds=(Current-TargetSeconds);Extra=$extraBox.Text.Trim();AddedAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');LastRunAt='';PromptPath='';JsonPath='';VideoPath=''} }
function Build-Args($item){ $a=@('--link',$item.Link); if($item.Name){$a+=@('--name',$item.Name)}; if($item.TargetSeconds -and [int]$item.TargetSeconds -gt 0){ $a+=@('--target-seconds',[string]$item.TargetSeconds) }; if($item.Extra){$a+=@('--extra',$item.Extra)}; $a }
function Prompt-Build($item){ (Node-Run (@('scripts/build-project-analysis-prompt.mjs') + (Build-Args $item)) '生成最终提示词') | ConvertFrom-Json }
function Json-Build($item){ (Node-Run (@('scripts/build-project-json.mjs') + (Build-Args $item)) '生成项目 JSON') | ConvertFrom-Json }
function Render-VideoFromJsonPath($item,[string]$jsonPath,[string]$promptPath,[bool]$autoPlay,[bool]$openFolder){ if(!(Test-Path $jsonPath)){ throw 'JSON 文件不存在，无法继续渲染。' }; $displayName=if($item.Name){$item.Name}else{Derive-ProjectName $item.Link}; $safe=Sanitize-FileName $displayName; $mp4=Join-Path $videosDir ($safe + '.mp4'); $args=@('scripts/render-account-from-json.mjs',$jsonPath,$mp4); if((Current-RenderProfile) -eq 'performance'){ $args += '--profile=performance' }; Node-Run $args '渲染 MP4' | Out-Null; if(!(Test-Path $mp4)){ throw '渲染结束了，但没找到 MP4 输出文件。' }; Add-HistoryItem ([pscustomobject]@{Name=$displayName;Link=$item.Link;TargetSeconds=$item.TargetSeconds;Extra=$item.Extra;AddedAt=$item.AddedAt;LastRunAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');PromptPath=[string]$promptPath;JsonPath=$jsonPath;VideoPath=$mp4}); if($openFolder){ Start-Process explorer.exe "/select,`"$mp4`"" }; if($autoPlay){ Start-Process $mp4 }; return $mp4 }
function Video-Build($item,[bool]$autoPlay,[bool]$openFolder){ $jr=Json-Build $item; return (Render-VideoFromJsonPath $item ([string]$jr.jsonPath) ([string]$jr.promptPath) $autoPlay $openFolder) }
function Rerender-HistoryItem($item,[bool]$autoPlay,[bool]$openFolder){ $rerenderItem=[pscustomobject]@{Name=[string]$item.Name;Link=[string]$item.Link;TargetSeconds=[int]$item.TargetSeconds;Extra=[string]$item.Extra;AddedAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');LastRunAt='';PromptPath=[string]$item.PromptPath;JsonPath=[string]$item.JsonPath;VideoPath=[string]$item.VideoPath}; if($item.JsonPath -and (Test-Path $item.JsonPath)){ Append-Status("检测到历史 JSON，直接重新渲染：$($item.Name)"); return (Render-VideoFromJsonPath $rerenderItem ([string]$item.JsonPath) ([string]$item.PromptPath) $autoPlay $openFolder) }; Append-Status("历史 JSON 不存在，改为重新生成 JSON：$($item.Name)"); return (Video-Build $rerenderItem $autoPlay $openFolder) }
function Open-Dir([string]$path){ New-Item -ItemType Directory -Path $path -Force | Out-Null; Invoke-Item $path }
function Load-ToEditor($item){ if($null -eq $item){return}; $linkBox.Text=[string]$item.Link; $nameBox.Text=[string]$item.Name; $extraBox.Text=[string]$item.Extra; if($targetSecondsBox){ $ts=[int]$item.TargetSeconds; if($ts -ge 240){ $targetSecondsBox.SelectedIndex=1 } else { $targetSecondsBox.SelectedIndex=0 } }; Append-Status("已载入：$($item.Name)") }
function Selected-QueueItem{ if($queueList.SelectedIndex -lt 0){return $null}; [pscustomobject]$queueItems[$queueList.SelectedIndex] }
function Selected-HistoryItem{ if($historyList.SelectedIndex -lt 0){return $null}; if($historyList.SelectedIndex -ge $historyViewItems.Count){return $null}; [pscustomobject]$historyViewItems[$historyList.SelectedIndex] }
function Import-LinksToQueue([string[]]$links,[string]$extra){ $count=0; $ts=(Current-TargetSeconds); foreach($link in @($links | ? {$_ -and $_.Trim()} | Select-Object -Unique)){ $item=[pscustomobject]@{Name=(Derive-ProjectName $link);Link=$link.Trim();TargetSeconds=$ts;Extra=$extra;AddedAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');LastRunAt='';PromptPath='';JsonPath='';VideoPath=''}; $script:queueItems=@($queueItems | ? {$_.Link -ne $item.Link}) + $item; $count++ }; if($count -gt 0){ Save-Queue; Refresh-QueueList; if(!$linkBox.Text.Trim()){ $linkBox.Text=$links[0]; if(!$nameBox.Text.Trim()){$nameBox.Text=Derive-ProjectName $links[0]} } }; $count }
function Handle-Drop($data){ $links=@(); if($data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)){ foreach($path in @($data.GetData([Windows.Forms.DataFormats]::FileDrop))){ $links += Links-FromFile $path } } elseif($data.GetDataPresent([Windows.Forms.DataFormats]::Text)){ $links += Extract-Links ([string]$data.GetData([Windows.Forms.DataFormats]::Text)) }; $links=@($links | Select-Object -Unique); if($links.Count -eq 0){ [Windows.Forms.MessageBox]::Show('没有从拖入内容里提取到有效链接。','提示','OK','Information')|Out-Null; return }; $count=Import-LinksToQueue $links $extraBox.Text.Trim(); Append-Status("已导入 $count 个链接到批量队列。") }
function Invoke-BatchRun([object[]]$items,[string]$taskLabel,[bool]$removeFromFailedCacheOnSuccess){
  $mode=if($queueFailureModeBox.SelectedItem){ [string]$queueFailureModeBox.SelectedItem } else { '失败时询问' }
  $last=''
  $failed=@()
  for($i=0;$i -lt $items.Count;){
    $item=[pscustomobject]$items[$i]
    try{
      Append-Status("$taskLabel $($i+1)/$($items.Count)：$($item.Name)")
      $last=Video-Build $item $false $false
      if($removeFromFailedCacheOnSuccess -or ($failedQueueItems | Where-Object { $_.Link -eq $item.Link } | Select-Object -First 1)){ Remove-FailedQueueItem ([string]$item.Link) }
      Append-Status("执行完成：$($item.Name)")
      $i++
    }catch{
      $message=$_.Exception.Message
      Add-HistoryFailure $taskLabel $item $message
      Remember-FailedQueueItem $item $message
      Append-Status("执行失败：$($item.Name) -> $message")
      if($mode -eq '失败跳过继续'){
        $failed += @($item.Name)
        Append-Status("已跳过失败项，继续下一个：$($item.Name)")
        $i++
        continue
      }
      if($mode -eq '失败即停'){
        [Windows.Forms.MessageBox]::Show("$taskLabel 在 '$($item.Name)' 这里失败。`r`n`r`n$message`r`n`r`n你当前设置为：失败即停。",'批量失败','OK','Error')|Out-Null
        return [pscustomobject]@{ Last=$last; Failed=$failed; Stopped=$true }
      }
      $decision=[Windows.Forms.MessageBox]::Show("$taskLabel 在 '$($item.Name)' 这里失败。`r`n`r`n$message`r`n`r`n重试：重新执行当前项`r`n忽略：跳过继续下一个`r`n中止：停止当前批次。",'批量失败','AbortRetryIgnore','Error')
      if($decision -eq [Windows.Forms.DialogResult]::Retry){
        Append-Status("准备重试：$($item.Name)")
        continue
      }
      if($decision -eq [Windows.Forms.DialogResult]::Ignore){
        $failed += @($item.Name)
        Append-Status("已跳过失败项：$($item.Name)")
        $i++
        continue
      }
      Append-Status('当前批次已中止。')
      return [pscustomobject]@{ Last=$last; Failed=$failed; Stopped=$true }
    }
  }
  return [pscustomobject]@{ Last=$last; Failed=$failed; Stopped=$false }
}

$form.Add_DragEnter({ if($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop) -or $_.Data.GetDataPresent([Windows.Forms.DataFormats]::Text)){ $_.Effect=[Windows.Forms.DragDropEffects]::Copy } else { $_.Effect=[Windows.Forms.DragDropEffects]::None } })
$form.Add_DragDrop({ Handle-Drop $_.Data })
$linkBox.Add_DragEnter({ if($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop) -or $_.Data.GetDataPresent([Windows.Forms.DataFormats]::Text)){ $_.Effect=[Windows.Forms.DragDropEffects]::Copy } else { $_.Effect=[Windows.Forms.DragDropEffects]::None } })
$linkBox.Add_DragDrop({ Handle-Drop $_.Data })
$projectGroup.Add_DragEnter({ if($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop) -or $_.Data.GetDataPresent([Windows.Forms.DataFormats]::Text)){ $_.Effect=[Windows.Forms.DragDropEffects]::Copy } else { $_.Effect=[Windows.Forms.DragDropEffects]::None } })
$projectGroup.Add_DragDrop({ Handle-Drop $_.Data })

$linkBox.Add_Leave({ if(!$nameBox.Text.Trim() -and $linkBox.Text.Trim()){ $nameBox.Text=Derive-ProjectName $linkBox.Text } })
$pasteButton.Add_Click({ try{$links=Extract-Links (Get-Clipboard -Raw); if($links.Count -gt 0){ $linkBox.Text=$links[0]; if(!$nameBox.Text.Trim()){$nameBox.Text=Derive-ProjectName $links[0]}; Append-Status('已从剪贴板提取项目链接。') } else { [Windows.Forms.MessageBox]::Show('剪贴板里没有检测到链接。','提示','OK','Information')|Out-Null } }catch{ [Windows.Forms.MessageBox]::Show('读取剪贴板失败。','错误','OK','Error')|Out-Null } })
$clearButton.Add_Click({ $linkBox.Clear(); $nameBox.Clear(); $extraBox.Clear(); Append-Status('已清空当前项目信息。') })
$toggleKeyButton.Add_Click({
  $keyBox.UseSystemPasswordChar = -not $keyBox.UseSystemPasswordChar
  $toggleKeyButton.Text = if($keyBox.UseSystemPasswordChar){'显示'}else{'隐藏'}
})
$saveKeyButton.Add_Click({
  if(!$keyBox.Text.Trim()){
    [Windows.Forms.MessageBox]::Show('请先输入 Key。','缺少 Key','OK','Warning')|Out-Null; return
  }
  Save-EnvFile $keyBox.Text $modelBox.Text
  Refresh-KeyStatus
  Append-Status('已保存项目本地模型配置。')
})
$queueCurrentButton.Add_Click({ if(!(Ensure-Input)){return}; $count=Import-LinksToQueue @($linkBox.Text.Trim()) $extraBox.Text.Trim(); if($count -gt 0){ Append-Status('已把当前项目加入队列。') } })
$importClipboardQueueButton.Add_Click({ try{$count=Import-LinksToQueue (Extract-Links (Get-Clipboard -Raw)) $extraBox.Text.Trim(); if($count -gt 0){ Append-Status("已从剪贴板导入 $count 个链接到队列。") } else { [Windows.Forms.MessageBox]::Show('剪贴板里没有可导入的链接。','提示','OK','Information')|Out-Null } }catch{ [Windows.Forms.MessageBox]::Show('读取剪贴板失败。','错误','OK','Error')|Out-Null } })
$loadQueueButton.Add_Click({ Load-ToEditor (Selected-QueueItem) })
$removeQueueButton.Add_Click({ $item=Selected-QueueItem; if($null -eq $item){return}; $script:queueItems=@($queueItems | ? {$_.Link -ne $item.Link}); Save-Queue; Refresh-QueueList; Append-Status('已移除选中的队列项。') })
$clearQueueButton.Add_Click({ if([Windows.Forms.MessageBox]::Show('确定要清空整个队列吗？','确认','YesNo','Question') -eq 'Yes'){ $script:queueItems=@(); Save-Queue; Refresh-QueueList; Append-Status('已清空批量队列。') } })
$historySearchBox.Add_TextChanged({ Refresh-HistoryList })
$historySortBox.Add_SelectedIndexChanged({ Refresh-HistoryList })
$historyFilterBox.Add_SelectedIndexChanged({ Refresh-HistoryList })
$historyList.Add_SelectedIndexChanged({ Refresh-HistoryFailureTip })
$queueFailureModeBox.Add_SelectedIndexChanged({ if($queueFailureModeBox.SelectedItem){ Append-Status("批量失败策略：$($queueFailureModeBox.SelectedItem)") } })
$retryFailedQueueButton.Add_Click({ if($failedQueueItems.Count -eq 0){ [Windows.Forms.MessageBox]::Show('当前没有可回填的失败项。','提示','OK','Information')|Out-Null; return }; $count=0; foreach($item in @($failedQueueItems)){ $count += Import-LinksToQueue @($item.Link) $item.Extra }; Append-Status("已把 $count 个失败项重新加入队列。"); [Windows.Forms.MessageBox]::Show("已把 $count 个失败项重新加入批量队列。",'完成','OK','Information')|Out-Null })
$rerunFailedQueueButton.Add_Click({ if($failedQueueItems.Count -eq 0){ [Windows.Forms.MessageBox]::Show('当前没有失败项可直接重跑。','提示','OK','Information')|Out-Null; return }; if([Windows.Forms.MessageBox]::Show("确定只重跑当前 $($failedQueueItems.Count) 个失败项吗？这不会动普通队列。",'确认','YesNo','Question') -ne 'Yes'){ return }; $result=Invoke-BatchRun @($failedQueueItems) '失败重跑' $true; if($result.Stopped){ return }; if($result.Last -and (Test-Path $result.Last)){ Start-Process explorer.exe "/select,`"$($result.Last)`""; if($autoPlayCheck.Checked){ Start-Process $result.Last } } elseif($failedQueueItems.Count -eq 0) { Open-Dir $videosDir }; if($result.Failed.Count -gt 0){ [Windows.Forms.MessageBox]::Show(("失败项重跑结束，但仍有 {0} 个失败项未成功：`r`n- {1}" -f $result.Failed.Count,($result.Failed -join "`r`n- ")),'部分完成','OK','Warning')|Out-Null } else { [Windows.Forms.MessageBox]::Show('失败项已经重跑完成。','完成','OK','Information')|Out-Null } })
$useHistoryButton.Add_Click({ Load-ToEditor (Selected-HistoryItem) })
$requeueHistoryButton.Add_Click({ $item=Selected-HistoryItem; if($null -eq $item){return}; $count=Import-LinksToQueue @($item.Link) $item.Extra; if($count -gt 0){ Append-Status('已把历史项目加入队列。') } })
$rerenderHistoryButton.Add_Click({ $item=Selected-HistoryItem; if($null -eq $item){return}; try{ $mp4=Rerender-HistoryItem $item $autoPlayCheck.Checked $true; Append-Status("历史项目已重新渲染：$mp4"); [Windows.Forms.MessageBox]::Show('历史项目已重新渲染完成。','完成','OK','Information')|Out-Null }catch{ Add-HistoryFailure '重新渲染' $item $_.Exception.Message; Append-Status($_.Exception.Message); [Windows.Forms.MessageBox]::Show($_.Exception.Message,'失败','OK','Error')|Out-Null } })
$historyDetailButton.Add_Click({ Show-HistoryFailureDetails (Selected-HistoryItem) })
$openHistoryVideoButton.Add_Click({ $item=Selected-HistoryItem; if($null -eq $item -or !$item.VideoPath -or !(Test-Path $item.VideoPath)){ [Windows.Forms.MessageBox]::Show('这个历史项没有可打开的视频文件。','提示','OK','Information')|Out-Null; return }; Start-Process explorer.exe "/select,`"$($item.VideoPath)`""; if($autoPlayCheck.Checked){ Start-Process $item.VideoPath } })
$clearHistoryButton.Add_Click({ if([Windows.Forms.MessageBox]::Show('确定要清空历史吗？','确认','YesNo','Question') -eq 'Yes'){ $script:historyItems=@(); Save-History; Refresh-HistoryList; Append-Status('已清空最近项目历史。') } })
$queueList.Add_DoubleClick({ Load-ToEditor (Selected-QueueItem) })
$historyList.Add_DoubleClick({ Load-ToEditor (Selected-HistoryItem) })
$promptButton.Add_Click({ if(!(Ensure-Input)){return}; try{$item=Current-Item; $result=Prompt-Build $item; if($result.outputPath -and (Test-Path $result.outputPath)){ Set-Clipboard -Value (Get-Content $result.outputPath -Raw -Encoding UTF8); Invoke-Item $result.outputPath; Append-Status('最终提示词已生成，并已复制到剪贴板。') }}catch{ Append-Status($_.Exception.Message); [Windows.Forms.MessageBox]::Show($_.Exception.Message,'失败','OK','Error')|Out-Null } })
$jsonButton.Add_Click({ if(!(Ensure-Input)){return}; $item=Current-Item; try{ $result=Json-Build $item; if($result.jsonPath -and (Test-Path $result.jsonPath)){ Set-Clipboard -Value (Get-Content $result.jsonPath -Raw -Encoding UTF8); Invoke-Item $result.jsonPath; Add-HistoryItem ([pscustomobject]@{Name=$item.Name;Link=$item.Link;Extra=$item.Extra;AddedAt=$item.AddedAt;LastRunAt=(Get-Date).ToString('yyyy-MM-dd HH:mm:ss');PromptPath=[string]$result.promptPath;JsonPath=[string]$result.jsonPath;VideoPath='';Status='json';LastError='' }); Append-Status('项目 JSON 已生成，并已复制到剪贴板。') }}catch{ Add-HistoryFailure '生成项目 JSON' $item $_.Exception.Message; Append-Status($_.Exception.Message); [Windows.Forms.MessageBox]::Show($_.Exception.Message,'失败','OK','Error')|Out-Null } })
$videoButton.Add_Click({ if(!(Ensure-Input)){return}; $item=Current-Item; try{ $mp4=Video-Build $item $autoPlayCheck.Checked $true; Append-Status("视频已生成：$mp4"); [Windows.Forms.MessageBox]::Show('视频已渲染完成，已打开输出位置。','完成','OK','Information')|Out-Null }catch{ Add-HistoryFailure '生成视频' $item $_.Exception.Message; Append-Status($_.Exception.Message); [Windows.Forms.MessageBox]::Show($_.Exception.Message,'失败','OK','Error')|Out-Null } })
$runQueueButton.Add_Click({
  if($queueItems.Count -eq 0){ [Windows.Forms.MessageBox]::Show('队列里还没有项目。','提示','OK','Information')|Out-Null; return }
  if([Windows.Forms.MessageBox]::Show("确定执行队列中的 $($queueItems.Count) 个项目吗？",'确认','YesNo','Question') -ne 'Yes'){return}
  $result=Invoke-BatchRun @($queueItems) '批量任务' $true
  if($result.Stopped){ return }
  if($result.Last -and (Test-Path $result.Last)){ Start-Process explorer.exe "/select,`"$($result.Last)`""; if($autoPlayCheck.Checked){ Start-Process $result.Last } } else { Open-Dir $videosDir }
  if($result.Failed.Count -gt 0){ [Windows.Forms.MessageBox]::Show(("批量队列执行完成，但有 {0} 个失败项已跳过。可点击[回填失败项]或[只重跑失败项]继续处理。`r`n- {1}" -f $result.Failed.Count,($result.Failed -join "`r`n- ")),'部分完成','OK','Warning')|Out-Null } else { [Windows.Forms.MessageBox]::Show('批量队列已经全部执行完成。','完成','OK','Information')|Out-Null }
})
$openPromptsButton.Add_Click({ Open-Dir $promptsDir })
$openJsonButton.Add_Click({ Open-Dir $jsonDir })
$openVideosButton.Add_Click({ Open-Dir $videosDir })
$refreshButton.Add_Click({ Refresh-KeyStatus; $script:queueItems=@(Read-JsonArray $queuePath | % { To-Item $_ }); $script:historyItems=@(Read-JsonArray $historyPath | % { To-Item $_ }); $script:failedQueueItems=@(Read-JsonArray $failedQueuePath | % { To-Item $_ }); Refresh-QueueList; Refresh-HistoryList; Append-Status('界面状态已刷新。') })

Refresh-KeyStatus; Refresh-QueueList; Refresh-HistoryList; Append-Status('面板已启动。先配置 Key，再复制链接，最后点“一键生成视频”。')
[void]$form.ShowDialog()




