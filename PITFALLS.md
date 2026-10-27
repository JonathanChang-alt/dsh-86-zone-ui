# 踩坑记录

这份文档记录主题在真实 DSH 0.2.1-rc.2 上落地时撞到的每一个坑。
每一条都是**实测**，不是推测。改代码前先读一遍。

---

## 1. 壳层根节点不是 `#root`

`<body>` 里确实有 `<div id="root">`，但**真正的布局不在里面** ——
`#root` 只有一两个 0×0 的 portal 容器。实际的壳层挂在 `#root` 之外：

```
HEADER.ST7X_W_header        (类名是构建哈希，不可依赖)
DIV.ST7X_W_root             ← 应用根，铺 rgb(4,8,15)
DIV._6Qf49G_centerCol       ← 中间对话列，铺 rgb(4,8,15)
DIV._6Qf49G_sidebarCol      ← 左侧栏
```

**结论**：不要假设任何哈希类名，也不要假设 `#root` 是布局根。
要找壳层表面，只能靠**颜色特征**（见第 2 条）或从自己的 slot 节点向上找。

---

## 2. 底色是"令牌换上去了，半透明没传下去"

`--dsw-alias-bg-base` 改成 `rgba(4,8,15,0.58)` 之后，
`ST7X_W_root` / `_6Qf49G_centerCol` 的计算值仍然是 **`rgb(4, 8, 15)`（不透明）**。
它们拿的是我们令牌的**颜色值**，却按不透明渲染。

**结论**：想让背景图透出来，必须直接把这些表面的
`background-color` 内联清成 `transparent !important`，改令牌不够。

---

## 3. 清扫规则里的"防误伤保险"会误伤自己

第一版清扫写了：

```js
if (el.querySelector('input, textarea, select')) return;   // 当成弹窗跳过
```

而 `ST7X_W_root` 里有底部的 composer 输入框 ——
于是**整个应用根被判定成弹窗**，唯一该清的两层被完美保护起来。
表现就是：日志说"清扫完成"，画面一点没变。

**结论**：弹窗判定要用 `position: fixed|absolute && z-index >= 40`，
绝不能用"内部有没有输入框"。

---

## 4. `dsh-app://` 协议：fetch 能通，CSS 图片源不行

页面 origin 是 `dsh-app://app`，所以：

| 用法 | 结果 |
|---|---|
| `fetch('/86-ui/background')` | ✅ 通（返回 1672×941 的 JPEG） |
| `new Image(); img.src = '/86-ui/background'` | ✅ 通（`naturalWidth` 正常） |
| CSS `background-image: url("/86-ui/background")` | ❌ 静默失败，一个像素都不画 |
| `blob:` URL 作背景 | ❌ 变成 `blob:dsh-app://app/...`，协议不支持 |
| `data:` URL 作背景 | ⚠️ 未验证（当时已改用 img 元素） |

**结论**：背景图用 **`<img>` 元素**（`position:fixed; z-index:-1; object-fit:cover`），
不要用 CSS background。

---

## 5. 静态资源路径

宿主路由注册在 `/86-ui/*` 下：
`/metrics`、`/avatar`、`/background`、`/report`。
所有路由都过 `connection.requestRejection()` —— 未登录返回 **401**，
未注册的路由返回 **404**。这两个状态码是判断"插件有没有挂上"的最快手段。

---

## 6. 两个主题插件不能同时装

`dsh-cyber-red-ui` 和本插件都在 bundles 里时：
各自注册令牌、各自注入右栏、各自改文案 → 互相拆台。

**结论**：bundles 里只能留一个主题插件。

---

## 7. skin-center 的默认皮肤是隐形的坑

`@linxin666/dsh-client-ui-skin-center` 自带 `blue-fantasy`，
**新装即激活**（`~/.dsh/skin-center-active.json` 里 `active: "blue-fantasy"`）。
它会刷气泡、输入框、右侧栏，还挂一个蓝发角色。

关掉的方式：

```json
{ "active": null, "initialized": true }
```

`initialized: true` 必须保留，否则 `seedDefaultActiveSkin()` 会把它重新写回去。

---

## 8. 浅色模式是最初的大坑

