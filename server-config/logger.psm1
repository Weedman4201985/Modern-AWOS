$Global:LogDir = "D:\Work Projects\MET\awos-modern2\logs"
$Global:ServerLog   = Join-Path $LogDir "server.log"
$Global:psErrorLog    = Join-Path $LogDir "error-powershell.log"
$Global:nodeErrorLog    = Join-Path $LogDir "error-node.log"
$Global:ShutdownLog = Join-Path $LogDir "shutdown.log"
$Global:LauncherLog = Join-Path $LogDir "launcher.log"

if (-not (Test-Path $LogDir)) {
    New-Item -Path $LogDir -ItemType Directory | Out-Null
}

function Write-Log {
    param (
        [Parameter(Mandatory)][string]$Message,
        [Parameter()][string]$Level = "INFO",
        [Parameter()][string]$Path = $Global:ServerLog
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        Write-Host "⚠️ Log path is missing. Skipping log write." -ForegroundColor Yellow
        return
    }

    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffK"
    $caller = "unknown"
    $stack = Get-PSCallStack
    if ($stack.Count -gt 1) {
        $caller = $stack[1].FunctionName
    } elseif ($MyInvocation.ScriptName) {
        $caller = Split-Path $MyInvocation.ScriptName -Leaf
    }

    $entry = "$timestamp [$Level] [$caller] $Message"
    Add-Content -Path $Path -Value $entry
}

