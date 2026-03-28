param(
  [string]$JobName = "DAS周报"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..")

Set-Location $rootDir

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $npmCommand) {
  throw "未找到 npm，请先安装 Node.js，并确保 npm 已加入 PATH。"
}

& $npmCommand.Source run once -- --job $JobName
