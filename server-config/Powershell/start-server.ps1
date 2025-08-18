$loggerModulePath = Join-Path $PSScriptRoot "..\logger.psm1"

if (Test-Path $loggerModulePath) {
    try {
        Import-Module $loggerModulePath -Force
    } catch {
        Write-Host "Failed to import logger module: $_" -ForegroundColor Red
    }
}

# Set project path
$projectPath = $PSScriptRoot

# Check if directory exists
if (Test-Path $projectPath) {
    Write-Host "Navigating to project directory..." -ForegroundColor Cyan
    Set-Location $projectPath

    Write-Host "Starting development server..." -ForegroundColor Green
    Write-Log -Message "Server started" -Path $ServerLog
    npm run dev
} else {
    Write-Host "Project directory not found: $projectPath" -ForegroundColor Red
}
