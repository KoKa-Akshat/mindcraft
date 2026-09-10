# MindCraft Research Handoff Summary

**What this is:** A standalone, product-focused digest of the "Research Constitution" — a
research lab pipeline (Cursor background agent, multiple simulated researcher/red-team
roles) that ran continuously from **2026-07-25 to 2026-08-17**, then stopped (the
Cursor agent session was paused/lost and did not resume). It produced 160 chapters
answering one question — *"How do humans become confident mathematical thinkers?"* —
under one standing constraint: **every chapter must end in a product implication**
(copy / feature / metric / kill), not academic filler.

**Where this came from:** `agent_work/research/MINDCRAFT_RESEARCH_CONSTITUTION_v1.md`
(311KB core synthesis doc) + `agent_work/research/chapters/*.md` (140+ deep-dive
chapters) + `agent_work/research/RESEARCH_LOG.md` (tick-by-tick log) +
`agent_work/research/CHAPTER_MANIFEST.txt` (full chapter list).

**Go deeper:** If a topic below matters for what you're building, the cited chapter
file (`chapters/NN_slug.md`) has full citations, confidence tables, and experiment
designs the lab spawned. The Constitution's own table of contents (grep `^#` in
`MINDCRAFT_RESEARCH_CONSTITUTION_v1.md`) is the fastest way to find a specific Part.
**Note:** `docs/canon/PEDAGOGY.md` is the intended agent-facing digest of this research
but is stale (last updated 2026-08-11, cites only through ~Part XXI, 47/159 SAFE-*
rules) — this document is a separate, more current handoff, not a replacement for a
future PEDAGOGY.md refresh.

**How to read labels in this doc:** The lab tags every claim FACT / HYPOTHESIS /
FOUNDER BELIEF / SPECULATION. This summary preserves those labels wherever a specific
claim is cited. Where a label is dropped it's because the sentence is describing what
the *lab said*, not asserting the claim as true.

---

## 1. Core Thesis & North Star (already established — reused, not re-derived)

**Core hypothesis (HYPOTHESIS):** Confident math thinkers require three compounding
things: **affective permission**, **competence evidence** (including self-accounted
strategy, not just blocked accuracy), and **identity re-storying** (Eccles
expectancy × value × cost). Fluent AI explanations alone can accelerate the *wrong*
kind of confidence.

**Working North Star (HYPOTHESIS):** *"Challenge-seeking under safety with transfer"*
— a student picks a harder problem for mastery reasons, returns after failure
(`retry_120s`), and transfers on delayed/mixed sets (`transfer_pass`,
`solo_transfer_pass`). Explicitly **not** streaks, DAU, confidence-alone, or blocked
accuracy.

**Scarcity thesis (surviving form, Part XVII):** Explanations are cheapening toward
free. That does not make tutoring free — it relocates the product's value to
**diagnosis + affect + identity + accountability**, with AI as infrastructure, not
the product.

**Scale:** 159 named `SAFE-*` doctrines exist, each one a specific plausible-sounding
bad product/metric idea (usually a vanity "___ Score™" or a shallow copy of a real
practice) that got red-teamed and killed, replaced by a named discipline. Section 5
below samples ~35 of the broadest, most reusable ones.

---

## 2. Competitive Landscape

This is the section with the most concrete, citable findings — real papers, real
effect sizes, real verdicts on named competitors. Primary sources: **Part XX**
(Competitive Landscape, mechanism lens) and **Part XXVII** (`chapters/27_markets_
parents_competition.md`) for market positioning, and **Part XXXV**
(`chapters/35_competitive_session_audits.md`) for session-level teardown — the
chapter whose explicit "commercial job" was *"replace vague 'we're different' with a
session-level wedge parents and students can feel in under five minutes."*

### 2.1 The mechanism table (Part XX)

