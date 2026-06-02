param(
  [int]$Port = 4175,
  [string]$BindHost = "0.0.0.0"
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $ProjectRoot ".local"
$LogFile = Join-Path $LogDir "preview-watchdog.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location -LiteralPath $ProjectRoot

function Write-WatchdogLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -LiteralPath $LogFile -Value $line
}

Write-WatchdogLog "Watchdog started for http://localhost:$Port"

$ClientBuild = Join-Path $ProjectRoot "dist\client\assets"
$ServerBuild = Join-Path $ProjectRoot "dist\server"

if (-not ((Test-Path $ClientBuild) -and (Test-Path $ServerBuild))) {
  Write-WatchdogLog "Production build not found. Running npm run build first."
  npm run build 2>&1 | ForEach-Object { Write-WatchdogLog $_ }
}

while ($true) {
  Write-WatchdogLog "Starting Vite preview on $BindHost`:$Port"
  $env:BROWSER = "none"

  npm run preview -- --host $BindHost --port $Port --strictPort 2>&1 |
    ForEach-Object { Write-WatchdogLog $_ }

  $exitCode = $LASTEXITCODE
  Write-WatchdogLog "Preview stopped with exit code $exitCode. Restarting in 3 seconds."
  Start-Sleep -Seconds 3
}
