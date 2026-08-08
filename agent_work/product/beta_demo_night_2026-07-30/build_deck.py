#!/usr/bin/env python3
"""MindCraft BETA Demo Night deck. 16:9 PDF. Short copy. No em dashes."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white, black
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "MindCraft_BETA_Demo_Night.pdf"

W, H = 1920, 1080

INK = HexColor("#143a2e")
INK_SOFT = HexColor("#2a5244")
MUTED = HexColor("#5f7a6d")
LIME = HexColor("#c4f547")
CREAM = HexColor("#fffdf7")
DARK = HexColor("#0c1a14")
CARD = HexColor("#f3f7f1")
LINE = HexColor("#d7e3db")


def fonts() -> tuple[str, str, str]:
    serif = sans = bold = None
    for path, key in [
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", "serif"),
        ("/Library/Fonts/Georgia.ttf", "serif"),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "sans"),
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


def draw_cover_bg(c: canvas.Canvas, img_name: str = "mindcraft-luxury-map-20260706.jpg") -> None:
    path = ASSETS / img_name
    c.setFillColor(DARK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    if path.exists():
        img = ImageReader(str(path))
        iw, ih = img.getSize()
        scale = max(W / iw, H / ih)
        dw, dh = iw * scale, ih * scale
        c.drawImage(img, (W - dw) / 2, (H - dh) / 2, width=dw, height=dh, mask="auto")
    # dark wash for text legibility
    c.setFillColor(Color(0.04, 0.09, 0.07, alpha=0.72))
    c.rect(0, 0, W, H, fill=1, stroke=0)


def cream_bg(c: canvas.Canvas) -> None:
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    # soft top edge accent
    c.setFillColor(HexColor("#eaf4e4"))
    c.rect(0, H - 8, W, 8, fill=1, stroke=0)


def footer(c: canvas.Canvas, n: int, total: int = 9, dark: bool = False, cite: str = "") -> None:
    c.setFillColor(LIME if dark else INK)
    c.setFont(SANS_B, 15)
    c.drawString(64, 36, "MindCraft")
    c.setFillColor(HexColor("#9bb5a8") if dark else MUTED)
    c.setFont(SANS, 13)
    c.drawRightString(W - 64, 36, f"{n} / {total}")
    if cite:
        c.setFont(SANS, 11)
        c.drawString(64, 16, cite)


def eyebrow(c: canvas.Canvas, text: str, x: float, y: float, color: Color = MUTED) -> None:
    c.setFillColor(color)
    c.setFont(SANS_B, 16)
    c.drawString(x, y, text.upper())


def fit_img(c: canvas.Canvas, name: str, x: float, y: float, mw: float, mh: float) -> None:
    path = ASSETS / name
    if not path.exists():
        c.setFillColor(CARD)
        c.roundRect(x, y, mw, mh, 20, fill=1, stroke=0)
        return
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = min(mw / iw, mh / ih)
    dw, dh = iw * scale, ih * scale
    ox = x + (mw - dw) / 2
    oy = y + (mh - dh) / 2
    c.setFillColor(HexColor("#dce8e0"))
    c.roundRect(ox + 10, oy - 10, dw, dh, 18, fill=1, stroke=0)
    c.drawImage(img, ox, oy, width=dw, height=dh, mask="auto")


def slide_01(c: canvas.Canvas) -> None:
    draw_cover_bg(c)
    logo = ASSETS / "mindcraft-logo.png"
    if logo.exists():
        c.drawImage(str(logo), 64, H - 130, width=64, height=64, mask="auto", preserveAspectRatio=True)
    c.setFillColor(LIME)
    c.setFont(SANS_B, 18)
    c.drawString(150, H - 100, "BETA DEMO NIGHT  ·  JULY 30, 2026")

    c.setFillColor(white)
    c.setFont(SERIF, 70)
    c.drawString(64, H - 260, "MindCraft")

    c.setFillColor(LIME)
    c.setFont(SERIF, 36)
    lines = [
        "We help high school students who think",
        "they are bad at math by mapping the real gap.",
        "Then a college tutor starts there, not page one.",
    ]
    y = H - 380
    for line in lines:
        c.setFillColor(white)
        c.setFont(SERIF, 34)
        c.drawString(64, y, line)
        y -= 52

    c.setFillColor(HexColor("#b7d0c2"))
    c.setFont(SANS, 22)
    c.drawString(64, 110, "Akshat Koirala  ·  Blake Kell  ·  Twin Cities ACT Math")
    footer(c, 1, dark=True)


def slide_02(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "The problem", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 48)
    c.drawString(64, H - 160, "The hour keeps failing.")

    cards = [
        ("Student", "\"I am not a math person.\"", "Avoidance is armor."),
        ("Parent", "Pays for tutoring.", "Still the same Sunday fight."),
        ("Tutor", "40 minutes of detective work.", "Finds the gap as time runs out."),
    ]
    x = 64
    for title, a, b in cards:
        c.setFillColor(DARK)
        c.roundRect(x, 250, 560, 420, 28, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.setFont(SANS_B, 16)
        c.drawString(x + 36, 600, title.upper())
        c.setFillColor(white)
        c.setFont(SERIF, 30)
        c.drawString(x + 36, 500, a)
        c.setFillColor(HexColor("#a8c4b4"))
        c.setFont(SANS, 22)
        c.drawString(x + 36, 430, b)
        x += 600

    c.setFillColor(INK_SOFT)
    c.setFont(SANS, 22)
    c.drawString(64, 140, "Next week they start over. Nobody drew the map.")
    footer(
        c,
        2,
        cite="Framing: solve the right problem first (Ackoff). Source: Jamie Ryan, Great Products Don't Matter If No One Buys Them (2026).",
    )


def slide_03(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "The insight", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(64, H - 160, "Answers got cheap. The map did not.")

    # left quote box
    c.setFillColor(DARK)
    c.roundRect(64, 420, 880, 280, 28, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.setFont(SANS_B, 14)
    c.drawString(100, 650, "CB INSIGHTS")
    c.setFillColor(white)
    c.setFont(SERIF, 28)
    c.drawString(100, 580, "Two thirds of product-market fit failures")
    c.drawString(100, 536, "were early-stage companies that never")
    c.drawString(100, 492, "found a market.")

    # right: user vs buyer (DND)
    c.setFillColor(CARD)
    c.roundRect(980, 420, 876, 280, 28, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(SANS_B, 14)
    c.drawString(1020, 650, "USERS ARE NOT ALWAYS BUYERS")
    c.setFont(SERIF, 28)
    c.drawString(1020, 580, "Student uses.")
    c.drawString(1020, 536, "Parent buys.")
    c.setFillColor(MUTED)
    c.setFont(SANS, 20)
    c.drawString(1020, 480, "We design for the student.")
    c.drawString(1020, 448, "We sell clarity to the parent.")

    # bottom three scarcities
    items = [
        ("Diagnosis", "Which misconception is blocking them"),
        ("Human start", "A tutor who begins on that spot"),
        ("Wedge", "Twin Cities ACT Math families first"),
    ]
    x = 64
    for title, body in items:
        c.setFillColor(white)
        c.setStrokeColor(LINE)
        c.setLineWidth(2)
        c.roundRect(x, 140, 560, 220, 24, fill=1, stroke=1)
        c.setFillColor(INK)
        c.setFont(SERIF, 28)
        c.drawString(x + 32, 290, title)
        c.setFillColor(MUTED)
        c.setFont(SANS, 18)
        c.drawString(x + 32, 240, body)
        x += 600

    footer(
        c,
        3,
        cite="CB Insights, Why Startups Fail (2023+ shutdowns). User/buyer: Ryan (2026). Design loop: IxDF, 5 Stages of Design Thinking.",
    )


def slide_04(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "How it works  ·  the critical few", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 46)
    c.drawString(64, H - 160, "Map first. Tutor second.")

    steps = [
        ("1", "Gap scan", "Confidence across ACT concepts.\nNo shame grade. Chart the fog."),
        ("2", "Living map", "Weak spot lights up.\nPractice has a reason."),
        ("3", "College tutor", "Starts on the gap.\nNever page one again."),
    ]
    x = 64
    for num, title, body in steps:
        c.setFillColor(DARK)
        c.roundRect(x, 220, 560, 500, 32, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.setFont(SERIF, 72)
        c.drawString(x + 40, 600, num)
        c.setFillColor(white)
        c.setFont(SERIF, 36)
        c.drawString(x + 40, 500, title)
        c.setFillColor(HexColor("#b7d0c2"))
        c.setFont(SANS, 22)
        by = 420
        for line in body.split("\n"):
            c.drawString(x + 40, by, line)
            by -= 36
        x += 600

    c.setFillColor(INK_SOFT)
    c.setFont(SANS, 20)
    c.drawString(64, 120, "MVP on purpose. Not every feature. The loop that must work first. (Pareto / Ryan 2026)")
    footer(c, 4, cite="IxDF design thinking: Empathize, Define, Ideate, Prototype, Test.")


def slide_05(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "Product  ·  gap scan", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 155, "Find where math lost them.")
    c.setFillColor(MUTED)
    c.setFont(SANS, 20)
    c.drawString(64, H - 200, "Our assessment instrument. Confidence in. Map out. Before session one.")
    fit_img(c, "gap_scan.png", 64, 90, W - 128, 640)
    footer(c, 5, cite="Buyer KPI angle: measure the gap before you sell hours (Ryan 2026, KPI / assessment framing).")


def slide_06(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "Product  ·  the map", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 155, "Fog lifts as they learn.")
    c.setFillColor(MUTED)
    c.setFont(SANS, 20)
    c.drawString(64, H - 200, "Warm-ups, algebra, geometry. Today's spark points at the weak spot.")
    fit_img(c, "dashboard_home_desktop.png", 64, 90, W - 128, 640)
    footer(c, 6)


def slide_07(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "Product  ·  capacity", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    c.drawString(64, H - 155, "A human tutor, already briefed.")

    fit_img(c, "find_a_tutor_desktop.png", 64, 160, 1080, 700)

    stats = [
        ("42", "concepts on one spine"),
        ("~1,500", "real exam questions"),
        ("~1,700", "named misconceptions"),
        ("1:1", "college tutor, not a bot"),
    ]
    y = 780
    for big, small in stats:
        c.setFillColor(DARK)
        c.roundRect(1200, y - 50, 640, 130, 22, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.setFont(SERIF, 34)
        c.drawString(1236, y + 20, big)
        c.setFillColor(white)
        c.setFont(SANS, 20)
        c.drawString(1236, y - 24, small)
        y -= 155

    c.setFillColor(MUTED)
    c.setFont(SANS, 14)
    c.drawString(64, 110, "Macalester · St. Olaf · St. Thomas · UNC")
    footer(c, 7, cite="Differentiation vs Khan / ChatGPT / hour marketplaces: map before the hour.")


def slide_08(c: canvas.Canvas) -> None:
    cream_bg(c)
    eyebrow(c, "Why us", 64, H - 80)
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(64, H - 160, "Built by people who lived the gap.")

    fit_img(c, "polish_about_founders.png", 64, 280, W - 128, 520)

    c.setFillColor(INK)
    c.setFont(SANS_B, 20)
    c.drawString(64, 180, "Wedge: Twin Cities ACT Math. Product live. Families can apply today.")
    c.setFillColor(MUTED)
    c.setFont(SANS, 16)
    c.drawString(
        64,
        140,
        "Akshat · Macalester, math learning   ·   Blake · product and data   ·   Abhigya · applied math research",
    )
    footer(c, 8, cite="Narrow market on purpose. CB Insights: most PMF failures never found a market.")


def slide_09(c: canvas.Canvas) -> None:
    draw_cover_bg(c, "sword-of-wisdom-valley.jpg")
    c.setFillColor(LIME)
    c.setFont(SANS_B, 18)
    c.drawString(64, H - 100, "THE ASK")

    c.setFillColor(white)
    c.setFont(SERIF, 48)
    c.drawString(64, H - 200, "Know someone we should talk to?")

    asks = [
        "A parent with a 10th to 12th grader staring at ACT Math",
        "A counselor who hears \"I am not a math person\" every week",
        "A college tutor who wants hours that are not detective work",
    ]
    y = H - 320
    for a in asks:
        c.setFillColor(LIME)
        c.circle(90, y + 8, 9, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(SANS, 26)
        c.drawString(120, y, a)
        y -= 70

    c.setFillColor(Color(0.07, 0.14, 0.11, alpha=0.88))
    c.roundRect(64, 120, W - 128, 170, 28, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.setFont(SERIF, 34)
    c.drawString(100, 220, "joinmindcraft@gmail.com")
    c.setFillColor(white)
    c.setFont(SANS, 22)
    c.drawString(100, 165, "MindCraft  ·  map the gap  ·  college tutor starts there")
    footer(
        c,
        9,
        dark=True,
        cite="Interest C on the feedback form: buy, invest, or partner. Ask for intros first (Ryan / Pitbull).",
    )


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    for build in [
        slide_01,
        slide_02,
        slide_03,
        slide_04,
        slide_05,
        slide_06,
        slide_07,
        slide_08,
        slide_09,
    ]:
        build(c)
        c.showPage()
    c.save()
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
