#!/usr/bin/env python3
"""Generate 10 neatly aligned Fable-5 futures briefs + index + zip bundle."""
from __future__ import annotations

import zipfile
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT_DIR = Path(__file__).resolve().parent / "futures_fable5_briefs"
BUNDLE = OUT_DIR / "MindCraft_Fable5_Futures_All_10.zip"
INDEX = OUT_DIR / "00_INDEX_All_Routes.pdf"

# Marketing / Fable 5 palette
CREAM = HexColor("#fff8e9")
INK = HexColor("#143a2e")
MUTED = HexColor("#5a6b62")
LEAF = HexColor("#247a4d")
GOLD = HexColor("#b8920a")
NAVY = HexColor("#1d3a8a")
RULE = HexColor("#d5ddd6")
WASH = HexColor("#f3f6f1")
ROW_ALT = HexColor("#faf8f2")


def styles():
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "eyebrow", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=GOLD, leading=10, spaceAfter=2,
        ),
        "title": ParagraphStyle(
            "title", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=20, textColor=INK, leading=24, spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, textColor=MUTED, leading=13, spaceAfter=8,
        ),
        "meta_label": ParagraphStyle(
            "meta_label", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=MUTED, leading=11,
        ),
        "meta_val": ParagraphStyle(
            "meta_val", parent=base["Normal"], fontName="Helvetica",
            fontSize=8.5, textColor=INK, leading=11,
        ),
        "h": ParagraphStyle(
            "h", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=10.5, textColor=NAVY, spaceBefore=12, spaceAfter=5, leading=13,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=INK, leading=13.5, alignment=TA_JUSTIFY, spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=INK, leading=12.8, alignment=TA_LEFT,
        ),
        "quote": ParagraphStyle(
            "quote", parent=base["Normal"], fontName="Helvetica-Oblique",
            fontSize=9.5, textColor=MUTED, leading=13.2, alignment=TA_LEFT,
        ),
        "foot": ParagraphStyle(
            "foot", parent=base["Normal"], fontName="Helvetica",
            fontSize=7.5, textColor=MUTED, alignment=TA_CENTER, spaceBefore=10,
        ),
        "index_title": ParagraphStyle(
            "index_title", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=22, textColor=INK, alignment=TA_CENTER, spaceAfter=6, leading=26,
        ),
        "index_sub": ParagraphStyle(
            "index_sub", parent=base["Normal"], fontName="Helvetica",
            fontSize=10, textColor=MUTED, alignment=TA_CENTER, spaceAfter=16, leading=14,
        ),
        "cell": ParagraphStyle(
            "cell", parent=base["Normal"], fontName="Helvetica",
            fontSize=8.5, textColor=INK, leading=11,
        ),
        "cell_b": ParagraphStyle(
            "cell_b", parent=base["Normal"], fontName="Helvetica-Bold",
            fontSize=8.5, textColor=INK, leading=11,
        ),
    }


def draw_header_band(canvas, doc, route_id: str, name: str):
    canvas.saveState()
    w, h = letter
    canvas.setFillColor(CREAM)
    canvas.rect(0, h - 0.42 * inch, w, 0.42 * inch, fill=1, stroke=0)
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(2)
    canvas.line(0, h - 0.42 * inch, w, h - 0.42 * inch)
    canvas.setFillColor(INK)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(0.7 * inch, h - 0.26 * inch, "MINDCRAFT  ·  FABLE 5 FUTURES BRIEF")
    canvas.setFillColor(LEAF)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(w - 0.7 * inch, h - 0.26 * inch, f"{route_id}  ·  {name.upper()}")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(0.7 * inch, 0.52 * inch, w - 0.7 * inch, 0.52 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.7 * inch, 0.34 * inch, "Internal futures brief — not a public launch claim")
    canvas.drawRightString(w - 0.7 * inch, 0.34 * inch, f"Page {doc.page}")
    canvas.restoreState()


def bullets(items: list[str], s) -> ListFlowable:
    return ListFlowable(
        [ListItem(Paragraph(t, s["bullet"]), leftIndent=8, bulletColor=LEAF) for t in items],
        bulletType="bullet",
        start="•",
        leftIndent=12,
        bulletFontName="Helvetica",
        bulletFontSize=9,
        spaceBefore=0,
        spaceAfter=2,
    )


