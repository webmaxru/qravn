# Resource names below keep the pre-rebrand string. They identify resources that
# already exist in Azure, and Azure cannot rename a resource group, a managed
# environment or a container app. Changing them here would not rename anything -
# it would provision a second, empty copy. See infra/README.md.
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ResourceGroupName = "rg-qrrrgh",
    [string]$Location = "westeurope",
    [string]$EnvironmentName = "qrrrgh-resolver-env",
    [string]$ContainerAppName = "qrrrgh-resolver",
    [string]$ContainerImage = "ghcr.io/webmaxru/qravn/resolver:latest",
    [string]$RegistryServer = "ghcr.io",
    [string]$RegistryUsername = "webmaxru",
    [securestring]$RegistryToken,
    [string]$Repo = "webmaxru/qravn",
    [string]$WebCustomHostname = "",
    [string]$ResolverCustomHostname = "",
    [string]$ResolverCorsAllowedOrigins = ""
)

# One-off provisioning of the redirect resolver on Azure Container Apps.
#
# This creates a Consumption-plan (serverless, scale-to-zero) Container Apps
# environment and the resolver app from infra/resolver.bicep. It provisions NO
# billed idle resources: no Azure Container Registry and no Log Analytics
# workspace. Idle cost is zero because minReplicas is 0. See infra/README.md.
#
# Pure ASCII only: Windows PowerShell 5.1 reads BOM-less files as cp1252, and a
# non-ASCII character inside a string literal can silently break parsing. Use
# '-' (hyphen), never an em dash.

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

function Get-DnsCnameTarget {
    param([string]$Name)

    $answer = Resolve-DnsName -Name $Name -Type CNAME -ErrorAction SilentlyContinue |
        Where-Object { $_.Type -eq "CNAME" } |
        Select-Object -First 1
    if ($answer) {
        return ($answer.NameHost.TrimEnd("."))
    }
    return $null
}

