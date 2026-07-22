$ErrorActionPreference = "Stop"

$ProjectRoot = (
    Resolve-Path (
        Join-Path $PSScriptRoot ".."
    )
).Path

$ProjectsFolder = Split-Path $ProjectRoot -Parent

$PublicRepo = Join-Path `
    $ProjectsFolder `
    "draftiq-public-data"

$HostedJson = Join-Path `
    $ProjectRoot `
    "hosted\draftiq-data-2026.json"

$PublicJson = Join-Path `
    $PublicRepo `
    "draftiq-data-2026.json"

$SecretsFile = Join-Path `
    $PSScriptRoot `
    "espn-secrets.ps1"


if (Test-Path $SecretsFile) {
    . $SecretsFile
}


function Write-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,

        [Parameter(Mandatory = $true)]
        [int]$Step,

        [Parameter(Mandatory = $true)]
        [int]$Total
    )

    Write-Host ""

    Write-Host `
        "Step $Step/$Total`: $Message" `
        -ForegroundColor Yellow
}


function Invoke-ExternalCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [string[]]$ArgumentList = @()
    )

    & $FilePath @ArgumentList

    if ($LASTEXITCODE -ne 0) {
        $argumentsText = $ArgumentList -join " "

        throw (
            "Command failed with exit code " +
            "$LASTEXITCODE`: " +
            "$FilePath $argumentsText"
        )
    }
}


Write-Host ""

Write-Host `
    "DraftIQ Full Data Refresh" `
    -ForegroundColor Cyan

Write-Host `
    "-------------------------" `
    -ForegroundColor Cyan

Write-Host "Private project: $ProjectRoot"
Write-Host "Public data repo: $PublicRepo"


foreach ($command in @("node", "python", "git")) {
    if (
        -not (
            Get-Command `
                $command `
                -ErrorAction SilentlyContinue
        )
    ) {
        throw (
            "Required command '$command' was not found."
        )
    }
}


if (-not (Test-Path $PublicRepo)) {
    throw @"
Public data repository was not found:

$PublicRepo

The draftiq-public-data repository must be located beside
fantasy-draft-assistant.
"@
}


$PublicGitFolder = Join-Path $PublicRepo ".git"

if (-not (Test-Path $PublicGitFolder)) {
    throw "$PublicRepo is not a Git repository."
}


if (-not $env:ESPN_S2 -or -not $env:ESPN_SWID) {
    throw @"
Missing ESPN cookies.

Set ESPN_S2 and ESPN_SWID in the current PowerShell session,
or create:

$SecretsFile

Do not commit or share the cookie values.
"@
}


Push-Location $ProjectRoot

try {
    Write-Step `
        -Message "Fetching ESPN ADP and projections..." `
        -Step 1 `
        -Total 6

    Invoke-ExternalCommand `
        -FilePath "node" `
        -ArgumentList @(
            "scripts\fetch_espn_playercard_data.js"
        )


    Write-Step `
        -Message "Fetching Sleeper projections..." `
        -Step 2 `
        -Total 6

    Invoke-ExternalCommand `
        -FilePath "node" `
        -ArgumentList @(
            "scripts\fetch_sleeper_projections.js"
        )


    Write-Step `
        -Message "Building Sleeper ADP..." `
        -Step 3 `
        -Total 6

    Invoke-ExternalCommand `
        -FilePath "node" `
        -ArgumentList @(
            "scripts\build_sleeper_adp_from_raw.js"
        )


    Write-Step `
        -Message "Building rankings, export, and RotoWire news..." `
        -Step 4 `
        -Total 6

    Invoke-ExternalCommand `
        -FilePath "python" `
        -ArgumentList @(
            "src\update_draftiq_data.py",
            "plantation",
            "2026"
        )


    if (-not (Test-Path $HostedJson)) {
        throw (
            "DraftIQ export was not created: " +
            $HostedJson
        )
    }


    Write-Step `
        -Message "Copying hosted JSON into the public repository..." `
        -Step 5 `
        -Total 6

    Copy-Item `
        -Path $HostedJson `
        -Destination $PublicJson `
        -Force


    Write-Step `
        -Message "Publishing updated DraftIQ data to GitHub..." `
        -Step 6 `
        -Total 6

    $publicChanges = & git `
        -C $PublicRepo `
        status `
        --porcelain `
        -- `
        "draftiq-data-2026.json"

    if ($LASTEXITCODE -ne 0) {
        throw (
            "Could not check the public repository status."
        )
    }

    $publicChangesText = (
        $publicChanges -join "`n"
    )


    if (
        [string]::IsNullOrWhiteSpace(
            $publicChangesText
        )
    ) {
        Write-Host ""

        Write-Host `
            "Public DraftIQ data is already current. Nothing to push." `
            -ForegroundColor Green
    }
    else {
        $commitTimestamp = Get-Date `
            -Format "yyyy-MM-dd HH:mm"

        Invoke-ExternalCommand `
            -FilePath "git" `
            -ArgumentList @(
                "-C",
                $PublicRepo,
                "add",
                "draftiq-data-2026.json"
            )

        Invoke-ExternalCommand `
            -FilePath "git" `
            -ArgumentList @(
                "-C",
                $PublicRepo,
                "commit",
                "-m",
                "Update DraftIQ data $commitTimestamp"
            )

        Invoke-ExternalCommand `
            -FilePath "git" `
            -ArgumentList @(
                "-C",
                $PublicRepo,
                "push"
            )

        Write-Host ""

        Write-Host `
            "Updated DraftIQ JSON was pushed to the public repository." `
            -ForegroundColor Green
    }


    Write-Host ""

    Write-Host `
        "DraftIQ refresh complete." `
        -ForegroundColor Green

    Write-Host ""

    Write-Host `
        "Final step:" `
        -ForegroundColor Cyan

    Write-Host (
        "Wait a few seconds, then click the " +
        "refresh button inside DraftIQ."
    )

    Write-Host (
        "Open a player profile and check " +
        "Latest Player News."
    )

    Write-Host ""
}
catch {
    Write-Host ""

    Write-Host `
        "DraftIQ refresh failed." `
        -ForegroundColor Red

    Write-Host `
        $_.Exception.Message `
        -ForegroundColor Red

    Write-Host ""

    exit 1
}
finally {
    Pop-Location
}