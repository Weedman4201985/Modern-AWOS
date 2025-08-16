Import-Module "$PSScriptRoot\logger.psm1"

$port = 3000
Write-Log -Message "Shutdown initiated" -Path $ShutdownLog
Write-Log -Message "Shutdown initiated" -Path $ServerLog


Write-Host "------ Nightly shutdown initiated... ------" -ForegroundColor Blue
Write-Host " "

# Kill Node.js process
Write-Host "[ACTION] Terminating Node.js process..." -ForegroundColor Yellow
Write-Host " "
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Kill any process still holding the port
try {
    $proc_id = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess
    if ($proc_id) {
        Write-Host "[ACTION] Killing lingering process on port $port (PID: $proc_id)" -ForegroundColor Yellow
        Write-Log -Message "Port still open. Attempting to close port $port and kill process (PID: $proc_id)" -Level "ERROR" -Path $ErrorLog
        Write-Log -Message "Port still open. Attempting to close port $port and kill process (PID: $proc_id)" -Level "ERROR" -Path $ServerLog
        Stop-Process -Id $proc_id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host " "
    Write-Host "[ACTION] Port: $port and associated process has been closed successfully." -ForegroundColor Yellow
    Write-Log -Message "Port: $port and associated process has been closed successfully." -Level "INFO" -Path $ServerLog
    Write-Log -Message "Port: $port and associated process has been closed successfully." -Level "INFO" -Path $ShutdownLog
}

Start-Sleep -Seconds 3

# Check if port is still listening
$portInUse = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq $port }

if ($portInUse) {
    Add-Content -Path $errorLog -Value "$(Get-Date) - ERROR: Port still in use"
    Write-Host "[WARNING] Port $port is still in use. Something may be stuck." -ForegroundColor Yellow
    Write-Log -Message "Port $port is still in use. Something may be stuck." -Level "ERROR" -Path $ErrorLog
    Write-Log -Message "Port $port is still in use. Something may be stuck." -Level "ERROR" -Path $ServerLog
} else {
    Write-Host " "
    Write-Host "[OK] Port $port is now free." -ForegroundColor Green
    Write-Host "[OK]Shutdown complete." -ForegroundColor Green
    Write-Host " "
    Write-Log -Message "Shutdown complete and Port is free." -Level "INFO" -Path $ShutdownLog
    Write-Log -Message "Shutdown complete and Port is free." -Level "INFO" -Path $ServerLog
}

Write-Host "------ Good night, dev machine. ------" -ForegroundColor Blue

Write-Host " "
Read-Host -Prompt "Press Enter to close"
