# install.ps1 — 把 dsh-86-zone-ui 装进 DSH 的 desktop profile。
#
# 为什么需要这个脚本：Windows 上手工改 package.json 极易踩 BOM 的坑。
# PowerShell 5.1 的 `Set-Content -Encoding UTF8` 会写入 EF BB BF，而 DSH 启动时
# 用 Node 的 JSON.parse 读清单，它不接受 BOM —— 结果是**整个应用起不来**，
# 不是皮肤不生效。更麻烦的是用 .NET 的 ConvertFrom-Json 自查会通过（它容忍 BOM），
# 于是「文件合法」和「打不开」可以同时成立。
#
# 本脚本一律通过 Node 读写清单，天然无 BOM，并在最后用 Node 再校验一次。
#
# 用法（PowerShell 5.1 与 7 均可）：
#   .\install.ps1
#   .\install.ps1 -Profile web
#
# 撤销：把 bundles 里的 dsh-86-zone-ui 删掉，再
#   dsh plugin --profile desktop remove dsh-86-zone-ui

[CmdletBinding()]
param(
  [string]$Profile = $(if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { 'desktop' })
)

$ErrorActionPreference = 'Stop'

$PluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProfileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"
$PkgJson = Join-Path $ProfileDir 'package.json'
$Name = 'dsh-86-zone-ui'

function Get-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  # DSH 自带的运行时里也有 node，回退到那里
  $bundled = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\node.exe'
  if (Test-Path $bundled) { return $bundled }
  throw '找不到 node。请先安装 Node.js，或在 DSH 已安装的机器上运行。'
}

$Node = Get-Node

if (-not (Test-Path $PkgJson)) {
  throw "找不到 profile 清单：$PkgJson`n请先启动一次 DSH，让它生成 profile。"
}

Write-Host "==> 1/3  以 link: 方式装进 profile $Profile"

# 优先用 DSH 自带 CLI；找不到就退回 pnpm
$dshCli = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\cli\bin\dsh.cjs'
if (Test-Path $dshCli) {
  & $Node $dshCli plugin --profile $Profile add "link:$PluginDir"
  if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败（exit=$LASTEXITCODE）" }
} else {
  $pnpm = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs'
  if (-not (Test-Path $pnpm)) { throw '找不到 DSH 自带的 pnpm，也没有 dsh CLI。' }
  Push-Location $ProfileDir
  try {
    & $Node $pnpm add "link:$($PluginDir -replace '\\','/')"
    if ($LASTEXITCODE -ne 0) { throw "pnpm add 失败（exit=$LASTEXITCODE）" }
  } finally {
    Pop-Location
  }
}

Write-Host "==> 2/3  写入 bundles（用 Node 写，确保无 BOM）"

$patchScript = @'
const fs = require('fs');
const [file, name] = process.argv.slice(1);
const raw = fs.readFileSync(file, 'utf8');
// 万一清单本来就被写过 BOM，先修掉再解析，避免把坏文件带上车
const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
const pkg = JSON.parse(text);
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
if (!bundles.includes(name)) bundles.push(name);
pkg.dsh.profile.bundles = bundles;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');   // 无 BOM
for (const entry of bundles) console.log('  - ' + entry);
'@

& $Node -e $patchScript $PkgJson $Name
if ($LASTEXITCODE -ne 0) { throw '写入 bundles 失败' }

Write-Host "==> 3/3  校验（Node 侧，和宿主启动时用的是同一套解析）"

& $Node -e "const fs=require('fs');const b=fs.readFileSync(process.argv[1]);if(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF){console.error('失败：package.json 带 BOM');process.exit(1)}JSON.parse(b.toString('utf8'));console.log('package.json 无 BOM，可被 JSON.parse 解析')" $PkgJson
if ($LASTEXITCODE -ne 0) { throw '清单校验未通过' }

Write-Host ''
Write-Host '装好了。现在完全退出并重新打开 DeepSeek Harness。'
Write-Host '（bundles 在启动时加载，刷新页面不够。）'
Write-Host ''
Write-Host '启动后应看到：左栏底部「战术状态」按钮，设置页多出「第 86 区」一节。'
Write-Host ''
Write-Host '如果启动失败并提示 JSON 解析错误：'
Write-Host '  1. 在崩溃弹窗点「Disable third-party plugins, back up profile patch, and restart」'
Write-Host "  2. 或手工把 $PkgJson 里 bundles 中的 $Name 删掉"
Write-Host ''
Write-Host '提醒：同一时间只能有一个主题插件。若 bundles 里还有 dsh-cyber-red-ui 之类，'
Write-Host '      请先移除，否则两套令牌会互相覆盖。'
