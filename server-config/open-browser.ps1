Import-Module "$PSScriptRoot\logger.psm1"


# Define URLs
$urls = @(
    "http://localhost:3000",
    "http://localhost:3000/latest-awos",
    "http://localhost:3000/raw-xml",
    "https://met.forces.gc.ca/english/airops/AWOS/?id=CYTR"
)

# Build the argument string for Edge
$edgeArgs = "--new-window"
foreach ($url in $urls) {
    $edgeArgs += " $url"
}

# Launch Edge with all URLs in one new window
Start-Process "msedge.exe" -ArgumentList $edgeArgs

Write-Host "[OK] Microsoft Edge launched with 4 tabs in a new window." -ForegroundColor Green
Write-Log -Message "Browser launched successfully" -Level "INFO" -Path $ServerLog