$loggerModulePath = Join-Path $PSScriptRoot "..\logger.psm1"
if (Test-Path $loggerModulePath) {
    try {
        Import-Module $loggerModulePath -Force
    } catch {
        Write-Host "Failed to import logger module: $_" -ForegroundColor Red
    }
}


param (
    [string]$Url = "http://localhost:3000/latest-awos"
)

Clear-Host
Write-Host "=== AWOS Raw XML Viewer ===" -ForegroundColor Cyan
Write-Host "Using URL: $Url"
try {
    $xml = Invoke-WebRequest -Uri $Url -UseBasicParsing
    Write-Host "`n--- Raw XML ---" -ForegroundColor Yellow
    Write-Host $xml.Content
} catch {
    Write-Host "`n[Error] Failed to retrieve XML data." -ForegroundColor Red
    try {
        Write-Log -Message "Failed to retrieve XML data" -Level "ERROR" -Path $LauncherLog
        Write-Log -Message "Failed to retrieve XML data" -Level "ERROR" -Path $psErrorLog
    } catch {
        Write-Host "Logging failed." -ForegroundColor DarkRed
    }
}

Write-Host "`nPress Enter to return to menu..."
[void](Read-Host)