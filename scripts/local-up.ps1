param(
  [int]$Port = 4175
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Watchdog = Join-Path $PSScriptRoot "local-preview-watchdog.ps1"

function Test-LocalPort {
  param([int]$PortToCheck)
  $connection = Test-NetConnection -ComputerName localhost -Port $PortToCheck -WarningAction SilentlyContinue
  return [bool]$connection.TcpTestSucceeded
}

if (Test-LocalPort -PortToCheck $Port) {
  Write-Host "VA Consultoria Manager already running at http://localhost:$Port"
  exit 0
}

Start-Process -FilePath "powershell.exe" `
  -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    $Watchdog,
    "-Port",
    "$Port"
  ) `
  -WorkingDirectory $ProjectRoot `
  -WindowStyle Hidden

for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Seconds 1
  if (Test-LocalPort -PortToCheck $Port) {
    Write-Host "VA Consultoria Manager running at http://localhost:$Port"
    exit 0
  }
}

Write-Host "Server did not answer on port $Port yet. Check .local/preview-watchdog.log for details."
exit 1