function Test-DnsTxtContains {
    param(
        [string]$Name,
        [string]$ExpectedValue
    )

    $answers = Resolve-DnsName -Name $Name -Type TXT -ErrorAction SilentlyContinue
    foreach ($answer in $answers) {
        $value = (($answer.Strings | ForEach-Object { $_ }) -join "")
        if ($value -eq $ExpectedValue) {
            return $true
        }
    }
    return $false
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI is not installed or is not on PATH."
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Warning "GitHub CLI was not found on PATH. Provisioning can continue, but setting the repository secrets and variable will require gh."
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

# The Container Apps resource provider must be registered once per subscription.
# No Microsoft.OperationalInsights registration is needed because this design
# uses no Log Analytics workspace (logs destination is 'none').
Write-Host "Ensuring the Microsoft.App resource provider is registered..."
Invoke-LoggedCommand -Executable "az" -Arguments @(
    "provider", "register",
    "--namespace", "Microsoft.App",
    "--wait"
)

Write-Host "Using location '$Location'. West Europe matches the existing Static Web App; change -Location if your subscription policy requires another region."

Invoke-LoggedCommand -Executable "az" -Arguments @(
    "group", "create",
    "--name", $ResourceGroupName,
    "--location", $Location,
    "--output", "none"
)

# The private image is pulled from ghcr.io using a token. Prompt for it securely
# if it was not supplied. For a PUBLIC image, pass an empty token and the Bicep
# will skip registry authentication.
if (-not $RegistryToken -and -not $WhatIfPreference) {
    Write-Host ""
    Write-Host "Enter the GitHub Container Registry pull token (PAT with the read:packages scope)."
    Write-Host "Leave blank and press Enter only if the image is public."
    $RegistryToken = Read-Host -AsSecureString "GHCR pull token"
}

$registryPasswordPlain = ""
if ($RegistryToken) {
    $registryPasswordPlain = [System.Net.NetworkCredential]::new("", $RegistryToken).Password
}

$devCorsAllowedOrigins = "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173"
$effectiveResolverCorsAllowedOrigins = $ResolverCorsAllowedOrigins
if ([string]::IsNullOrWhiteSpace($effectiveResolverCorsAllowedOrigins)) {
    $effectiveResolverCorsAllowedOrigins = $devCorsAllowedOrigins
    if (-not [string]::IsNullOrWhiteSpace($WebCustomHostname)) {
        $effectiveResolverCorsAllowedOrigins = "$effectiveResolverCorsAllowedOrigins,https://$WebCustomHostname"
    }
}

$templatePath = Join-Path $PSScriptRoot "resolver.bicep"
if (-not (Test-Path $templatePath)) {
    throw "Bicep template not found at $templatePath."
}

Write-Host ""
Write-Host "NOTE: The image '$ContainerImage' must already be pushed to the registry for the"
Write-Host "first revision to become healthy. If it is not there yet, run the Deploy Resolver"
Write-Host "GitHub workflow (it builds, pushes and deploys) instead of this script."

# Build the deployment arguments. The token is passed as a secure Bicep
# parameter (@secure()), so it is never stored in Azure deployment history. We
# log a REDACTED command line so the token is not printed to the console.
$deployArgs = @(
    "deployment", "group", "create",
    "--resource-group", $ResourceGroupName,
    "--template-file", $templatePath,
    "--parameters",
    "location=$Location",
    "environmentName=$EnvironmentName",
    "containerAppName=$ContainerAppName",
    "containerImage=$ContainerImage",
    "registryServer=$RegistryServer",
    "registryUsername=$RegistryUsername",
    "registryPassword=$registryPasswordPlain",
    "webCustomHostname=$WebCustomHostname",
    "resolverCustomHostname=$ResolverCustomHostname",
    "resolverCorsAllowedOrigins=$effectiveResolverCorsAllowedOrigins",
    "--query", "properties.outputs.resolverUrl.value",
    "--output", "tsv"
)

$redactedArgs = $deployArgs | ForEach-Object {
    if ($_ -like "registryPassword=*") { "registryPassword=***" } else { $_ }
}
Write-CommandLine -Executable "az" -Arguments $redactedArgs

$resolverUrl = $null
if (-not $WhatIfPreference) {
    try {
        $resolverUrl = & az @deployArgs
        if ($LASTEXITCODE -ne 0) {
            throw "az deployment group create failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        # Clear the plaintext token from memory as soon as it is no longer needed.
        $registryPasswordPlain = $null
    }
}

Write-Host ""
Write-Host "Provisioning command sequence is complete."
if ($resolverUrl) {
    Write-Host "Resolver URL: $resolverUrl"
}

if (-not [string]::IsNullOrWhiteSpace($ResolverCustomHostname)) {
    Write-Host ""
    Write-Host "Custom resolver domain requested: $ResolverCustomHostname"

    $resolverFqdn = Invoke-LoggedCommand -Executable "az" -Arguments @(
        "containerapp", "show",
        "--name", $ContainerAppName,
        "--resource-group", $ResourceGroupName,
        "--query", "properties.configuration.ingress.fqdn",
        "--output", "tsv"
    ) -Capture
    $resolverFqdn = ($resolverFqdn -join "").Trim()

    $verificationId = Invoke-LoggedCommand -Executable "az" -Arguments @(
        "containerapp", "show",
        "--name", $ContainerAppName,
        "--resource-group", $ResourceGroupName,
        "--query", "properties.customDomainVerificationId",
        "--output", "tsv"
    ) -Capture
    $verificationId = ($verificationId -join "").Trim()

    $asuidName = "asuid.$ResolverCustomHostname"
    Write-Host "Create these DNS records first (DNS-only in Cloudflare):"
    Write-Host "  CNAME $ResolverCustomHostname -> $resolverFqdn"
    Write-Host "  TXT   $asuidName -> $verificationId"

    $cnameTarget = Get-DnsCnameTarget -Name $ResolverCustomHostname
    $txtOk = Test-DnsTxtContains -Name $asuidName -ExpectedValue $verificationId
    if ($cnameTarget -eq $resolverFqdn -and $txtOk) {
        Invoke-LoggedCommand -Executable "az" -Arguments @(
            "containerapp", "hostname", "add",
            "--name", $ContainerAppName,
            "--resource-group", $ResourceGroupName,
            "--hostname", $ResolverCustomHostname,
            "--output", "none"
        )
        Invoke-LoggedCommand -Executable "az" -Arguments @(
            "containerapp", "hostname", "bind",
            "--name", $ContainerAppName,
            "--resource-group", $ResourceGroupName,
            "--environment", $EnvironmentName,
            "--hostname", $ResolverCustomHostname,
            "--validation-method", "CNAME",
            "--output", "none"
        )
        Write-Host "Custom resolver domain is bound. Verify with:"
        Write-Host "  Invoke-WebRequest https://$ResolverCustomHostname/healthz"
    } else {
        Write-Warning "DNS is not ready, so Azure custom-domain binding was not attempted. Add the records above, wait for DNS, then rerun this script with the same custom-domain parameters."
        if ($cnameTarget) {
            Write-Warning "Observed CNAME target: $cnameTarget"
        }
        if (-not $txtOk) {
            Write-Warning "TXT record $asuidName with the Azure verification id was not observed."
        }
    }
}
Write-Host ""
Write-Host "To let the GitHub workflow deploy new images, set these repository secrets and"
Write-Host "the enable variable (values are not printed by this script):"
Write-Host "  gh secret set AZURE_CLIENT_ID --repo $Repo"
Write-Host "  gh secret set AZURE_TENANT_ID --repo $Repo"
Write-Host "  gh secret set AZURE_SUBSCRIPTION_ID --repo $Repo"
Write-Host "  gh secret set GHCR_PULL_TOKEN --repo $Repo"
Write-Host "  gh variable set AZURE_ACA_ENABLED --body true --repo $Repo"
Write-Host ""
Write-Host "AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID drive OIDC login. Create a"
Write-Host "federated credential for this repo as described in infra/README.md so no client"
Write-Host "secret is ever stored. GHCR_PULL_TOKEN is the read:packages PAT the app uses to pull."
