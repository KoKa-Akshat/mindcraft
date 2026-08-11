#!/usr/bin/env python3
"""Instagram / X Post 003 — Tartaglia / polynomials story quiz.

Canon from app conceptStories (polynomials): Venice arsenal asks Tartaglia
the deadliest range question. Old masters answer with instinct. He writes
the curve as stacked pieces. That is the polynomial click.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
APP = ROOT.parent / "app" / "src" / "assets" / "canvas"
OUT = ROOT / "instagram"
SIZE = 1080
X_W, X_H = 1600, 900

DEEP = (8, 14, 20)
CHALK = (245, 245, 245)
CREAM = (255, 253, 247)
INK = (20, 58, 46)
GOLD = (211, 169, 0)
LIME = (196, 245, 71)
STAKES = (193, 18, 31)
MUTED = (180, 175, 165)

SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

STORY_POLY = APP / "generated" / "story-polynomials.jpg"
STORY_QUAD = APP / "generated" / "story-quadratic_equations.jpg"


def fnt(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def cover_fit(src: Path, size: int = SIZE) -> Image.Image:
    im = Image.open(src).convert("RGB")
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.05)
    return ImageOps.fit(im, (size, size), method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))


def brand(draw: ImageDraw.ImageDraw, y: int = 48, on_dark: bool = True) -> None:
    fb = fnt(SANS_B, 28)
    c1 = CHALK if on_dark else INK
    draw.text((48, y), "Mind", font=fb, fill=c1)
    w = draw.textlength("Mind", font=fb)
    draw.text((48 + w, y), "Craft", font=fb, fill=GOLD)


def vignette_bottom(im: Image.Image, strength: int = 210) -> Image.Image:
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    w, h = im.size
    for i in range(h // 2):
        t = i / (h // 2)
        a = int(strength * (t**1.6))
        y = h // 2 + i
        od.line([(0, y), (w, y)], fill=(8, 14, 20, a))
    for i in range(140):
        a = int(140 * (1 - i / 140))
        od.line([(0, i), (w, i)], fill=(8, 14, 20, a))
    return Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")


def ig_slide_1() -> Path:
    """Hook: arsenal needs range. Instinct is failing. Stakes are real."""
    base = cover_fit(STORY_POLY)
    im = vignette_bottom(base, strength=230)
    d = ImageDraw.Draw(im)
    brand(d)

    d.text((48, 140), "STORY DROP · POLYNOMIALS", font=fnt(SANS_B, 15), fill=STAKES)
    d.text((48, 180), "Venice arsenal, 1537.", font=fnt(SERIF, 46), fill=CHALK)
    d.text((48, 245), "Every short shot wastes", font=fnt(SERIF, 34), fill=CHALK)
    d.text((48, 290), "iron, powder, and pride.", font=fnt(SERIF, 34), fill=CHALK)
    d.text((48, 360), "Captains swear by gut.", font=fnt(SERIF, 28), fill=MUTED)
    d.text((48, 400), "Tartaglia asks for a curve.", font=fnt(SERIF, 28), fill=MUTED)

    d.rounded_rectangle((48, 680, 1032, 1008), radius=28, fill=CREAM)
    d.text((80, 715), "THE QUESTION THEY BRING HIM", font=fnt(SANS_B, 13), fill=STAKES)
    d.text((80, 760), "At what angle does a cannon", font=fnt(SERIF, 32), fill=INK)
    d.text((80, 808), "throw a ball the farthest?", font=fnt(SERIF, 32), fill=INK)
    d.text((80, 880), "Old masters say: feel it.", font=fnt(SERIF, 22), fill=(90, 110, 100))
    d.text((80, 940), "Swipe before you guess →", font=fnt(SANS_B, 22), fill=GOLD)

    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / "ig_0005_story_hook.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def ig_slide_2() -> Path:
    """Comment bait: you advise the arsenal, not a confused gunner."""
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    art = cover_fit(STORY_POLY, 520)
    art = art.filter(ImageFilter.GaussianBlur(0.6))
    im.paste(art, (SIZE - 520, SIZE - 520))
    fade = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    fd.rectangle((0, 0, SIZE, SIZE), fill=(255, 253, 247, 210))
    im = Image.alpha_composite(im.convert("RGBA"), fade).convert("RGB")

    d = ImageDraw.Draw(im)
    fb = fnt(SANS_B, 28)
    d.text((48, 48), "Mind", font=fb, fill=INK)
    w = d.textlength("Mind", font=fb)
    d.text((48 + w, 48), "Craft", font=fb, fill=GOLD)

    d.text((48, 115), "PICK ONE. NO CALCULATOR.", font=fnt(SANS_B, 15), fill=STAKES)
    d.text((48, 160), "What do you tell", font=fnt(SERIF, 44), fill=INK)
    d.text((48, 220), "the arsenal?", font=fnt(SERIF, 44), fill=INK)

    choices = [
        ("A", "30° · skim the water, stay fast"),
        ("B", "45° · balance height and run"),
        ("C", "60° · loft it, pride of the sky"),
        ("D", "Whatever feels right. Instinct."),
    ]
    y = 320
    for letter, text in choices:
        d.rounded_rectangle((48, y, 1032, y + 110), radius=22, fill=(255, 255, 255))
        d.rounded_rectangle((48, y, 1032, y + 110), radius=22, outline=(220, 210, 190), width=2)
        d.rounded_rectangle((72, y + 28, 140, y + 82), radius=14, fill=DEEP)
        d.text((92, y + 38), letter, font=fnt(SANS_B, 28), fill=LIME if letter == "B" else CHALK)
        d.text((168, y + 40), text, font=fnt(SERIF, 26), fill=INK)
        y += 130

    d.text((48, 980), "Comment your letter. Reveal next →", font=fnt(SANS_B, 22), fill=GOLD)

    path = OUT / "ig_0006_story_choices.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def ig_slide_3() -> Path:
    """Reveal + polynomial bridge from canon story."""
    base = cover_fit(STORY_QUAD)
    im = vignette_bottom(base, strength=235)
    d = ImageDraw.Draw(im)
    brand(d)

    d.text((48, 145), "THE CLICK", font=fnt(SANS_B, 16), fill=LIME)
    d.text((48, 190), "B · 45°", font=fnt(SERIF, 72), fill=CHALK)
    d.text((48, 280), "when the path is a parabola", font=fnt(SERIF, 32), fill=CHALK)
    d.text((48, 328), "you can write down.", font=fnt(SERIF, 32), fill=LIME)

    d.rounded_rectangle((48, 680, 1032, 1008), radius=28, fill=CREAM)
    d.text((80, 715), "TARTAGLIA’S MOVE", font=fnt(SANS_B, 14), fill=STAKES)
    d.text((80, 760), "Don’t guess the angle.", font=fnt(SERIF, 28), fill=INK)
    d.text((80, 805), "Hold the curve as stacked pieces.", font=fnt(SERIF, 28), fill=INK)
    d.text((80, 860), "That is polynomial thinking.", font=fnt(SERIF, 28), fill=INK)
    d.text((80, 930), "MindCraft puts ACT questions", font=fnt(SANS_B, 20), fill=INK)
    d.text((80, 965), "inside the story. Then the map moves.", font=fnt(SANS_B, 20), fill=GOLD)

    path = OUT / "ig_0007_story_reveal.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def x_card() -> Path:
    base = cover_fit(STORY_POLY, max(X_W, X_H))
    left = (base.width - X_W) // 2
    top = (base.height - X_H) // 2
    im = base.crop((left, top, left + X_W, top + X_H))
    overlay = Image.new("RGBA", (X_W, X_H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(X_H):
        a = int(200 * ((i / X_H) ** 1.4))
        od.line([(0, i), (X_W, i)], fill=(8, 14, 20, a))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    d = ImageDraw.Draw(im)
    brand(d, y=40)
    d.text((56, 170), "Venice arsenal, 1537.", font=fnt(SERIF, 36), fill=MUTED)
    d.text((56, 240), "Short shots waste iron.", font=fnt(SERIF, 44), fill=CHALK)
    d.text((56, 300), "At what angle goes farthest?", font=fnt(SERIF, 44), fill=CHALK)
    d.text((56, 400), "Instinct vs a curve you can write. Same ACT math.", font=fnt(SANS_B, 26), fill=MUTED)
    d.text((56, 780), "MindCraft  ·  story first, then the questions", font=fnt(SANS_B, 24), fill=GOLD)
    path = OUT / "x_0003_story_cannon.png"
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def main() -> None:
    for p in (STORY_POLY, STORY_QUAD):
        if not p.exists():
            raise SystemExit(f"missing story art: {p}")
    ig_slide_1()
    ig_slide_2()
    ig_slide_3()
    x_card()
    downloads = Path.home() / "Downloads"
    mapping = [
        (OUT / "ig_0005_story_hook.png", "ig_0005.png"),
        (OUT / "ig_0006_story_choices.png", "ig_0006.png"),
        (OUT / "ig_0007_story_reveal.png", "ig_0007.png"),
        (OUT / "x_0003_story_cannon.png", "x_0003.png"),
    ]
    for src, name in mapping:
        dest = downloads / name
        try:
            dest.write_bytes(src.read_bytes())
            print("copied", dest)
        except OSError as e:
            print("skip Downloads copy:", e)


if __name__ == "__main__":
    main()
