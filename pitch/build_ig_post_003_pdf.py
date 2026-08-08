#!/usr/bin/env python3
"""One-pager PDF: story brief + IG slides + caption for Post 003."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
IG = ROOT / "instagram"
OUT = ROOT / "MindCraft_IG_Post_003_Story_Quiz.pdf"
# Also drop a copy in Downloads when possible
DOWNLOADS = Path.home() / "Downloads" / "MindCraft_IG_Post_003_Story_Quiz.pdf"

# Letter portrait, roomy for images + copy
W, H = 612, 792  # US Letter points
MARGIN = 36

INK = HexColor("#143a2e")
GOLD = HexColor("#d3a900")
STAKES = HexColor("#c1121f")
CREAM = HexColor("#fffdf7")
MUTED = HexColor("#5f7a6d")
PAPER = HexColor("#f7f2e8")
DEEP = HexColor("#080e14")


def fonts() -> tuple[str, str, str]:
    serif = sans = bold = "Times-Roman"
    pairs = [
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", "serif"),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "sans"),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "bold"),
    ]
    names = {"serif": "Times-Roman", "sans": "Helvetica", "bold": "Helvetica-Bold"}
    for path, key in pairs:
        if Path(path).exists():
            name = f"MC3_{Path(path).stem.replace(' ', '_')}"
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                names[key] = name
            except Exception:
                pass
    return names["serif"], names["sans"], names["bold"]


SERIF, SANS, SANS_B = fonts()

CAPTION = """Venice arsenal, 1537.

Every short shot wastes iron, powder, and pride. Captains swear by gut. Tartaglia asks for a curve.

At what angle does a cannon throw a ball the farthest?

A) 30° · skim the water, stay fast
B) 45° · balance height and run
C) 60° · loft it, pride of the sky
D) Whatever feels right. Instinct.

Drop your letter before you swipe.

(The answer is not a vibe. It is a path you can write.)

MindCraft puts ACT math inside stories like this. Tartaglia, the arsenal, the stacked pieces of a curve. Then asks the question while the world is still open.

Story first. Questions second. Map moves.

#MindCraft #ACTMath #MathStories #Polynomials"""

PIN = """Reveal: B · 45°. If air is calm and the path is a parabola.

Don’t guess the angle. Hold the curve as stacked pieces. That is polynomial thinking. Same move on your ACT."""

WHY = (
    "Why this story (not “a gunner asking about cannons”): "
    "Gunners already think they know. The stake is the Republic’s arsenal. "
    "Short shots waste iron. Old masters answer with instinct. "
    "Tartaglia’s click is writing the flight as stacked pieces: polynomial thinking. "
    "Canon lives in MindCraft’s Polynomial Operations chapter."
)


def wrap(c: canvas.Canvas, text: str, font: str, size: float, max_w: float) -> list[str]:
    c.setFont(font, size)
    lines: list[str] = []
    for para in text.split("\n"):
        if not para.strip():
            lines.append("")
            continue
        words = para.split()
        cur = ""
        for w in words:
            trial = (cur + " " + w).strip()
            if c.stringWidth(trial, font, size) <= max_w:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
    return lines


def page_cover(c: canvas.Canvas) -> None:
    c.setFillColor(DEEP)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(SANS_B, 14)
    c.drawString(MARGIN, H - 48, "Mind")
    c.setFillColor(GOLD)
    c.drawString(MARGIN + c.stringWidth("Mind", SANS_B, 14), H - 48, "Craft")

    c.setFillColor(STAKES)
    c.setFont(SANS_B, 11)
    c.drawString(MARGIN, H - 90, "INSTAGRAM POST 003 · READY TO POST")

    c.setFillColor(CREAM)
    c.setFont(SERIF, 28)
    c.drawString(MARGIN, H - 140, "Tartaglia’s arsenal quiz")
    c.setFont(SERIF, 16)
    y = H - 175
    for line in (
        "Fun story-first carousel with a real stake,",
        "comment bait, and a polynomial click.",
    ):
        c.drawString(MARGIN, y, line)
        y -= 22

    c.setFillColor(HexColor("#9aa89f"))
    c.setFont(SANS, 11)
    why_lines = wrap(c, WHY, SANS, 11, W - 2 * MARGIN)
    y = H - 260
    for line in why_lines:
        c.drawString(MARGIN, y, line)
        y -= 15

    # Mini preview of three slides
    slides = [
        IG / "ig_0005_story_hook.png",
        IG / "ig_0006_story_choices.png",
        IG / "ig_0007_story_reveal.png",
    ]
    thumb = 160
    gap = 16
    total = 3 * thumb + 2 * gap
    x0 = (W - total) / 2
    y0 = 120
    labels = ["1 · Hook", "2 · Guess", "3 · Reveal"]
    for i, path in enumerate(slides):
        if not path.exists():
            continue
        x = x0 + i * (thumb + gap)
        c.drawImage(ImageReader(str(path)), x, y0, width=thumb, height=thumb, preserveAspectRatio=True, mask="auto")
        c.setFillColor(GOLD)
        c.setFont(SANS_B, 9)
        c.drawCentredString(x + thumb / 2, y0 - 16, labels[i])

    c.setFillColor(MUTED)
    c.setFont(SANS, 9)
    c.drawCentredString(W / 2, 48, "Slides · caption · pin comment on the next pages")
    c.showPage()


