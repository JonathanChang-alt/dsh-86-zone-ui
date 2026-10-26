#!/usr/bin/env python3
"""Turn a flat-colour anime still into a white-ground line drawing.

The HUD wants black lines on white: the theme inverts + multiplies them over the
accent field, so whatever leaves this script becomes cyan-on-black on screen.

No potrace here — a gradient-magnitude edge map is enough for a flat-shaded
illustration, and it keeps the pipeline to numpy + Pillow.

    python3 scripts/lineart.py --sheet          # contact sheet of every variant
    python3 scripts/lineart.py --pick color --out assets/avatar.png
"""

import argparse
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from numpy.lib.stride_tricks import sliding_window_view

SOBEL_X = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float64)
SOBEL_Y = SOBEL_X.T


def load(path, crop=None, size=1024):
    image = Image.open(path).convert("RGB")
    if crop:
        left, top, right, bottom = crop
        image = image.crop((left, top, right, bottom))
    return image.resize((size, size), Image.LANCZOS)


def sobel(channel):
    padded = np.pad(channel, 1, mode="edge")
    windows = sliding_window_view(padded, (3, 3))
    gx = (windows * SOBEL_X).sum(axis=(2, 3))
    gy = (windows * SOBEL_Y).sum(axis=(2, 3))
    return np.hypot(gx, gy)


def normalise(magnitude):
    peak = float(magnitude.max()) or 1.0
    return np.clip(magnitude / peak * 255.0, 0, 255)


def background_mask(image, tolerance=30, small=256):
    """Flood the red backdrop inwards from the border.

    The reference still has a blurred crimson sky, and every speck of that
    texture lands in the edge map. Growing a mask from the corners through
    red-dominant pixels keeps the red *inside* the subject (mouth, insignia,
    webbing) untouched, because the fill cannot jump across the outline."""
    tiny = np.array(image.convert("RGB").resize((small, small), Image.LANCZOS), dtype=np.int16)
    height, width, _ = tiny.shape
    red = tiny[:, :, 0]
    others = np.maximum(tiny[:, :, 1], tiny[:, :, 2])
    candidate = (red > 85) & (red > others + tolerance)

    seen = np.zeros((height, width), dtype=bool)
    queue = deque()
    for y, x in ((0, 0), (0, width - 1), (height - 1, 0), (height - 1, width - 1)):
        if candidate[y, x] and not seen[y, x]:
            seen[y, x] = True
            queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < height and 0 <= nx < width and candidate[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))

    mask = Image.fromarray((seen * 255).astype(np.uint8), mode="L")
    return mask.resize(image.size, Image.NEAREST).filter(ImageFilter.MinFilter(9))


def to_lines(magnitude, threshold, erode=3, dilate=5, bg=None):
    """White ground, black strokes.

    An opening (erode then dilate) removes the one-pixel speckles that JPEG
    grain and fabric texture leave behind, while keeping the strokes that carry
    the composition. The result has to survive being drawn at 108 px."""
    mask = (magnitude >= threshold).astype(np.uint8) * 255
    if bg is not None:
        mask[np.array(bg) > 0] = 0
    strokes = Image.fromarray(mask, mode="L")
    if erode and erode > 1:
        strokes = strokes.filter(ImageFilter.MinFilter(erode))
    if dilate and dilate > 1:
        strokes = strokes.filter(ImageFilter.MaxFilter(dilate))
    return Image.fromarray(255 - np.array(strokes), mode="L")


