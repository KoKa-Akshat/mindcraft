#!/usr/bin/env python3
"""Build MindCraft social banners from the locked four-color brand system."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent
SCALE = 3

DEEP = (8, 14, 20)
CHALK = (245, 245, 245)
LIME = (196, 245, 71)
NAVY = (29, 58, 138)
PALETTE = (DEEP, CHALK, LIME, NAVY)

FONT_PATH = "/System/Library/Fonts/Avenir Next.ttc"
FONT_BOLD = 0
FONT_DEMI = 2
FONT_HEAVY = 8


def px(value):
    if isinstance(value, tuple):
        return tuple(round(part * SCALE) for part in value)
    return round(value * SCALE)


def font(size, face=FONT_BOLD):
    return ImageFont.truetype(FONT_PATH, px(size), index=face)


def tracked_text(draw, position, text, text_font, fill, tracking):
    x, y = px(position)
    for character in text:
        draw.text((x, y), character, font=text_font, fill=fill)
        advance = draw.textlength(character, font=text_font)
        x += advance + px(tracking)


def palette_lock(image):
    """Force every output pixel to one of the four exact brand hex values."""
    palette_image = Image.new("P", (1, 1))
    flat_palette = []
    for color in PALETTE:
        flat_palette.extend(color)
    flat_palette.extend(list(DEEP) * (256 - len(PALETTE)))
    palette_image.putpalette(flat_palette)
    return image.quantize(palette=palette_image, dither=Image.Dither.NONE)


def save_rgb_png(image, path):
    """Save a conventional 24-bit RGB PNG after enforcing the brand palette."""
    palette_lock(image).convert("RGB").save(path, format="PNG", optimize=True)


def save_jpg_fallback(image, path):
    """Save a maximum-quality fallback for uploaders with strict PNG decoders."""
    palette_lock(image).convert("RGB").save(
        path,
        format="JPEG",
        quality=100,
        subsampling=0,
        optimize=True,
    )


def draw_node(draw, center, radius, fill, ring=False):
    cx, cy = px(center)
    radius = px(radius)
    if ring:
        outer = radius + px(16)
        draw.ellipse((cx - outer, cy - outer, cx + outer, cy + outer), outline=NAVY, width=px(3))
        middle = radius + px(7)
        draw.ellipse((cx - middle, cy - middle, cx + middle, cy + middle), outline=CHALK, width=px(2))
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=fill)


def draw_learning_map(draw, points, final_radius):
    scaled = [px(point) for point in points]
    draw.line(scaled, fill=NAVY, width=px(5), joint="curve")

    # Quiet alternate routes make the structure feel diagnosed, not ornamental.
    forks = [
        (points[0], (points[1][0] - 54, points[1][1] - 66), points[2]),
        (points[1], (points[2][0] + 78, points[2][1] + 38), points[3]),
    ]
    for fork in forks:
        draw.line([px(point) for point in fork], fill=NAVY, width=px(2), joint="curve")

    for index, point in enumerate(points[:-1]):
        fill = CHALK if index in (1, 3) else NAVY
        draw_node(draw, point, 7 if fill == CHALK else 9, fill)
    draw_node(draw, points[-1], final_radius, LIME, ring=True)


def draw_wordmark(draw, x, y, domain_x):
    tracked_text(draw, (x, y), "MINDCRAFT", font(18, FONT_HEAVY), CHALK, 1.7)
    draw.rectangle((px(x), px(y + 31), px(x + 28), px(y + 35)), fill=LIME)
    tracked_text(draw, (domain_x, y + 2), "JOINMINDCRAFT.COM", font(11, FONT_DEMI), CHALK, 1.2)


def draw_headline(draw, x, y, size, line_gap):
    headline_font = font(size, FONT_HEAVY)
    draw.text(px((x, y)), "YOU WERE NEVER", font=headline_font, fill=CHALK, spacing=0)
    draw.text(px((x, y + line_gap)), "BAD AT MATH.", font=headline_font, fill=CHALK, spacing=0)


def draw_support(draw, x, y, size=18):
    support_font = font(size, FONT_DEMI)
    draw.text(px((x, y)), "MindCraft finds the gap. The story makes it click.", font=support_font, fill=CHALK)


def build_x():
    width, height = 1500, 500
    image = Image.new("RGB", px((width, height)), DEEP)
    draw = ImageDraw.Draw(image)
    draw.fontmode = "1"

    draw_wordmark(draw, 82, 54, 1182)
    draw_headline(draw, 78, 136, 73, 83)
    draw_support(draw, 84, 342, 18)

    map_points = [(1002, 397), (1085, 322), (1048, 229), (1176, 279), (1234, 178), (1382, 127)]
    draw_learning_map(draw, map_points, 17)
    tracked_text(draw, (1242, 400), "THE CLICK", font(11, FONT_DEMI), CHALK, 1.4)

    image = image.resize((width, height), Image.Resampling.NEAREST)
    save_rgb_png(image, OUT / "mindcraft-x-banner-1500x500.png")


def build_linkedin():
    width, height = 1584, 396
    image = Image.new("RGB", px((width, height)), DEEP)
    draw = ImageDraw.Draw(image)
    draw.fontmode = "1"

    # LinkedIn's profile portrait occupies the lower-left; the message begins in its safe area.
    draw_wordmark(draw, 374, 42, 1320)
    draw_headline(draw, 370, 112, 59, 68)
    draw_support(draw, 375, 282, 16)

    map_points = [(1112, 316), (1173, 265), (1147, 192), (1252, 225), (1301, 145), (1446, 102)]
    draw_learning_map(draw, map_points, 15)
    tracked_text(draw, (1348, 317), "THE CLICK", font(10, FONT_DEMI), CHALK, 1.2)

    # A navy anchor keeps the portrait side intentional when the image is viewed on its own.
    draw.rectangle(px((0, 0, 18, height)), fill=NAVY)

    image = image.resize((width, height), Image.Resampling.NEAREST)
    save_rgb_png(image, OUT / "mindcraft-linkedin-banner-1584x396.png")
    save_jpg_fallback(image, OUT / "mindcraft-linkedin-banner-1584x396.jpg")


def build_linkedin_company():
    width, height = 1128, 191
    image = Image.new("RGB", px((width, height)), DEEP)
    draw = ImageDraw.Draw(image)
    draw.fontmode = "1"

    tracked_text(draw, (64, 23), "MINDCRAFT", font(12, FONT_HEAVY), CHALK, 1.2)
    draw.rectangle(px((64, 47, 84, 50)), fill=LIME)
    tracked_text(draw, (892, 25), "JOINMINDCRAFT.COM", font(8, FONT_DEMI), CHALK, .8)
    draw_headline(draw, 61, 65, 36, 42)

    map_points = [(779, 160), (831, 126), (810, 83), (892, 106), (930, 59), (1050, 46)]
    draw_learning_map(draw, map_points, 10)

    image = image.resize((width, height), Image.Resampling.NEAREST)
    save_rgb_png(image, OUT / "mindcraft-linkedin-company-cover-1128x191.png")
    save_jpg_fallback(image, OUT / "mindcraft-linkedin-company-cover-1128x191.jpg")


def verify_palette(path):
    image = Image.open(path).convert("RGB")
    colors = set(image.get_flattened_data())
    unexpected = colors.difference(PALETTE)
    if unexpected:
        raise RuntimeError(f"{path.name} contains colors outside the locked palette: {unexpected}")
    return colors


def main():
    build_x()
    build_linkedin()
    build_linkedin_company()
    for filename in (
        "mindcraft-x-banner-1500x500.png",
        "mindcraft-linkedin-banner-1584x396.png",
        "mindcraft-linkedin-company-cover-1128x191.png",
    ):
        path = OUT / filename
        colors = verify_palette(path)
        print(f"{filename}: {Image.open(path).size}, {len(colors)} locked colors")


if __name__ == "__main__":
    main()