def page_slide(c: canvas.Canvas, path: Path, title: str, note: str, n: int, total: int = 6) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColor(INK)
    c.setFont(SANS_B, 12)
    c.drawString(MARGIN, H - 40, "MindCraft · Post 003")
    c.setFillColor(MUTED)
    c.setFont(SANS, 10)
    c.drawRightString(W - MARGIN, H - 40, f"{n} / {total}")

    c.setFillColor(STAKES)
    c.setFont(SANS_B, 10)
    c.drawString(MARGIN, H - 68, title.upper())
    c.setFillColor(INK)
    c.setFont(SERIF, 11)
    for i, line in enumerate(wrap(c, note, SERIF, 11, W - 2 * MARGIN)):
        c.drawString(MARGIN, H - 90 - i * 14, line)

    # Square image, max that fits
    side = min(W - 2 * MARGIN, 480)
    x = (W - side) / 2
    y = 72
    if path.exists():
        c.drawImage(
            ImageReader(str(path)),
            x,
            y,
            width=side,
            height=side,
            preserveAspectRatio=True,
            mask="auto",
        )
    c.setFillColor(MUTED)
    c.setFont(SANS, 8)
    c.drawCentredString(W / 2, 48, path.name)
    c.showPage()


def page_caption(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColor(INK)
    c.setFont(SANS_B, 12)
    c.drawString(MARGIN, H - 40, "MindCraft · Post 003")
    c.setFillColor(MUTED)
    c.setFont(SANS, 10)
    c.drawRightString(W - MARGIN, H - 40, "5 / 6")

    c.setFillColor(STAKES)
    c.setFont(SANS_B, 11)
    c.drawString(MARGIN, H - 72, "INSTAGRAM CAPTION · COPY / PASTE")

    y = H - 100
    c.setFillColor(INK)
    for line in wrap(c, CAPTION, SERIF, 10.5, W - 2 * MARGIN):
        if line == "":
            y -= 8
            continue
        c.setFont(SERIF, 10.5)
        c.drawString(MARGIN, y, line)
        y -= 14
        if y < 80:
            break

    c.showPage()


def page_pin_and_x(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColor(INK)
    c.setFont(SANS_B, 12)
    c.drawString(MARGIN, H - 40, "MindCraft · Post 003")
    c.setFillColor(MUTED)
    c.setFont(SANS, 10)
    c.drawRightString(W - MARGIN, H - 40, "6 / 6")

    c.setFillColor(STAKES)
    c.setFont(SANS_B, 11)
    c.drawString(MARGIN, H - 72, "PIN THIS AS FIRST COMMENT")

    y = H - 100
    c.setFillColor(INK)
    for line in wrap(c, PIN, SERIF, 12, W - 2 * MARGIN):
        c.setFont(SERIF, 12)
        c.drawString(MARGIN, y, line)
        y -= 16

    y -= 24
    c.setFillColor(STAKES)
    c.setFont(SANS_B, 11)
    c.drawString(MARGIN, y, "X / TWITTER CARD")
    y -= 16
    x_path = IG / "x_0003_story_cannon.png"
    if x_path.exists():
        iw, ih = 520, 292
        c.drawImage(ImageReader(str(x_path)), MARGIN, y - ih - 8, width=iw, height=ih, preserveAspectRatio=True, mask="auto")
        y = y - ih - 28

    c.setFillColor(MUTED)
    c.setFont(SANS, 9)
    c.drawString(MARGIN, 56, "Rebuild slides: python3 pitch/build_ig_post_003.py")
    c.drawString(MARGIN, 42, "Rebuild this PDF: python3 pitch/build_ig_post_003_pdf.py")
    c.showPage()


def main() -> None:
    needed = [
        IG / "ig_0005_story_hook.png",
        IG / "ig_0006_story_choices.png",
        IG / "ig_0007_story_reveal.png",
    ]
    missing = [p for p in needed if not p.exists()]
    if missing:
        raise SystemExit(f"missing slides; run build_ig_post_003.py first: {missing}")

    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    c.setTitle("MindCraft IG Post 003 · Tartaglia Story Quiz")
    c.setAuthor("MindCraft")

    page_cover(c)
    page_slide(
        c,
        needed[0],
        "Slide 1 · Hook",
        "Arsenal stake first. Captains vs Tartaglia. Then the question.",
        2,
    )
    page_slide(
        c,
        needed[1],
        "Slide 2 · Guess",
        "You advise the arsenal. Comment bait. D is the instinct trap.",
        3,
    )
    page_slide(
        c,
        needed[2],
        "Slide 3 · Reveal",
        "45° + write the curve as stacked pieces = polynomial click.",
        4,
    )
    # Renumber: cover=1, slides 2-4, then caption needs to be page 5 — fix page_caption to 5/6 or merge
    # Simpler: caption page after slides, then pin. Update totals to 6.
    page_caption(c)
    page_pin_and_x(c)
    c.save()
    print("wrote", OUT)

    try:
        DOWNLOADS.write_bytes(OUT.read_bytes())
        print("copied", DOWNLOADS)
    except OSError as e:
        print("skip Downloads copy:", e)


if __name__ == "__main__":
    main()
