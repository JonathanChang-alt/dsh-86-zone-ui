# install.ps1 - install dsh-86-zone-ui into a DSH profile (Windows).
#
# Why a script at all: hand-editing package.json on Windows is the #1 way to
# brick the app. `Set-Content -Encoding UTF8` on Windows PowerShell 5.1 writes a
# UTF-8 BOM (EF BB BF), and DSH parses that manifest with Node's JSON.parse at
# startup - a BOM makes the whole application fail to launch, not just the skin.
# Worse, .NET's ConvertFrom-Json tolerates a BOM, so checking with PowerShell
# reports "valid JSON" while the app cannot start.
#
# This script reads and writes the manifest through Node, so no BOM can appear,
# then re-verifies with the same Node parser the host uses.
#
# IMPORTANT: keep this file ASCII-only.
# Windows PowerShell 5.1 reads .ps1 files as ANSI unless they carry a UTF-8 BOM,
# so any non-ASCII character here (Chinese included) breaks the parse on a clean
# machine with "Missing closing '}' in statement block". The rest of the
# documentation is in Chinese; this script is English on purpose.
#
# Usage (works on PowerShell 5.1 and 7):
#   .\install.ps1
#   .\install.ps1 -Profile web
#
# Uninstall: remove dsh-86-zone-ui from dsh.profile.bundles, then
#   pnpm remove dsh-86-zone-ui      (inside the profile directory)

[CmdletBinding()]
param(
    [string]$Profile = $(if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { 'desktop' }),
    [string]$PluginDir = ''
)

$ErrorActionPreference = 'Stop'

# $PSScriptRoot is not reliably populated inside a param default on PowerShell 5.1,
# so resolve it in the body instead.
if (-not $PluginDir) { $PluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

$Name = 'dsh-86-zone-ui'
$ProfileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$PkgJson = Join-Path $ProfileDir 'package.json'
$Runtime = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime'

function Get-NodePath {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    # Fall back to the Node that ships with the DSH runtime.
    $bundled = Join-Path $Runtime 'dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundled) { return $bundled }
    throw 'node not found. Install Node.js, or run this on a machine where DSH is installed.'
}

function Get-PnpmPath {
    foreach ($leaf in @('dependencies\pnpm\bin\pnpm.mjs', 'dependencies\pnpm\bin\pnpm.cjs')) {
        $candidate = Join-Path $Runtime $leaf
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw 'pnpm not found (neither the copy bundled with DSH nor one on PATH).'
}

$Node = Get-NodePath
$Pnpm = Get-PnpmPath

if (-not (Test-Path -LiteralPath $PluginDir)) { throw "plugin directory not found: $PluginDir" }
if (-not (Test-Path -LiteralPath $PkgJson)) {
    throw "profile manifest not found: $PkgJson`nStart DSH once so it creates the profile, then retry."
}

Write-Host "==> plugin dir : $PluginDir"
Write-Host "==> profile    : $Profile"
Write-Host "==> manifest   : $PkgJson"

# --- 1/3 link the plugin into the profile ------------------------------------
Write-Host '==> 1/3  link the plugin into the profile'
$linkTarget = 'link:' + ($PluginDir -replace '\\', '/')
Push-Location $ProfileDir
try {
    & $Node $Pnpm add $linkTarget
    if ($LASTEXITCODE -ne 0) { throw "pnpm add failed (exit=$LASTEXITCODE)" }
}
finally { Pop-Location }

# --- 2/3 append the bundle name, written by Node (never a BOM) ---------------
Write-Host '==> 2/3  write dsh.profile.bundles'
# The JS goes into a temp file instead of `node -e`: PowerShell mangles inline JS
# (||, {}, quotes) and here-strings are fragile across editors. A file is boring
# and always works.
$jsPath = Join-Path $env:TEMP 'dsh86_add_bundle.cjs'
$js = @(
    "const fs = require('fs');"
    "const [file, name] = process.argv.slice(2);"
    "const raw = fs.readFileSync(file, 'utf8');"
    "const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;"
    "const pkg = JSON.parse(text);"
    "pkg.dsh = pkg.dsh || {};"
    "pkg.dsh.profile = pkg.dsh.profile || {};"
    "const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];"
    "if (!bundles.includes(name)) bundles.push(name);"
    "pkg.dsh.profile.bundles = bundles;"
    "fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');"
    "for (const entry of bundles) console.log('  - ' + entry);"
) -join "`n"
[System.IO.File]::WriteAllText($jsPath, $js, (New-Object System.Text.UTF8Encoding($false)))

& $Node $jsPath $PkgJson $Name
if ($LASTEXITCODE -ne 0) { throw 'writing bundles failed' }
Remove-Item -LiteralPath $jsPath -Force -ErrorAction SilentlyContinue

# --- 3/3 verify with the same parser the host uses ---------------------------
Write-Host '==> 3/3  verify (Node, same parser the host uses at startup)'
$verify = @(
    "const fs = require('fs');"
    "const b = fs.readFileSync(process.argv[2]);"
    "if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) { console.error('FAIL: package.json has a BOM'); process.exit(1); }"
    "JSON.parse(b.toString('utf8'));"
    "console.log('package.json has no BOM and parses as JSON');"
) -join "`n"
$verifyPath = Join-Path $env:TEMP 'dsh86_verify_manifest.cjs'
[System.IO.File]::WriteAllText($verifyPath, $verify, (New-Object System.Text.UTF8Encoding($false)))
& $Node $verifyPath $PkgJson
if ($LASTEXITCODE -ne 0) { throw 'manifest verification failed' }
Remove-Item -LiteralPath $verifyPath -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Done. Fully quit and reopen DeepSeek Harness.'
Write-Host '(bundles load at startup - refreshing the page is not enough.)'
Write-Host ''
Write-Host 'After restart you should see:'
Write-Host '  - a "tactical status" button at the bottom of the left sidebar'
Write-Host '  - a "Zone 86" section on the settings page'
Write-Host ''
Write-Host 'If the app fails to start with a JSON error:'
Write-Host '  1. click "Disable third-party plugins, back up profile patch, and restart"'
Write-Host "  2. or remove $Name from the bundles array in $PkgJson"
Write-Host ''
Write-Host 'Only one theme plugin can be active at a time. If bundles still lists'
Write-Host 'another theme (e.g. dsh-cyber-red-ui), remove it or the token sets collide.'
