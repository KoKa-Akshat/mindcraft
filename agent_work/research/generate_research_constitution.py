#!/usr/bin/env python3
"""Generate MindCraft Research Constitution v1 PDF from the markdown source."""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)

ROOT = Path(__file__).resolve().parent
MD = ROOT / "MINDCRAFT_RESEARCH_CONSTITUTION_v1.md"
MANIFEST = ROOT / "CHAPTER_MANIFEST.txt"
OUT = ROOT / "MINDCRAFT_RESEARCH_CONSTITUTION_v1.pdf"


def load_constitution_markdown() -> str:
    """Concatenate core OS + chapter files listed in CHAPTER_MANIFEST.txt."""
    if not MANIFEST.exists():
        return MD.read_text(encoding="utf-8")

    parts: list[str] = []
    for raw in MANIFEST.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        path = ROOT / line
        if not path.exists():
            raise FileNotFoundError(f"Manifest entry missing: {path}")
        parts.append(path.read_text(encoding="utf-8").rstrip() + "\n")
    return "\n\n---\n\n".join(parts)

INK = HexColor("#143a2e")
MUTED = HexColor("#4a5c54")
RULE = HexColor("#c9d4cc")
ACCENT = HexColor("#247a4d")
CREAM = HexColor("#f7f3ea")


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline_md(text: str) -> str:
    text = esc(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\*(.+?)\*", r"<i>\1</i>", text)
    text = re.sub(r"`(.+?)`", r'<font face="Courier" size="8">\1</font>', text)
    return text


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName="Times-Bold",
            fontSize=28,
            leading=34,
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
        "code": ParagraphStyle(
            "code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8,
            leading=11,
            textColor=INK,
            backColor=CREAM,
            leftIndent=6,
            rightIndent=6,
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
        "footer": ParagraphStyle(
            "footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }
    return styles


def parse_md(md: str, styles: dict):
    story = []
    lines = md.splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    table_buf: list[list[str]] = []

    def flush_table():
        nonlocal table_buf
        if not table_buf:
            return
        # skip separator row
        rows = [r for r in table_buf if not all(re.match(r"^:?-+:?$", c.strip()) for c in r)]
        if not rows:
            table_buf = []
            return
        data = []
        for r in rows:
            data.append([Paragraph(inline_md(c.strip()), styles["bullet"]) for c in r])
        t = Table(data, colWidths=[1.5 * inch] * min(4, max(len(r) for r in rows)))
        # dynamic widths
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
        table_buf = []

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            if in_code:
                story.append(Paragraph(esc("\n".join(code_buf)).replace("\n", "<br/>"), styles["code"]))
                code_buf = []
                in_code = False
            else:
                flush_table()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if line.startswith("|") and "|" in line[1:]:
            cells = [c for c in line.strip().strip("|").split("|")]
            table_buf.append(cells)
            i += 1
            continue
        else:
            flush_table()

        if line.startswith("# "):
            # skip duplicate top title on cover handling
            story.append(Paragraph(inline_md(line[2:].strip()), styles["h1"]))
        elif line.startswith("## "):
            story.append(Paragraph(inline_md(line[3:].strip()), styles["h2"]))
        elif line.startswith("### "):
            story.append(Paragraph(inline_md(line[4:].strip()), styles["h3"]))
        elif line.startswith("---"):
            story.append(HRFlowable(width="100%", thickness=0.6, color=RULE, spaceBefore=6, spaceAfter=8))
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
        f"MindCraft Research Constitution  ·  page {doc.page}  ·  living lab",
    )
    canvas.restoreState()


def main():
    styles = build_styles()
    md = load_constitution_markdown()
    word_count = len(md.split())

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.8 * inch,
        title="MindCraft Research Constitution",
        author="MindCraft Research Lab",
    )

    cover = [
        Spacer(1, 1.4 * inch),
        Paragraph("MINDCRAFT", styles["cover_sub"]),
        Paragraph("Research Constitution", styles["cover_title"]),
        Spacer(1, 0.3 * inch),
        Paragraph(
            "How do humans become confident mathematical thinkers?",
            styles["cover_sub"],
        ),
        Spacer(1, 0.2 * inch),
        Paragraph(
            "Identity transformation · Evidence · Red Team · Product systems · Experiments",
            styles["cover_sub"],
        ),
        Spacer(1, 0.5 * inch),
        HRFlowable(width="40%", thickness=1, color=ACCENT, spaceBefore=8, spaceAfter=12),
        Paragraph(
            "This is not a pitch deck. This is the company’s research operating system.<br/>"
            "Challenge assumptions. Label uncertainty. Kill weak arguments.<br/>"
            f"Source corpus: ~{word_count:,} words · multi-chapter living lab",
            styles["meta"],
        ),
        Spacer(1, 1.2 * inch),
        Paragraph("MindCraft Research Lab · ongoing evidence program", styles["meta"]),
        PageBreak(),
    ]

    body = parse_md(md, styles)
    doc.build(cover + body, onFirstPage=add_page, onLaterPages=add_page)
    print(f"Wrote {OUT} ({word_count} words from manifest)")


if __name__ == "__main__":
    main()
