from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import textwrap

OUT = Path(__file__).resolve().parent
DPI = 300

CREAM = (249, 241, 225)
PAPER = (255, 250, 240)
GREEN = (6, 77, 54)
GREEN_DARK = (1, 30, 25)
GREEN_MID = (21, 88, 64)
LIME = (78, 181, 67)
BURGUNDY = (75, 0, 29)
GOLD = (214, 154, 28)
GOLD_SOFT = (232, 192, 102)
INK = (16, 35, 31)
MUTED = (109, 116, 105)
WHITE = (255, 255, 255)

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
SANS = str(FONT_DIR / "Arial.ttf")
SANS_BOLD = str(FONT_DIR / "Arial Bold.ttf")
SANS_BLACK = str(FONT_DIR / "Arial Black.ttf")
SERIF = str(FONT_DIR / "Georgia.ttf")
SERIF_BOLD = str(FONT_DIR / "Georgia Bold.ttf")


def font(path, size):
    return ImageFont.truetype(path, size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size, top)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        c = lerp(top, bottom, t)
        for x in range(w):
            px[x, y] = c
    return img


def rounded_rect(draw, xy, r, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, value, fnt, fill, anchor=None, spacing=8, align="left"):
    draw.multiline_text(xy, value, font=fnt, fill=fill, anchor=anchor, spacing=spacing, align=align)


def fit_lines(draw, value, fnt, max_width):
    words = value.split()
    lines = []
    line = ""
    for word in words:
        test = f"{line} {word}".strip()
        if draw.textbbox((0, 0), test, font=fnt)[2] <= max_width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return "\n".join(lines)


def draw_brand(draw, x, y, scale=1.0, light=False):
    f1 = font(SANS_BLACK, int(38 * scale))
    f2 = font(SANS_BLACK, int(38 * scale))
    c1 = WHITE if light else GREEN
    c2 = LIME
    draw.text((x, y), "Mind", font=f1, fill=c1)
    w = draw.textbbox((x, y), "Mind", font=f1)[2] - x - int(2 * scale)
    draw.text((x + w, y), "Craft", font=f2, fill=c2)


def paste_qr(base, box, invert=False):
    qr_path = OUT / "mindcraft-landing-qr.png"
    qr = Image.open(qr_path).convert("RGBA")
    if invert:
        rgb = qr.convert("RGB")
        data = []
        for r, g, b in rgb.getdata():
            if r < 128:
                data.append((*GREEN_DARK, 255))
            else:
                data.append((*PAPER, 255))
        qr = Image.new("RGBA", rgb.size)
        qr.putdata(data)
    x, y, size = box
    qr = qr.resize((size, size), Image.Resampling.NEAREST)
    base.alpha_composite(qr, (x, y))


def draw_arcs(draw, w, h, color, alpha=48, offset=0):
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i, r in enumerate([w * 0.36, w * 0.58, w * 0.82]):
        bbox = (
            int(w * 0.08 - r * 0.5 + offset),
            int(h * 0.18 - r * 0.5),
            int(w * 0.08 + r * 0.5 + offset),
            int(h * 0.18 + r * 0.5),
        )
        od.arc(bbox, start=285, end=72, fill=(*color, max(18, alpha - i * 12)), width=max(2, int(w * 0.002)))
    return overlay


def save_print(img, name):
    png = OUT / f"{name}.png"
    pdf = OUT / f"{name}.pdf"
    rgb = img.convert("RGB")
    rgb.save(png, dpi=(DPI, DPI), quality=95)
    rgb.save(pdf, "PDF", resolution=DPI)


