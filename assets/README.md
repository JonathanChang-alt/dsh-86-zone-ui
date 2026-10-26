# assets/

这里已经放好 `avatar.png`（512×512，白底黑线）—— 生图模型按 [PROMPTS.md](../PROMPTS.md) 画的蕾娜线稿，
脚本只做了裁剪 + 色阶归一化 + 缩放，溯源见 `AVATAR-SOURCE.txt`。

## 换图

命名成下面任意一个即可，第一个命中的生效：

| 文件名 | 说明 |
|---|---|
| `avatar.png` | 当前使用：512×512，白底黑线 |
| `avatar.webp` | 同上，体积极小 |
| `avatar.jpg` | 扫描件也行，但会被压成灰阶 |
| `avatar.svg` | 矢量线稿最佳，缩放不失真 |

宿主每条请求都会重新解析文件名，**换完刷新页面即生效，不用重启**。

## 处理链路

1. `index.js` 按上面的顺序找文件，通过 `/86-ui/avatar` 吐出来（`no-cache`）。
2. 默认「线稿双色」：图像反相 → `mix-blend-mode: multiply` 压在青蓝场上 →
   **原图黑线变成青蓝发光线，白底变黑底**，再压一层扫描线。
3. 如果你的图是**透明底 + 浅色线**（multiply 会把线吃掉），到
   「设置 → 第 86 区 → 线稿呈现」切「原图」。
4. 没有文件时回落到内置的 86 六边形徽记（纯 SVG）。

## 兜底：从截图自动描边

只在"手上只有彩色截图、没有线稿"时用。**效果远不如生图**，当前这张不是它做的。

参考图在 `preview/source-lena.jpg`：

```bash
PY=/Users/jonathanchang/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3

# 看所有参数组合的效果（5 种 × 阈值）
"$PY" scripts/lineart.py --sheet

"$PY" scripts/lineart.py --kind ink --threshold 16 --erode 1 --dilate 7 \
      --crop 70,20,700,650 --out preview/trace.png
```

- `--crop` 是源图像素坐标（左,上,右,下）；`470,30,620,540` 会更贴脸，但 152px 下容易糊
- `--threshold` 越大线越少越干净，`--dilate` 越大线越粗
- 背景会自动识别（从四角洪水填充红色区域），不用手动抠

## 建议

- 想让 HUD 里更清楚：**脸部占比越大越好**，108px（md）下再细的线都会糊成噪点，默认已经设成 152px（lg）。
- 别用灰阶照片，双色模式会变成一块灰。
