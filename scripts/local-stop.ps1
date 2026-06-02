param(
  [int]$Port = 4175
)

$ErrorActionPreference = "Continue"

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  if ($processId) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

$watchdogs = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*local-preview-watchdog.ps1*" }

foreach ($watchdog in $watchdogs) {
  Stop-Process -Id $watchdog.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped VA Consultoria Manager local server on port $Port."
