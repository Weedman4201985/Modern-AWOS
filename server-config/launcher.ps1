Import-Module "$PSScriptRoot\logger.psm1"

$scriptPath = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $PSCommandPath }

function Get-ServerStatus {
    param (
        [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$Url
    )
    try {
        # Use a lightweight HEAD request with a short timeout
        Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 2 -UseBasicParsing | Out-Null
        return @{ Status = "RUNNING"; Color = "Green" }
    } catch {
        return @{ Status = "NOT RUNNING"; Color = "Red" }
    }
}

function Get-PortStatus {
    param (
        [int]$Port
    )
    # Querying directly by port avoids pipeline filtering for better performance
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($null -ne $listening) {
        return @{ Status = "IN USE"; Color = "Red" }
    } else {
        return @{ Status = "FREE"; Color = "Green" }
    }
}

function Show-ServerMenu {
    do {
        Clear-Host
        Write-Host "=== Server Control Menu ===" -ForegroundColor Cyan
        Write-Host "1. Launch Server"
        Write-Host "2. Shutdown Server"
        Write-Host "3. Restart Server"
        Write-Host "4. Back to Main Menu"
        Write-Host ''

        $choice = (Read-Host "Select an option (1-4)").Trim()

        switch ($choice) {
            '1' {
                Start-Companion -ScriptName "start-server.ps1" -ActionLabel "Launch Server"
                Write-Host "`nPress Enter to return to Server Menu..."
                [void](Read-Host)
            }
            '2' {
                Start-Companion -ScriptName "shutdown-server.ps1" -ActionLabel "Shutdown Server"
                Write-Host "`nPress Enter to return to Server Menu..."
                [void](Read-Host)
            }
            '3' {
                Start-Companion -ScriptName "restart-server.ps1" -ActionLabel "Restart Server"
                Write-Host "`nPress Enter to return to Server Menu..."
                [void](Read-Host)
            }
            '4' {
                Write-Host "Returning to main menu..." -ForegroundColor Cyan
                return
            }
            default {
                Write-Host "Invalid selection. Try again." -ForegroundColor Yellow
                Start-Sleep -Milliseconds 900
            }
        }
    } while ($true)
}

function Show-Menu {
    param(
        [Parameter()][string]$ServerUrl = 'http://localhost:3000',
        [Parameter()][string]$AWOSXMLUrl = 'http://localhost:3000/latest-awos',
        [Parameter()][string]$Title = 'AWOS Launcher Dashboard'
    )

    Clear-Host
    if ($Host -and $Host.UI -and $Host.UI.RawUI) {
        $Host.UI.RawUI.WindowTitle = $Title
    }

    $uri  = [Uri]$ServerUrl
    $port = $uri.Port

    $statusInfo   = Get-ServerStatus -Url $ServerUrl
    $AWOSXMLInfo  = Get-ServerStatus -Url $AWOSXMLUrl
    $portInfo     = Get-PortStatus -Port $port

    Write-Host ("=== {0} ===" -f $Title) -ForegroundColor Cyan
    Write-Host ("Server Status: {0}" -f $statusInfo.Status) -ForegroundColor $statusInfo.Color
    Write-Host ("AWOS XML Data Status: {0}" -f $AWOSXMLInfo.Status) -ForegroundColor $AWOSXMLInfo.Color
    Write-Host ("Port {0}: {1}" -f $port, $portInfo.Status) -ForegroundColor $portInfo.Color
    Write-Host ''
    Write-Host ("Server URL: {0}" -f $ServerUrl)
    Write-Host ("Latest AWOS XML Data URL: {0}" -f $AWOSXMLUrl)
    Write-Host ''

   $menuItems = @(
    @{ Key='1'; Label='Server Controls'    ; Script=$null },
    @{ Key='2'; Label='Open Browser'       ; Script='open-browser.ps1' },
    @{ Key='3'; Label='View Logs'          ; Script=$null },
    @{ Key='4'; Label='View Raw AWOS XML'  ; Script=$null },
    @{ Key='5'; Label='Exit'               ; Script=$null }
)

    Write-Host '---------- MAIN MENU ------------'
    foreach ($i in $menuItems) {
        Write-Host ("{0}. {1}" -f $i.Key, $i.Label)
    }
    Write-Host '---------------------------------'
    Write-Host ''

    Write-Log -Message "Launcher initialized" -Path $LauncherLog
}

function Invoke-MenuAction {
    param(
        [Parameter(Mandatory)][string]$Choice
    )

    switch ($Choice) {
        '1' { Show-ServerMenu }
        '2' { & "open-browser.ps1" }
        '3' { Show-LogViewer }
        '4' { Show-RawXML -Url $AWOSXMLUrl }
        '5' { Write-Host "Exiting..." }
        default {
            Write-Host "Invalid selection. Try again." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 900
        }
    }


}

function Start-Companion {
    param(
        [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ScriptName,
        [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$ActionLabel
    )
    $fullPath = Join-Path $scriptPath $ScriptName
    if (-not (Test-Path -LiteralPath $fullPath)) {
        Write-Log -Message "Script not found: $fullPath" -Level "ERROR" -Path $LauncherLog
        Write-Host "[Error] Script not found: $fullPath" -ForegroundColor Red
        return
    }
    Write-Log -Message "Running action: $ActionLabel" -Path $LauncherLog
    Write-Host "[Launching] $ActionLabel..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$fullPath`""
}

function Show-RawXML {
    Clear-Host
    Write-Host "=== AWOS Raw XML Viewer ===" -ForegroundColor Cyan
    try {
        $xml = Invoke-WebRequest -Uri "http://localhost:3000/latest-awos" -UseBasicParsing
        Write-Host "`n--- Raw XML ---" -ForegroundColor Yellow
        $xml.Content
    } catch {
        Write-Host "`n[Error] Failed to retrieve XML data." -ForegroundColor Red
        Write-Log -Message "Failed to retrieve XML data" -Level "ERROR" -Path $LauncherLog
        Write-Log -Message "Failed to retrieve XML data" -Level "ERROR" -Path $ErrorLog

    }
    Write-Host "`nPress Enter to return to menu..."
    [void](Read-Host)
}

function Show-LogTail {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Path,
        [Parameter()][int]$TailLineCount = 20
    )

    if (Test-Path $Path)
    {
        Write-Host "`n--- Showing last $TailLineCount lines of $Name ---" -ForegroundColor Yellow
        Get-Content -Path $Path -Tail $TailLineCount
    }
    else
    {
        Write-Host "`n[Error] Log file not found: $Path" -ForegroundColor Red
        Write-Log -Message "Log file not found: $Path" -Level "ERROR" -Path $ErrorLog
    }
}

function Show-LogViewer {
    $TailLineCount = 20

    $LogFiles = @(
        @{ Name = "Launcher Log"; Path = $LauncherLog },
        @{ Name = "Server Log"; Path = $ServerLog },
        @{ Name = "Shutdown Log"; Path = $ShutdownLog }
    )

    do {
        Clear-Host
        Write-Host "=== Log Viewer ===" -ForegroundColor Cyan

        for ($i = 0; $i -lt $LogFiles.Count; $i++) {
            Write-Host "$($i + 1). View $($LogFiles[$i].Name)"
        }

        $CombinedLogOption = $LogFiles.Count + 1
        $ClearOption = $LogFiles.Count + 2
        $BackOption = $LogFiles.Count + 3

        Write-Host "$CombinedLogOption. View Combined Error Log"

        Write-Host "$ClearOption. Clear a Log"
        Write-Host "$BackOption. Back to Main Menu"

        $choice = Read-Host "Select an option (1-$BackOption)"

        if ($choice -notmatch '^\d+$') {
            Write-Host "`nPlease enter a valid number between 1 and $BackOption." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 900
            continue
        }

        $ChoiceInt = [int]$choice

        if ($ChoiceInt -ge 1 -and $ChoiceInt -le $LogFiles.Count) {
            $index = $ChoiceInt - 1
            $logInfo = $LogFiles[$index]
            Show-LogTail -Name $logInfo.Name -Path $logInfo.Path -TailLineCount $TailLineCount
            Write-Host "`nPress Enter to return to log menu..."
            [void](Read-Host)
        }
        elseif ($ChoiceInt -eq $ClearOption) {
            try {
                Show-ClearLogsMenu -LogFiles $LogFiles
            } catch {
                Write-Host "Error opening Clear Logs menu: $_" -ForegroundColor Red
                Write-Log -Message "Error opening Clear Logs menu: $_" -Level "ERROR" -Path $ErrorLog}
        }
        elseif ($ChoiceInt -eq $CombinedLogOption) {
            Show-CombinedErrorLog
            Write-Host "`nPress Enter to return to log menu..."
            [void](Read-Host)
        }
        elseif ($ChoiceInt -eq $BackOption) {
            break
        }
        else {
            Write-Host "`nInvalid selection. Please choose between 1 and $BackOption." -ForegroundColor Yellow
            Start-Sleep -Milliseconds 900
        }
    } while ($true)
}

function Clear-LogFile {
    param (
        [Parameter(Mandatory)][string]$LogPath,
        [Parameter(Mandatory)][string]$LogName
    )

    if (-not (Test-Path $LogPath)) {
        Write-Host "[Error] Log file not found: $LogPath" -ForegroundColor Red
        Write-Log -Message "Attempted to clear non-existent log: $LogPath" -Level "ERROR" -Path $ErrorLog
        return
    }

    $confirm = Read-Host "Are you sure you want to clear '$LogName'? Type YES to confirm"
    if ($confirm -eq 'YES') {
        Clear-Content -Path $LogPath
        Write-Host "[Cleared] $LogName has been emptied." -ForegroundColor Green
        Write-Log -Message "Cleared log: $LogName" -Level "INFO" -Path $LauncherLog
    } else {
        Write-Host "[Cancelled] Log clearing aborted." -ForegroundColor Yellow
    }
}

function Show-ClearLogsMenu {
    param (
        [array]$LogFiles = @(
            @{ Name = "Launcher Log"; Path = $LauncherLog },
            @{ Name = "Server Log"; Path = $ServerLog },
            @{ Name = "Shutdown Log"; Path = $ShutdownLog },
            @{ Name = "Error Log"; Path = $ErrorLog }
        )
    )

    do {
        Clear-Host
        Write-Host "=== Clear Logs ===" -ForegroundColor Cyan

        for ($i = 0; $i -lt $LogFiles.Count; $i++) {
            Write-Host "$($i + 1). Clear $($LogFiles[$i].Name)"
        }
        $clearAllOption = $LogFiles.Count + 1
        $backOption = $LogFiles.Count + 2

        Write-Host "$clearAllOption. Clear ALL Logs"
        Write-Host "$backOption. Back to Previous Menu"

        $logChoice = Read-Host "Select an option (1-$backOption)"

        if ($logChoice -in @('1','2','3','4')) {
            $index = [int]$logChoice - 1
            $logPath = $LogFiles[$index].Path
            $logName = $LogFiles[$index].Name
            Clear-LogFile -LogPath $logPath -LogName $logName
        } elseif ($logChoice -eq "$clearAllOption") {
            Clear-AllLogs
        } elseif ($logChoice -eq "$backOption") {
            break
        } else {
            Write-Host "Invalid selection." -ForegroundColor Red
        }

        Write-Host "`nPress Enter to return to Clear Logs menu..."
        [void](Read-Host)
    } while ($true)
}

function Clear-AllLogs {
    $logFiles = @(
        @{ Name="Launcher Log"; Path=$LauncherLog },
        @{ Name="Server Log"; Path=$ServerLog },
        @{ Name="Shutdown Log"; Path=$ShutdownLog },
        @{ Name="Error Log"; Path=$ErrorLog }
    )

    $confirm = Read-Host "Are you sure you want to clear ALL logs? Type YES to confirm"
    if ($confirm -eq 'YES') {
        foreach ($log in $logFiles) {
            if (Test-Path $log.Path) {
                Clear-Content -Path $log.Path
                Write-Host "[Cleared] $($log.Name)" -ForegroundColor Green
                Write-Log -Message "Cleared log: $($log.Name)" -Level "INFO" -Path $LauncherLog
            } else {
                Write-Host "[Missing] $($log.Name) not found." -ForegroundColor Yellow
                Write-Log -Message "Log not found during clear-all: $($log.Path)" -Level "WARN" -Path $ErrorLog
            }
        }
    } else {
        Write-Host "[Cancelled] Clear all logs aborted." -ForegroundColor Yellow
    }
}

function Show-CombinedErrorLog {
    $nodeErrorLog = Join-Path $LogDir "error-node.log"
    $psErrorLog   = Join-Path $LogDir "error-powershell.log"

    Write-Host "Checking logs at:" -ForegroundColor Cyan
    Write-Host " - $nodeErrorLog"
    Write-Host " - $psErrorLog"

    $logs = @()

    if (Test-Path $nodeErrorLog) {
        $nodeContent = Get-Content $nodeErrorLog
        Write-Host "Node log lines: $($nodeContent.Count)"
        $logs += $nodeContent
    } else {
        Write-Host "Node log not found." -ForegroundColor Yellow
    }

    if (Test-Path $psErrorLog) {
        $psContent = Get-Content $psErrorLog
        Write-Host "PS log lines: $($psContent.Count)"
        $logs += $psContent
    } else {
        Write-Host "PS log not found." -ForegroundColor Yellow
    }

    if ($logs.Count -eq 0) {
        Write-Host "[Info] Logs found, but they are empty." -ForegroundColor Yellow
        return
    }

    $sortedLogs = $logs | Sort-Object {
        if ($_ -match '^\[(.*?)\]') { [datetime]$matches[1] } else { Get-Date }
    }

    Write-Host "`n--- Combined Error Log (Last 20 Entries) ---" -ForegroundColor Cyan
    $sortedLogs | Select-Object -Last 20
}

do {
    Show-Menu
    $choice = Read-Host "Select an option (1-5)"
    Invoke-MenuAction -Choice $choice

    if ($choice -ne '5') {
        Write-Host "`nPress Enter to return to menu..."
        [void](Read-Host)
    }
} while ($choice -ne '5')