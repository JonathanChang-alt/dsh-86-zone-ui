#!/usr/bin/env python3
"""Composite the 86 lockup onto a key visual.

    python3 scripts/logo-plate.py preview/bg-night.jpg

Writes three takes into preview/:
    keyart-card.png     the title card, centred on the tracks (closest to the poster)
    keyart-plain.png    the numeral alone, glowing out of the fog (no plate)
    keyart-corner.png   small bottom-left lockup, for splash / footer use
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FACES = {
    "avenir": ("/System/Library/Fonts/Avenir Next.ttc", 8),          # geometric, round bowls
    "arial": ("/System/Library/Fonts/Supplemental/Arial Black.ttf", 0),  # grotesque, flat sides
    "helv": ("/System/Library/Fonts/HelveticaNeue.ttc", 9),          # condensed black
    "bold": ("/System/Library/Fonts/HelveticaNeue.ttc", 1),          # bold, lighter strokes
}
FACE = "helv"      # condensed black: narrower numeral, same weight as the logo
CARD_W = 0.205     # plate width as a fraction of the image
CARD_ASPECT = 1.46 # height / width — smaller is a wider plate
CARD_FILL = 0.72   # width ceiling (the height usually binds first)
CARD_H = 0.34      # height of the numeral block, as a fraction of the plate
TAILOR = 0.88      # horizontal squash: <1 = narrower, taller-looking numerals
KANA = "/System/Library/Fonts/Hiragino Sans GB.ttc"
BOX = "/System/Library/Fonts/HelveticaNeue.ttc"      # index 1 = Bold
INK = (255, 255, 255)
PLATE = (6, 7, 9)


def font(path, index=0, size=24):
    return ImageFont.truetype(path, size, index=index)


def tracked(draw, xy, text, fnt, fill, tracking=0, anchor="mm"):
    """Draw text with letter spacing. PIL has none, so lay glyphs out by hand."""
    widths = [draw.textlength(ch, font=fnt) for ch in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x, y = xy
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=fnt, fill=fill, anchor="lm")
        x += w + tracking
    return total


def tracked_width(draw, text, fnt, tracking=0):
    total = sum(draw.textlength(ch, font=fnt) for ch in text)
    return total + tracking * max(0, len(text) - 1)


def fit_size(draw, text, target_width, tracking_ratio=0.0, lo=8, hi=2400):
    """Binary-search the font size whose tracked width lands just inside target.

    The 86 plate is a fixed-aspect box; without this the numerals spill past the
    edge as soon as the face changes (Arial Black is much wider than Avenir)."""
    face_path, face_index = FACES[FACE]
    best = lo
    for _ in range(22):
        mid = (lo + hi) // 2
        fnt = font(face_path, face_index, size=mid)
        width = tracked_width(draw, text, fnt, mid * tracking_ratio)
        if width <= target_width:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
        if lo > hi:
            break
    return best


def numeral_ink(text, size, tracking=0.0, squash=1.0):
    """Render the numerals to their own image and crop to the real ink.

    Advance widths lie about side bearings, so a width computed from
    textlength() can still paint outside the plate. This measures pixels."""
    face_path, face_index = FACES[FACE]
    fnt = font(face_path, face_index, size=size)
    probe = ImageDraw.Draw(Image.new("L", (8, 8)))
    width = int(tracked_width(probe, text, fnt, tracking)) + size * 2
    height = int(size * 2.2)
    canvas = Image.new("L", (width, height), 0)
    tracked(ImageDraw.Draw(canvas), (size, height / 2), text, fnt, 255, tracking)
    box = canvas.getbbox() or (0, 0, width, height)
    ink = canvas.crop(box)
    if squash != 1.0:
        ink = ink.resize((max(1, int(ink.width * squash)), ink.height), Image.LANCZOS)
    return ink


def glow(layer, radius, strength):
    """Blurred copy of the layer, used as a bloom behind the artwork."""
    blur = layer.filter(ImageFilter.GaussianBlur(radius))
    if strength >= 1:
        return blur
    alpha = blur.split()[3].point(lambda v: int(v * strength))
    blur.putalpha(alpha)
    return blur


def card_layer(size, scale=1.0, width_ratio=0.165, aspect=1.62, fill=0.80):
    """The black title card with 86 / rule / kana / boxed EIGHTY SIX.

    width_ratio and aspect set the plate's footprint; fill is how much of that
    width the two numerals are allowed to occupy."""
    w = int(size[0] * width_ratio * scale)
    h = int(w * aspect)
    layer = Image.new("RGBA", (w + 60, h + 60), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = 30, 30

    # plate + hairline edge
    d.rectangle([ox, oy, ox + w, oy + h], fill=PLATE + (248,))
    d.rectangle([ox, oy, ox + w, oy + h], outline=(255, 255, 255, 46), width=2)

    # big 86: drawn as ink, then scaled to fit a box that is inset from the
    # plate on every side — pixel-exact, so nothing can ever poke out
    ink = numeral_ink("86", size=int(h * 0.5), tracking=int(h * -0.012), squash=TAILOR)
    box_w, box_h = w * fill, h * CARD_H
    k = min(box_w / ink.width, box_h / ink.height)
    ink = ink.resize((max(1, int(ink.width * k)), max(1, int(ink.height * k))), Image.LANCZOS)
    ix = ox + int((w - ink.width) / 2)
    iy = oy + int(h * 0.115)
    white = Image.new("RGBA", ink.size, (255, 255, 255, 255))
    white.putalpha(ink)
    layer.alpha_composite(white, (ix, iy))

    # hairline rule
    rule_y = oy + h * 0.66
    d.rectangle([ox + w * 0.10, rule_y, ox + w * 0.90, rule_y + 2], fill=(255, 255, 255, 150))

    # katakana subtitle
    kana = font(KANA, size=int(w * 0.072))
    tracked(d, (ox + w / 2, rule_y + h * 0.055), "ーエイティシックスー", kana, (255, 255, 255, 225), tracking=w * 0.004)

    # boxed EIGHTY SIX — box sized from the measured text, never a guess
    small = font(BOX, 1, size=int(w * 0.085))
    trk = w * 0.010
    padx, bh = w * 0.045, int(w * 0.085 * 2.9)
    bw = max(tracked_width(d, "EIGHTY", small, trk), tracked_width(d, "SIX", small, trk)) + padx * 2
    bx, by = ox + (w - bw) / 2, oy + h * 0.79
    d.rectangle([bx, by, bx + bw, by + bh], outline=(255, 255, 255, 210), width=2)
    tracked(d, (ox + w / 2, by + bh * 0.33), "EIGHTY", small, INK, tracking=trk)
    tracked(d, (ox + w / 2, by + bh * 0.72), "SIX", small, INK, tracking=trk)

    return layer, (ox, oy, w, h)


def compose_card(base):
    W, H = base.size
    layer, (ox, oy, w, h) = card_layer(base.size, width_ratio=CARD_W, aspect=CARD_ASPECT, fill=CARD_FILL)

    out = base.convert("RGBA")
    # bloom behind the plate so it reads as floating over the fog
    halo = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).rectangle([ox, oy, ox + w, oy + h], fill=(90, 170, 230, 90))
    halo = glow(halo, 50, 0.85)
    px = int(W / 2 - layer.size[0] / 2)
    py = int(H * 0.455 - layer.size[1] / 2)
    out.alpha_composite(halo, (px, py))
    out.alpha_composite(layer, (px, py))
    return out.convert("RGB")


def compose_plain(base):
    """Numeral straight in the fog: white 86 + rule + boxed text, no plate."""
    W, H = base.size
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = W / 2, H * 0.46
    numeral = font(*FACES[FACE], size=int(H * 0.30))
    tracked(d, (cx, cy - H * 0.05), "86", numeral, INK, tracking=-H * 0.012)

    rule_y = cy + H * 0.10
    d.rectangle([cx - W * 0.075, rule_y, cx + W * 0.075, rule_y + 2], fill=(255, 255, 255, 160))
    kana = font(KANA, size=int(H * 0.019))
    tracked(d, (cx, rule_y + H * 0.035), "ーエイティシックスー", kana, (255, 255, 255, 215), tracking=2)

    small = font(BOX, 1, size=int(H * 0.024))
    trk = 5
    padx, bh = W * 0.013, int(H * 0.024 * 2.9)
    bw = max(tracked_width(d, "EIGHTY", small, trk), tracked_width(d, "SIX", small, trk)) + padx * 2
    bx, by = cx - bw / 2, rule_y + H * 0.082
    d.rectangle([bx, by, bx + bw, by + bh], outline=(255, 255, 255, 190), width=2)
    tracked(d, (cx, by + bh * 0.33), "EIGHTY", small, INK, tracking=trk)
    tracked(d, (cx, by + bh * 0.72), "SIX", small, INK, tracking=trk)

    out = base.convert("RGBA")
    out.alpha_composite(glow(layer, 26, 0.7))
    out.alpha_composite(layer)
    return out.convert("RGB")


def compose_corner(base):
    """Compact horizontal lockup, bottom left — the same shape the UI uses."""
    W, H = base.size
    pad = int(H * 0.055)
    h = int(H * 0.105)
    layer_w, layer_h = int(h * 4.1), h
    layer = Image.new("RGBA", (layer_w + 80, layer_h + 80), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox = oy = 40

    d.rectangle([ox, oy, ox + layer_w, oy + h], fill=PLATE + (226,))
    d.rectangle([ox, oy, ox + layer_w, oy + h], outline=(140, 200, 240, 70), width=2)

    numeral = font(*FACES[FACE], size=int(h * 0.70))
    d.text((ox + h * 0.24, oy + h * 0.52), "86", font=numeral, fill=INK, anchor="lm")

    col = ox + h * 1.66
    kana = font(KANA, size=int(h * 0.145))
    tracked(d, (col, oy + h * 0.29), "ーエイティシックスー", kana, (222, 238, 250, 225), tracking=1)

    small = font(BOX, 1, size=int(h * 0.20))
    trk = 2
    tw = tracked_width(d, "EIGHTY SIX", small, trk)
    bx, by = col, oy + h * 0.45
    bw, bh = tw + h * 0.22, h * 0.40
    d.rectangle([bx, by, bx + bw, by + bh], outline=(255, 255, 255, 195), width=1)
    tracked(d, (bx + bw / 2, by + bh / 2), "EIGHTY SIX", small, INK, tracking=trk)

    out = base.convert("RGBA")
    out.alpha_composite(glow(layer, 16, 0.55), (pad - 40, H - pad - layer_h - 40))
    out.alpha_composite(layer, (pad - 40, H - pad - layer_h - 40))
    return out.convert("RGB")


def main():
    global FACE, CARD_W, CARD_ASPECT, CARD_FILL, CARD_H, TAILOR
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for flag in sys.argv[1:]:
        key, _, value = flag.partition("=")
        if key == "--face":
            FACE = value
        elif key == "--card-w":
            CARD_W = float(value)
        elif key == "--card-aspect":
            CARD_ASPECT = float(value)
        elif key == "--card-fill":
            CARD_FILL = float(value)
        elif key == "--numeral":
            FACE = value
        elif key == "--card-h":
            CARD_H = float(value)
        elif key == "--tailor":
            TAILOR = float(value)
    src = Path(args[0] if args else "preview/bg-night.jpg")
    base = Image.open(src).convert("RGB")
    out_dir = src.parent
    for name, fn in (("keyart-card", compose_card), ("keyart-plain", compose_plain), ("keyart-corner", compose_corner)):
        target = out_dir / f"{name}.png"
        fn(base).save(target)
        print(f"wrote {target} ({base.size[0]}x{base.size[1]})")


if __name__ == "__main__":
    main()