def make_card_front():
    w, h = int(3.75 * DPI), int(2.25 * DPI)
    img = gradient((w, h), GREEN_DARK, GREEN).convert("RGBA")
    img.alpha_composite(draw_arcs(ImageDraw.Draw(img), w, h, GOLD_SOFT, 52, offset=120))
    d = ImageDraw.Draw(img)

    rounded_rect(d, (54, 46, w - 54, h - 46), 42, PAPER, (255, 250, 240, 90), 2)
    draw_brand(d, 88, 76, 0.82, light=False)
    d.text((88, 190), "FOR PARENTS TIRED OF GUESSING", font=font(SANS_BOLD, 20), fill=GOLD, spacing=6)
    headline = "Know what to do next."
    d.multiline_text((88, 240), headline, font=font(SERIF_BOLD, 72), fill=BURGUNDY, spacing=4)
    body = "MindCraft maps where your child stands in math, routes what to practice, and connects tutoring to the plan."
    d.multiline_text((88, 428), fit_lines(d, body, font(SANS_BOLD, 25), 610), font=font(SANS_BOLD, 25), fill=GREEN, spacing=8)

    qr_box = (w - 296, h - 338, 222)
    rounded_rect(d, (qr_box[0] - 16, qr_box[1] - 16, qr_box[0] + qr_box[2] + 16, qr_box[1] + qr_box[2] + 58), 28, PAPER, None)
    paste_qr(img, qr_box, invert=True)
    d.text((qr_box[0] + qr_box[2] // 2, qr_box[1] + qr_box[2] + 18), "Scan for demo", font=font(SANS_BOLD, 20), fill=GREEN, anchor="ma")
    save_print(img, "mindcraft_showcase_card_front_3.75x2.25_bleed")


def make_card_back():
    w, h = int(3.75 * DPI), int(2.25 * DPI)
    img = Image.new("RGBA", (w, h), PAPER)
    d = ImageDraw.Draw(img)
    img.alpha_composite(draw_arcs(d, w, h, GOLD, 38, offset=40))
    rounded_rect(d, (46, 44, w - 46, h - 44), 36, None, (6, 77, 54, 70), 2)
    draw_brand(d, 74, 70, 0.58, light=False)
    d.text((74, 150), "Private learning support for ACT + school math", font=font(SANS_BOLD, 21), fill=BURGUNDY)

    items = [
        ("1", "Find the gaps behind missed questions"),
        ("2", "Build a practice route students can follow"),
        ("3", "Turn homework stress into guided help"),
        ("4", "Give tutors context before every session"),
    ]
    y = 210
    for n, line in items:
        rounded_rect(d, (74, y, 112, y + 38), 19, (221, 244, 212), None)
        d.text((93, y + 19), n, font=font(SANS_BOLD, 18), fill=GREEN, anchor="mm")
        d.text((130, y + 6), line, font=font(SANS_BOLD, 22), fill=INK)
        y += 58

    d.line((74, 468, w - 74, 468), fill=(6, 77, 54, 70), width=2)
    d.text((74, 502), "joinmindcraft@gmail.com  •  +1 (763) 340-5616", font=font(SANS_BOLD, 20), fill=GREEN)
    d.text((74, 540), "mindcraft-marketing-site.web.app", font=font(SANS, 18), fill=MUTED)
    d.text((w - 74, 540), "BETA Showcase 2026", font=font(SANS_BOLD, 18), fill=BURGUNDY, anchor="ra")
    save_print(img, "mindcraft_showcase_card_back_3.75x2.25_bleed")


def make_poster(name, inches):
    w, h = int(inches[0] * DPI), int(inches[1] * DPI)
    img = gradient((w, h), PAPER, CREAM).convert("RGBA")
    d = ImageDraw.Draw(img)
    # Deep right panel
    panel_x = int(w * 0.62)
    d.rectangle((panel_x, 0, w, h), fill=GREEN_DARK)
    # Burgundy band
    d.rectangle((panel_x, 0, w, int(h * 0.29)), fill=BURGUNDY)
    # Premium grid lines
    for x in range(0, w, max(220, w // 8)):
        d.line((x, 0, x, h), fill=(6, 77, 54, 28), width=2)
    for y in range(0, h, max(260, h // 8)):
        d.line((0, y, w, y), fill=(6, 77, 54, 22), width=2)
    img.alpha_composite(draw_arcs(d, w, h, GOLD, 46, offset=int(w * 0.12)))

    margin = int(w * 0.055)
    draw_brand(d, margin, int(h * 0.055), 1.75 if inches[0] > 12 else 1.05, light=False)
    d.text((margin, int(h * 0.17)), "FOR PARENTS TIRED OF GUESSING", font=font(SANS_BOLD, int(w * 0.018)), fill=GOLD)
    headline_font = font(SERIF_BOLD, int(w * 0.074))
    headline = "Know what to\ndo next."
    d.multiline_text((margin, int(h * 0.225)), headline, font=headline_font, fill=BURGUNDY, spacing=int(w * 0.012))
    sub = "MindCraft turns missed math questions into a clear learning route, so families know where a student stands, what to practice, and when tutoring is actually helping."
    d.multiline_text((margin, int(h * 0.50)), fit_lines(d, sub, font(SANS_BOLD, int(w * 0.021)), int(w * 0.49)), font=font(SANS_BOLD, int(w * 0.021)), fill=GREEN, spacing=int(w * 0.01))

    qr_size = int(w * 0.18)
    qr_x = panel_x + int((w - panel_x - qr_size) / 2)
    qr_y = int(h * 0.56)
    rounded_rect(d, (qr_x - int(w * 0.018), qr_y - int(w * 0.018), qr_x + qr_size + int(w * 0.018), qr_y + qr_size + int(w * 0.07)), int(w * 0.02), PAPER)
    paste_qr(img, (qr_x, qr_y, qr_size), invert=True)
    d.text((qr_x + qr_size // 2, qr_y + qr_size + int(w * 0.032)), "Scan for the demo", font=font(SANS_BOLD, int(w * 0.017)), fill=GREEN, anchor="ma")

    right_x = panel_x + int(w * 0.05)
    right_width = w - right_x - int(w * 0.045)
    right_small = font(SERIF_BOLD, int(w * 0.022))
    right_big = font(SERIF_BOLD, int(w * 0.030))
    d.multiline_text(
        (right_x, int(h * 0.09)),
        fit_lines(d, "Your child does not need more random reps.", right_small, right_width),
        font=right_small,
        fill=GOLD_SOFT,
        spacing=int(w * 0.008),
    )
    d.multiline_text(
        (right_x, int(h * 0.18)),
        fit_lines(d, "They need the next right move.", right_big, right_width),
        font=right_big,
        fill=PAPER,
        spacing=int(w * 0.01),
    )
    bullets = [
        "Gap map from diagnostic + practice",
        "Personal route for what to fix next",
        "Homework help that preserves thinking",
        "Tutor sessions connected to evidence",
    ]
    y = int(h * 0.34)
    for b in bullets:
        rounded_rect(d, (right_x, y, right_x + int(w * 0.018), y + int(w * 0.018)), int(w * 0.009), LIME)
        bf = font(SANS_BOLD, int(w * 0.015))
        d.multiline_text(
            (right_x + int(w * 0.035), y - int(w * 0.006)),
            fit_lines(d, b, bf, right_width - int(w * 0.05)),
            font=bf,
            fill=(230, 240, 226),
            spacing=int(w * 0.006),
        )
        y += int(h * 0.062)

    d.text((margin, h - int(h * 0.075)), "joinmindcraft@gmail.com  •  +1 (763) 340-5616", font=font(SANS_BOLD, int(w * 0.017)), fill=GREEN)
    d.text((right_x, h - int(h * 0.075)), "BETA Showcase • The Luminare", font=font(SANS_BOLD, int(w * 0.015)), fill=(220, 225, 214))
    save_print(img, name)


if __name__ == "__main__":
    make_card_front()
    make_card_back()
    make_poster("mindcraft_showcase_poster_18x24", (18, 24))
    make_poster("mindcraft_showcase_poster_11x17", (11, 17))
    print(f"Generated print assets in {OUT}")
