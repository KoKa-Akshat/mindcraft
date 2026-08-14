#!/usr/bin/env python3
"""Generate a combined Brand Book + Business Model PDF for co-founder sharing.

Reuses the styling/markdown-parsing from generate_brand_book.py so this packet
matches the canon Brand Book's visual system. Source: root BRAND_BOOK.md +
BUSINESS_MODEL.md. Output: root MindCraft_Brand_Business_Update.pdf.
"""

from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_brand_book import LIME, build_styles, parse_md  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BRAND_MD = ROOT / "BRAND_BOOK.md"
BIZ_MD = ROOT / "BUSINESS_MODEL.md"
OUT = ROOT / "MindCraft_Brand_Business_Update.pdf"


def divider_page(styles: dict, kicker: str, title: str, sub: str) -> list:
    return [
        Spacer(1, 2.2 * inch),
        Paragraph(kicker, styles["cover_kicker"]),
        Paragraph(title, styles["cover_title"]),
        Spacer(1, 0.15 * inch),
        HRFlowable(width="30%", thickness=2, color=LIME, spaceBefore=4, spaceAfter=14),
        Paragraph(sub, styles["cover_sub"]),
        PageBreak(),
    ]


def add_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColorRGB(0.29, 0.36, 0.33)
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(
        letter[0] / 2,
        0.55 * inch,
        f"MindCraft — Brand & Business Update  ·  2026-08-11  ·  page {doc.page}",
    )
    canvas.restoreState()


def main() -> int:
    if not BRAND_MD.exists() or not BIZ_MD.exists():
        print("Missing BRAND_BOOK.md or BUSINESS_MODEL.md", file=sys.stderr)
        return 1

    styles = build_styles()
    brand_md = BRAND_MD.read_text(encoding="utf-8")
    biz_md = BIZ_MD.read_text(encoding="utf-8")

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.8 * inch,
        title="MindCraft — Brand & Business Update",
        author="MindCraft",
    )

    cover = [
        Spacer(1, 1.4 * inch),
        Paragraph("MINDCRAFT", styles["cover_kicker"]),
        Paragraph("Brand &amp; Business Update", styles["cover_title"]),
        Spacer(1, 0.15 * inch),
        Paragraph("2026-08-11 · For co-founders", styles["cover_sub"]),
        Spacer(1, 0.35 * inch),
        HRFlowable(width="36%", thickness=2, color=LIME, spaceBefore=4, spaceAfter=14),
        Paragraph(
            "Never work alone. Office hours from your room.<br/>"
            "The operating system for student work — with Solver, the math "
            "engine and Katha's story world, as its deepest-built vertical.",
            styles["cover_sub"],
        ),
        Spacer(1, 0.45 * inch),
        Paragraph(
            "Part One: Brand Book v2.0 — positioning, voice, Maya, Jordan, vocabulary<br/>"
            "Part Two: Business Model v1.0 — segments, revenue, unit economics, GTM, risks",
            styles["meta"],
        ),
        Spacer(1, 0.3 * inch),
        Paragraph(
            "Working draft — every unvalidated number in Part Two is tagged [ASSUMPTION].",
            styles["meta"],
        ),
        Spacer(1, 1.1 * inch),
        Paragraph("joinmindcraft.com  ·  confidential, internal use", styles["meta"]),
        PageBreak(),
    ]

    part_one = divider_page(
        styles,
        "PART ONE",
        "Brand Book",
        "Version 2.0 · governs every design, copy, product, and marketing decision at MindCraft",
    )
    brand_body = parse_md(brand_md, styles)

    part_two = divider_page(
        styles,
        "PART TWO",
        "Business Model",
        "Version 1.0 · companion to the Brand Book · every unvalidated figure tagged [ASSUMPTION]",
    )
    biz_body = parse_md(biz_md, styles)

    story = cover + part_one + brand_body + [PageBreak()] + part_two + biz_body
    doc.build(story, onFirstPage=add_page, onLaterPages=add_page)
    word_count = len(brand_md.split()) + len(biz_md.split())
    print(f"Wrote {OUT} ({word_count:,} words combined)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
