#!/usr/bin/env python3
"""Generate MindCraft Imprint Ring white paper PDF."""
from pathlib import Path
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether,
)

OUT = Path(__file__).resolve().parent / "MINDCRAFT_IMPRINT_RING_WHITEPAPER.pdf"

INK = HexColor("#143a2e")
MUTED = HexColor("#4a5c54")
RULE = HexColor("#c9d4cc")
ACCENT = HexColor("#1d3a8a")
WASH = HexColor("#f4f7f2")
GOLD = HexColor("#8a6a14")


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_brand": ParagraphStyle(
            "cover_brand", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=11, textColor=GOLD, letterSpacing=2, alignment=TA_CENTER, spaceAfter=18,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=28, textColor=INK, leading=34, alignment=TA_CENTER, spaceAfter=14,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=12, textColor=MUTED, leading=18, alignment=TA_CENTER, spaceAfter=8,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta", parent=base["Normal"], fontName="Helvetica",
            fontSize=9, textColor=MUTED, alignment=TA_CENTER, spaceBefore=28,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=16, textColor=INK, spaceBefore=18, spaceAfter=10, leading=20,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=12, textColor=ACCENT, spaceBefore=14, spaceAfter=6, leading=16,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, textColor=INK, leading=15, alignment=TA_JUSTIFY, spaceAfter=8,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, textColor=INK, leading=14, leftIndent=14, spaceAfter=4,
        ),
        "quote": ParagraphStyle(
            "quote", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=10, textColor=MUTED, leading=15, leftIndent=16, rightIndent=16,
            spaceBefore=8, spaceAfter=10,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontName="Helvetica",
            fontSize=8, textColor=MUTED, alignment=TA_CENTER, spaceBefore=4, spaceAfter=12,
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"], fontName="Helvetica",
            fontSize=8, textColor=MUTED, alignment=TA_CENTER,
        ),
    }
    return s


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.75 * inch, 0.55 * inch, letter[0] - 0.75 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.35 * inch, "MindCraft Confidential — Imprint Ring White Paper")
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.35 * inch, f"{doc.page}")
    canvas.restoreState()


