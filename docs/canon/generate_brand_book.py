#!/usr/bin/env python3
"""Generate MindCraft Brand Book PDF from root BRAND_BOOK.md."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
MD = ROOT / "BRAND_BOOK.md"
OUT = ROOT / "BRAND_BOOK.pdf"

INK = HexColor("#143a2e")
MUTED = HexColor("#4a5c54")
RULE = HexColor("#c9d4cc")
ACCENT = HexColor("#247a4d")
LIME = HexColor("#c4f547")
CREAM = HexColor("#f7f3ea")
DEEP = HexColor("#080e14")


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline_md(text: str) -> str:
    text = esc(text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    text = re.sub(r"`(.+?)`", r'<font face="Courier" size="8">\1</font>', text)
    return text


def build_styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=10,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Times-Bold",
            fontSize=30,
            leading=36,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Times-Bold",
            fontSize=16,
            leading=20,
            textColor=INK,
            spaceBefore=18,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Times-Bold",
            fontSize=13,
            leading=17,
            textColor=ACCENT,
            spaceBefore=14,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=INK,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=14,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=13,
            textColor=INK,
            leftIndent=14,
            spaceAfter=3,
        ),
        "quote": ParagraphStyle(
            "quote",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=10,
            leading=14,
            textColor=INK,
            leftIndent=12,
            rightIndent=12,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "meta": ParagraphStyle(
            "meta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }


def parse_md(md: str, styles: dict):
    story = []
    lines = md.splitlines()
    i = 0
    table_buf: list[list[str]] = []

    def flush_table():
        nonlocal table_buf
        if not table_buf:
            return
        rows = [r for r in table_buf if not all(re.match(r"^:?-+:?$", c.strip()) for c in r)]
        table_buf = []
        if not rows:
            return
        data = []
        for r in rows:
            data.append([Paragraph(inline_md(c.strip()), styles["bullet"]) for c in r])
        ncols = max(len(r) for r in rows)
        width = 6.5 * inch
        t = Table(data, colWidths=[width / ncols] * ncols)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), CREAM),
                    ("TEXTCOLOR", (0, 0), (-1, -1), INK),
                    ("GRID", (0, 0), (-1, -1), 0.4, RULE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(t)
        story.append(Spacer(1, 8))

    while i < len(lines):
        line = lines[i]
        if line.startswith("|") and "|" in line[1:]:
            cells = [c for c in line.strip().strip("|").split("|")]
            table_buf.append(cells)
            i += 1
            continue
        flush_table()

        if line.startswith("# "):
            # Skip top H1 — cover owns the title
            pass
        elif line.startswith("## "):
            story.append(Paragraph(inline_md(line[3:].strip()), styles["h2"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline_md(line[4:].strip()), styles["h3"]))
        elif line.startswith("---"):
            story.append(HRFlowable(width="100%", thickness=0.6, color=RULE, spaceBefore=6, spaceAfter=8))
        elif line.startswith("> "):
            story.append(Paragraph(inline_md(line[2:].strip()), styles["quote"]))
        elif line.startswith("- ") or line.startswith("* "):
            story.append(Paragraph("• " + inline_md(line[2:].strip()), styles["bullet"]))
        elif re.match(r"^\d+\.\s", line):
            story.append(Paragraph(inline_md(line.strip()), styles["bullet"]))
        elif line.strip() == "":
            story.append(Spacer(1, 4))
        else:
            story.append(Paragraph(inline_md(line.strip()), styles["body"]))
        i += 1

    flush_table()
    return story


def add_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(
        letter[0] / 2,
        0.55 * inch,
        f"MindCraft Brand Book v1.1  ·  The Desk by MindCraft  ·  page {doc.page}",
    )
    canvas.restoreState()


def main() -> int:
    if not MD.exists():
        print(f"Missing {MD}", file=sys.stderr)
        return 1
    styles = build_styles()
    md = MD.read_text(encoding="utf-8")
    word_count = len(md.split())

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.8 * inch,
        title="MindCraft Brand Book",
        author="MindCraft",
    )

    cover = [
        Spacer(1, 1.5 * inch),
        Paragraph("MINDCRAFT", styles["cover_kicker"]),
        Paragraph("Brand Book", styles["cover_title"]),
        Spacer(1, 0.15 * inch),
        Paragraph("Version 1.1 · The Desk by MindCraft", styles["cover_sub"]),
        Spacer(1, 0.35 * inch),
        HRFlowable(width="36%", thickness=2, color=LIME, spaceBefore=4, spaceAfter=14),
        Paragraph(
            "Math is the mechanism. The story is the point.<br/>"
            "The Desk is the place. Everything serves the click.",
            styles["cover_sub"],
        ),
        Spacer(1, 0.45 * inch),
        Paragraph(
            "Voice · Maya · vocabulary · visual stages · anti-positioning · research handshake",
            styles["meta"],
        ),
        Spacer(1, 0.2 * inch),
        Paragraph(f"~{word_count:,} words · confidential · share with partners as needed", styles["meta"]),
        Spacer(1, 1.4 * inch),
        Paragraph("joinmindcraft.com", styles["meta"]),
        PageBreak(),
    ]

    body = parse_md(md, styles)
    doc.build(cover + body, onFirstPage=add_page, onLaterPages=add_page)
    print(f"Wrote {OUT} ({word_count} words)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
