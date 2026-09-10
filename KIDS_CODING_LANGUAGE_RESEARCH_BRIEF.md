# Kids' Coding Language + Design Studio — Research Brief

Hand this whole file to a fresh agent as its first message. It has zero
context on MindCraft otherwise — everything below is real, verified this
session or drawn directly from the repo's own canonical docs, not invented.
Akshat has explicitly said this deserves real time and thorough research, not
a fast pass — treat it that way.

---

## Part 1 — What MindCraft actually is (read this before proposing anything)

**The company is MindCraft. The product is "The Desk by MindCraft"** (website
name; in-app chrome is just "The Desk," no MindCraft logo mark shown to
students). Read these real files in the repo, in this order, before writing
anything:

1. `WORLD_VISION.md` — **the why, read first.** Math as a world; The Desk's
   horizon roadmap.
2. `BRAND_BOOK.md` — voice, vocabulary, visual system, positioning
   architecture, anti-claims. This is the authoritative brand/design contract
   — do not override its decisions.
3. `CLAUDE.md` (repo root) — architecture, lane split, current product state.
4. `docs/canon/PEDAGOGY.md` if it exists — research-to-product rules.

**Mission** (verbatim from `BRAND_BOOK.md`): *"Turn every student working
alone into a student who never has to be."*

**Vision**: The Desk becomes the operating system for everything a student
does outside class — notes, meetings, presentations, projects, content
creation — pulling in a mentor or an AI the moment they get stuck, on any
subject. Inside that OS, **Solver** is the fully-realized vertical for math
specifically: a living world where the student is the character, every
problem is a mission, mastery visibly changes a map. That's the depth-of-
execution bar any new vertical (including a coding-language product) should
be measured against, not a lower one.

**The evidence layer**: every session, practice set, note, and question a
mentor answers is evidence, feeding a living map of what a student actually
knows. Two binding commitments follow: the record belongs to the student
(exportable, inspectable, deletable), and MindCraft computes recommendations
from that record but does not own it.

**Real architecture, current as of 2026-08-19**:
- **`ios-prototype/MindCraftNotes/`** — native SwiftUI iPad/iPhone app. Per
  explicit product direction, **this is THE product** now, not the web app.
- **`app/`** — React web app, kept on deliberately as an ML accuracy lab and
  a Level-3 book-prototyping surface, not the target student experience.
- **Jesse** — a real, shipped, native voice AI. Tap-to-toggle (not
  push-to-talk — that was tried, was real reported friction, reverted).
  Context-scoped conversations already exist in production: the resume agent
  (`ResumeAgentView.swift`/`ResumeAgentClient.swift`/
  `webhook/lib/handlers/resume-agent.ts`) is the concrete, working pattern —
  a `context` field, a system prompt, structured turn-by-turn state, a
  stateless webhook. Any voice-driven coding idea should study this exact
  pattern before inventing a new one.
- **Desk OS surfaces**: Field Desk (Jesse's Kitchen), the Work dashboard
  (`DeskGridDashboardView`), **Create Studio**
  (`CreateStudioView.swift` → loads live web content from
  `agent_work/product/desk_os/studio/` via `WKWebView` — native shell, web
  content, edit the source at `agent_work/product/desk_os/…`, never the
  built copy under `app/public/desk-os/…`, which is gitignored and gets
  silently regenerated on build), Binder, and more — see `CLAUDE.md`'s "iOS
  native app" section for the full current map and known bug classes before
  touching any of them.
- **Two visual "stages," don't mix them**: **The Desk OS** (cream paper
  `#f7f5f0`/`#f8faf7`, soft ink `#143a2e`, lime `#c4f547` accents — a real
  desk a student owns, not a dark theater) versus **Deep Field**
  (near-black `#080e14`, chalk white `#f5f5f5` — marketing, story, Katha,
  cinematic moments only). Full color system in `BRAND_BOOK.md`.
- **Naming**: the three student-facing sections are **Notes, Solver, Map** —
  everywhere, never other phrasings.
- **Lanes**: `Engine` (`ml/**`, `webhook/**`, `data/**`, `worlds/**`) vs.
  `Product` (`app/**`, `ios-prototype/**`). Crossing lanes is fine, in a
  separate labeled commit — but **live product changes need Blake looped in
  before shipping**, not after.
- **A separate, private repo, `mindcraft-content-engine`**, is where a
  quality-gated content-generation pipeline lives (concept-dependency graphs,
  simulation generation with a real structural + visual + pedagogical gate,
  and — as of tonight — a Socratic-conversation content type for Jesse). This
  is genuinely relevant prior art for how *any* new generative content type
  in this ecosystem should be built: generate, gate, only serve what passes.
  Don't skip this discipline for the coding-language idea just because it's
  a new domain.