def build():
    s = styles()
    doc = SimpleDocTemplate(
        str(OUT), pagesize=letter,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.7 * inch, bottomMargin=0.8 * inch,
    )
    story = []

    # Cover
    story.append(Spacer(1, 1.6 * inch))
    story.append(Paragraph("MINDCRAFT FUTURES", s["cover_brand"]))
    story.append(Paragraph("The Imprint Ring", s["cover_title"]))
    story.append(Paragraph(
        "A human-development operating system that turns lived days into excellence — "
        "Whoop for the body. Aura for recovery. Imprint for the mind that has to win tonight.",
        s["cover_sub"],
    ))
    story.append(Paragraph(
        "White Paper v0.1 · July 2026<br/>From MindCraft MVP → life-context mastery infrastructure",
        s["cover_meta"],
    ))
    story.append(PageBreak())

    # 1 Thesis
    story.append(Paragraph("1. Thesis", s["h1"]))
    story.append(Paragraph(
        "Learning is no longer scarce. Attention, timing, and <b>situational relevance</b> are. "
        "Every excellence culture — poker nights, trading floors, operating rooms, deal desks — "
        "already generates a private curriculum of moments that punish ignorance. The winners "
        "are not the people who completed the most courses. They are the people who got the "
        "right imprint in the hour before the moment that mattered.",
        s["body"],
    ))
    story.append(Paragraph(
        "MindCraft today proves a spine: a knowledge graph, misconception memory, story-wrapped "
        "practice, and human tutors. The Imprint Ring is the Ferrari built from that tractor engine — "
        "wearable + ambient sensing that captures what your life is asking of you, then fires "
        "micro-lessons calibrated to make you dangerous in those exact situations.",
        s["body"],
    ))
    story.append(Paragraph(
        "Not another feed. Not another course library. A closed loop: <b>life event → gap "
        "hypothesis → imprint → performance → graph update</b>.",
        s["body"],
    ))

    # 2 Problem
    story.append(Paragraph("2. The Problem We Are Actually Solving", s["h1"]))
    story.append(Paragraph("2.1 Excellence is event-shaped", s["h2"]))
    story.append(Paragraph(
        "Modern knowledge work and high-stakes hobbies do not fail because people lack access "
        "to information. They fail because the right model is not loaded when the event arrives. "
        "A trader knows expected value in a textbook and still tilts after three red candles. "
        "A student knows probability and still misplays the Saturday night poker table. "
        "A founder knows negotiation theory and still gives away the point under social pressure.",
        s["body"],
    ))
    story.append(Paragraph("2.2 Wearables stopped at physiology", s["h2"]))
    story.append(Paragraph(
        "Whoop, Aura, Oura, and Forma-class products industrialized recovery: HRV, sleep, strain. "
        "They tell you how ready the body is. They do not tell you what the mind must rehearse "
        "before the next high-leverage scene. Cognitive wearables today are mostly productivity "
        "toys or meditation timers. Nobody owns the category of <b>situational mastery infrastructure</b>.",
        s["body"],
    ))
    story.append(Paragraph("2.3 What our own field notes already scream", s["h2"]))
    story.append(Paragraph(
        "From MindCraft’s brand and product research (tutors, parents, neurodivergent students):",
        s["body"],
    ))
    for b in [
        "Tutors burn forty minutes of every session playing detective — finding the real gap "
        "while students politely perform understanding.",
        "Parents do not want grade theater; they want an honest weekly signal of where the fog is.",
        "ADHD and high-agency students reject fixed-hour schooling; they need scaffolds that "
        "attach to life, not calendars built for factories.",
        "The story that made MindCraft click — math inside a craft the student already loves — "
        "is the same story that scales to poker, markets, kitchens, and war rooms.",
    ]:
        story.append(Paragraph(f"• {b}", s["bullet"]))

    # 3 Product
    story.append(Paragraph("3. Product Vision: The Imprint Stack", s["h1"]))
    story.append(Paragraph("3.1 Hardware form factors", s["h2"]))
    story.append(Paragraph(
        "Start software-first with phone + calendar + optional microphone consent. Scale into "
        "hardware we design ourselves when the loop is proven:",
        s["body"],
    ))
    for b in [
        "<b>Ring</b> — silent haptic cue + context button (“mark this moment”). Always-on presence "
        "without pulling a phone at the table.",
        "<b>Necklace / pendant</b> — higher battery, optional mic array for ambient scene tagging "
        "(with hard privacy gates).",
        "<b>Clip / pin</b> — professional dress code friendly for floors and clinics.",
        "<b>Desk puck</b> — trading desk / study desk ambient node that syncs with the ring.",
    ]:
        story.append(Paragraph(f"• {b}", s["bullet"]))

    story.append(Paragraph("3.2 The Imprint loop", s["h2"]))
    data = [
        [Paragraph("<b>Stage</b>", s["bullet"]), Paragraph("<b>What happens</b>", s["bullet"])],
        [Paragraph("Sense", s["bullet"]),
         Paragraph("Calendar, location clusters, app intents, optional biometrics, user taps "
                   "“poker night / earnings / interview.”", s["bullet"])],
        [Paragraph("Classify", s["bullet"]),
         Paragraph("Event → domain ontology (probability, EV, tilt control, negotiation, "
                   "spatial reasoning…).", s["bullet"])],
        [Paragraph("Diagnose", s["bullet"]),
         Paragraph("MindCraft graph + recent failures → highest-severity gap for <i>this</i> scene.", s["bullet"])],
        [Paragraph("Imprint", s["bullet"]),
         Paragraph("60–180s story-physics drill or flash pattern. World responds; no red X shame.", s["bullet"])],
        [Paragraph("Seal", s["bullet"]),
         Paragraph("Post-event debrief: what happened vs what the model predicted. Graph updates.", s["bullet"])],
    ]
    t = Table(data, colWidths=[1.15 * inch, 5.35 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), WASH),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Paragraph("Table 1. Closed-loop imprint pipeline.", s["caption"]))

    story.append(Paragraph("3.3 Example: Saturday poker night", s["h2"]))
    story.append(Paragraph(
        "Thursday: calendar shows recurring “cards @ Jordan’s.” Saturday 4pm: ring buzzes — "
        "three-minute imprint on pot odds + a tilt-control breath protocol tied to the user’s "
        "last three losing sessions. Sunday morning: one question — “Which hand did you "
        "overplay?” — seals the lesson into the graph. The math was never abstract. It was rent "
        "on the table.",
        s["body"],
    ))
    story.append(Paragraph(
        "This is MindCraft’s original insight — Cardano gambled in Bologna; probability was his "
        "rent money — productized as infrastructure.",
        s["quote"],
    ))

    # 4 Moat
    story.append(Paragraph("4. Why MindCraft Can Win This", s["h1"]))
    for b in [
        "<b>Ontology spine</b> — 42 concepts, 179 ingredients, bridges, misconceptions. Wearables "
        "lack a mastery model; we already ship one.",
        "<b>Story-physics feedback</b> — hide-correctness, world response. Critical for adults who "
        "hate being graded.",
        "<b>Tutor / human layer</b> — Imprint never replaces the guide; it makes the human hour "
        "count by pre-loading the gap.",
        "<b>Event → lesson matching</b> — First Spark already proves interest → scene → question. "
        "Imprint generalizes that matcher from typed interests to lived events.",
        "<b>Data flywheel</b> — every sealed event becomes population priors for the next user "
        "in that scene class (poker, earnings, interviews).",
    ]:
        story.append(Paragraph(f"• {b}", s["bullet"]))

    # 5 Route
    story.append(Paragraph("5. Route From MVP to Imprint", s["h1"]))
    route = [
        [Paragraph("<b>Phase</b>", s["bullet"]),
         Paragraph("<b>Ship</b>", s["bullet"]),
         Paragraph("<b>Proof</b>", s["bullet"])],
        [Paragraph("0 — Now", s["bullet"]),
         Paragraph("ACT notebook, constellation GPS, story chapters, tutor briefs.", s["bullet"]),
         Paragraph("Students click. Tutors stop guessing.", s["bullet"])],
        [Paragraph("1 — Context layer", s["bullet"]),
         Paragraph("Phone-only “Scenes”: calendar import, manual scene tags, imprint packs "
                   "for poker / interviews / SAT crunch weeks.", s["bullet"]),
         Paragraph("Weekly retention + sealed-event count.", s["bullet"])],
        [Paragraph("2 — Soft wearable", s["bullet"]),
         Paragraph("Partner ring OEM or white-label. Haptic cue + one-button mark. "
                   "No custom silicon yet.", s["bullet"]),
         Paragraph("Cue → open rate → drill completion.", s["bullet"])],
        [Paragraph("3 — Domain verticals", s["bullet"]),
         Paragraph("Trading desk packs, founder negotiation packs, esports decision packs. "
                   "B2B seat licenses.", s["bullet"]),
         Paragraph("Willingness-to-pay > tutoring ARPU.", s["bullet"])],
        [Paragraph("4 — Own hardware", s["bullet"]),
         Paragraph("MindCraft-designed ring/pendant. Privacy-first ambient tagging. "
                   "Desk puck for pros.", s["bullet"]),
         Paragraph("Hardware attach rate; brand as excellence object.", s["bullet"])],
        [Paragraph("5 — OS", s["bullet"]),
         Paragraph("Cross-domain human development graph. Employers / family offices "
                   "buy excellence infrastructure.", s["bullet"]),
         Paragraph("Category ownership: situational mastery.", s["bullet"])],
    ]
    t2 = Table(route, colWidths=[1.2 * inch, 3.3 * inch, 2.0 * inch])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), WASH),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t2)
    story.append(Paragraph("Table 2. Phased route — tractor → Ferrari without skipping the engine.", s["caption"]))

    # 6 Business
    story.append(Paragraph("6. Business Model Sketches", s["h1"]))
    for b in [
        "<b>Consumer</b> — $20–40/mo software; $250–450 ring; packs à la carte (Poker Season, "
        "Interview Month).",
        "<b>Pro desks</b> — $200–800/seat/mo for trading / consulting / sales orgs; SSO + admin "
        "scene libraries.",
        "<b>Tutor network</b> — Imprint briefs auto-attach to MindCraft sessions; tutors paid "
        "for sealed outcomes, not hours alone.",
        "<b>Hardware margin</b> — Brand object that sits next to Whoop on the nightstand — "
        "different job, same vanity shelf.",
    ]:
        story.append(Paragraph(f"• {b}", s["bullet"]))

    # 7 Ethics
    story.append(Paragraph("7. Non-Negotiables (or We Become the Villain)", s["h1"]))
    for b in [
        "No silent always-on recording without explicit, revocable scene consent.",
        "On-device first for audio; cloud only for opted-in sealed events.",
        "No employer access to raw ambient audio — only mastery aggregates the user shares.",
        "Imprints never shame. World physics, not red Xs — especially for adults.",
        "Gambling / trading verticals include tilt and addiction circuit-breakers, not just EV drills.",
    ]:
        story.append(Paragraph(f"• {b}", s["bullet"]))

    # 8 Ask
    story.append(Paragraph("8. What This Demands Next", s["h1"]))
    story.append(Paragraph(
        "Build Phase 1 as a thin wedge inside the existing app: <b>Scenes</b> — three packs "
        "(Poker, Interview, Crunch Week), calendar hooks, and sealed debriefs that write into "
        "the same graph that already powers ACT mastery. If sealed-event retention beats "
        "generic practice retention, fund the ring. If not, we learned cheaply and kept the tractor.",
        s["body"],
    ))
    story.append(Paragraph(
        "Tractors plow. Ferraris win races. The same engine block can do both — but only if we "
        "stop pretending the plow is the end of the product.",
        s["quote"],
    ))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph(
        "Contact: joinmindcraft@gmail.com · Internal futures memo — not a public launch claim.",
        s["caption"],
    ))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