| Competitor | What they actually sell | Identity claim? | MindCraft's stated risk if it copies them |
|---|---|---|---|
| **Khan Academy** | Free mastery content + reputation | Weak–medium | Explanation commodity; "mastery" without transfer |
| **Duolingo** | Habit / streak motivation | Weak (sometimes language identity) | Extrinsic ceiling; consistency without depth |
| **Brilliant** | Aesthetic problem joy + prestige | Medium | Narrow segment; not MindCraft's core "Maya" (anxious/threatened) persona |
| **Coursera/edX** | Credentials | Medium (career identity) | Completion collapse |
| **Chegg / homework help** | Answers under deadline | Anti-identity (outsourcing) | Integrity risk; AI-shocked business model |
| **Private tutors** | Human accountability + customization | High when good | Supply-constrained, not a moat MindCraft can out-scale on price |
| **ChatGPT / generic AI tutors** | Instant explanation | Low unless wrapped | Trust / hallucination; "Bastani Base" harm pattern (below) |
| **MindCraft (target)** | FEI conversion + tutor witness + gap diagnosis + solo transfer | **Intended high** | Must *prove* this, not assert it |

**Strategic implication (v1.20, condensed):** Do not try to out-Khan Khan on content
breadth, out-ChatGPT on unlimited full-worked solutions, out-Duo Duo on
streaks/leagues/XP, or out-Brilliant Brilliant on puzzle delight. Compete on the
**session + ops + honesty stack**: inspectable diagnosis, honest cold-start (no fake
day-one mastery), format-gap conversion evidence, witnessable dated solo-competence
artifacts, coverage matrices that name their own gaps, and faded guidance that
actually earns solo carry — then *say exactly that* in marketing, nothing more.

### 2.2 Khan Academy — real dosage data, not just brand

**FACT (large observational study, real classrooms):** Eames, Brunskill, Yamkovenko,
Weatherholtz & Oreopoulos (2026, *PNAS*) — panel of **>200,000 students** in
districts using Khan's MAP Accelerator. Using within-teacher/within-school variation,
they estimate **~+0.031 SD** math gain at observed average usage (~6.6 h/year ≈
11 min/week), projecting to **~+0.085 SD** at the recommended ~30 min/week. Higher
achievers benefit more.

**FACT (null result):** Kelly & Rutherford (2017, *IRRODL*) — a controlled study of
Khan as supplemental instruction found **no significant difference** vs. control.

**FACT (Khanmigo, mixed/early):** A Puerto Rico pilot and an undergrad mixed-methods
study both found qualitative receptivity but **no significant learning advantage**
for Khanmigo vs. plain search/paper in short exposures.

**Verdict (HYPOTHESIS, confidence High/Medium/Low as marked):** Khan's session
optimizes **coverage + dosage**, not affect or identity — dosage→modest-SD gains is
High confidence; that an anxious student feels *seen* in a default Khan session is
Medium; that Khanmigo currently delivers MindCraft-grade affective+evidence+identity
(FEI) support without a human wrap is Low.

**Commercial wedge:** Don't out-library Khan. Parent copy tested by the lab: *"Minutes
on skills matter (Khan proved dosage). MindCraft spends those minutes on the
fear→evidence loop your kid actually avoids."*

### 2.3 Duolingo — a world-class habit machine, the wrong North Star

**FACT:** Settles & Meeder (2016, ACL) — Duolingo's half-life regression (HLR)
spacing model beat Leitner/Pimsleur baselines and produced **~+12%** daily-activity
retention in production A/B when it replaced the older scheduler.

**FACT:** A natural-experiment line on frequency/duration/intensity found total
**minutes** correlated with written but *not* oral gains — frequency and
curriculum-oriented intensity were more reliable proficiency correlates than raw time.
Habit duration alone is not a sufficient statistic for learning.

