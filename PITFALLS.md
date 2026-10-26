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

## 调试通道（已移除）

排查阶段曾经用过一条临时通道：客户端把 DOM 现场 POST 到 `/86-ui/report`，
宿主写成 `debug-report.json`。定位完成后已连同设置页的「诊断」面板一起删除。

如果以后又要排查布局，最快的办法是在浏览器 devtools 里对目标坐标执行
`document.elementsFromPoint(x, y)`，逐个看 `z-index / position / backgroundColor`。
这一轮所有难点都是这样定位的，截图帮不上忙。
