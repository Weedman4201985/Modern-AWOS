Import-Module "$PSScriptRoot\logger.psm1"

# Set project path
$projectPath = "D:\Work Projects\MET\awos-modern2"

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