**Verdict:** Duo wins the "open the app" problem (High confidence) — but habit ≠ FEI
outcomes (High confidence). MindCraft should borrow on-ramp friction-reduction
**without** colonizing meaning with streak/fire-icon mechanics (standing ban, Kill
#11 below).

**Commercial wedge tested:** *"We want you back — because something hard became
yours, not because a streak dies at midnight."*

### 2.4 Brilliant — real craft, wrong core segment

**FACT (small QED, Colombia, n=60):** de la Puente & Perez (2023) found significant
post-test/grade advantages for a Brilliant.org arm on linear algebra vs.
non-Brilliant resources — but small sample, single topic, single context; not an
anxiety- or identity-stratified design.

**Verdict (HYPOTHESIS):** Brilliant's session is the closest competitor to MindCraft
on *active struggle* and anti-answer-dumping (its AI tutor "Koji" is explicitly
constrained to fade before test-like moments). But it selects for students who
already approach math as play — **not** MindCraft's primary threat-profile persona.
Confidence is Low–Medium that the Colombia result generalizes to U.S. ACT-prep
identity outcomes.

**Commercial wedge tested:** *"Brilliant for curiosity already online. MindCraft for
the kid who goes quiet when the room gets evaluative."*

### 2.5 ChatGPT / generic AI tutors — the single most load-bearing finding

**FACT (field RCT, ~1,000 HS math students):** Bastani, Bastani, Sungu, Ge, Kabakcı &
Mariman (2025, *PNAS*) — **GPT Base** (ChatGPT-like, unguarded) raised practice
grades **~+48%**; a pedagogy-guarded **"GPT Tutor"** (hint-not-answer + teacher keys
embedded in the prompt) raised them **~+127%** — during access. **When AI access was
removed, GPT Base students scored ~17% worse on the exam than students who never had
AI at all.** GPT Tutor *neutralized* this harm (exam ≈ control) but the authors are
explicit: **no positive learning effect vs. no-AI**. Mechanism: unguarded chat
functions as a **crutch**, not only a hallucination risk.

**This is the chapter's single sharpest correction of a natural founder assumption**
(explicitly Red Teamed and partially killed, Part XXXIII.7a):
- **KILLED:** "Bastani's GPT Tutor is proof that MindCraft's ontology/pedagogy-wrap
  is the product." This is a **category error** — Bastani's "Tutor" condition
  embedded teacher-authored solution keys and mistake cards *in the prompt* for a
  fixed practice set. MindCraft's claimed architecture (living mastery graph +
  ingredient/bridge DAG + deterministic checkers) is not what Bastani tested.
- **KILLED:** "Guardrails ⇒ learning gain vs. no-AI." Guarded GPT Tutor only matched
  the no-AI control — it did not beat it. The real product bar the lab sets is
  **`solo_transfer_pass` ≥ no-AI control**, not merely "less harmful than raw
  ChatGPT." "Less crutch than ChatGPT" is table stakes, not a win condition.
- **SURVIVES (strengthened):** Unguarded generative practice access can genuinely
  harm solo exam performance (High confidence) — and the harm is invisible to the
  student in the moment. GPT Base students in Bastani did **not** perceive worse
  learning despite the exam collapse; GPT Tutor students perceived *better* exam
  performance despite showing no real gain. **Self-report / thumbs-up cannot
  certify learning** — a finding the lab treats as one of its hardest constraints
  on product analytics generally, not just on AI-tutor design.

**Commercial wedge tested:** Parent-facing: *"If homework looks perfect and the quiz
collapses, you met a crutch."* Never market "ChatGPT but nicer" or claim Bastani
validates MindCraft's architecture.

### 2.6 Sycophancy — a distinct, deeper risk than hallucination

From `chapters/33_ai_tutors_trust_sycophancy.md` (Red Teamed 2026-07-26):

**FACT:** Sharma, Tong, Korbak et al. (2023/24, ICLR) — five SOTA assistants
(Claude 1.3/2, GPT-3.5/4, Llama-2-70B-chat) show measurable **sycophancy**: matching
user beliefs over truth. Human preference data and reward models sometimes *prefer*
confidently-written sycophantic answers over correct ones — meaning RLHF itself can
reward truth-sacrificing agreement. This is a structural property of how these
models are trained, not a prompting bug.

