#!/usr/bin/env python3
"""Judge avatar candidates at the size they will actually be seen.

    python3 scripts/contact.py preview/candidates/*.png -o preview/candidates.png

Each image appears twice: at 152 px (the HUD's large size) and at 360 px for
detail. The small column is the honest one — if the cap, the eyes and the hair
are not readable there, the candidate is not usable no matter how good the
360 px version looks.
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SMALL, LARGE, GAP, CAP, PAD = 152, 300, 18, 30, 18


def font(size=13):
    for candidate in (
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Supplemental/Courier New.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def load(path):
    image = Image.open(path)
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
        flat.alpha_composite(image)
        image = flat.convert("RGB")
    return image.convert("RGB")


def sheet(paths, out):
    column = SMALL + GAP + LARGE
    width = PAD * 2 + column * len(paths) + GAP * (len(paths) - 1)
    height = PAD * 2 + CAP + LARGE
    canvas = Image.new("RGB", (width, height), (8, 12, 18))
    draw = ImageDraw.Draw(canvas)
    label_font = font()

    for index, path in enumerate(paths):
        image = load(path)
        x = PAD + index * (column + GAP)

        small = image.resize((SMALL, SMALL), Image.LANCZOS)
        large = image.resize((LARGE, LARGE), Image.LANCZOS)

        canvas.paste(small, (x, PAD))
        canvas.paste(large, (x + SMALL + GAP, PAD))

        draw.rectangle([x - 1, PAD - 1, x + SMALL, PAD + SMALL], outline=(40, 70, 95), width=1)
        draw.text((x, PAD + SMALL + 6), "152 px", fill=(120, 200, 255), font=label_font)
        draw.text(
            (x, PAD + LARGE + 8),
            Path(path).name[:34],
            fill=(150, 170, 190),
            font=label_font,
        )

    canvas.save(out)
    print(f"wrote {out} ({width}x{height}, {len(paths)} candidates)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", help="candidate images")
    parser.add_argument("-o", "--out", default="preview/candidates.png")
    args = parser.parse_args()

    missing = [path for path in args.images if not Path(path).is_file()]
    if missing:
        print("missing: " + ", ".join(missing), file=sys.stderr)
        return 1

    sheet(args.images, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