def section(title: str, body_flowables: list, s) -> KeepTogether:
    return KeepTogether([Paragraph(title, s["h"]), *body_flowables])


BRIEFS = [
    {
        "file": "R01_Imprint_Ring.pdf",
        "id": "R1",
        "name": "Imprint Ring",
        "lane": "Futures / Hardware + Software (coordinate before build)",
        "status": "White paper shipped · Scenes wedge open",
        "wild": "9/10",
        "one_liner": (
            "A human-development OS that turns lived days into excellence: capture the scene "
            "you're about to enter, fire a 60–180s imprint lesson tuned to the gap that will "
            "hurt you there, then seal what happened back into the mastery graph — Whoop for "
            "the body; Imprint for the mind that has to win tonight."
        ),
        "not": [
            "Another course library, streak app, or meditation timer with a ring skin",
            "Silent always-on surveillance sold as “coaching”",
            "Gamified XP for adults who hate being graded",
            "A replacement for tutors — Imprint preloads the gap so humans teach, not detective",
        ],
        "is": [
            "Closed loop: life event → classify → diagnose → imprint → seal → graph update",
            "Situational mastery infrastructure — the missing category between Aura and tutoring",
            "Software-first Scenes (calendar + tags), then haptic ring / pendant / desk puck",
            "Story-physics feedback (world responds; no red X) for adult excellence cultures",
        ],
        "feeling": (
            "User thinks: “It knew poker night was coming — and the number actually mattered "
            "at the table.” Not: “Cute app guessed my hobby.”"
        ),
        "arc": [
            "Sense — calendar, location cluster, optional biometrics, one-tap “mark scene”",
            "Classify — event → domain ontology (EV, tilt, negotiation, spatial…)",
            "Diagnose — MindCraft graph picks highest-severity gap for THIS scene",
            "Imprint — 60–180s story-physics drill; haptic cue from ring optional",
            "Seal — post-event debrief; graph updates; population priors improve next user",
        ],
        "visual": [
            "Marketing cream / ink / gold for consumer; navy desk mode for pro verticals",
            "Ring as quiet object — no RGB gamer glow; nightstand next to Whoop",
            "Imprint card = journal paper, not dark glass; motion cinematic, not bouncey",
        ],
        "deliverables": [
            "Scenes v0 inside app: Poker / Interview / Crunch Week packs",
            "Calendar import + manual scene tags + sealed debrief writer into existing graph",
            "Haptic cue spec for partner OEM ring (Phase 2) — one button, one buzz language",
            "Privacy contract: no silent ambient audio; on-device first; employer never gets raw mic",
            "Demo matrix: 8 recurring life scenes that feel specific, not generic tips",
        ],
        "constraints": [
            "Reuse questionBank.Question + ontology IDs — do not invent a parallel mastery model",
            "Hide-correctness (C4) during imprint; seal can be reflective without shame",
            "Hardware only after sealed-event retention beats generic practice retention",
        ],
        "priority": [
            "1. Scenes software wedge (unblocks proof)",
            "2. Retention experiment vs normal practice",
            "3. OEM ring pilot",
            "4. Own hardware + desk puck for pro desks",
        ],
        "frame": (
            "Imprint is the Ferrari body on MindCraft’s tractor engine — same graph, same "
            "story-physics, now attached to the hour before the moment that matters."
        ),
    },
    {
        "file": "R02_Trading_Floor_Imprint.pdf",
        "id": "R2",
        "name": "Trading Floor Imprint",
        "lane": "Futures / B2B Pro Desks",
        "status": "Open — vertical on R1 stack",
        "wild": "8/10",
        "one_liner": (
            "Pre-open and post-session imprint packs for prop traders and junior PMs — sizing, "
            "regime recognition, and tilt protocols fired from a desk puck + optional ring, "
            "because textbook EV dies under sleep debt and desk contagion."
        ),
        "not": [
            "A signal service, chatroom, or “AI that picks stocks”",
            "Compliance theater that logs every keystroke for HR",
            "Retail gambling app cosplay",
        ],
        "is": [
            "Decision-hygiene infrastructure desks will pay seat licenses for",
            "Probability/stats ontology mapped to trading scenes (open, news, drawdown, revenge)",
            "Sealed after-action: what the model said vs what you did under pressure",
            "Tilt circuit-breakers as first-class product, not an afterthought disclaimer",
        ],
        "feeling": (
            "Trader thinks: “I got the size right because the imprint loaded before the open — "
            "not because I reread a PDF at 1am.”"
        ),
        "arc": [
            "Pre-open cue (puck/ring) → 90s imprint on today’s regime class",
            "In-session optional mark → tags emotional state without breaking flow",
            "Post-close seal → 3 prompts; graph updates personal tilt signatures",
            "Weekly desk digest for lead PM — aggregates, not raw ambient audio",
        ],
        "visual": [
            "Desk mode: charcoal + lime accent sparingly; no candy gamification",
            "Puck = matte aluminum, one LED for cue only",
            "Charts as teaching objects inside imprint — never fake live prices as the product",
        ],
        "deliverables": [
            "Trading scene taxonomy + 12 imprint packs",
            "B2B admin: seats, SSO stub, pack assignment",
            "Desk puck industrial design one-pager + BOM sketch",
            "Risk/ethics addendum (gambling addiction circuit-breakers)",
        ],
        "constraints": [
            "No price prediction claims — mastery of decision process only",
            "Employer sees aggregates the trader opts into sharing",
            "Reuse MindCraft /recommend curriculum mode for pack sequencing",
        ],
        "priority": [
            "1. Packs + Scenes for trading (software)",
            "2. One prop desk design partner",
            "3. Puck pilot",
        ],
        "frame": (
            "Desks already buy alpha. The last unpriced edge is whether the human loads the "
            "right model before the open."
        ),
    },
    {
        "file": "R03_Tutor_Zero_Detective_OS.pdf",
        "id": "R3",
        "name": "Tutor Zero-Detective OS",
        "lane": "Product (`app/**` tutor surfaces) + Engine read-only APIs",
        "status": "Closest ship — brand pain already named",
        "wild": "4/10",
        "one_liner": (
            "An automatic pre-session brief so tutors never spend forty minutes playing detective "
            "while students politely perform understanding — exact bridge gap, last wrong patterns, "
            "recommended first move, then teach."
        ),
        "not": [
            "A tutor marketplace racing to the bottom on hourly rates",
            "A dashboard full of vanity charts tutors ignore",
            "Replacement for human judgment — brief is a map, tutor steers",
        ],
        "is": [
            "The product the Brand Book already promised tutors: peer-level, precise, warm",
            "Zero-detective hour — session starts at the gap, not at small talk archaeology",
            "Parent-safe weekly signal (“where the fog is”) without grade theater",
            "Direct consumer of /knowledge-graph severity + /recommend curriculum chain",
        ],
        "feeling": (
            "Tutor thinks: “I finally walked in knowing where Kai was stuck — and the hour "
            "was teaching, not guessing.”"
        ),
        "arc": [
            "Night before — brief generates from graph + last practice outcomes",
            "Session open — tutor sees bridge gap + 1 suggested opener puzzle",
            "During — optional mark “performed understanding” when student nods too fast",
            "After — 60s seal updates graph; parent gets honest fog note",
        ],
        "visual": [
            "Notebook desk language already shipping on dashboard",
            "Brief card: mono stamps + Caveat titles; lime only on CTA",
            "No purple SaaS chrome — keep MindCraft paper world",
        ],
        "deliverables": [
            "Tutor brief panel (pre-session) wired to graphCache + recommend",
            "“Performed understanding” quick mark",
            "Parent weekly fog digest (email or in-app)",
            "Acceptance: 5 real students where tutor time-to-first-real-gap < 5 minutes",
        ],
        "constraints": [
            "Tutor writes to student docs only via already-allowed / Admin-SDK paths",
            "Do not invent new mastery scores — use engine severity + status",
            "Copy never says “learners” or “leverage outcomes” (BRAND_BOOK)",
        ],
        "priority": [
            "1. Pre-session brief MVP",
            "2. Parent fog digest",
            "3. Tutor marking loop",
        ],
        "frame": (
            "MindCraft sells the click and makes the human hour count. This route IS that sentence, "
            "productized."
        ),
    },
    {
        "file": "R04_ADHD_Life_Scaffold_Ring.pdf",
        "id": "R4",
        "name": "ADHD Life Scaffold Ring",
        "lane": "Futures / Consumer neurodiversity",
        "status": "Open — tone + Imprint loop, not a medical device claim",
        "wild": "7/10",
        "one_liner": (
            "Context-triggered executive scaffolds and micro-mastery for high-agency neurodivergent "
            "students and adults — attached to real life scenes, never factory bells or remediation theater."
        ),
        "not": [
            "A diagnosis tool, clinical ADHD treatment, or FDA-claim wearable",
            "Nagging reminders dressed as “accountability”",
            "Childish gamification that high-agency users bounce off",
        ],
        "is": [
            "Life-attached scaffolds: when the scene starts, the right next move loads",
            "Respectful excellence framing — ambitious users, not broken users",
            "Optional ring haptic as external working memory, not a leash",
            "Pairs with R1 Imprint; softens UX for attention variance",
        ],
        "feeling": (
            "User thinks: “It caught me at the start of the spiral — and handed me one clear move, "
            "not a lecture.”"
        ),
        "arc": [
            "Scene detect / user mark → scaffold card (1 move, 1 imprint, 1 escape hatch)",
            "Optional body double mode — silent haptic every N minutes during deep work",
            "Seal — what worked; never shame for unfinished lists",
            "Parent/partner view only if user grants — honesty without surveillance",
        ],
        "visual": [
            "Calm paper, larger tap targets, reduced motion default ON",
            "No red failure states; world-physics language only",
            "Ring black/matte — tool, not toy",
        ],
        "deliverables": [
            "Scaffold card component + 10 life scenes (homework start, inbox, commute study…)",
            "Reduced-motion + focus-mode settings pack",
            "Legal/copy pass: no medical claims",
            "User research script with 8 ADHD / AuDHD participants",
        ],
        "constraints": [
            "Never claim to treat ADHD",
            "Defaults favor less notification, not more",
            "Reuse Imprint loop; do not fork a separate “ADHD product” codebase",
        ],
        "priority": [
            "1. Scaffold card + focus mode",
            "2. Research round",
            "3. Optional haptic patterns on R1 OEM ring",
        ],
        "frame": (
            "Fixed-hour schooling is violence for these users. Attach mastery to life, or lose them."
        ),
    },
    {
        "file": "R05_Esports_Decision_Engine.pdf",
        "id": "R5",
        "name": "Esports Decision Engine",
        "lane": "Futures / Gaming + Roblox seam",
        "status": "Open — WORLD_VISION Roblox dimension is the bridge",
        "wild": "8/10",
        "one_liner": (
            "VOD-tagged decision imprints for competitive players and coaches — expected value of "
            "peeks, utility, and economy — because mechanics get coached and probabilistic judgment under "
            "fog of war does not."
        ),
        "not": [
            "Aim trainers, recoil scripts, or cheat-adjacent tooling",
            "A generic “gaming makes you smart” content farm",
            "Replacement for human coaches",
        ],
        "is": [
            "Mastery graph of decisions, not K/D cosmetics",
            "Scene pack per title family (tactical FPS, MOBA economy, battle royale RNG honesty)",
            "Coach dashboard: which decision classes are fog for each player",
            "Roblox / custom game API seam updates the same MindCraft graph",
        ],
        "feeling": (
            "Player thinks: “That was the same math as last night’s imprint — and I took the better fight.”"
        ),
        "arc": [
            "Coach or player tags VOD moment → scene class",
            "Imprint drills isomorphic decision with frozen numbers",
            "Next scrim — optional mark when pattern reappears",
            "Weekly decision fog map for the roster",
        ],
        "visual": [
            "Team skin overlays OK — but imprint card stays journal-clear for thinking",
            "Avoid neon gamer sludge; keep MindCraft seriousness",
        ],
        "deliverables": [
            "Decision ontology v0 (EV peek, utility value, economy timing, tilt after throw)",
            "VOD tagger lightweight UI",
            "One title pack end-to-end + coach digest",
            "Roblox sample call: conceptId + outcome → graph",
        ],
        "constraints": [
            "No cheats, overlays that read enemy memory, or ToS-breaking hooks",
            "Math frozen from bank; skin is the game world",
            "Coordinate Roblox seam with Engine lane if new endpoints needed",
        ],
        "priority": [
            "1. Decision ontology + one title pack",
            "2. Coach digest",
            "3. Roblox / custom game webhook sample",
        ],
        "frame": (
            "Orgs already pay analysts. A mastery graph of decisions is a new staff member that never sleeps."
        ),
    },
    {
        "file": "R06_Spice_Apprenticeship_Commerce.pdf",
        "id": "R6",
        "name": "Spice Apprenticeship Commerce",
        "lane": "Futures / DTC + Learning (wildest tangent)",
        "status": "Open — brand object + ratios ontology",
        "wild": "10/10",
        "one_liner": (
            "Sell curated spice kits whose labels are story-lessons; the app unlocks ratio and "
            "chemistry mastery so cooks stop copying steps and start cooking free — tractor company "
            "ships a kitchen brand because why not."
        ),
        "not": [
            "Another recipe SEO blog with affiliate links",
            "“Edutainment” spice rack with no real mastery loop",
            "Cultural appropriation kits without origin stories and fair sourcing",
        ],
        "is": [
            "Physical goods + First Spark interest matching (cooking) + ratios/measurement concepts",
            "Each tin = a chapter: origin story, ratio puzzle, sealed cook debrief",
            "Diaspora-respectful sourcing narrative; Katha voice on the label",
            "Gateway drug into MindCraft for adults who swear they’re “not math people”",
        ],
        "feeling": (
            "Cook thinks: “I adjusted the masala by ratio — and dinner proved the algebra.”"
        ),
        "arc": [
            "Unbox → QR → story of the spice route (not a worksheet)",
            "Ratio imprint before cook (salt %, dilution, scaling a feast)",
            "Cook → seal: what you changed and why",
            "Next kit unlocks when graph shows ratio fluency rising",
        ],
        "visual": [
            "Packaging: paper, ink, gold foil sparingly — kitchen-counter beautiful",
            "App skin: warm paper, steam-not-neon",
            "No cartoon vegetables",
        ],
        "deliverables": [
            "3 SKU kit concepts (origin, ratios taught, price)",
            "Label copy pack (BRAND_BOOK Katha rules — no UI words on story side)",
            "App flow: scan → imprint → seal",
            "Sourcing ethics one-pager",
        ],
        "constraints": [
            "Food safety / labeling compliance per ship region",
            "Math frozen; recipes can vary as the “world”",
            "Do not block core ACT product engineering on DTC logistics",
        ],
        "priority": [
            "1. One kit concept + app scan flow mock",
            "2. Micro-batch pilot (50 units)",
            "3. Decide if brand is MindCraft Kitchen or separate label",
        ],
        "frame": (
            "Recipes teach obedience. Ratios teach freedom. Sell the tin that teaches freedom."
        ),
    },
    {
        "file": "R07_Resident_Pattern_Graph.pdf",
        "id": "R7",
        "name": "Resident Pattern Graph",
        "lane": "Futures / Med ed (new ontology domain)",
        "status": "Open — port hide-correctness + misconception memory",
        "wild": "7/10",
        "one_liner": (
            "Case imprint before clinic for med students and residents — a pattern-recognition "
            "graph with hide-correctness debriefs so rare presentations aren’t forgotten between "
            "rotations and shame culture can’t hide gaps."
        ),
        "not": [
            "A diagnostic medical device or treatment recommender for real patients",
            "Public leaderboards that weaponize shame",
            "USMLE content dump without a mastery model",
        ],
        "is": [
            "Training-only pattern graph: presentations → ingredients → common misses",
            "Hide-correctness diagnostics already proven on MindCraft C4 — port the ethic",
            "Hospital cohort seats; program directors buy readiness, not vibes",
            "Sealed after-clinic reflection without attending humiliation",
        ],
        "feeling": (
            "Resident thinks: “I saw that rash pattern in last night’s imprint — and I didn’t freeze.”"
        ),
        "arc": [
            "Night before clinic — 3 case imprints matched to rotation",
            "Optional mid-day mark: “saw this, unsure”",
            "Post-clinic seal — private",
            "Program view: cohort fog by presentation class (no individual shame feed)",
        ],
        "visual": [
            "Clinical calm: paper white, navy structure, no playful lime overload",
            "Cases read as vignettes, not multiple-choice carnival",
        ],
        "deliverables": [
            "Domain ontology sketch (10 presentation families) — separate from ACT IDs",
            "Hide-correctness case player reuse plan",
            "Pilot with 1 residency program champion",
            "Legal: training simulation disclaimers",
        ],
        "constraints": [
            "Never advise on live patients",
            "New canonical IDs — do not overload ACT concept slugs",
            "Coordinate Engine lane before any ML schema expansion",
        ],
        "priority": [
            "1. Ontology sketch + 20 cases",
            "2. Program pilot design",
            "3. Cohort fog dashboard",
        ],
        "frame": (
            "Licensure + patient stakes = extreme WTP. Shame is the competitor — remove it."
        ),
    },
    {
        "file": "R08_Deal_Desk_Imprint.pdf",
        "id": "R8",
        "name": "Deal Desk Imprint",
        "lane": "Futures / Founder & sales excellence",
        "status": "Open — affective check-in agent is a seed",
        "wild": "6/10",
        "one_liner": (
            "Pre-call imprint and post-call seal for founders, AEs, and family-office negotiators — "
            "concessions, BATNA math, and emotional tells — because theory collapses under social "
            "pressure and postmortems are currently vibes."
        ),
        "not": [
            "A creepy call recorder that grades your personality for your boss by default",
            "Script robots that make humans sound like SDRs from hell",
            "Generic “confidence” coaching",
        ],
        "is": [
            "Negotiation ontology: BATNA, ZOPA, concession ladders, time pressure, social proof traps",
            "Pre-call 90s imprint; post-call seal with optional transcript user pastes",
            "Affective check-in agent extended: stress softens target_mastery (already in ML)",
            "One saved point on a term sheet pays for a decade of seats",
        ],
        "feeling": (
            "Founder thinks: “I didn’t give away the board seat — the imprint named that trap at 8am.”"
        ),
        "arc": [
            "Calendar: “Series A call” → pack assigned",
            "Imprint — one number (walk-away) + one social pattern",
            "Call happens in the real world",
            "Seal — what moved; graph updates concession habits",
        ],
        "visual": [
            "Executive paper: quiet, expensive whitespace, navy rules",
            "No startup-gradient sludge",
        ],
        "deliverables": [
            "Negotiation ontology v0 + 15 imprint packs",
            "Calendar → pack rules",
            "Optional paste-transcript seal assistant",
            "Family-office vs startup pack variants",
        ],
        "constraints": [
            "Recording only with explicit consent; default is manual seal",
            "No employer forced personality scoring",
            "Keep math/finance numbers frozen when sourced from bank items",
        ],
        "priority": [
            "1. Packs + calendar rules",
            "2. Seal assistant",
            "3. B2B seat SKU",
        ],
        "frame": (
            "Negotiations are exams with money. Treat them like MindCraft treats ACT — map the gap, imprint, seal."
        ),
    },
    {
        "file": "R09_Fog_of_War_Decision_School.pdf",
        "id": "R9",
        "name": "Fog-of-War Decision School",
        "lane": "Futures / Institutional training",
        "status": "Open — training only, not live ops",
        "wild": "8/10",
        "one_liner": (
            "Scenario packs with sealed after-action graphs for first responders, junior officers, "
            "and pilots in training — readiness scores for uncertainty mastery, not public letter grades."
        ),
        "not": [
            "A combat targeting system or live operational tool",
            "Public ranking boards that destroy psychological safety",
            "Hollywood “tacticool” branding",
        ],
        "is": [
            "Institutional sim layer on MindCraft pathfinder + outcomes",
            "Fog scenarios: incomplete info, time pressure, conflicting reports",
            "Readiness credential portable across rotations",
            "After-action seal private by default; unit sees cohort fog",
        ],
        "feeling": (
            "Trainee thinks: “I recognized the incomplete-info pattern — and I called for the right pause.”"
        ),
        "arc": [
            "Briefing scenario imprint",
            "Sim run (partner sim or paper tabletop)",
            "Sealed after-action — decisions tagged to ontology",
            "Readiness map updates; instructor assigns next fog class",
        ],
        "visual": [
            "Institutional serious: deep field optional, high contrast, zero cartoons",
            "Clear classification banners: TRAINING ONLY",
        ],
        "deliverables": [
            "Uncertainty ontology v0 (info incompleteness, time, authority conflict…)",
            "2 tabletop scenarios + imprint/seal flow",
            "Instructor cohort fog view",
            "Procurement one-pager for training orgs",
        ],
        "constraints": [
            "Training simulation only — hard boundary in copy and contracts",
            "New domain IDs; coordinate Engine",
            "Export controls / sensitive content review before any military marketing",
        ],
        "priority": [
            "1. Ontology + tabletop pilot",
            "2. Instructor view",
            "3. One training-org design partner",
        ],
        "frame": (
            "Institutions already buy sims. A portable mastery credential for decisions under fog is new."
        ),
    },
    {
        "file": "R10_Heir_Excellence_Passport.pdf",
        "id": "R10",
        "name": "Heir Excellence Passport",
        "lane": "Futures / Family office + immigrant professionals",
        "status": "Open — graph as durable identity",
        "wild": "9/10",
        "one_liner": (
            "A portable mastery passport across domains for next-gen family-office heirs and "
            "immigrant professionals rebuilding careers — imprint packs for boardrooms and new "
            "countries, because credentials don’t travel and private tutors don’t scale."
        ),
        "not": [
            "A vanity NFT of certificates",
            "Western-savior “fix the immigrant” branding",
            "Replacement for real licensure where law requires it",
        ],
        "is": [
            "Durable MindCraft graph as cross-border excellence identity",
            "Packs: board literacy, personal finance, civic systems, interview/scene imprint",
            "Family office succession without theater — honest fog maps for principals",
            "Immigrant speed path: map what transfers, imprint what doesn’t",
        ],
        "feeling": (
            "User thinks: “My map came with me — and the new country’s boardroom pack loaded overnight.”"
        ),
        "arc": [
            "Intake — what domains matter in the new arena",
            "Gap scan (confidence + probes) seeds graph",
            "Imprint packs weekly tied to real calendar (board dinner, visa interview…)",
            "Passport view — shareable mastery aggregates, user-controlled",
        ],
        "visual": [
            "Passport metaphor done quietly — paper booklet UI, not crypto chrome",
            "Multilingual later; English v0 with respectful localization plan",
        ],
        "deliverables": [
            "Passport share view (user-gated aggregates)",
            "2 pack lines: Family Office Heir + New Country Professional",
            "Principal digest for family offices",
            "Trust/safety: who can see what",
        ],
        "constraints": [
            "User owns share keys — no silent family surveillance",
            "Expand ontology carefully (finance/civic) with Engine coordination",
            "Never claim to replace regulated credentials",
        ],
        "priority": [
            "1. Shareable passport view on existing graph",
            "2. One pack line end-to-end",
            "3. Family-office design partner",
        ],
        "frame": (
            "Excellence is currently gossip. Make it a map you can carry."
        ),
    },
]


