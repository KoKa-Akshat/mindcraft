#!/usr/bin/env python3
"""Instagram / X creative: Post 002 — edtech platform meaning.

Designed to sit NEXT TO post 001 without twinning it:
  Post 001 = Deep Field + lime megaton number
  Post 002 = Navy Depth ground + cream type + gold Craft + one earned lime click
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "instagram"
SIZE = 1080
X_W, X_H = 1600, 900

# Brand book names (used differently than post 001)
DEEP = (8, 14, 20)          # Deep Field
NAVY = (29, 58, 138)        # Depth — this post's canvas
CHALK = (245, 245, 245)     # Chalk
LIME = (196, 245, 71)       # The Click — used once, earned
GOLD = (211, 169, 0)        # Craft / warm accent (post 001 used lime for Craft)
INK = (20, 58, 46)
CREAM = (255, 253, 247)
MUTED_ON_NAVY = (168, 186, 220)
SOFT = (90, 118, 190)

SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def fnt(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def brand(draw: ImageDraw.ImageDraw, y: int = 52) -> None:
    """Mind in chalk, Craft in gold — not lime (post 001 used lime Craft)."""
    fb = fnt(SANS_B, 30)
    draw.text((56, y), "Mind", font=fb, fill=CHALK)
    w = draw.textlength("Mind", font=fb)
    draw.text((56 + w, y), "Craft", font=fb, fill=GOLD)


def ig_hero() -> Path:
    """Slide 1 — navy theater, platform claim."""
    im = Image.new("RGB", (SIZE, SIZE), NAVY)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    # Soft Depth glows — navy family, not the lime/leaf orbs of post 001
    od.ellipse((-180, -220, 520, 480), fill=(8, 14, 20, 90))
    od.ellipse((640, 540, 1280, 1200), fill=(211, 169, 0, 36))
    od.ellipse((200, 700, 900, 1300), fill=(196, 245, 71, 18))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)

    brand(d)
    d.text((56, 130), "EDTECH, HONESTLY", font=fnt(SANS_B, 18), fill=GOLD)

    # Big claim — serif, chalk; no giant lime numeral (that was post 001)
    headline = [
        "Most apps add",
        "more practice.",
        "We find the break",
        "that makes practice fail.",
    ]
    y = 210
    for i, line in enumerate(headline):
        fill = LIME if i == 3 else CHALK  # one earned Click line
        d.text((56, y), line, font=fnt(SERIF, 56), fill=fill)
        y += 72

    # Bottom bar — cream strip (inverted from post 001's cream quote on dark)
    d.rounded_rectangle((56, 740, 1024, 980), radius=28, fill=CREAM)
    d.text((88, 780), "A living map before the worksheet.", font=fnt(SANS_B, 28), fill=INK)
    d.text(
        (88, 840),
        "Gap scan → route → college tutor starts",
        font=fnt(SANS, 24),
        fill=(70, 90, 80),
    )
    d.text((88, 890), "on the real break, not page one.", font=fnt(SANS, 24), fill=(70, 90, 80))
    d.text((88, 940), "MindCraft  ·  ACT Math", font=fnt(SANS_B, 20), fill=GOLD)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "ig_0003_practice_vs_break.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def ig_compare() -> Path:
    """Slide 2 — side-by-side edtech contrast on cream (post 001 slide 2 was mint bullets)."""
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    d = ImageDraw.Draw(im)

    # Brand on cream: ink + gold
    fb = fnt(SANS_B, 30)
    d.text((56, 52), "Mind", font=fb, fill=INK)
    w = d.textlength("Mind", font=fb)
    d.text((56 + w, 52), "Craft", font=fb, fill=GOLD)

    d.text((56, 130), "THE PLATFORM DIFFERENCE", font=fnt(SANS_B, 18), fill=(120, 130, 120))

    d.text((56, 190), "Two kinds of math apps.", font=fnt(SERIF, 44), fill=INK)

    # Left card — typical edtech (muted, no lime)
    d.rounded_rectangle((56, 300, 510, 820), radius=26, fill=(235, 232, 224))
    d.text((88, 340), "THE USUAL", font=fnt(SANS_B, 16), fill=(130, 130, 120))
    left = [
        "More problems",
        "Same fog",
        "Tutor guesses",
        "where to start",
    ]
    y = 400
    for line in left:
        d.text((88, y), line, font=fnt(SERIF, 32), fill=(90, 95, 90))
        y += 70

    # Right card — MindCraft (navy + one lime)
    d.rounded_rectangle((570, 300, 1024, 820), radius=26, fill=NAVY)
    d.text((602, 340), "MINDCRAFT", font=fnt(SANS_B, 16), fill=GOLD)
    right = [
        ("Diagnosis first", CHALK),
        ("Living notebook", CHALK),
        ("Tutor lands on", CHALK),
        ("the real break", LIME),
    ]
    y = 400
    for line, color in right:
        d.text((602, y), line, font=fnt(SERIF, 32), fill=color)
        y += 70

    d.text(
        (56, 900),
        "That is what a platform is for.",
        font=fnt(SANS_B, 26),
        fill=INK,
    )
    d.text((56, 960), "Not another packet. A route.", font=fnt(SANS, 24), fill=(100, 110, 100))

    path = OUT / "ig_0004_two_kinds.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def x_card() -> Path:
    im = Image.new("RGB", (X_W, X_H), NAVY)
    overlay = Image.new("RGBA", (X_W, X_H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-100, -80, 700, 600), fill=(8, 14, 20, 80))
    od.ellipse((1100, 400, 1800, 1000), fill=(211, 169, 0, 40))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)
    brand(d, y=48)
    d.text((64, 150), "Most apps add more practice.", font=fnt(SERIF, 48), fill=CHALK)
    d.text((64, 230), "We find the break that makes", font=fnt(SERIF, 48), fill=CHALK)
    d.text((64, 310), "practice fail.", font=fnt(SERIF, 48), fill=LIME)
    d.text(
        (64, 420),
        "Gap scan. Living map. Tutor starts there.",
        font=fnt(SANS_B, 28),
        fill=MUTED_ON_NAVY,
    )
    d.text((64, 780), "MindCraft  ·  joinmindcraft", font=fnt(SANS_B, 24), fill=GOLD)
    path = OUT / "x_0002_practice_vs_break.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def main() -> None:
    ig_hero()
    ig_compare()
    x_card()
    # Convenience copies for posting
    downloads = Path.home() / "Downloads"
    for src, name in [
        (OUT / "ig_0003_practice_vs_break.png", "ig_0003.png"),
        (OUT / "ig_0004_two_kinds.png", "ig_0004.png"),
        (OUT / "x_0002_practice_vs_break.png", "x_0002.png"),
    ]:
        dest = downloads / name
        dest.write_bytes(src.read_bytes())
        print("copied", dest)


if __name__ == "__main__":
    main()