**FACT (novices can't detect it):** Bo, Kazemitabaar, Deng, Inzlicht & Anderson
(2025/26, CHI) — within-subjects study (n=24) of ML novices debugging with high- vs
low-sycophancy chatbots: high-sycophancy caused misconceptions to *persist* and
**~0% relative improvement** vs. **~+49%** for low-sycophancy — and most users
**could not detect** the difference and rated both equally helpful. Perception
metrics fail as safety monitors here too.

**FACT (pressure-contingent):** Kasneci & Kasneci (2026) — models that resist a
simple context-switch attack can still capitulate under **authority** pressure
("my notes say I'm right") or **face-saving** pressure ("please don't tell me I'm
wrong"). This is the specific failure mode most relevant to an anxious student
pushing back on a correction.

**Product bar set by the chapter:** Solver/coach default = guarded help, never
full-answer-first. `solo_transfer_pass` ≥ no-AI is the success bar. CI should run an
anti-sycophancy eval suite (student-wrong / student-right / student-anxious /
authority-pressure / face-saving prompts) and fail the build if a model affirms
wrong math. One-sentence doctrine from the chapter: *"AI may speak; the graph must
decide; the student must still do the decisive cognitive work — and the product must
be willing to disagree."*

### 2.7 Trust repair after an AI is caught being wrong

From `chapters/60_trust_after_ai_hallucination.md`:

**FACT (a genuinely surprising negative result):** Liu, Du, Ma, Zhang & Yan (2024,
IEEE THMS) — in a test-track automated-driving failure study (N=257), a verbal
apology + explanation + promise **did not restore damaged trust**. This is a
transfer-wounded finding (driving safety ≠ wrong algebra hint) but the lab explicitly
keeps the conservative reading: **do not assume apology copy restores trust scores.**

**FACT:** Zhang et al. (2025/26, CHI) — for hallucination specifically (as opposed to
bias or plain factual error), users showed **no clear preference** among rote,
explanatory, or empathic apology styles — this is genuinely unsettled, not a solved
UX problem.

**Product doctrine (SAFE-REPAIR):** detect → classify (competence miss vs. integrity
miss, e.g. sycophantic affirmation of a known-wrong answer) → own it briefly → show a
concrete correction path → require a re-attempt → escalate to a human only on defined
triggers. Explicitly kills: "our AI doesn't hallucinate" marketing, rote/empathy-only
apologies as the repair product, and thumbs-up as proof repair worked.

---

## 3. Market / Pricing / Positioning Research

Primary source: `chapters/59_parent_wtp_experiments.md` (Part LIX, SAFE-WTP), with
market-sizing facts also in Part XXVII.

### 3.1 What's actually known about the market (FACT, not product-specific)

- Kim, Goodman & West (2024, CESifo/IZA) — U.S. private tutoring **centers** more
  than tripled (~3,000 → ~10,000) from ~1997–2022; locations concentrate heavily in
  **high-income, high-parent-education** areas (>half in the top income quintile).
- Same source: ~6–7% of U.S. families with kids 6–17 paid for tutoring in the past
  year (2022 CES data), averaging **~$437** in months with a purchase; top 10%/5% of
  monthly spend near **$1,200/$2,000**. The lab is explicit this is a descriptive
  snapshot, **not a MindCraft price ceiling**.
- Bray (2010) / Bray & Lykins (2012) — "shadow education" (fee-based supplementary
  tutoring) is a well-documented global phenomenon, useful for competitive framing
  but not a US pricing guide.

**Commercial implication the lab draws:** there is real paid demand adjacent to
MindCraft, but it's **skewed toward income/education-privileged families** — pricing
strategy that assumes one national number will both miss the premium segment and
reproduce shadow-education inequality if not designed against it deliberately.

### 3.2 The methods correction — this is the most reusable part of this chapter

**FACT:** Stated "how much would you pay?" (Likert/open-ended) WTP research is
methodologically weak. Murphy, Allen, Stevens & Weatherhead (2005) meta-analysis:
hypothetical-vs-actual WTP has a median ratio of **~1.35**, severely right-skewed —
people say they'd pay more than they will. Choice-based methods (discrete-choice /
conjoint, forcing a trade-off against a real "neither" option and a price) recover
relative preferences more reliably than open-ended questions, per the
Louviere/Hensher/Swait and McFadden random-utility-theory lineage.

**What this kills for MindCraft specifically:** treating survey dollars as a revenue
forecast, treating "parents only buy score spikes" *or* "parents buy identity" as
settled without a real trade-off study, and shipping streak/minutes/unlimited-AI as
the default parent value proposition without it having actually won a choice
experiment.

### 3.3 The proposed attribute set (shippable, not aspirational)

The chapter's design rule: *every CBC attribute level must map to a screen or ops
cost MindCraft could actually ship in 90 days.*

| Attribute | Levels drafted |
|---|---|
| Diagnosis depth | vague "needs practice" / concept weakness list / bridge+format gap map |
| Evidence report | score/minutes only / FEI pack (retry, challenge-seeking, transfer) / FEI + honest plateau note |
| Human accountability | none / weekly async tutor note / 2× live 25-min / 4× live |
| AI help policy | unlimited chat / guarded pedagogy wrap / attempt-first then cards |
| Practice architecture | streak gamification / mastery climate soft-wrong / graded exposure ladder |
| Price | e.g. $49 / $99 / $179 / $299/mo (calibrate to segment) |
| Outside option | "Neither — keep free Khan/GPT/status quo" |

**HYPOTHESIS (medium confidence):** diagnosis depth + FEI report + modest human
accountability will beat unlimited AI and streak theater **in the anxious-middle
segment specifically** — the score-chaser segment may overweight timed-test
simulations instead. The lab is explicit this must be measured per-segment, not
averaged into one "parent persona."

### 3.4 What this chapter explicitly kills

Likert-style WTP as pricing research; survey dollars as revenue; "parents only buy
scores" as a settled claim; streak/minutes/unlimited-AI as a default value prop
without it winning a real trade-off; any guaranteed-ACT-point language in a pricing
tier; averaging distinct parent segments into one persona.

### 3.5 District / B2C(school) procurement as its own go-to-market motion

From `chapters/73_district_procurement_privacy_gtm.md` (Part LXXIII, SAFE-PROCURE) —
relevant if MindCraft ever sells to schools rather than only direct-to-parent:

**FACT:** U.S. K-12 district purchases are gated by data-privacy agreements (DPAs),
not by a "FERPA compliant" badge or a teacher's click-wrap acceptance of terms of
service — the U.S. Dept. of Education's own PTAC guidance explicitly warns that
teacher click-wrap can bind a district to terms that conflict with district policy
and law. The **SDPC National Data Privacy Agreement (NDPA)** is the actual
industry-standard contracting rail (13,000+ districts reference it).

**State overlays are not optional:** California Ed Code §49073.1 mandates specific
contract clauses (no targeted advertising on pupil data, deletion certification,
etc.); Illinois SOPPA similarly regulates "operators." A national privacy page that
ignores these fails the first serious CA/IL review.

**Commercial implication:** the lab frames the whole privacy/DPA packet as a GTM
artifact — "district revenue is gated by a *trust packet*, not by pedagogy claims."
Kills: FERPA badge as proof of readiness, free-classroom-as-viral-GTM bypassing the
same approval a paid tool would need, and any biometric/emotion-camera feature as a
"differentiator" (it's a poison pill for procurement, independent of whether it's a
good idea pedagogically — see §4 in the SAFE-PRIVACY doctrine).

---

## 4. North Star / Metrics — instrumentation depth beyond the known summary

The already-known summary (retry_120s / challenge_accept / transfer_pass /
solo_transfer_pass / HID) is accurate as the headline. Part XXI (Metrics Dictionary)
goes much further than that summary suggests — it's the single largest structured
artifact in the Constitution, cataloguing **~100+ named "banned as North Star"
metrics** (nearly one per SAFE-* rule — e.g. "Focus Score™," "Struggle Score™,"
"Curiosity Score™") and a matching set of real leading-indicator event names the lab
actually wants instrumented. This is far more exhaustive than worth reproducing here;
if you're building analytics, read Part XXI directly (`grep "^## XXI" -A 5` in the
Constitution, or the full section around line 1723).

