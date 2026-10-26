# 86 -不存在的战区- · DSH 皮肤插件

一个面向 **DeepSeek Harness** 的完整皮肤插件，不是纯 CSS 换色：
蓝黑底 + 青蓝线条 + 扫描层，右上角**蕾娜线稿 HUD**，右栏一座**第 86 区战术状态台**，
读的是本机真实指标，头像可以换，左上角锁标会自己动。

![总览](docs/overview.jpg)

## 功能

### 视觉

| 功能 | 说明 |
|---|---|
| 背景图 | 铁轨夜景铺在 `<html>` 上，基础面令牌转半透明让图透出来；四档强度（关 / 淡 / 中 / 浓）。切对话时会被壳层重置，插件用增量扫描 + 定期复检把它拉回来 |
| 左上 86 锁标 | 大号 86 + 片假名 + `[EIGHTY SIX]` 框，四层动效：扫描光带 6.5s、数字色散抖动 5.7s、片假名解码闪烁 4.3s、方框脉冲 3.9s —— 四个周期互质，永不整齐划一 |
| 右上 HUD 头像 | 线稿头像 + 四角框 + `VLADILENA MILIZÉ / HANDLER 01` 铭牌 + Para-RAID 指示灯；**5 张头像可切换**，状态台展开时放大居中变成该列页眉 |
| 装饰层 | 扫描线 / 技术网格 / 暗角 / 竖向扫光带，全部 `pointer-events: none` |
| Hex 数据雨 | 全窗口 canvas，约 11fps，径向遮罩让中心留空，窗口不可见时 `cancelAnimationFrame` |
| 空会话水印 | 86 描边字压在空会话主视觉后面，注册在 `conversation.hero.brand.mark` 槽位，有对话时自动消失 |
| 底部状态条 | 24px 滚动条，内容是真实 CPU / 内存 / 磁盘 / 负载 / uptime |
| 顶栏标签 | 「对话 / 上下文 / 编队」按文字定位后加编号与批示线 |
| 左侧栏 | 导航项编号 + 分组批示线 + hover 光条；主操作按钮「新会话」不编号、保持顶格 |
| 代码与滚动条 | 代码块左侧 2px 批示线，行内代码描边，链接改青蓝，8px 青色滚动条 |
| 账号区 | 账号行下方加 `HANDLER 01 · 管制指挥官 · ● PARA-RAID` 军阶行 |

### 战术状态台

![状态台](docs/rail.jpg)

可收起、可折叠分区，头部三个快捷开关（扫描线 / 数据雨 / 背景）加一个界面重载按钮。

| 区块 | 内容 |
|---|---|
| SYSTEM | **CPU 60 点迷你曲线**（2 秒一采样，两分钟窗口）、MEM / DISK 分段条、**网络上下行**（`netstat` 差分） |
| Para-RAID | 扇区雷达（`conic-gradient` 扫描面 + 三个错相光点）+ **同步率大读数**（由 CPU 反推，空载 ≈99%、满载 ≈82%）+ 34 根波形 |
| 事件流 | **真实事件**，不是假数据：主题启用、背景加载、CPU 跨过 85%、指标轮询失败、状态台开合、标签页与侧栏的识别结果 |
| 告警态 | CPU > 85% 或磁盘 > 90% 时，描边与同步率转橙红，标题栏出现「负载偏高」 |
| 页脚 | 主机名、UPTIME、RSS、**补给窗口倒计时**（指向下一个本地 03:00） |

### 设置页

「第 86 区」一页，共 18 项：

```
主题总开关 · 扫描线 · 技术网格 · 暗角 · 状态台亮度 · 头像亮度
预览（HUD / 锁标 / 状态台）
Hex 数据雨 · 空会话水印 · 顶栏标签战术化 · 底部状态条
背景图 · 左上 86 锁标 · 右上 HUD 头像 · 头像（5 选 1）· 头像呈现
状态台默认展开 · 侧栏名称 · 窗口标题 · 重置
```

## 截图

| ID 卡（5 张头像） | 左侧栏 |
|---|---|
| ![ID 卡](docs/idcards.jpg) | ![侧栏](docs/sidebar.jpg) |

| 锁标动效 | 顶栏标签 |
|---|---|
| ![锁标](docs/lockup.jpg) | ![标签](docs/tabs.jpg) |

## 安装

