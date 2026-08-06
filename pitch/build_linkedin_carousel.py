#!/usr/bin/env python3
"""Build LinkedIn carousel PNGs (1080x1080) from pitch assets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "img"
OUT = ROOT / "linkedin_carousel"
SIZE = 1080

INK = (20, 58, 46)
INK_SOFT = (42, 82, 68)
LEAF = (36, 122, 77)
LIME = (196, 245, 71)
GOLD = (211, 169, 0)
CREAM = (255, 253, 247)
PAPER = (255, 248, 233)
MINT = (228, 247, 220)
DARK = (7, 15, 12)
MUTED = (95, 122, 109)
WHITE = (255, 255, 255)


def font(path: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_B = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANS_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def cover_top(src: Path, tw: int, th: int) -> Image.Image:
    im = Image.open(src).convert("RGB")
    scale = max(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2)
    top = 0
    if top + th > nh:
        top = max(0, nh - th)
    return im.crop((left, top, left + tw, top + th))


def cover_center(src: Path, tw: int, th: int) -> Image.Image:
    im = Image.open(src).convert("RGB")
    scale = max(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2)
    top = max(0, (nh - th) // 2)
    return im.crop((left, top, left + tw, top + th))


def rounded_paste(base: Image.Image, im: Image.Image, xy: tuple[int, int], radius: int = 28) -> None:
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, im.width, im.height), radius=radius, fill=255)
    base.paste(im, xy, mask)


def brand(draw: ImageDraw.ImageDraw, y: int = 48, light: bool = False) -> None:
    f = font(SANS_B, 28)
    c1 = CREAM if light else INK
    c2 = LIME if light else GOLD
    draw.text((48, y), "Mind", font=f, fill=c1)
    w = draw.textlength("Mind", font=f)
    draw.text((48 + w, y), "Craft", font=f, fill=c2)


def save(im: Image.Image, name: str) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    im.save(path, "PNG", optimize=True)
    print("wrote", path)
    return path


def slide_01() -> None:
    im = Image.new("RGB", (SIZE, SIZE), DARK)
    draw = ImageDraw.Draw(im)
    # soft orbs
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((620, 200, 1200, 780), fill=(36, 122, 77, 55))
    od.ellipse((-120, 700, 420, 1200), fill=(196, 245, 71, 22))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(im)
    brand(draw, light=True)
    draw.text((48, 160), "WHAT WE ARE", font=font(SANS_B, 20), fill=LIME)
    lines = [
        "We map the real",
        "math gap.",
        "Then a college tutor",
        "starts there,",
        "not page one.",
    ]
    y = 240
    f = font(SERIF, 64)
    for line in lines:
        draw.text((48, y), line, font=f, fill=WHITE)
        y += 78
    draw.rounded_rectangle((48, y + 20, 128, y + 28), radius=4, fill=LIME)
    save(im, "01_what_we_are.png")


def slide_02_merged_product() -> None:
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(im)
    brand(draw)
    draw.text((48, 100), "THE PRODUCT", font=font(SANS_B, 18), fill=MUTED)
    draw.text((48, 136), "Gap scan + living notebook", font=font(SERIF, 42), fill=INK)

    # two stacked UI frames (tight for 1080 square)
    gap = cover_center(IMG / "gap_scan.png", 984, 320)
    note = cover_center(IMG / "contents.png", 984, 320)
    draw.rounded_rectangle((48, 200, 200, 234), radius=16, fill=MINT)
    draw.text((64, 206), "GAP SCAN", font=font(SANS_B, 15), fill=LEAF)
    rounded_paste(im, gap, (48, 246), radius=22)

    draw.rounded_rectangle((48, 590, 280, 624), radius=16, fill=MINT)
    draw.text((64, 596), "LIVING NOTEBOOK", font=font(SANS_B, 15), fill=LEAF)
    rounded_paste(im, note, (48, 636), radius=22)

    draw.text(
        (48, 980),
        "Fog becomes a chart. Today’s work has a reason.",
        font=font(SANS_B, 18),
        fill=INK_SOFT,
    )
    save(im, "02_product_merged.png")


def slide_03_story_tutors() -> None:
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(im)
    brand(draw)
    draw.text((48, 100), "PRODUCT", font=font(SANS_B, 18), fill=MUTED)
    draw.text((48, 136), "Story missions + tutors", font=font(SERIF, 40), fill=INK)
    draw.rounded_rectangle((700, 140, 1032, 180), radius=18, fill=MINT)
    draw.text((720, 148), "STAKES, THEN A HUMAN", font=font(SANS_B, 14), fill=LEAF)

    left = cover_center(IMG / "valley.jpg", 500, 760)
    right = cover_center(IMG / "find_a_tutor_desktop.png", 460, 760)
    rounded_paste(im, left, (48, 220), radius=24)
    rounded_paste(im, right, (572, 220), radius=24)
    save(im, "03_story_tutors.png")


def slide_04_duo() -> None:
    im = Image.new("RGB", (SIZE, SIZE), CREAM)
    draw = ImageDraw.Draw(im)
    brand(draw)
    draw.text((48, 100), "WHY US", font=font(SANS_B, 18), fill=MUTED)
    draw.text((48, 136), "Big picture. Allen wrench.", font=font(SERIF, 40), fill=INK)

    card_w, card_h = 470, 780
    photo_h = 520

    def card(x: int, photo: str, role: str, title: str, blurb: str) -> None:
        draw.rounded_rectangle((x, 210, x + card_w, 210 + card_h), radius=28, fill=PAPER)
        # TOP-aligned cover so Blake’s face stays in frame
        pic = cover_top(IMG / photo, card_w - 36, photo_h)
        rounded_paste(im, pic, (x + 18, 228), radius=22)
        ty = 228 + photo_h + 24
        draw.text((x + 28, ty), role.upper(), font=font(SANS_B, 14), fill=LEAF)
        draw.text((x + 28, ty + 32), title, font=font(SANS_B, 26), fill=INK)
        draw.text((x + 28, ty + 76), blurb, font=font(SANS, 18), fill=INK_SOFT)

    card(48, "akshat-koirala.jpg", "Akshat · Big picture", "Why the student gave up", "Eight years watching the broken hour.")
    card(562, "blake-kell.jpg", "Blake · Allen wrench", "Why the engine knows", "Builds the map tutors can trust.")
    save(im, "04_duo.png")


def slide_05_ask() -> None:
    im = Image.new("RGB", (SIZE, SIZE), DARK)
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((500, 100, 1200, 700), fill=(36, 122, 77, 50))
    im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(im)
    brand(draw, light=True)
    draw.text((48, 140), "THE ASK", font=font(SANS_B, 18), fill=LIME)
    draw.text((48, 190), "Who should we", font=font(SERIF, 56), fill=WHITE)
    draw.text((48, 260), "talk to?", font=font(SERIF, 56), fill=WHITE)

    asks = [
        ("01", "Parent with a 10th–12th grader on ACT Math"),
        ("02", "Counselor who hears “not a math person”"),
        ("03", "College tutor tired of detective hours"),
    ]
    y = 380
    for n, text in asks:
        draw.rounded_rectangle((48, y, 1032, y + 88), radius=18, fill=(255, 253, 247, 0))
        # simulate translucent bar
        bar = Image.new("RGBA", (984, 88), (255, 253, 247, 18))
        im.paste(Image.alpha_composite(im.convert("RGBA").crop((48, y, 1032, y + 88)), bar), (48, y))
        draw = ImageDraw.Draw(im)
        draw.text((72, y + 28), n, font=font(SANS_B, 22), fill=LIME)
        draw.text((140, y + 30), text, font=font(SANS_B, 22), fill=CREAM)
        y += 108

    # contact card
    draw.rounded_rectangle((48, 760, 1032, 1020), radius=28, fill=CREAM)
    draw.text((80, 790), "SNAP THIS", font=font(SANS_B, 14), fill=LEAF)
    draw.text((80, 830), "akshat@mindcraft.com", font=font(SANS_B, 32), fill=INK)
    draw.text((80, 880), "blake@mindcraft.com", font=font(SANS_B, 32), fill=INK)
    draw.text((80, 950), "linkedin.com/company/joinmindcraft", font=font(SANS_B, 20), fill=MUTED)
    save(im, "05_ask.png")


def main() -> None:
    slide_01()
    slide_02_merged_product()
    slide_03_story_tutors()
    slide_04_duo()
    slide_05_ask()
    print(f"\nCarousel ready in {OUT}")


if __name__ == "__main__":
    main()