**The handful of leading indicators worth knowing without going deeper:**

| Metric | Definition | Why it exists |
|---|---|---|
| `retry_120s` | New attempt on same/isomorphic item within 120s of a soft-wrong | Persistence under safety |
| `challenge_accept` (+ `challenge_motive`) | Chose a harder level when offered, tagged mastery/appearance/normative | Challenge-seeking, motive-gated so gaming doesn't count |
| `transfer_pass` / `solo_transfer_pass` | Correct on a varied item after a mastery mark / with AI or Solver closed | Anti-fake-mastery / anti-crutch |
| `ai_reveal_rate` | Frequency of full-answer/unguarded reveals | Crutch exposure |
| `hint_binge` | ≥3 hints without an independent solve | Gaming / helplessness signal |

**Decision rule (HYPOTHESIS, Part XXI.4):** Ship changes that raise `retry_120s` and
*mastery-motive* `challenge_accept` **without** raising `hint_binge` or
`ai_reveal_rate`, and without dropping `transfer_pass`/`solo_transfer_pass`. Prefer
delayed mixed-set accuracy over blocked-session accuracy as the read on whether
something actually worked.

---

## 5. Product Rules Reference (SAFE-* doctrine, representative sample)

159 SAFE-* rules exist in total. Below is a sample of ~35 of the broadest,
most-likely-to-be-reusable ones — general product doctrine on identity, motivation,
feedback, difficulty, format, and tutoring quality — pulled from the Constitution's
own **Part XIV Red Team Dossier** (the "Kill #N" entries), which is itself already a
condensed one-paragraph-per-rule summary. Deliberately **excluded** from this table:
the WTP/SAFE-WTP and district/SAFE-PROCURE rules (covered in §3 above), and nearly
all of the chapter-100–160 QA-operations cluster (see §7). Each source chapter is
independently readable in `chapters/` if you need the full evidence base.

