#!/bin/bash
# 安装 dsh-86-zone-ui 到 desktop profile。
#
# 做的事：
#   1. 用 DSH 自带的 CLI 把插件以 link: 方式加进 profile 依赖
#   2. 把包名追加到 dsh.profile.bundles（幂等）
#   3. 提示你重启 DSH
#
# 撤销：把 bundles 里的 dsh-86-zone-ui 删掉，再 `dsh plugin --profile desktop remove dsh-86-zone-ui`。

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSH_CLI="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
PROFILE="${DSH_PROFILE:-desktop}"
PKG_JSON="$HOME/.dsh/profiles/$PROFILE/package.json"
NAME="dsh-86-zone-ui"

if [ ! -x "$DSH_CLI" ]; then
  echo "找不到 DSH CLI：$DSH_CLI" >&2
  exit 1
fi
if [ ! -f "$PKG_JSON" ]; then
  echo "找不到 profile：$PKG_JSON" >&2
  exit 1
fi

echo "==> 1/2  link 到 profile $PROFILE"
"$DSH_CLI" plugin --profile "$PROFILE" add "link:$PLUGIN_DIR"

echo "==> 2/2  写入 bundles"
node - "$PKG_JSON" "$NAME" <<'JS'
const fs = require('fs');
const [file, name] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dsh = pkg.dsh || {};
pkg.dsh.profile = pkg.dsh.profile || {};
const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
if (!bundles.includes(name)) bundles.push(name);
pkg.dsh.profile.bundles = bundles;
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('bundles:');
for (const entry of bundles) console.log('  - ' + entry);
JS

echo
echo "装好了。现在完全退出并重新打开 DeepSeek Harness（不是刷新页面，bundles 在启动时加载）。"
echo "左栏底部会出现「战术状态」按钮；设置页多出「第 86 区」一节。"
echo
echo "提醒：如果 dsh-cyber-red-ui 还在 bundles 里，两个主题会同时注册令牌。"
echo "      建议先在它自己的设置页关掉主开关，或把它从 bundles 里移除。"
