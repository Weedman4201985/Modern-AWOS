$loggerModulePath = Join-Path $PSScriptRoot "..\logger.psm1"
if (Test-Path $loggerModulePath) {
    try {
        Import-Module $loggerModulePath -Force
    } catch {
        Write-Host "Failed to import logger module: $_" -ForegroundColor Red
    }
}

# Check for Node.js process
$nodeProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
Write-Log -Message "Restart Initated" -Level "INFO" -Path $ServerLog


if ($nodeProcess) {
    Write-Host "[INFO] Node.js process found. Terminating..." -ForegroundColor Yellow
    Stop-Process -Name "node" -Force
    Write-Host "[OK] Node.js process terminated." -ForegroundColor Green
} else {
    Write-Host "[INFO] No Node.js process found. Nothing to terminate." -ForegroundColor Cyan
}

# Restart the dev server
Write-Host "[ACTION] Starting development server..." -ForegroundColor Green
npm run dev