def meta_table(brief: dict, s) -> Table:
    rows = [
        [Paragraph("LANE", s["meta_label"]), Paragraph(brief["lane"], s["meta_val"])],
        [Paragraph("STATUS", s["meta_label"]), Paragraph(brief["status"], s["meta_val"])],
        [Paragraph("WILDNESS", s["meta_label"]), Paragraph(brief["wild"], s["meta_val"])],
        [Paragraph("COMPANION", s["meta_label"]),
         Paragraph("R1 white paper · futures_fable5_briefs/ · 10-routes canvas", s["meta_val"])],
    ]
    t = Table(rows, colWidths=[1.05 * inch, 5.55 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WASH),
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 0), (0, -1), HexColor("#e8efe6")),
    ]))
    return t


def quote_box(text: str, s) -> Table:
    t = Table([[Paragraph(text, s["quote"])]], colWidths=[6.6 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ROW_ALT),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
    ]))
    return t


def build_brief(brief: dict, s: dict):
    story = []
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph("FABLE 5 COMMISSION", s["eyebrow"]))
    story.append(Paragraph(f"{brief['id']}  ·  {brief['name']}", s["title"]))
    story.append(Paragraph(
        "Short bullets. Dense detail. Same spine as First Spark Fable 5 briefs.",
        s["subtitle"],
    ))
    story.append(meta_table(brief, s))
    story.append(Spacer(1, 0.08 * inch))
    story.append(HRFlowable(width="100%", thickness=0.6, color=RULE, spaceBefore=2, spaceAfter=2))

    story.append(section("What you're building (one sentence)", [Paragraph(brief["one_liner"], s["body"])], s))
    story.append(section("This is NOT", [bullets(brief["not"], s)], s))
    story.append(section("This IS", [bullets(brief["is"], s)], s))
    story.append(section("North star feeling", [quote_box(brief["feeling"], s)], s))
    story.append(section("Emotional / product arc (do not reorder)", [bullets(brief["arc"], s)], s))
    story.append(section("Visual system", [bullets(brief["visual"], s)], s))
    story.append(section("Your deliverables", [bullets(brief["deliverables"], s)], s))
    story.append(section("Architecture constraints (do not fight engineering)", [bullets(brief["constraints"], s)], s))
    story.append(section("Priority order", [bullets(brief["priority"], s)], s))
    story.append(section("How to frame it", [quote_box(brief["frame"], s)], s))

    story.append(Paragraph(
        "Tone: warm, serious, never remedial. Read BRAND_BOOK.md + WORLD_VISION.md before UI copy.",
        s["foot"],
    ))
    return story