DSH 处于 `light`/`system` 时，气泡、composer、代码块用的是**另一套令牌**，
只覆盖 17 个别名根本不够。必须：

```js
if (ctx.theme.getTheme().preference !== 'dark') ctx.theme.setTheme('dark');
```

并在 `theme/change` 事件里持续按住；关闭主题时还原用户原本的偏好。

---

## 9. 弹窗会被"大块背景清扫"误杀

设置页是一个大面积、有背景色的浮动层。
按"面积大 + 有底色"去清，会把弹窗底板清成透明，设置页变成文字浮在聊天上。

**结论**：弹窗必须豁免，并且主动给它刷回 `rgba(5,13,23,0.97)`。

---

## 10. 亮度滑杆不要触发结构重绘

滑杆 `onChange` 每像素一次 store 变更，如果每次都跑清扫/重绘，
会在拖动时反复重建页面（表现为"一拖就黑屏"）。

**结论**：亮度类改动只更新 CSS 变量；结构重绘按"签名"门控：

```js
const sig = [bg, bgStrength, railOpen, hideDecor].join('|');
if (sig !== lastSig) { /* 才重绘 */ }
```

---

## Windows：BOM 会让整个 DSH 起不来

**症状**：重启后弹窗 `DeepSeek Harness is unavailable`，
`Unexpected token ' ', "﻿{ ... is not valid JSON`

**根因**：Windows PowerShell 5.1 的 `Set-Content -Encoding UTF8`（以及老版记事本
「另存为 UTF-8」）会写入 UTF-8 BOM（`EF BB BF`）。DSH 启动时 `readProfileManifest`
用 Node 的 `JSON.parse` 读 profile 清单，而它**不接受 BOM** —— 于是宿主启动失败，
整个应用打不开，不是插件被禁用。

**为什么自查发现不了**：`.NET` 的 `ConvertFrom-Json` 容忍 BOM。

```
Set-Content -Encoding UTF8 后：EF BB BF 7B 0D 0A
  ConvertFrom-Json : OK     ← 假阳性
  JSON.parse       : FAIL   ← 宿主就是这一步
```

**做法**：
- 不要用 PowerShell 写 `package.json`，用 `install.ps1`（内部走 Node 的
  `fs.writeFileSync`，天然无 BOM）
- 一定要手改时，写完用 Node 校验：
  `node tests/manifest.mjs "$env:USERPROFILE\.dsh\profiles\desktop\package.json"`
- 已经崩了：点弹窗第三个按钮
  「Disable third-party plugins, back up profile patch, and restart」，
  或删掉 `bundles` 里的插件名

上游如果给 `readProfileManifest` 加一行 `text.replace(/^\uFEFF/, '')`，
这个坑就能从「致命」降级为「无害」。已作为建议一并提交。

## macOS 文件名不区分大小写：渲染截图覆盖了纯图

**症状**：铁轨背景干净，切到花海却多出「第 86 区」大字和整条状态台 —— 像是 UI 印在了图里。

**原因**：确实是。生成流程是

```
pil 输出  preview/bg-cover-B3.png     ← 纯背景图
无头浏览器 screenshot → preview/bg-cover-b3.png   ← 同一张页面的截图
```

macOS 的 APFS **默认不区分大小写**，`B3` 和 `b3` 是同一个文件 —— 截图把纯图覆盖了。
随后用这个文件名转成 `assets/background-flowers.jpg`，于是背景图变成了一张带 UI 的截图。

**做法**：
- 同一批产物**不要用只差大小写的名字**；给截图加前缀，如 `shot-bg-cover-B3.png`
- 用作素材的图，落盘后再肉眼确认一次（或比对尺寸：截图是 2880×1800，素材是 1672×941）
- 提交前用 `identify` 类方式核对：只含画面、不含 UI

## 调试通道（已移除）

排查阶段曾经用过一条临时通道：客户端把 DOM 现场 POST 到 `/86-ui/report`，
宿主写成 `debug-report.json`。定位完成后已连同设置页的「诊断」面板一起删除。

如果以后又要排查布局，最快的办法是在浏览器 devtools 里对目标坐标执行
`document.elementsFromPoint(x, y)`，逐个看 `z-index / position / backgroundColor`。
这一轮所有难点都是这样定位的，截图帮不上忙。