```bash
# 1. 放进插件目录
git clone https://github.com/<you>/dsh-86-zone-ui.git \
  ~/Documents/plugins/dsh-86-zone-ui

# 2. 链接进 DSH 的 profile（别用 cp，链接才能边改边看）
cd ~/.dsh/profiles/desktop
pnpm add link:$HOME/Documents/plugins/dsh-86-zone-ui

# 3. 把 dsh-86-zone-ui 加进 package.json 的 dsh.profile.bundles
#    同一时间只能有一个主题插件，装它之前先移除别的主题

# 4. 重启 DeepSeek Harness
```

也可以在插件管理器里「添加本地插件」指向该目录。

> 只有宿主文件（`index.js`）改动需要重启；客户端（`client.js`）刷新界面即可。

## 平台支持

| 功能 | macOS | Windows | Linux |
|---|---|---|---|
| 皮肤 / HUD / 状态台 / 数据雨 / 事件流 | ✅ | ✅ | ✅ |
| CPU 曲线、同步率、内存 | ✅ | ✅ | ✅ |
| 磁盘占用 | ✅ | ✅ `fs.statfsSync` | ✅ |
| 网络上下行 | ✅ `netstat -ibn` | ✅ `netstat -e` | ➖ 显示 `—` |
| 负载 `loadavg` | ✅ | ➖ 恒为 0.00（系统没有此概念） | ✅ |
| 内存精确度 | ✅ `vm_stat` 修正 | ✅ 直接用 `os.freemem()` | ✅ |
| `install.sh` / `restore-profile.sh` | ✅ | ➖ 需 Git Bash 或 WSL | ✅ |

Windows 上装插件用 pnpm 即可，两个 shell 脚本只是便利工具：

```powershell
cd $env:USERPROFILE\.dsh\profiles\desktop
pnpm add link:$env:USERPROFILE\Documents\plugins\dsh-86-zone-ui
```

## 宿主路由

三条只读本地路由，**没有任何第三方外联**：

| 路由 | 内容 |
|---|---|
| `GET /86-ui/metrics` | CPU / 内存 / 磁盘 / 负载 / 网络吞吐 / RSS / uptime |
| `GET /86-ui/avatar?art=NN` | 头像；`NN` ∈ `01..04` 时取 `assets/portraits/NN.png`，其余回退 `assets/avatar.png` |
| `GET /86-ui/background` | 背景图 |

都先过 `connection.requestRejection(req)` 鉴权闸门。

macOS 上内存用 `vm_stat` 修正（`os.freemem()` 会把缓存算成已用，显示约 99%），
网络用 `netstat -ibn` 的累计字节做差分 —— 固定 argv、不拼 shell、不读用户输入。

## 结构

```
client.js          浏览器侧全部内容，单文件（约 125 KB）
index.js           宿主侧路由与采样（约 12 KB）
assets/            背景图、默认头像、4 张可选头像
docs/              README 用的截图（preview/ 是工作目录，不进仓库）
scripts/           头像描线与主视觉合成脚本（PIL）
tests/             205 项检查，见下
PITFALLS.md        这个项目踩过的坑，动手前值得先读
PROMPTS.md         生图提示词（头像 / 背景 / 主视觉）
```

## 测试

```bash
node tests/selfcheck.mjs   # 57  静态红线：无外联、无 base64、对比度、体积
node tests/contract.mjs    # 29  插件契约：槽位注册、主题令牌、卸载清理
node tests/host.mjs        # 38  路由：鉴权、MIME、字节一致、?art= 回退
node tests/audit.mjs       # 67  跨文件一致性：设置键、字段、类名、残留引用
node tests/render.mjs      # 14  渲染冒烟：用桩 React 真跑每个槽位组件
```

`audit` 与 `render` 是为两类真实事故加的：

- **静默失效**：`store.get('x')` 拼错、宿主少发一个字段、类名没有对应样式 —— 语法检查全都看不见
- **整棵槽位消失**：某个组件渲染时抛错，React 会把整个 slot 卸掉（曾经表现为「状态台突然不见了，但头像还在」）

## 说明

个人同人作品，角色与作品名归原作者所有，不含任何官方素材。
头像由生成模型产出后经脚本处理（二值化 → 加粗 → 降采样），并非直接描摹官方图。
仅供学习与自用，请勿商用。

## 许可

MIT
