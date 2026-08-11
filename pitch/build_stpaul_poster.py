#!/usr/bin/env python3
"""St. Paul coffee-shop + Facebook forum poster. Letter 8.5x11 + tabloid 11x17."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor, Color, white, black
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "img"
OUT_LETTER = ROOT / "MindCraft_StPaul_Poster_Letter.pdf"
OUT_TABLOID = ROOT / "MindCraft_StPaul_Poster_Tabloid.pdf"
QR = IMG / "qr_apply.png"

INK = HexColor("#143a2e")
LEAF = HexColor("#247a4d")
LIME = HexColor("#c4f547")
GOLD = HexColor("#d3a900")
CREAM = HexColor("#fffdf7")
PAPER = HexColor("#fff8e9")
MINT = HexColor("#e4f7dc")
MUTED = HexColor("#5f7a6d")
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
            name = f"P_{Path(path).stem.replace(' ', '_')}"
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


def draw_poster(c: canvas.Canvas, W: float, H: float) -> None:
    # cream field
    c.setFillColor(PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # soft mint wash top
    c.setFillColor(MINT)
    c.rect(0, H - 2.2 * inch, W, 2.2 * inch, fill=1, stroke=0)

    # accent bar
    c.setFillColor(INK)
    c.rect(0, H - 0.18 * inch, W, 0.18 * inch, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.rect(0, H - 0.22 * inch, 1.6 * inch, 0.08 * inch, fill=1, stroke=0)

    m = 0.65 * inch

    # brand
    c.setFont(SANS_B, 22)
    c.setFillColor(INK)
    c.drawString(m, H - 0.75 * inch, "Mind")
    tw = c.stringWidth("Mind", SANS_B, 22)
    c.setFillColor(GOLD)
    c.drawString(m + tw, H - 0.75 * inch, "Craft")

    c.setFillColor(LEAF)
    c.setFont(SANS_B, 11)
    c.drawString(m, H - 1.05 * inch, "TWIN CITIES  ·  ACT MATH")

    # headline — little words, human
    c.setFillColor(INK)
    c.setFont(SERIF, 42)
    y = H - 2.0 * inch
    for line in ["They don’t hate math.", "They lost the plot."]:
        c.drawString(m, y, line)
        y -= 0.58 * inch

    # value prop — parent clarity from research
    c.setFillColor(INK)
    c.setFont(SANS_B, 16)
    y -= 0.15 * inch
    c.drawString(m, y, "We find the real gap first.")
    y -= 0.28 * inch
    c.setFont(SANS, 15)
    c.setFillColor(MUTED)
    for line in [
        "Then a college tutor starts there,",
        "not on page one of the book.",
    ]:
        c.drawString(m, y, line)
        y -= 0.26 * inch

    # three beats
    y -= 0.25 * inch
    beats = [
        ("1", "Map the gap", "A short scan before tutoring starts."),
        ("2", "See the path", "Parents finally know what’s next."),
        ("3", "Meet a tutor", "Local college help, already briefed."),
    ]
    card_h = 1.05 * inch
    gap = 0.14 * inch
    for n, title, body in beats:
        c.setFillColor(CREAM)
        c.roundRect(m, y - card_h + 0.2 * inch, W - 2 * m, card_h, 14, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.setLineWidth(1)
        c.roundRect(m, y - card_h + 0.2 * inch, W - 2 * m, card_h, 14, fill=0, stroke=1)
        c.setFillColor(LIME)
        c.circle(m + 0.35 * inch, y - 0.28 * inch, 0.18 * inch, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(SANS_B, 12)
        c.drawCentredString(m + 0.35 * inch, y - 0.34 * inch, n)
        c.setFont(SANS_B, 16)
        c.drawString(m + 0.7 * inch, y - 0.22 * inch, title)
        c.setFont(SANS, 13)
        c.setFillColor(MUTED)
        c.drawString(m + 0.7 * inch, y - 0.48 * inch, body)
        y -= card_h + gap

    # bottom CTA band
    band_h = 1.85 * inch
    c.setFillColor(INK)
    c.roundRect(m, 0.55 * inch, W - 2 * m, band_h, 18, fill=1, stroke=0)

    c.setFillColor(LIME)
    c.setFont(SANS_B, 11)
    c.drawString(m + 0.35 * inch, 0.55 * inch + band_h - 0.4 * inch, "ST. PAUL FAMILIES")

    c.setFillColor(CREAM)
    c.setFont(SANS_B, 18)
    c.drawString(m + 0.35 * inch, 0.55 * inch + band_h - 0.75 * inch, "Apply free. Start with a gap scan.")

    c.setFont(SANS, 12)
    c.setFillColor(HexColor("#b7d0c2"))
    c.drawString(m + 0.35 * inch, 0.55 * inch + band_h - 1.1 * inch, "joinmindcraft.com")
    c.drawString(m + 0.35 * inch, 0.55 * inch + band_h - 1.35 * inch, "joinmindcraft@gmail.com")

    # QR
    if QR.exists():
        q = 1.15 * inch
        qx = W - m - q - 0.25 * inch
        qy = 0.55 * inch + (band_h - q) / 2
        c.setFillColor(CREAM)
        c.roundRect(qx - 0.08 * inch, qy - 0.08 * inch, q + 0.16 * inch, q + 0.16 * inch, 8, fill=1, stroke=0)
        c.drawImage(str(QR), qx, qy, width=q, height=q, mask="auto")

    # footer whisper
    c.setFillColor(MUTED)
    c.setFont(SANS, 9)
    c.drawCentredString(W / 2, 0.28 * inch, "Built in the Twin Cities. For students who think they are not math people.")


def build(path: Path, w_in: float, h_in: float) -> None:
    W, H = w_in * inch, h_in * inch
    c = canvas.Canvas(str(path), pagesize=(W, H))
    draw_poster(c, W, H)
    c.save()
    print("wrote", path)


def main() -> None:
    build(OUT_LETTER, 8.5, 11)
    build(OUT_TABLOID, 11, 17)


if __name__ == "__main__":
    main()
