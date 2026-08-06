#!/usr/bin/env python3
"""Instagram / X creative: platform-power post (242 number properties records)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "instagram"
SIZE = 1080  # IG square
X_W, X_H = 1600, 900  # X landscape card

INK = (20, 58, 46)
LEAF = (36, 122, 77)
LIME = (196, 245, 71)
GOLD = (211, 169, 0)
CREAM = (255, 253, 247)
PAPER = (255, 248, 233)
MINT = (228, 247, 220)
DARK = (7, 15, 12)
MUTED = (104, 116, 104)


def fnt(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def brand(draw: ImageDraw.ImageDraw, y: int = 52, light: bool = False) -> None:
    fb = fnt(SANS_B, 30)
    c1 = CREAM if light else INK
    c2 = LIME if light else GOLD
    draw.text((56, y), "Mind", font=fb, fill=c1)
    w = draw.textlength("Mind", font=fb)
    draw.text((56 + w, y), "Craft", font=fb, fill=c2)


def ig_square() -> Path:
    im = Image.new("RGB", (SIZE, SIZE), DARK)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((520, -80, 1280, 680), fill=(36, 122, 77, 70))
    od.ellipse((-200, 620, 520, 1280), fill=(196, 245, 71, 28))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)

    brand(d, light=True)
    d.text((56, 140), "THE MAP SEES MORE", font=fnt(SANS_B, 18), fill=LIME)

    # Big number
    d.text((56, 220), "242", font=fnt(SERIF, 180), fill=LIME)
    d.text(
        (56, 420),
        "question records",
        font=fnt(SANS_B, 36),
        fill=CREAM,
    )
    d.text(
        (56, 470),
        "shaping one gap: number properties",
        font=fnt(SANS, 28),
        fill=(183, 208, 194),
    )

    # Quote card
    d.rounded_rectangle((56, 580, 1024, 820), radius=28, fill=CREAM)
    d.text(
        (88, 620),
        "You see one problem.",
        font=fnt(SERIF, 36),
        fill=INK,
    )
    d.text(
        (88, 680),
        "The map sees the pattern",
        font=fnt(SERIF, 36),
        fill=INK,
    )
    d.text(
        (88, 740),
        "underneath it.",
        font=fnt(SERIF, 36),
        fill=LEAF,
    )

    d.text(
        (56, 900),
        "Diagnosis before the hour starts.",
        font=fnt(SANS_B, 24),
        fill=(200, 220, 208),
    )
    d.text(
        (56, 960),
        "MindCraft  ·  ACT Math",
        font=fnt(SANS_B, 20),
        fill=MUTED,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "ig_0001_platform_power.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def ig_story_safe() -> Path:
    """Optional second slide: cream brand explainer for carousel."""
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    d = ImageDraw.Draw(im)
    brand(d)
    d.text((56, 140), "WHY IT MATTERS", font=fnt(SANS_B, 18), fill=MUTED)
    d.text((56, 200), "A tutor should not", font=fnt(SERIF, 48), fill=INK)
    d.text((56, 268), "spend the hour", font=fnt(SERIF, 48), fill=INK)
    d.text((56, 336), "hunting the gap.", font=fnt(SERIF, 48), fill=LEAF)

    bullets = [
        ("01", "Gap scan charts the fog"),
        ("02", "Living notebook shows the route"),
        ("03", "College tutor starts on that spot"),
    ]
    y = 460
    for n, t in bullets:
        d.rounded_rectangle((56, y, 1024, y + 100), radius=22, fill=MINT)
        d.text((88, y + 32), n, font=fnt(SANS_B, 28), fill=LEAF)
        d.text((180, y + 34), t, font=fnt(SANS_B, 28), fill=INK)
        y += 124

    d.text((56, 920), "That is the power of the platform.", font=fnt(SANS_B, 24), fill=INK)

    path = OUT / "ig_0002_why_it_matters.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def x_card() -> Path:
    im = Image.new("RGB", (X_W, X_H), DARK)
    overlay = Image.new("RGBA", (X_W, X_H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((900, -100, 1800, 700), fill=(36, 122, 77, 70))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)
    brand(d, y=48, light=True)
    d.text((64, 160), "242", font=fnt(SERIF, 140), fill=LIME)
    d.text((64, 320), "records behind one math gap.", font=fnt(SANS_B, 40), fill=CREAM)
    d.text(
        (64, 400),
        "You see one problem. The map sees the pattern.",
        font=fnt(SERIF, 34),
        fill=(200, 220, 208),
    )
    d.text((64, 760), "MindCraft  ·  joinmindcraft", font=fnt(SANS_B, 24), fill=MUTED)
    path = OUT / "x_0001_platform_power.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def main() -> None:
    ig_square()
    ig_story_safe()
    x_card()


if __name__ == "__main__":
    main()