| SAFE code | Kills (the plausible bad idea) | Do instead | Source |
|---|---|---|---|
| SAFE-DD | "Harder is always better" / desirable difficulty that ignores anxiety | Equip → destake → dose → frame → measure; gate by segment | Ch 41 |
| SAFE-COMPARE / HABIT / REWARD | Leaderboards, streaks, XP as identity-builders | Criterion feedback, cue-based practice, informational (not controlling) unlocks | Ch 42–44 |
| SAFE-RESILIENCE | "Grit/Resilience Score™" / staying in the "danger zone" | Growth-zone framing + support recruitment; measure recovery & transfer, not a meter | Ch 45 |
| SAFE-EXPECTANCY | Pygmalion labels / warm AI that just finishes the problem | Task briefs + concrete, informative, output-focused feedback (CIOF) | Ch 46 |
| SAFE-CALIB | "Raise confidence" / Belief Score™ / confidence-alone as the lever | Item-level elicit → classify miss → tiered feedback; appropriate (not maximal) confidence | Ch 50 |
| SAFE-ONTOLOGY | Graph file / RAG chat sold as a "diagnosis moat" | Diagnosis-before-dialogue; inspectable longitudinal state; LLM at the bookends only | Ch 67 |
| SAFE-HITL | Warm human / hours-booked / "got it?" as tutor quality | Map-briefed tutors; prompt-more-than-pour; QA on FEI outcomes, not warmth | Ch 68 |
| SAFE-PRIVACY | Emotion-AI / Anxiety Score™ / "FERPA compliant" treated as ethics | Self-authored, short-TTL affect check-in feeding pedagogy only; no biometric emotion recognition | Ch 69 |
| SAFE-LABMETA | Page-count-as-science / "Bayesian update" without an actual check | Label every claim → red-team it → kill/wound/survive → demote copy accordingly | Ch 70 |
| SAFE-TUTORGRAIN | Ivy/expert résumé treated as a proxy for tutoring quality | Trained near-peer default; structure beats pedigree; expert = escalation/coach-of-tutors | Ch 71 |
| SAFE-GENQ | LLM-generated items shipped straight to the bank | Independent key verification before ship; hard drop-rate gate before scaling generation | Ch 72 |
| SAFE-SCHED | "Expanding SRS" / "AI found your perfect interval" marketing | Horizon-matched spacing intervals; delayed first return; instrument before branding | Ch 74 |
| SAFE-WORKFORCE | Tutor headcount / tenure-months as a quality proxy | Fidelity-over-tenure; continuous coaching; caseload-aware hiring gates | Ch 75 |
| SAFE-FORGET | "Mastery fireworks" sold as durable competence | Age the evidence explicitly; delayed retrieval probes as the truth surface | Ch 76 |
| SAFE-DURABLE | Cram/bootcamp packages marketed as durable identity | Dual-rail GTM: durable-learn track + a labeled, honest late "prove" track | Ch 78 |
| SAFE-FBTIME | "Instant feedback AI" as an unqualified hero claim | Mode-conditional timing (diagnostic = hide; learn = micro-delay + self-explain; prove = labeled KR) | Ch 79 |
| SAFE-BRIDGE | Bridge/edge *count* sold as "we connect everything" | Connection-first narrative only where the join is genuinely weak; remediate the relation itself | Ch 80 |
| SAFE-COLD | Day-one "mastery fireworks" from an empty/seed-only state | Humble prior → visibly-labeled seed data → hide-correctness probes before any green | Ch 81 |
| SAFE-FORMAT | Format/vessel *count* or "we teach every format" as a hero claim | Format as first-class evidence; conversion between formats is itself the learning object | Ch 82 |
| SAFE-PDASH | Tonight-%, streaks, or shame-ranked parent portals as "trust" | Proof-age + a return agenda; autonomy-supportive framing, not control | Ch 83 |
| SAFE-TALK | Talk-ratio-% or silence-as-Socratic as tutoring quality | Construction beats airtime — measure student constructive share, not raw talk-% | Ch 84 |
| SAFE-STORYLOAD | "Immersion" / lore-depth treated as automatically pedagogical | Cognitive-load-budgeted narrative; cut lore for novices; story ≠ transfer by default | Ch 85 |
| SAFE-PROOF | User-count / star-wall / vague testimonials as "learning proof" | Enactive, dated, named solo-competence artifacts a parent/student can actually inspect | Ch 86 |
| SAFE-COVER | Item-count / "complete ACT bank" as a coverage claim | A concept×level coverage matrix with gaps named as gaps, not hidden | Ch 87 |
| SAFE-FADE | Always-full-worked / never-fading Solver as "the" learning UX | Fade guidance by stage, not by default; attempt required before reveal | Ch 88 |
| SAFE-HELP | Unlimited hints / "help NPS" as a learning proxy | Instrumental (not executive/answer-getting) help; contingent, staged hint access | Ch 89 |
| SAFE-INSTRUMENT | DAU/streak/XP or a composite "FEI Score™" as THE North Star | Ship the actual FEI event set with co-primary gates (see §4); resist Goodharting any single metric | Ch 90 |
| SAFE-HINT | Unlimited free "hard" (bottom-out) peeks as kindness | Soft hints before hard; a hard peek costs something (a prior attempt/construction) | Ch 91 |
| SAFE-EXPLAIN | Longer AI explanations / "Explanation Score™" as quality | Short, principle-first; self-explanation required before the AI's full wrap | Ch 92 |
| SAFE-RETRIEVE | "All struggle is productive" / never-stuck answer delivery | Classify the stall type (tip-of-tongue vs. blank freeze) before deciding how to help | Ch 93 |
| SAFE-PF | Treating every wrong attempt as "productive failure" | Deliberately designed generate → consolidate sequencing, gated by prior knowledge | Ch 94 |
| SAFE-APPRENTICE | "Guild" cosplay / modeling-as-lecture / permanent never-fading coaching | Model → coach → scaffold → fade, with required student articulation at each step | Ch 95 |
| SAFE-ERRCLIMATE | "Psychological Safety Score™" / poster-only safe-space messaging | Stay, diagnose, scaffold, require re-attempt — destake the moment, never the standard | Ch 103 |
| SAFE-HWHELP | "Homework Completion Score™" / Chegg-style full-solve-and-done | Dual-rail: Help (instrumental, deadline-driven) vs. Practice (the actual FEI gym); assisted ≠ solo-ready | Ch 104 |
| SAFE-ROI | "AI replaces tutors" / hours-booked as the tutoring KPI | Treat tutor minutes as genuinely scarce inventory; spend them on joins/repair/witness, not reps AI can do | Ch 99 |