def variant(image, kind, threshold, erode=3, dilate=5, suppress_bg=True):
    bg = background_mask(image) if suppress_bg else None
    grey = image.convert("L")
    if kind == "grey":
        soft = grey.filter(ImageFilter.GaussianBlur(1.1))
        return to_lines(normalise(sobel(np.array(soft, dtype=np.float64))), threshold, erode, dilate, bg)

    if kind == "color":
        # Max over channels: the cap/background boundary shares luminance with
        # the cap but not hue, so a grey-only edge map loses it.
        stack = np.array(image, dtype=np.float64)
        magnitude = np.maximum.reduce([sobel(stack[:, :, i]) for i in range(3)])
        soft = Image.fromarray(normalise(magnitude).astype(np.uint8)).filter(
            ImageFilter.GaussianBlur(0.8)
        )
        return to_lines(normalise(np.array(soft, dtype=np.float64)), threshold, erode, dilate, bg)

    if kind == "ink":
        # The still already IS a line drawing, just painted over. An adaptive
        # threshold keeps the drawn strokes (eyes, cap hem, hair strands) and
        # drops shading boundaries, which edge detection cannot tell apart.
        grey = image.convert("L")
        pixels = np.array(grey, dtype=np.float64)
        local = np.array(grey.filter(ImageFilter.BoxBlur(14)), dtype=np.float64)
        ink = pixels < (local - threshold)
        # Add the strongest gradients so boundaries with no drawn line survive.
        edges = normalise(sobel(pixels)) >= 110
        mask = ((ink | edges) * 255).astype(np.uint8)
        if bg is not None:
            mask[np.array(bg) > 0] = 0
        strokes = Image.fromarray(mask, mode="L")
        if erode and erode > 1:
            strokes = strokes.filter(ImageFilter.MinFilter(erode))
        if dilate and dilate > 1:
            strokes = strokes.filter(ImageFilter.MaxFilter(dilate))
        return Image.fromarray(255 - np.array(strokes), mode="L")

    if kind == "poster":
        # Flatten to 5 levels first: texture noise disappears, contours remain.
        flat = image.quantize(colors=5, method=Image.MEDIANCUT).convert("RGB")
        soft = flat.filter(ImageFilter.GaussianBlur(1.0))
        stack = np.array(soft, dtype=np.float64)
        magnitude = np.maximum.reduce([sobel(stack[:, :, i]) for i in range(3)])
        return to_lines(normalise(magnitude), threshold, erode, dilate, bg)

    raise SystemExit(f"unknown variant: {kind}")


VARIANTS = [
    ("ink", 10, "墨线 · 10 · 细", 1, 3),
    ("ink", 16, "墨线 · 16 · 标准", 1, 3),
    ("ink", 16, "墨线 · 16 · 加粗", 1, 5),
    ("ink", 24, "墨线 · 24 · 去杂", 3, 5),
    ("color", 40, "边缘 · 40 · 对照", 3, 5),
]


def sheet(source, crop, out_path):
    image = load(source, crop)
    cell = 300
    pad = 26
    label_h = 34
    width = cell * len(VARIANTS)
    canvas = Image.new("RGB", (width, cell + label_h), (8, 12, 18))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 16)
    except OSError:
        font = ImageFont.load_default()

    for index, (kind, threshold, label, erode, dilate) in enumerate(VARIANTS):
        lines = variant(image, kind, threshold, erode, dilate).resize((cell - pad, cell - pad), Image.LANCZOS)
        canvas.paste(lines.convert("RGB"), (index * cell + pad // 2, pad // 2))
        draw.text((index * cell + pad // 2, cell + 4), label, fill=(180, 210, 235), font=font)

    canvas.save(out_path)
    print(f"wrote {out_path} ({width}x{cell + label_h})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="preview/source-lena.jpg")
    parser.add_argument("--out", default="assets/avatar.png")
    parser.add_argument("--kind", default="color", choices=["grey", "color", "poster", "ink"])
    parser.add_argument("--threshold", type=float, default=40)
    parser.add_argument("--size", type=int, default=512)
    parser.add_argument("--erode", type=int, default=3)
    parser.add_argument("--dilate", type=int, default=5)
    parser.add_argument("--keep-bg", action="store_true")
    parser.add_argument("--sheet", action="store_true")
    parser.add_argument("--sheet-out", default="preview/lineart-sheet.png")
    parser.add_argument(
        "--crop",
        default="40,10,824,794",
        help="left,top,right,bottom in source pixels (square-ish keeps the HUD honest)",
    )
    args = parser.parse_args()

    crop = tuple(int(part) for part in args.crop.split(","))
    if args.sheet:
        sheet(args.source, crop, args.sheet_out)
        return

    image = load(args.source, crop)
    lines = variant(
        image, args.kind, args.threshold, args.erode, args.dilate, not args.keep_bg
    ).resize((args.size, args.size), Image.LANCZOS)
    lines.save(args.out, optimize=True)
    ink = np.array(lines)
    print(
        f"wrote {args.out} ({args.size}x{args.size}, "
        f"{(ink < 128).mean() * 100:.1f}% ink)"
    )


if __name__ == "__main__":
    sys.exit(main())
