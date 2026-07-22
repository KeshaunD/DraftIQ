param(
  [string]$ExtensionId = "ogpmogkdeajnbphkgkmciijjhnmjadpp"
)

$ErrorActionPreference = "Stop"

if ($ExtensionId -notmatch "^[a-p]{32}$") {
  throw "DraftIQ Chrome extension ID is invalid: $ExtensionId"
}

$nativeHostRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourcePath = Join-Path $nativeHostRoot "DraftIQYahooHost.cs"
$hostPath = Join-Path $nativeHostRoot "DraftIQYahooHost.exe"
$manifestPath = Join-Path $nativeHostRoot "com.draftiq.yahoo_sync.json"
$nodeCommand = Get-Command node -ErrorAction Stop
$compiler = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = (Get-Command csc -ErrorAction Stop).Source
}

& $compiler /nologo /target:exe /platform:anycpu /optimize+ "/out:$hostPath" $sourcePath
if ($LASTEXITCODE -ne 0) {
  throw "DraftIQ's Chrome launcher could not be compiled."
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $nativeHostRoot "node-path.txt"),
  $nodeCommand.Source,
  $utf8WithoutBom
)

$manifest = [ordered]@{
  name = "com.draftiq.yahoo_sync"
  description = "DraftIQ Yahoo sync helper launcher"
  path = $hostPath
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

[System.IO.File]::WriteAllText(
  $manifestPath,
  ($manifest | ConvertTo-Json -Depth 3),
  $utf8WithoutBom
)

$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.draftiq.yahoo_sync"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -LiteralPath $registryPath -Value $manifestPath

Write-Host "DraftIQ Yahoo launcher installed for Chrome extension $ExtensionId."
Write-Host "Reload DraftIQ on chrome://extensions, then use Connect Yahoo normally."
