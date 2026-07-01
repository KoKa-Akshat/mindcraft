from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
DPI = 300
W, H = int(8.5 * DPI), int(11 * DPI)

GREEN = (6, 77, 54)
LIME = (84, 185, 72)
BURGUNDY = (75, 0, 29)
GOLD = (214, 154, 28)
PAPER = (255, 250, 240)
CREAM = (248, 237, 220)
INK = (20, 36, 32)
MUTED = (96, 108, 99)
BLACK = (7, 10, 9)

FONT_DIR = Path("/System/Library/Fonts/Supplemental")
SANS = str(FONT_DIR / "Arial.ttf")
SANS_BOLD = str(FONT_DIR / "Arial Bold.ttf")
SANS_BLACK = str(FONT_DIR / "Arial Black.ttf")
SERIF_BOLD = str(FONT_DIR / "Georgia Bold.ttf")


def font(path, size):
    return ImageFont.truetype(path, size)


def fit_lines(draw, value, fnt, max_width):
    words = value.split()
    lines, line = [], ""
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
    return lines


def brand(draw, x, y, scale=1.0):
    f = font(SANS_BLACK, int(42 * scale))
    draw.text((x, y), "Mind", font=f, fill=BLACK)
    mind_w = draw.textbbox((x, y), "Mind", font=f)[2] - x - int(2 * scale)
    draw.text((x + mind_w, y), "Craft", font=f, fill=LIME)


def checkbox(draw, x, y, label, size=26):
    draw.rounded_rectangle((x, y, x + size, y + size), radius=5, outline=GREEN, width=3)
    draw.text((x + size + 12, y - 2), label, font=font(SANS, 25), fill=INK)


def section_title(draw, x, y, text):
    draw.text((x, y), text, font=font(SANS_BOLD, 28), fill=BURGUNDY)


def draw_option_group(draw, x, y, title, options, cols=2, col_w=850):
    section_title(draw, x, y, title)
    y += 46
    start_y = y
    for i, opt in enumerate(options):
        col = i % cols
        row = i // cols
        checkbox(draw, x + col * col_w, start_y + row * 48, opt)
    return start_y + ((len(options) + cols - 1) // cols) * 48 + 26


def make_sheet():
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # Background grid and arcs.
    for gx in range(0, W, 300):
        d.line((gx, 0, gx, H), fill=(6, 77, 54, 34), width=1)
    for gy in range(0, H, 300):
        d.line((0, gy, W, gy), fill=(6, 77, 54, 26), width=1)
    for r in [950, 1350, 1800]:
        d.arc((-460, -480, -460 + r, -480 + r), start=285, end=76, fill=(214, 154, 28), width=3)

    margin = 150
    brand(d, margin, 110, 1.1)
    d.text((margin, 210), "2-minute parent signal check", font=font(SERIF_BOLD, 78), fill=BURGUNDY)
    intro = "Help us understand what families need when maths gets stressful. Check what fits, then drop this at the MindCraft booth."
    for i, line in enumerate(fit_lines(d, intro, font(SANS_BOLD, 31), W - margin * 2)):
        d.text((margin, 330 + i * 40), line, font=font(SANS_BOLD, 31), fill=GREEN)

    y = 455
    y = draw_option_group(d, margin, y, "1. I am a...", [
        "Parent / guardian", "Student", "Educator", "Tutor", "Founder / builder", "Other"
    ], cols=3, col_w=650)

    y = draw_option_group(d, margin, y + 14, "2. What feels hardest right now? Pick up to 2.", [
        "Knowing the real gaps", "Getting practice to stick",
        "Homework stress at home", "ACT / test urgency",
        "Tutoring feels disconnected", "AI use without learning",
        "Finding help I trust"
    ], cols=2, col_w=920)

    y = draw_option_group(d, margin, y + 14, "3. What would make you trust a premium platform? Pick up to 3.", [
        "Clear diagnostic map", "Proof of progress over time",
        "Human tutor support", "Simple parent dashboard",
        "Family testimonials", "School / educator partners",
        "Short trial or live demo", "Strong student privacy"
    ], cols=2, col_w=920)

    y = draw_option_group(d, margin, y + 14, "4. Which MindCraft idea feels most valuable? Pick up to 2.", [
        "See where struggle starts", "Know the next right skill",
        "Homework help that explains", "Tutoring with context",
        "Parent visibility", "Students studying together",
        "AI that builds thinking"
    ], cols=2, col_w=920)

    y = draw_option_group(d, margin, y + 14, "5. If it clearly helped, what price would feel reasonable?", [
        "Free trial first", "Under $100/mo", "$100-$160/mo",
        "$160-$220/mo", "$220+/mo with tutoring", "Pay per session"
    ], cols=3, col_w=650)

    y += 18
    section_title(d, margin, y, "6. What would you need to see before trusting MindCraft?")
    y += 52
    for i in range(3):
        d.line((margin, y + i * 60, W - margin, y + i * 60), fill=(6, 77, 54, 130), width=2)

    y += 210
    section_title(d, margin, y, "Optional follow-up")
    d.text((margin, y + 45), "Name / email / phone:", font=font(SANS_BOLD, 26), fill=GREEN)
    d.line((margin + 270, y + 78, W - margin, y + 78), fill=(6, 77, 54, 130), width=2)

    d.rounded_rectangle((margin, H - 210, W - margin, H - 100), radius=24, fill=GREEN)
    d.text((margin + 34, H - 177), "MindCraft", font=font(SANS_BLACK, 34), fill=PAPER)
    d.text((margin + 250, H - 169), "Know what to do next. Making maths fun again.", font=font(SANS_BOLD, 28), fill=PAPER)
    d.text((W - margin - 34, H - 169), "joinmindcraft@gmail.com", font=font(SANS_BOLD, 24), fill=(228, 191, 106), anchor="ra")

    png = OUT / "mindcraft_parent_signal_check_printable.png"
    pdf = OUT / "mindcraft_parent_signal_check_printable.pdf"
    img.save(png, dpi=(DPI, DPI), quality=95)
    img.save(pdf, "PDF", resolution=DPI)
    print(f"Wrote {png}")
    print(f"Wrote {pdf}")


if __name__ == "__main__":
    make_sheet()
