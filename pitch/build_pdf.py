#!/usr/bin/env python3
"""MindCraft revised pitch deck PDF — visual-first, post Demo Night feedback."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "img"
OUT = ROOT / "MindCraft_Pitch.pdf"

W, H = 1920, 1080

INK = HexColor("#143a2e")
INK_SOFT = HexColor("#2a5244")
LEAF = HexColor("#247a4d")
LIME = HexColor("#c4f547")
GOLD = HexColor("#d3a900")
CREAM = HexColor("#fffdf7")
PAPER = HexColor("#fff8e9")
MINT = HexColor("#e4f7dc")
DARK = HexColor("#070f0c")
MUTED = HexColor("#5f7a6d")
LINE = HexColor("#d7e3db")


def fonts() -> tuple[str, str, str]:
    serif = sans = bold = None
    for path, key in [
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", "serif"),
        ("/Library/Fonts/Georgia.ttf", "serif"),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "sans"),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "bold"),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "bold"),
    ]:
        if Path(path).exists():
            name = f"MC_{Path(path).stem.replace(' ', '_')}"
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                if key == "serif" and not serif:
                    serif = name
                elif key == "sans" and not sans:
                    sans = name
                elif key == "bold" and not bold:
                    bold = name
            except Exception:
                pass
    return serif or "Times-Bold", sans or "Helvetica", bold or "Helvetica-Bold"


SERIF, SANS, SANS_B = fonts()


def dark_bg(c: canvas.Canvas) -> None:
    c.setFillColor(DARK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(Color(0.14, 0.48, 0.30, alpha=0.22))
    c.circle(W * 0.72, H * 0.55, 420, fill=1, stroke=0)
    c.setFillColor(Color(0.77, 0.96, 0.28, alpha=0.06))
    c.circle(W * 0.18, H * 0.25, 280, fill=1, stroke=0)


def cream_bg(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)


def brand(c: canvas.Canvas, y: float = H - 56, light: bool = False) -> None:
    c.setFont(SANS_B, 18)
    c.setFillColor(CREAM if light else INK)
    c.drawString(64, y, "Mind")
    c.setFillColor(LIME if light else GOLD)
    c.drawString(64 + c.stringWidth("Mind", SANS_B, 18), y, "Craft")


def num(c: canvas.Canvas, n: int, total: int = 9, light: bool = False) -> None:
    c.setFillColor(Color(1, 1, 1, alpha=0.4) if light else MUTED)
    c.setFont(SANS_B, 12)
    c.drawRightString(W - 64, H - 56, f"{n:02d} / {total:02d}")


def kicker(c: canvas.Canvas, text: str, x: float, y: float, light: bool = False) -> None:
    c.setFillColor(LIME if light else MUTED)
    c.setFont(SANS_B, 13)
    c.drawString(x, y, text.upper())


def fit_cover(
    c: canvas.Canvas,
    name: str,
    x: float,
    y: float,
    mw: float,
    mh: float,
    *,
    align: str = "center",
) -> None:
    path = IMG / name
    c.setFillColor(HexColor("#0c1a14"))
    c.roundRect(x, y, mw, mh, 22, fill=1, stroke=0)
    if not path.exists():
        return
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = max(mw / iw, mh / ih)
    dw, dh = iw * scale, ih * scale
    ox = x + (mw - dw) / 2
    # Top-align tall portraits so faces aren't cropped out.
    oy = y if align == "top" else y + (mh - dh) / 2
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, mw, mh, 22)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(img, ox, oy, width=dw, height=dh, mask="auto")
    c.restoreState()
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.roundRect(x, y, mw, mh, 22, fill=0, stroke=1)


def slide_01(c: canvas.Canvas) -> None:
    dark_bg(c)
    brand(c, light=True)
    num(c, 1, light=True)
    kicker(c, "At the end of this pitch", 64, H - 160, light=True)
    c.setFillColor(white)
    c.setFont(SERIF, 64)
    for i, line in enumerate([
        "We are going to ask you",
        "for introductions.",
    ]):
        c.drawString(64, H - 260 - i * 78, line)
    c.setFillColor(HexColor("#b7d0c2"))
    c.setFont(SANS, 22)
    c.drawString(64, H - 460, "ACT parents. Counselors. College tutors.")
    c.drawString(64, H - 494, "Four minutes to make the case.")
    c.setFillColor(Color(0.77, 0.96, 0.28, alpha=0.12))
    c.roundRect(64, 120, 720, 56, 28, fill=1, stroke=0)
    c.setStrokeColor(Color(0.77, 0.96, 0.28, alpha=0.4))
    c.setLineWidth(1)
    c.roundRect(64, 120, 720, 56, 28, fill=0, stroke=1)
    c.setFillColor(LIME)
    c.setFont(SANS_B, 16)
    c.drawString(88, 140, "Smile. You invited them. Own the room.")
    c.setFillColor(HexColor("#8aa898"))
    c.setFont(SANS, 16)
    c.drawString(64, 70, "Akshat Koirala  ·  Blake Kell")


def slide_02(c: canvas.Canvas) -> None:
    cream_bg(c)
    brand(c)
    num(c, 2)
    kicker(c, "The broken hour", 64, H - 140)
    c.setFillColor(INK)
    c.setFont(SERIF, 52)
    lines = [
        "Tutor plays detective.",
        "Session ends.",
        "Next week starts over.",
    ]
    y = H - 280
    for line in lines:
        c.drawCentredString(W / 2, y, line)
        y -= 70
    chips = [("Student stuck", False), ("Parent pays", False), ("Tutor hunts", False), ("No map", True)]
    x = 420
    for label, hot in chips:
        tw = c.stringWidth(label, SANS_B, 16) + 40
        if hot:
            c.setFillColor(INK)
            c.roundRect(x, 180, tw, 48, 24, fill=1, stroke=0)
            c.setFillColor(CREAM)
        else:
            c.setFillColor(HexColor("#eef4ef"))
            c.roundRect(x, 180, tw, 48, 24, fill=1, stroke=0)
            c.setFillColor(INK_SOFT)
        c.setFont(SANS_B, 16)
        c.drawString(x + 20, 196, label)
        x += tw + 14


def slide_03(c: canvas.Canvas) -> None:
    cream_bg(c)
    brand(c)
    num(c, 3)
    kicker(c, "Why not a tutor alone", 64, H - 120)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 190, "Great tutors fail when they fly blind.")

    # left card
    c.setFillColor(HexColor("#f4f1ea"))
    c.roundRect(64, 100, 860, 700, 28, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(SANS_B, 24)
    c.drawString(100, 720, "Traditional tutoring")
    left = [
        "Starts on tonight’s homework",
        "Forty minutes finding the gap",
        "Progress lives in the tutor’s head",
        "Practice is another worksheet",
    ]
    y = 640
    for t in left:
        c.setFillColor(MUTED)
        c.setFont(SANS_B, 28)
        c.drawString(100, y, "–")
        c.setFillColor(INK_SOFT)
        c.setFont(SANS_B, 22)
        c.drawString(140, y, t)
        y -= 70

    # right card
    c.setFillColor(MINT)
    c.roundRect(996, 100, 860, 700, 28, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 24)
    c.drawString(1032, 720, "MindCraft")
    right = [
        "Gap diagnosed before session one",
        "Tutor walks in already briefed",
        "Living map parents can see",
        "Story missions that make the click matter",
    ]
    y = 640
    for t in right:
        c.setFillColor(LEAF)
        c.circle(1050, y + 8, 6, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(SANS_B, 22)
        c.drawString(1080, y, t)
        y -= 70


def slide_04(c: canvas.Canvas) -> None:
    dark_bg(c)
    brand(c, light=True)
    num(c, 4, light=True)
    kicker(c, "What we are", 64, H - 200, light=True)
    c.setFillColor(white)
    c.setFont(SERIF, 48)
    lines = [
        "We map the real math gap.",
        "Then a college tutor starts",
        "there, not page one.",
    ]
    y = H - 320
    for line in lines:
        c.drawString(64, y, line)
        y -= 68
    c.setFillColor(LIME)
    c.roundRect(64, y - 10, 80, 5, 3, fill=1, stroke=0)


def ui_slide(c: canvas.Canvas, n: int, title: str, tag: str, image: str) -> None:
    cream_bg(c)
    brand(c)
    num(c, n)
    kicker(c, f"Product · {n - 4} of 3", 64, H - 120)
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(64, H - 185, title)
    tw = c.stringWidth(tag, SANS_B, 13) + 36
    c.setFillColor(MINT)
    c.roundRect(W - 64 - tw, H - 200, tw, 40, 20, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 13)
    c.drawString(W - 64 - tw + 18, H - 186, tag.upper())
    fit_cover(c, image, 64, 56, W - 128, H - 280)


def slide_07(c: canvas.Canvas) -> None:
    cream_bg(c)
    brand(c)
    num(c, 7)
    kicker(c, "Product · 3 of 3", 64, H - 120)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 185, "Story missions + college tutors")
    tag = "STAKES, THEN A HUMAN"
    tw = c.stringWidth(tag, SANS_B, 13) + 36
    c.setFillColor(MINT)
    c.roundRect(W - 64 - tw, H - 200, tw, 40, 20, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 13)
    c.drawString(W - 64 - tw + 18, H - 186, tag)
    fit_cover(c, "valley.jpg", 64, 56, 1080, H - 280)
    fit_cover(c, "find_a_tutor_desktop.png", 1170, 56, 686, H - 280)


def slide_08(c: canvas.Canvas) -> None:
    cream_bg(c)
    brand(c)
    num(c, 8)
    kicker(c, "Why us", 64, H - 120)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 185, "Big picture. Allen wrench.")

    def person(x: float, photo: str, role: str, title: str, blurb: str, *, align: str = "top") -> None:
        c.setFillColor(PAPER)
        c.roundRect(x, 80, 880, 720, 28, fill=1, stroke=0)
        fit_cover(c, photo, x + 24, 320, 832, 450, align=align)
        c.setFillColor(LEAF)
        c.setFont(SANS_B, 12)
        c.drawString(x + 40, 270, role.upper())
        c.setFillColor(INK)
        c.setFont(SANS_B, 28)
        c.drawString(x + 40, 225, title)
        c.setFillColor(INK_SOFT)
        c.setFont(SANS, 16)
        c.drawString(x + 40, 185, blurb)

    person(64, "akshat-koirala.jpg", "Akshat · Big picture", "Why the student gave up",
           "Eight years watching the broken hour.")
    person(976, "blake-kell.jpg", "Blake · Allen wrench", "Why the engine knows",
           "Builds the map tutors can trust.")


def slide_09(c: canvas.Canvas) -> None:
    dark_bg(c)
    brand(c, light=True)
    num(c, 9, light=True)
    kicker(c, "The ask", 64, H - 140, light=True)
    c.setFillColor(white)
    c.setFont(SERIF, 48)
    c.drawString(64, H - 230, "Who should we talk to?")

    asks = [
        ("01", "Parent with a 10th–12th grader on ACT Math"),
        ("02", "Counselor who hears “not a math person”"),
        ("03", "College tutor tired of detective hours"),
    ]
    y = H - 330
    for n, text in asks:
        c.setFillColor(Color(1, 1, 1, alpha=0.06))
        c.roundRect(64, y - 18, 900, 58, 14, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.setFont(SANS_B, 16)
        c.drawString(88, y, n)
        c.setFillColor(CREAM)
        c.setFont(SANS_B, 18)
        c.drawString(140, y, text)
        y -= 78

    # contact card
    c.setFillColor(CREAM)
    c.roundRect(1060, 160, 796, 620, 28, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 13)
    c.drawString(1100, 700, "SNAP THIS · NO HUNTING")
    c.setFillColor(INK)
    c.setFont(SANS_B, 30)
    c.drawString(1100, 640, "Reach us tonight")
    for i, email in enumerate(["akshat@mindcraft.com", "blake@mindcraft.com"]):
        yy = 520 - i * 100
        c.setFillColor(MINT)
        c.roundRect(1100, yy, 716, 72, 16, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(SANS_B, 26)
        c.drawString(1128, yy + 26, email)
    c.setFillColor(MUTED)
    c.setFont(SANS, 14)
    c.drawString(1100, 220, "mindcraft-93858.web.app  ·  Twin Cities")


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    for fn in [
        slide_01, slide_02, slide_03, slide_04,
        lambda c: ui_slide(c, 5, "Gap scan", "Fog → chart", "gap_scan.png"),
        lambda c: ui_slide(c, 6, "Living notebook", "Today’s work has a reason", "contents.png"),
        slide_07, slide_08, slide_09,
    ]:
        fn(c)
        c.showPage()
    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
