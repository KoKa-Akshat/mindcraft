#!/usr/bin/env python3
"""MindCraft Demo Night deck v2 · 11 slides · 16:9 PDF."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parent
IMG = ROOT / "img"
OUT = ROOT / "MindCraft_Demo_Night_Deck.pdf"
W, H = 1920, 1080

INK = HexColor("#143a2e")
LEAF = HexColor("#247a4d")
LIME = HexColor("#c4f547")
CREAM = HexColor("#fffdf7")
MIST = HexColor("#e8f2eb")
CARD = HexColor("#f4faf5")
MUTED = HexColor("#5f7a6d")
DARK = HexColor("#0f241c")
LINE = HexColor("#d5e5db")


def fonts():
    serif = sans = bold = None
    for path, key in [
        ("/System/Library/Fonts/Supplemental/Georgia.ttf", "serif"),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "sans"),
        ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "bold"),
    ]:
        if Path(path).exists():
            name = f"D_{Path(path).stem.replace(' ', '_')}"
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                if key == "serif":
                    serif = name
                elif key == "sans":
                    sans = name
                else:
                    bold = name
            except Exception:
                pass
    return serif or "Times-Bold", sans or "Helvetica", bold or "Helvetica-Bold"


SERIF, SANS, SANS_B = fonts()


def cream(c):
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#eaf4e8"))
    c.rect(0, H - 6, W, 6, fill=1, stroke=0)


def ocean(c, alpha=0.55):
    cream(c)
    bg = IMG / "background.jpg"
    if bg.exists():
        c.drawImage(str(bg), 0, 0, width=W, height=H, preserveAspectRatio=True, anchor="c", mask="auto")
    c.setFillColor(Color(1, 0.992, 0.969, alpha=alpha))
    c.rect(0, 0, W, H, fill=1, stroke=0)


def top(c, n, tag=""):
    c.setFillColor(INK)
    c.setFont(SANS_B, 16)
    c.drawString(56, H - 48, "MindCraft")
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 16)
    # Craft accent approx
    c.setFillColor(MUTED)
    c.setFont(SANS_B, 12)
    label = f"{n:02d} / 11" + (f"  ·  {tag}" if tag else "")
    c.drawRightString(W - 56, H - 48, label)


def foot(c, text):
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(56, 58, W - 56, 58)
    c.setFillColor(MUTED)
    c.setFont(SANS, 9)
    lines = simpleSplit(text, SANS, 9, W - 120)
    y = 42
    for line in lines[:3]:
        c.drawString(56, y, line)
        y -= 11


def ph(c, x, y, w, h, title, sub=""):
    c.setStrokeColor(HexColor("#a8c0b2"))
    c.setDash(5, 4)
    c.setLineWidth(2)
    c.setFillColor(Color(1, 1, 1, alpha=0.55))
    c.roundRect(x, y, w, h, 18, fill=1, stroke=1)
    c.setDash()
    c.setFillColor(MUTED)
    c.setFont(SANS_B, 11)
    c.drawCentredString(x + w / 2, y + h / 2 + (8 if sub else 0), title.upper())
    if sub:
        c.setFont(SANS, 10)
        c.drawCentredString(x + w / 2, y + h / 2 - 12, sub)


def img(c, name, x, y, w, h, contain=False):
    path = IMG / name
    if not path.exists():
        ph(c, x, y, w, h, name)
        return
    ir = ImageReader(str(path))
    iw, ih = ir.getSize()
    if contain:
        scale = min(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        c.setFillColor(white)
        c.roundRect(x, y, w, h, 14, fill=1, stroke=0)
        c.drawImage(ir, x + (w - dw) / 2, y + (h - dh) / 2, width=dw, height=dh, mask="auto")
    else:
        scale = max(w / iw, h / ih)
        dw, dh = iw * scale, ih * scale
        c.saveState()
        p = c.beginPath()
        p.roundRect(x, y, w, h, 16)
        c.clipPath(p, stroke=0)
        c.drawImage(ir, x + (w - dw) / 2, y + (h - dh) / 2, width=dw, height=dh, mask="auto")
        c.restoreState()


def s1(c):
    ocean(c, 0.72)
    top(c, 1)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawString(56, H - 90, "BETA DEMO NIGHT  ·  TWIN IGNITION")
    cards = [
        ("akshat-koirala.jpg", "FOUNDER · MATH LEARNING", "Akshat Koirala",
         "Math and economics at Macalester. Eight years helping students find the first step that finally makes sense. Starts on the gap, not page one."),
        ("blake-kell.jpg", "FOUNDER · PRODUCT · DATA", "Blake Kell",
         "Data science and math. Builds the calm interface, learning signals, and product feel behind MindCraft."),
    ]
    x = 56
    for photo, role, name, bio in cards:
        c.setFillColor(CARD)
        c.roundRect(x, 140, 880, 720, 28, fill=1, stroke=0)
        img(c, photo, x + 36, 280, 280, 350)
        c.setFillColor(LEAF)
        c.setFont(SANS_B, 11)
        c.drawString(x + 350, 760, role)
        c.setFillColor(INK)
        c.setFont(SERIF, 36)
        c.drawString(x + 350, 700, name)
        c.setFillColor(MUTED)
        c.setFont(SANS, 16)
        for i, line in enumerate(simpleSplit(bio, SANS, 16, 460)):
            c.drawString(x + 350, 650 - i * 24, line)
        x += 920
    foot(c, "Bios from mindcraft-marketing-site.web.app team copy.")


def s2(c):
    cream(c)
    top(c, 2)
    for i, year in enumerate(["2016", "2026"]):
        x = 220 + i * 760
        c.setFillColor(INK)
        c.setFont(SERIF, 36)
        c.drawCentredString(x + 280, H - 160, year)
        ph(c, x, 180, 560, 700, "Photo placeholder", "Teaching · drop image here")
    c.setFillColor(LEAF)
    c.setFont(SERIF, 48)
    c.drawCentredString(W / 2, 520, "→")
    foot(c, "Spoken: teaching in 2016, still teaching in 2026. Education shaped the path here.")


def s3(c):
    ocean(c, 0.5)
    top(c, 3)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawString(56, H - 100, "A PATH ACROSS A DECADE")
    # path
    c.setStrokeColor(LEAF)
    c.setLineWidth(8)
    c.line(100, 480, W - 100, 480)
    nodes = [
        (0.04, "2016", "Where it starts", False),
        (0.20, "2018", "Nepal at UWC", True),
        (0.36, "2020", "Library in Eastern Nepal", False),
        (0.52, "2022", "TutorsInc", True),
        (0.70, "2024", "First student. MindCraft begins.", False),
        (0.90, "2026", "STS Preceptor · SciQ · Launch", True),
    ]
    for t, year, cap, down in nodes:
        x = 100 + t * (W - 200)
        c.setFillColor(CREAM)
        c.setStrokeColor(INK)
        c.setLineWidth(3)
        c.circle(x, 480, 10, fill=1, stroke=1)
        c.setFillColor(LEAF)
        c.setFont(SANS_B, 13)
        cy = 420 if down else 560
        c.drawCentredString(x, cy, year)
        c.setFillColor(INK)
        c.setFont(SANS, 11)
        for i, line in enumerate(simpleSplit(cap, SANS, 11, 150)):
            c.drawCentredString(x, cy - 18 - i * 14, line)
        if year == "2022":
            ph(c, x - 70, 300, 140, 90, "IG SS", "TutorsInc")
    foot(c, "Background: marketing landscape (birds / layered hills). Paste TutorsInc Instagram into dashed box.")


def s4(c):
    cream(c)
    top(c, 4)
    # train panel
    c.setFillColor(DARK)
    c.roundRect(56, 140, 900, 820, 28, fill=1, stroke=0)
    # train doodle
    c.setFillColor(LIME)
    c.roundRect(420, 520, 280, 90, 12, fill=1, stroke=0)
    c.setFillColor(HexColor("#e8f7a8"))
    c.roundRect(650, 470, 90, 140, 12, fill=1, stroke=0)
    c.setFillColor(HexColor("#0c1a14"))
    for cx in (460, 540, 620, 700, 760):
        c.circle(cx, 500, 16, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#5a7468"))
    c.setDash(8, 8)
    c.setLineWidth(6)
    c.line(100, 560, 380, 540)
    c.setDash()
    c.setFillColor(LIME)
    c.circle(180, 555, 14, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(SERIF, 34)
    for i, line in enumerate(simpleSplit("It is our education system that is failing our students", SERIF, 34, 820)):
        c.drawString(90, 320 - i * 42, line)

    stats = [
        ("73%", "of U.S. 8th graders scored below NAEP Proficient in math (2024)."),
        ("2.1×", "STEM median wage vs non-STEM ($103,580 vs $49,500, 2024)."),
        ("+8.1%", "Projected STEM job growth 2024–2034 vs 2.7% non-STEM."),
    ]
    y = 820
    for big, lab in stats:
        c.setFillColor(CARD)
        c.roundRect(1000, y - 100, 860, 130, 20, fill=1, stroke=0)
        c.setFillColor(LEAF)
        c.setFont(SERIF, 42)
        c.drawString(1030, y - 40, big)
        c.setFillColor(MUTED)
        c.setFont(SANS, 14)
        for i, line in enumerate(simpleSplit(lab, SANS, 14, 520)):
            c.drawString(1180, y - 20 - i * 18, line)
        y -= 160
    ph(c, 1000, 160, 860, 120, "Customer discovery graph", "Paste Twin Cities interview chart")
    foot(c, "¹ NCES NAEP Math 2024 G8: ~27% at/above Proficient ⇒ ~73% below (nationsreportcard.gov). NAEP Proficient ≠ state grade-level. ² BLS Employment Projections STEM vs non-STEM wages & growth 2024–2034 (bls.gov/emp).")


def s5(c):
    cream(c)
    top(c, 5)
    c.setFillColor(INK)
    c.setFont(SERIF, 48)
    c.drawString(56, H - 160, "What are their feelings towards math")
    c.setFillColor(MUTED)
    c.setFont(SANS, 18)
    c.drawString(56, H - 210, "Parents: this is what the road to their future looks like from the inside.")
    labels = ["Reddit SS 1 · r/ACT", "Reddit SS 2 · anxiety / freeze", "Reddit SS 3 · Sunday-night fight"]
    for i, lab in enumerate(labels):
        ph(c, 56 + i * 610, 160, 580, 620, lab, "Blur faces · paste screenshot")
    foot(c, "Place real screenshots. Tone: dread of the path, not mockery of kids.")


def s6(c):
    cream(c)
    top(c, 6, "Blake")
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawString(56, H - 110, "BLAKE")
    c.setFillColor(INK)
    c.setFont(SERIF, 40)
    lines = simpleSplit("What if what’s failing them is a rigid, outdated one-size fits all model", SERIF, 40, 900)
    y = H - 200
    for line in lines:
        c.drawString(56, y, line)
        y -= 50
    c.setFillColor(MUTED)
    c.setFont(SANS, 18)
    c.drawString(56, y - 10, "School built for the industrial era. Students living in an AI economy.")
    c.setFillColor(DARK)
    c.roundRect(1050, 180, 800, 700, 28, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.rect(1120, 360, 200, 220, fill=1, stroke=0)
    c.setFillColor(HexColor("#1f4a38"))
    c.rect(1380, 320, 160, 260, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.roundRect(1120, 300, 520, 24, 8, fill=1, stroke=0)
    c.setFillColor(CREAM)
    for i in range(5):
        c.roundRect(1140 + i * 95, 340, 50, 40, 6, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(SANS, 14)
    c.drawString(1120, 240, "Same mold. Different minds.")
    foot(c, "Spoken (Blake): industrial-era pacing vs contemporary AI economy.")


def s7(c):
    cream(c)
    top(c, 7)
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(56, H - 140, "That’s where MindCraft comes in")
    bullets = [
        ("vs Khan", "They library content. We map the gap, then a human starts there."),
        ("vs Wyzant / marketplace", "They sell detective time. We brief the tutor before minute one."),
        ("vs ChatGPT / AI tutors", "Answers are cheap. Diagnosis + accountability stay scarce."),
        ("Customizing math education", "ACT Math front door. Living record between student and tutor."),
    ]
    y = 820
    for title, body in bullets:
        c.setFillColor(CARD)
        c.roundRect(56, y - 90, 700, 100, 16, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(SANS_B, 14)
        c.drawString(80, y - 30, title)
        c.setFillColor(MUTED)
        c.setFont(SANS, 12)
        c.drawString(80, y - 55, body)
        y -= 120
    img(c, "dashboard_home_desktop.png", 800, 520, 1060, 420, contain=True)
    img(c, "gap_scan.png", 800, 280, 520, 210, contain=True)
    ph(c, 1340, 280, 520, 210, "Stanford conversation", "Human learning + technology PhD")
    foot(c, "Product: live dashboard + gap scan. Competitive stance: Research Lab ch. 27 & 35.")


def s8(c):
    cream(c)
    top(c, 8, "Akshat")
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(56, H - 150, "Well, does it actually work?")
    c.setFillColor(CARD)
    c.roundRect(56, 420, 860, 380, 22, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont(SANS, 16)
    lit = "Literature on tutoring shows consistent, substantial gains from high-quality 1:1 and small-group instruction (pooled ~0.37 SD across PreK–12 RCTs).¹ Peer models at college, like Macalester SciQ, put students in both seats."
    y = 740
    for line in simpleSplit(lit, SANS, 16, 800):
        c.drawString(80, y, line)
        y -= 24
    c.setFillColor(CARD)
    c.roundRect(960, 160, 900, 760, 28, fill=1, stroke=0)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawString(1000, 860, "SEB SECTION")
    c.setFillColor(INK)
    c.setFont(SERIF, 32)
    c.drawString(1000, 800, "Putting Seb on the spot")
    ph(c, 1000, 280, 820, 460, "Seb review / video still", "France vacation · coming back as tutor")
    foot(c, "¹ Nickow, Oreopoulos & Quan (2020), NBER WP 27476 / J-PAL: tutoring pooled ~0.37 SD. Not Bloom 2-sigma. SciQ: Macalester peer tutoring (spoken).")


def s9(c):
    ocean(c, 0.45)
    top(c, 9, "Blake")
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawString(56, H - 110, "FOR THE INVESTORS")
    c.setFillColor(INK)
    c.setFont(SERIF, 48)
    c.drawString(56, H - 180, "Our financials")
    c.setStrokeColor(HexColor("#a8c0b2"))
    c.setDash(6, 5)
    c.setLineWidth(2)
    c.setFillColor(Color(1, 1, 1, alpha=0.25))
    c.roundRect(56, 140, W - 112, 680, 28, fill=1, stroke=1)
    c.setDash()
    c.setFillColor(Color(0.08, 0.14, 0.11, alpha=0.35))
    c.setFont(SANS_B, 14)
    c.drawCentredString(W / 2, 470, "OVERLAY YOUR DIAGRAMS HERE")
    foot(c, "Spoken only (Blake): banking experience · assumptions tested · freemium → intensive human · rapid acquisition · Q&A.")


def s10(c):
    cream(c)
    top(c, 10, "The Ask")
    c.setFillColor(INK)
    c.setFont(SERIF, 44)
    c.drawString(56, H - 140, "The Ask")
    asks = [
        "High school teachers whose students worry about ACT. We will help set up school ↔ college dialogues on AI in Minnesota. Macalester is actively looking to do this.",
        "Parents whose kids see math as a challenge. We reframe that into strengths.",
        "Tutors who want hours that are not detective work. Minnesota community is hired. Now we need your intros.",
    ]
    y = 820
    for a in asks:
        c.setFillColor(CARD)
        c.roundRect(56, y - 110, 820, 120, 16, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.circle(90, y - 50, 7, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(SANS, 13)
        ty = y - 30
        for line in simpleSplit(a, SANS, 13, 740):
            c.drawString(120, ty, line)
            ty -= 17
        y -= 140
    ph(c, 56, 140, 820, 130, "Macalester AI / school dialogue event", "img_theevent@MAC")
    img(c, "find_a_tutor_desktop.png", 920, 420, 940, 520, contain=True)
    skills = [
        ("EVERY TUTOR", "ACT Math first. Gap-ready brief before session one."),
        ("+ PIANO / MUSIC", "College libraries. Same trusted human."),
        ("+ CODING / ROBOTICS", "Complementary skill parents get excited for."),
    ]
    x = 920
    for title, body in skills:
        c.setFillColor(DARK)
        c.roundRect(x, 160, 300, 220, 16, fill=1, stroke=0)
        c.setFillColor(LIME)
        c.setFont(SANS_B, 11)
        c.drawString(x + 20, 340, title)
        c.setFillColor(CREAM)
        c.setFont(SANS, 12)
        for i, line in enumerate(simpleSplit(body, SANS, 12, 250)):
            c.drawString(x + 20, 300 - i * 18, line)
        x += 310
    foot(c, "Ask is on-slide (say it out loud). Tutor sourcing: Minnesota college network. Map from live Find a Tutor.")


def s11(c):
    ocean(c, 0.7)
    top(c, 11)
    c.setFillColor(LEAF)
    c.setFont(SANS_B, 12)
    c.drawCentredString(W / 2, 720, "IDEAL CUSTOMER")
    c.setFillColor(INK)
    c.setFont(SERIF, 52)
    lines = simpleSplit("If you want your kid competent for today, bring them to us.", SERIF, 52, 1200)
    y = 620
    for line in lines:
        c.drawCentredString(W / 2, y, line)
        y -= 62
    c.setFillColor(MUTED)
    c.setFont(SANS, 18)
    c.drawCentredString(W / 2, 460, "Not a verdict. A map. A college tutor who starts where it broke.")
    c.setFillColor(INK)
    c.roundRect(W / 2 - 260, 300, 520, 70, 35, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont(SANS_B, 18)
    c.drawCentredString(W / 2, 325, "joinmindcraft@gmail.com")
    foot(c, "Akshat closer (spoken): “Yo, this is not Dagestan… tough crowd.” Then stop.")


def main():
    c = canvas.Canvas(str(OUT), pagesize=(W, H))
    for build in [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11]:
        build(c)
        c.showPage()
    c.save()
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
