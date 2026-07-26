[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ResourceGroupName = "rg-qrrrgh",
    [string]$Location = "westeurope",
    [string]$Name = "qrrrgh-web",
    [string]$Repo = "webmaxru/qrrrgh"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Format-Arg {
    param([string]$Value)
    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Write-CommandLine {
    param(
        [string]$Executable,
        [string[]]$Arguments
    )
    $rendered = @($Executable) + ($Arguments | ForEach-Object { Format-Arg $_ })
    Write-Host ("> " + ($rendered -join " "))
}

function Invoke-LoggedCommand {
    param(
        [string]$Executable,
        [string[]]$Arguments,
        [switch]$Capture
    )

    Write-CommandLine -Executable $Executable -Arguments $Arguments

    if ($WhatIfPreference) {
        return $null
    }

    if ($Capture) {
        $output = & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Executable failed with exit code $LASTEXITCODE."
        }
        return $output
    }

    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Executable failed with exit code $LASTEXITCODE."
    }
    return $null
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI is not installed or is not on PATH."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Warning "GitHub CLI was not found on PATH. Provisioning can continue, but setting the repository secret will require gh."
}

Write-Host "Checking Azure sign-in status..."
Write-CommandLine -Executable "az" -Arguments @("account", "show", "--query", "name", "-o", "tsv")
if ($WhatIfPreference) {
    $account = $null
} else {
    $account = & az account show --query name -o tsv 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($account -join ""))) {
        throw "Azure CLI is not signed in. Run 'az login' and select the target subscription, then rerun this script."
    }
}

Write-Host "Using Static Web Apps location '$Location'. West Europe is a safe default for this project; change -Location if your subscription policy requires another supported region."

Invoke-LoggedCommand -Executable "az" -Arguments @(
    "group", "create",
    "--name", $ResourceGroupName,
    "--location", $Location,
    "--output", "none"
)

Invoke-LoggedCommand -Executable "az" -Arguments @(
    "staticwebapp", "create",
    "--name", $Name,
    "--resource-group", $ResourceGroupName,
    "--location", $Location,
    "--sku", "Free",
    "--output", "none"
)

$deploymentToken = Invoke-LoggedCommand -Executable "az" -Arguments @(
    "staticwebapp", "secrets", "list",
    "--name", $Name,
    "--resource-group", $ResourceGroupName,
    "--query", "properties.apiKey",
    "--output", "tsv"
) -Capture

if (-not $WhatIfPreference -and [string]::IsNullOrWhiteSpace(($deploymentToken -join ""))) {
    throw "Azure Static Web Apps deployment token could not be retrieved."
}

$secretCommand = "az staticwebapp secrets list --name $Name --resource-group $ResourceGroupName --query `"properties.apiKey`" -o tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo $Repo"
$variableCommand = "gh variable set AZURE_SWA_ENABLED --body true --repo $Repo"

Write-Host ""
Write-Host "Provisioning command sequence is complete."
Write-Host "The deployment token is not printed or written to disk."
Write-Host "Run this command to set the GitHub Actions secret without exposing the token in logs:"
Write-Host $secretCommand
Write-Host ""
Write-Host "Then enable deployment with:"
Write-Host $variableCommand