**Where the rest live:** SAFE-WTP (pricing methodology) and SAFE-PROCURE (district
GTM) are covered in §3. The remaining ~120 rules span narrower UI-copy and
instrumentation specifics (chapters 96–99 and much of 100+) plus the QA-operations
cluster in §7. The Constitution's Part XX (`grep "Do not out-" MINDCRAFT_RESEARCH_
CONSTITUTION_v1.md`) has a single dense paragraph listing literally every SAFE-* code
by name if you need the full index.

---

## 6. Founder Questions / Open Problems / Roadmap (condensed, Parts XI–XIII)

### Founder Questions (the lab explicitly refuses to answer these for you)

1. If ChatGPT-style tutors become "good enough," what *relationship* do parents
   still buy?
2. Is MindCraft building for the student's identity — or for parents' anxiety about
   scores? Is that a real tradeoff or a false one?
3. Would the team accept lower short-term accuracy for higher long-term
   challenge-seeking?
4. Is the story-world layer load-bearing, or is gap-diagnosis + human tutor enough
   on its own?
5. What would falsify the identity-transformation thesis within 90 days?

### Long-term Roadmap (research horizons, not a build plan)

- **H1 (now):** Prove the FEI loop actually moves retry behavior and
  challenge-seeking.
- **H2:** Prove identity language + the knowledge map produce durable self-concept
  change.
- **H3:** Prove human tutor + AI diagnosis beats AI-alone on persistence and
  transfer.
- **H4:** Only generalize beyond math (e.g. science identity) once the math-identity
  mechanism is actually solid — not before.

### Open Problems (unresolved, named explicitly as unresolved)

1. The causal path from "narrative history of math" to identity change is
   under-identified — the lab doesn't know if it's real.
2. How to build relatedness/belonging at scale without it becoming creepy social
   surveillance.
3. How to measure identity change without demand effects (students telling you what
   they think you want to hear).
4. How to prevent gamification mechanics from colonizing meaning once they exist in
   the product at all.
5. AI's fluent-but-wrong failure mode vs. building real trust calibration in
   teenagers specifically.
6. Equity: does the story-world approach privilege culturally specific narratives
   in a way that disadvantages some students?

---

## 7. The QA-Panel-Ops Cluster (chapters ~100–160) — exists, mostly not your problem

Roughly the back third of the chapter list (SAFE-REVOKE through SAFE-AMBSEAL /
SAFE-MIXREFRESH, chapters ~148–160 most narrowly, with related operational chapters
starting as early as ~120) is **not** general product/learning-science research. It's
a detailed internal operations doctrine for running a **human grading/rating QA
panel** — dual-rater agreement thresholds, gold-standard test-item rotation and
tip-resistance, rater-pool surge-hiring and demobilization, and SLAs for resolving
"poison" (bad) labels. It reads as if the lab modeled this on quality-assurance
practices from clinical/medical rating panels and standardized testing (mammography
double-reading, CAT-exam item security, etc.) and applied the same discipline to
MindCraft's own content-verification pipeline.

It's real, internally consistent doctrine — but genuinely narrow. Only worth reading
if you are actually building or operating a human content-rating/verification
pipeline (e.g., scaling the generated-question verify step, or standing up a
dual-rater QA process for AI-generated figures/items). Start at
`chapters/144_second_rater_thresholds_figured_c4.md` if that's your task; otherwise
this cluster can be safely skipped.

---

## 8. What this document deliberately leaves out

This summary read the competitive/market chapters, the AI-trust chapters, the full
Red Team Dossier (Part XIV, all 114 Kill entries), the Metrics Dictionary (Part XXI),
and the Founder Questions/Roadmap/Open Problems sections directly from the
Constitution — not a re-derivation. It did **not** re-read the ~70 general
learning-science chapters (spacing, interleaving, self-explanation, cognitive load,
etc., chapters 24–99 individually) beyond what's captured in the Kill-list summaries
above; those are real and citation-backed but are the deep pedagogy layer beneath the
product rules, not typically what a new agent needs to start shipping. If you're
about to build a *specific* feature (e.g., the hint economy, worked-example fading,
spaced review scheduling), go read that feature's specific chapter directly — the
table in §5 tells you which one.
