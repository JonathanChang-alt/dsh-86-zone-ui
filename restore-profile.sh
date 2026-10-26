#!/bin/bash
# 把 desktop profile 的 bundles 列表恢复成已知可用的状态。
# 用在：DSH 插件管理器又把 bundles 重置成只剩 @deepseek-ai/dsh-base 时。
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.dsh/profiles/desktop/package.json"
[ -f "$TARGET" ] || { echo "找不到 $TARGET" >&2; exit 1; }
cp "$TARGET" "$TARGET.bak-$(date +%Y%m%d-%H%M%S)"
node - "$DIR/restore-snapshot.json" "$TARGET" <<'JS'
const fs = require('fs');
const [snapPath, target] = process.argv.slice(2);
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
const cur = JSON.parse(fs.readFileSync(target, 'utf8'));
cur.dsh = cur.dsh || {};
cur.dsh.profile = cur.dsh.profile || {};
cur.dsh.profile.bundles = snap.dsh.profile.bundles.slice();
fs.writeFileSync(target, JSON.stringify(cur, null, 2) + '\n');
console.log('restored:');
cur.dsh.profile.bundles.forEach((b) => console.log('  ' + b));
JS
echo "完成。重启 DeepSeek Harness 生效。"