---

## Part 2 — The actual ask

Akshat wants to explore a coding language / environment built specifically
for kids — where students can code interactive books and learning
simulations themselves, not just consume AI-generated ones. Possibly
voice-driven (talking through code with Jesse rather than only typing it).
Possibly open-sourced on GitHub. The stated long-term intention, verbatim
from earlier tonight: *"our model can go create these books themselves based
on student profile."*

**This is explicitly being greenlit for real research time tonight** — not
a five-minute survey. Do the work thoroughly.

## Part 3 — Real open questions, genuinely open, don't assume the answer

1. **Where does this sit in the platform?** A new vertical alongside Solver
   (its own "world," per `WORLD_VISION.md`'s horizon structure)? A capability
   inside the existing Create Studio? A standalone new Desk OS surface? This
   needs a real, argued answer grounded in the actual positioning
   architecture in `BRAND_BOOK.md` (entry point → core product →
   differentiation → broader platform → long-term vision), not a guess.
2. **Build vs. extend — research this seriously before assuming a new
   language is warranted.** Real, existing, relevant prior art already
   exists and should be studied in depth, not name-dropped:
   - **Scratch** (MIT Media Lab) — block-based, the dominant kids'-coding
     paradigm, open source.
   - **Blockly** (Google) — the open-source engine behind Scratch-likes and
     MIT App Inventor; used as a building block by many other kids'-coding
     tools rather than always built from scratch.
   - **Swift Playgrounds** (Apple) — real, and specifically relevant given
     MindCraft's own iOS-native direction; worth understanding both its
     pedagogy and its actual technical approach (it's Swift, on Apple's own
     platform, which could matter a lot for integration).
   Compare real strengths/weaknesses of each against what MindCraft actually
   needs (interactive-book/simulation authoring, not general-purpose
   programming), and give an honest recommendation — extending an existing
   open ecosystem is very often the right call versus inventing a new
   language, and that possibility should be taken seriously, not dismissed
   for being less exciting than building something new.
3. **Voice-driven coding via Jesse** — genuinely novel territory. Real UX
   research needed on how spoken interaction maps onto code structure
   without becoming unwieldy. Look at what exists (voice coding
   accessibility tools, natural-language-to-code research) as a starting
   point, not a blank page.
4. **Target age/skill range**, and whether "coding mastery" would plug into
   MindCraft's existing mastery/concept-graph engine (the same
   deterministic Beta-Binomial system that already tracks math mastery) or
   needs its own model.
5. **Open-source implications** — what specifically would be open-sourced,
   and how that interacts with MindCraft's business model. The
   `mindcraft-content-engine` repo's own real licensing discipline
   (`licensing.py`, the McCreary advisor-authorization pattern) is a useful
   real precedent for how this project already thinks about
   open/permissive/restricted content — worth reading before proposing a
   licensing model here.

## Part 4 — Design Studio visual direction

Akshat provided a real reference image tonight: a polished patient-dashboard
UI (cardiology data — vitals, a tabbed category nav across the top,
medication timeline with connected date nodes, inline expandable stat
cards). He wants this as layout inspiration for **Design Studio** — the real
Create Studio surface described in Part 1.

**Translate the interaction patterns, not the literal palette or content.**
The dashboard's yellow/dark color scheme is not MindCraft's brand — Design
Studio lives on **Desk OS** (cream/ink-green/lime), per `BRAND_BOOK.md`, and
any new surface should honor that existing system rather than introduce a
new one. What's actually worth studying from the reference: the tabbed
category navigation pattern, the connected-timeline/history visualization,
clean stat-tile composition, and inline contextual detail cards that expand
without a full navigation change. Propose how those patterns would look
rendered in MindCraft's real, established visual language — this is a
translation exercise, not a reskin.

## Part 5 — Standing rules, carried over from tonight, don't relitigate

- Loop Blake in before any live Product-lane change ships — this brief is
  research and design, not a mandate to touch `ios-prototype/**` directly.
- Verify real prior art (Scratch, Blockly, Swift Playgrounds, voice-coding
  research) rather than assuming or inventing details about them.
- No cloud/billing/account actions of any kind without explicit, separate
  confirmation — out of scope for this brief entirely.
- Real, thorough research over fast, shallow output — that was the explicit
  instruction this brief was written under.

Report back with: a real recommendation on where this sits in the platform
(with reasoning, not just an assertion), an honest build-vs-extend analysis
of Scratch/Blockly/Swift Playgrounds against MindCraft's actual needs, and a
concrete Design Studio visual direction grounded in the real brand system —
not a generic mockup.