def build_index(s: dict):
    story = []
    story.append(Spacer(1, 0.35 * inch))
    story.append(Paragraph("MINDCRAFT", s["eyebrow"]))
    story.append(Paragraph("Fable 5 Futures — All 10 Routes", s["index_title"]))
    story.append(Paragraph(
        "Downloadable brief pack · July 2026 · Internal only<br/>"
        "Each route is a separate PDF in this folder. Also bundled as MindCraft_Fable5_Futures_All_10.zip",
        s["index_sub"],
    ))

    header = [
        Paragraph("ID", s["cell_b"]),
        Paragraph("Route", s["cell_b"]),
        Paragraph("Status", s["cell_b"]),
        Paragraph("Wild", s["cell_b"]),
        Paragraph("File", s["cell_b"]),
    ]
    rows = [header]
    for b in BRIEFS:
        rows.append([
            Paragraph(b["id"], s["cell_b"]),
            Paragraph(b["name"], s["cell"]),
            Paragraph(b["status"], s["cell"]),
            Paragraph(b["wild"], s["cell"]),
            Paragraph(b["file"], s["cell"]),
        ])
    t = Table(rows, colWidths=[0.55 * inch, 1.7 * inch, 2.35 * inch, 0.55 * inch, 1.85 * inch])
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))
    t.setStyle(TableStyle(style_cmds))
    # Fix header text color — Paragraphs use their own color; rebuild header cells white via fill only
    story.append(t)
    story.append(Spacer(1, 0.25 * inch))
    story.append(quote_box(
        "Recommended sequence: R3 (pays bills) → R1 Scenes wedge → pick one Ferrari story "
        "(R2 Trading or R6 Spice) for the gut punch.",
        s,
    ))
    story.append(Paragraph(
        "Companion white paper: ../MINDCRAFT_IMPRINT_RING_WHITEPAPER.pdf",
        s["foot"],
    ))
    return story


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    s = styles()

    # Index
    index_doc = SimpleDocTemplate(
        str(INDEX), pagesize=letter,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.55 * inch, bottomMargin=0.7 * inch,
    )

    def index_footer(canvas, doc):
        draw_header_band(canvas, doc, "PACK", "Index")

    index_doc.build(build_index(s), onFirstPage=index_footer, onLaterPages=index_footer)
    print(f"Wrote {INDEX}")

    pdf_paths = [INDEX]
    for brief in BRIEFS:
        out = OUT_DIR / brief["file"]
        doc = SimpleDocTemplate(
            str(out), pagesize=letter,
            leftMargin=0.7 * inch, rightMargin=0.7 * inch,
            topMargin=0.55 * inch, bottomMargin=0.7 * inch,
        )
        rid, name = brief["id"], brief["name"]

        def _footer(canvas, document, rid=rid, name=name):
            draw_header_band(canvas, document, rid, name)

        doc.build(build_brief(brief, s), onFirstPage=_footer, onLaterPages=_footer)
        pdf_paths.append(out)
        print(f"Wrote {out}")

    with zipfile.ZipFile(BUNDLE, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in pdf_paths:
            zf.write(p, arcname=p.name)
    print(f"Wrote {BUNDLE}")
    print(f"\nDone — {len(BRIEFS)} briefs + index + zip in {OUT_DIR}")


if __name__ == "__main__":
    main()
