# Part LI — Deliberate Practice in Tutoring Sessions: Ericsson vs Hambrick, and the 45-Minute Design

**Chapter status:** Living evidence brief — Researcher tick 2026-07-31 (UTC hour 09; hour%6≠0; 1 researcher entry since synthesizer v1.7 → Researcher)  
**Primary question:** What should a MindCraft tutoring / practice session *do* if “practice” is not volume, not streak minutes, and not answer delivery — and how far can Ericsson’s deliberate-practice (DP) frame travel before Macnamara–Hambrick evidence kills overclaim?  
**Owners:** Product (session architecture / tutor briefing) · Engine (weakness targeting / feedback loops) · Marketing claim ladder · Red Team  
**Commercial job:** Ship a **SAFE-DP** session stack — diagnose → isolate edge skill → goal → effortful attempt → informative feedback → revise → brief rest → solo check — kill 10,000-hours theater, grind-volume North Stars, and “we do deliberate practice” as brand without a coach-designed edge task.

---

## LI.1 Why this chapter exists

MindCraft sells sessions: college tutors, practice missions, Solver, Map. The Constitution’s research question is identity transformation under difficulty. Deliberate practice is the popular science answer to “how experts get good.” It is also a marketing trap — competitors and edtech decks cite Ericsson while shipping naive drill (more of the same), gamified volume (streaks/XP), or fluent AI monologue (pseudo-coaching).

Parts XXVI (CLT / fading), XXIX (spacing/retrieval), XXXI (challenge–skill), XXXIX (interleave), XL (self-explanation), XLI (SAFE-DD), and L (SAFE-CALIB) already constrain *what kind* of difficulty and feedback are safe. What was missing was a chapter that (a) defines DP vs purposeful vs naive practice, (b) faces the Macnamara–Hambrick variance numbers honestly, (c) translates math-education DP (Lehtinen line) into a **45-minute** tutor/product design, and (d) refuses talent-denial and grind-as-virtue as doctrine.

**FOUNDER BELIEF under audit:** A high-quality MindCraft session is closer to *coach-designed practice at the edge of ability with feedback* than to homework help, content library, or engagement loops.

**Claims we refuse as doctrine:**
1. 10,000 hours / “practice makes perfect” as causal story.  
2. Accumulated minutes / streaks as proof of DP.  
3. DP explains nearly all expert variance (popular overread).  
4. Any hard drill = DP; AI chat without diagnosis = DP coach; talent-denial as brand.

---

## LI.2 Constructs (product language)

| Construct | Plain definition | Product signal | Failure mode if misused |
|-----------|------------------|----------------|-------------------------|
| **Naive practice** | Repeating what you can already do; play / homework slog | High accuracy, low struggle, no edge target | “Completed 40 problems” vanity |
| **Purposeful practice** | Goal + focus + feedback, possibly self-directed (Ericsson & Pool, *Peak*, 2016) | Student sets a micro-goal; app gives feedback | Duo-like streaks dressed as purpose |
| **Deliberate practice (strict)** | Coach/teacher designs tasks beyond current reliable performance; immediate informative feedback; refinement; builds mental representations (Ericsson et al., 1993; Ericsson & Pool, 2016) | Tutor/engine picks weakness; task just beyond; feedback revises method | Labeling all structured homework “DP” |
| **Structured practice (meta-analytic)** | Broad “practice designed to improve” used in Macnamara et al. (2014) — often looser than Ericsson’s DP | Hours logged in studies | Equating study-hours with DP |
| **Mental representation** | Organized internal model that lets experts monitor and improve (Ericsson line; Lehtinen et al., 2017) | Transfer / format hop / self-monitor | Fluency without representation |
| **SAFE-DP** | DP doctrine that survives Hambrick wound + anxiety/CLT gates | See LI.8 | Grind theater; 10k-hours copy |

**Operational definition (HYPOTHESIS):** A MindCraft block counts as *deliberate-practice-shaped* when (a) target is a diagnosed edge (concept, ingredient, bridge, format, or miss class), (b) task is beyond reliable solo performance but solvable with brief support, (c) feedback changes the *next attempt’s method*, not only the answer key, (d) student generates at least one why / check before AI wrap (PWC / XL), and (e) session ends with a short unaided probe (`solo_transfer_pass` or isomorphic check) — not with “minutes practiced.”

---

## LI.3 Ericsson’s core claim — what is actually said

**FACT (foundational paper):** Ericsson, Krampe & Tesch-Römer (1993, *Psychological Review*, 100(3), 363–406, doi:10.1037/0033-295X.100.3.363) — expert performance is strongly associated with accumulated *deliberate practice*: highly structured activities designed to improve specific aspects of performance, typically with teacher/coach guidance, clear goals, feedback, and effortful concentration. Mere experience / play / mindless repetition do not substitute.

**FACT (effort constraint):** Same paper and later summaries — effective daily DP duration is limited; early practice often ~1 hour or less; laboratory extended-practice protocols commonly ~1 hr sessions; pushing past optimal duration yields diminishing returns and fatigue. Rest is part of the training system, not laziness (aligns SAFE-TIMING).

**FACT (Peak distinction):** Ericsson & Pool (2016, *Peak*) — **purposeful practice** = well-defined goal, focus, feedback, get-out-of-comfort-zone; **deliberate practice** = purposeful practice *plus* a field with known training methods and a teacher who designs/adapts exercises. Popular “10,000 hours” readings flatten this distinction and often cite Gladwell’s popularization rather than Ericsson’s constraints.

**Product translation:** MindCraft’s tutor + ontology spine can *aspire* to the coach role (diagnose → design edge task → feedback). Solo app loops without diagnosis are at best purposeful practice — and often naive practice with a nicer UI.

**Kill:** “10,000 hours of MindCraft.” Survive: “coach-designed practice at your edge, in a session you can sustain.”

---

## LI.4 The Hambrick / Macnamara wound — variance is not destiny theater

**FACT (meta-analysis):** Macnamara, Hambrick & Oswald (2014, *Psychological Science*, 25(8), 1608–1618, doi:10.1177/0956797614535810) — across domains, deliberate-practice measures explained roughly **26%** of variance in games, **21%** music, **18%** sports, **4%** education, and **<1%** professions. Conclusion: DP is important, but **not as important as popular arguments claim**.

**FACT (sports follow-up):** Macnamara, Moreau & Hambrick (2016, *Perspectives on Psychological Science*, 11(3), 333–350, doi:10.1177/1745691616635591) — in sports, substantial unexplained variance remains; elite vs sub-elite comparisons weaken simple “more DP → elite” stories.

**FACT (reply chain):** Ericsson (2016, *Perspectives on Psychological Science*, doi:10.1177/1745691616635600) argues meta-analyses sum *heterogeneous practice hours* and dilute the construct; Macnamara & Hambrick (2016, doi:10.1177/1745691616635614) reply that Ericsson’s criteria shift and that existing evidence does not support “largely accounted for by DP.”

**FACT (definition rescue attempt):** Ericsson & Harwell (2019, *Frontiers in Psychology*, doi:10.3389/fpsyg.2019.02396) — re-emphasize original DP criteria; claim Macnamara et al. often measured **structured practice**, not strict DP; reanalyses with stricter inclusion raise explained variance. Independent methodologists still warn against treating any reanalysis as settling talent, opportunity, and starting-skill confounds.

**Wound for MindCraft marketing:** Education’s **~4%** figure is a Red Team grenade against “science says deliberate practice is everything.” Even if Ericsson is right that many education studies measured weak proxies, MindCraft cannot sell DP as a near-sufficient cause of identity or ACT gains.

**HYPOTHESIS:** MindCraft should treat DP as a **session design grammar** (how to spend 45 minutes), not as a **variance-explained brand claim**. Commercial strength is *individualized edge practice with feedback* — the part both camps agree matters more than mindless hours — without promising that practice volume explains Maya’s future.

**Kill:** “Experts are made of deliberate practice — so we made you an expert factory.” Survive: “Most homework isn’t practice that changes you; we design the next hard thing on purpose.”

---

## LI.5 Mathematics education — drill vs deliberate practice

**FACT (math DP review):** Lehtinen, Hannula-Sormunen, McMullen & Gruber (2017, *ZDM Mathematics Education*, 49, 625–636, doi:10.1007/s11858-017-0856-6) — school math “practice” is often **drill-and-practice** that automatizes procedures but can yield *inert* routines rather than adaptive number knowledge; DP in expertise research involves thinking, problem solving, reflection, and dynamically retargeted training — not mechanical fluency alone. They summarize Ericsson (2016) features: coach-known skills, beyond-current-ability effort, specific goals, full attention, feedback + modification, building mental representations, improving prior skills with correct fundamentals.

**FACT (study time ≠ improvement):** Plant, Ericsson, Hill & Asberg (2005, *Contemporary Educational Psychology*, 30(1), 96–116) — in higher education, amount of study time did not significantly predict GPA once quality/concentration/goals entered; improvement tied to concentrated, goal-directed learning (cited in Lehtinen et al. as caution against raw hours).

**HYPOTHESIS for MindCraft:** Ontology ingredients + bridges are the *right decomposition* for DP-style targeting (isolate the failing subprocess, then rebuild), but only if sessions refuse “do 20 similar ACT items” as the default. Blocked accuracy is acquisition theater (XXXIX); DP needs the edge miss class (SAFE-MISCON / SAFE-CALIB), then varied probes (SAFE-TRANSFER).

**Link to CLT / anxiety:** Beyond-ability tasks without destake/equip violate SAFE-DD. DP’s “near-maximal effort” is **not** permission for threat flooding. For Maya, the coach’s first job is often making the edge task *informative*, not merely hard.

**Kill:** Back-to-basics grind marketed as Ericsson. Survive: adaptive practice that builds representations — Lehtinen’s contrast as competitive copy vs worksheet mills.

---

## LI.6 What a 45-minute MindCraft session should look like

**FOUNDER BELIEF:** Human tutor sessions (~45–60 min) and digital missions should share one DP-shaped spine so marketing demos, tutor briefs, and app UX do not diverge into “warm homework help” vs “streak game.”

**Proposed spine (HYPOTHESIS — SAFE-DP):**

| Minute block | Move | Maps to |
|--------------|------|---------|
| 0–5 | Affect + goal: name *one* edge target (weakness / bridge / format / miss class) | FEI safety; E×V; SAFE-EXPECTANCY task-only language |
| 5–12 | Quick diagnose / warm isomorphic (hide-correctness OK if FEI) | C4; SAFE-CALIB elicit if used |
| 12–28 | Edge attempts: 1–3 items beyond reliable solo; student generation before explain | DP effort; PWC; SE (XL); SAFE-DD dose |
| 28–36 | Feedback that revises method: contradicting reason / springboard / ingredient card — not answer dump | Koriat; SAFE-MISCON; ingredient runtime |
| 36–42 | Near transfer / format hop / interleaved foil | SAFE-TRANSFER; XXXIX |
| 42–45 | Solo check + attribution (“what changed in your method?”) + next cue | `solo_transfer_pass`; SAFE-HABIT if-then; no streak sermon |

**Effort constraint product rule:** Prefer one sharp DP cycle over stuffing eight topics. Marathon “grind nights” violate SAFE-TIMING and Ericsson’s own duration cautions.

**Tutor ethics:** Brief tutors on *task* targets from the graph — never trait labels (SAFE-EXPECTANCY). “Today we strengthen the functions→rate bridge” beats “she’s weak and unmotivated.”

**AI role:** Engine proposes the edge target and card order; LLM wraps language *after* student attempt (PWC). Unguarded Solver-as-session is not DP.

---

## LI.7 Competitive wedge (brief)

Khan often explain-then-block; Duo sells streak volume; Brilliant scaffolds delight; ChatGPT tutors monologue without diagnosis; traditional tutoring delivers answers. MindCraft’s L1-safe line: not “more practice” — **better-designed practice** (one edge, method-changing feedback, solo proof). Minutes, XP, and fluent help are not DP.

---

## LI.8 SAFE-DP stack (ship rule)

1. **Diagnose** — Pick one edge from graph / gap / tutor brief (concept, ingredient, bridge, format, or confidence-miss class).  
2. **Isolate** — Decompose to the failing subprocess (ontology), not a random worksheet.  
3. **Goal** — State a performance micro-goal for the block (“solve rate problems when the story hides the function”).  
4. **Stretch** — Tasks beyond reliable solo, inside SAFE-DD capacity (equip/destake first if anxious).  
5. **Attempt** — Student generates; no AI monologue-first (PWC / XL).  
6. **Feedback** — Informative, method-revising; confidence-tiered when elicited (SAFE-CALIB / MISCON).  
7. **Revise** — Immediate retry or isomorphic variant that uses the new method.  
8. **Prove** — Short unaided / format-hop check; log `solo_transfer_pass`, not minutes.  
9. **Stop** — Respect effort constraint; schedule sleep/spacing (SAFE-TIMING / XXIX).  
10. **Measure** — Edge-target hit rate, method-change coding, transfer — never 10k-hours progress bars.

**Marketing language that survives:** “Practice at your edge,” “coach-designed sessions,” “feedback that changes your next try,” “show what you can do alone.”  
**Marketing language that dies:** “10,000 hours,” “grind mindset,” “practice makes perfect,” “XP = mastery,” “our AI is your deliberate-practice coach” without diagnosis spine, talent-denial (“anyone can be elite if they DP”).

---

## LI.9 Claim ladder

| Claim | Max ladder without new data |
|-------|------------------------------|
| Strict DP ≠ mere study hours / drill fluency | L1 (Ericsson 1993; Lehtinen 2017; Plant et al. 2005) |
| Popular “DP explains almost all expertise” overclaims; education variance small in Macnamara et al. | L1 (2014 meta; reply chain) |
| Coach/teacher-designed edge tasks + feedback beat naive repetition for skill change | L1 (expertise literature consensus on quality > raw hours) |
| MindCraft 45-min SAFE-DP spine improves solo transfer vs homework-help control | L1 product bet — needs DP experiments |
| DP volume alone creates identity as mathematical thinker | **Banned** (L3 without instruments; Hambrick wound) |
| Talent/opportunity irrelevant | **Banned** as brand |

---

## LI.10 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| DP-1 | SAFE-DP spine vs homework-help / explain-first session (same tutor time) | 2-arm | `solo_transfer_pass`; method-change code | Help ≥ DP spine → spine overstated |
| DP-2 | One edge target vs multi-topic coverage in 45 min | 2-arm | delayed isomorphic accuracy; cognitive load / affect | Coverage ≥ focus on learning → “one edge” wrong for ACT cram segment |
| DP-3 | Engine-proposed ingredient target vs tutor-chosen topic without graph | 2-arm | edge-hit; transfer | Tutor-only ≥ engine → graph targeting weak |
| DP-4 | Feedback revises method (SE + springboard) vs answer-key-only after miss | 2-arm | next-attempt success; `retry_120s` | Key-only ≥ method feedback → DP feedback claim weak |
| DP-5 | Session cap (~45–60 focused min) vs encouraged grind (+30 min similar items) | 2-arm | delayed accuracy; sleep/affect | Grind ≥ cap → effort-constraint messaging wrong for this population |
| DP-QUAL | 10 Maya + 5 tutor interviews: “real practice” vs help | interview | coded: edge / threat / agency | Spine feels like cruelty → redesign destake |

**Pre-reg (XXXIV):** DP-* identify **session architecture / targeting / feedback quality** — not “DP causes identity” or “explains elite careers.” Densifies FEI, PWC, SAFE-DD/TRANSFER/MISCON/CALIB/TIMING; prefer transfer metrics over minutes.

---

## LI.11 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| Ericsson et al. (1993): DP = coach-guided, feedback-rich, effortful practice beyond current performance | FACT | High |
| Practice duration constrained; rest matters; purposeful ≠ deliberate without coach (*Peak*) | FACT | High |
| Macnamara et al. (2014): modest DP variance; ~4% education; definition dispute unsettled | FACT | High |
| Lehtinen et al.: math drill ≠ DP; Plant et al.: hours ≠ achievement when quality ignored | FACT | High |
| SAFE-DP is right default session grammar for MindCraft | FOUNDER BELIEF / HYPOTHESIS | Medium–High |
| 10k-hours / talent-denial / grind NS transform learners | SPECULATION / false as doctrine | Low (against) |

---

## LI.12 What this chapter kills

1. **Kill:** 10,000-hours / “practice makes perfect” as causal brand.  
2. **Kill:** Streak minutes, problem counts, or XP as DP proof.  
3. **Kill:** “DP explains expertise — therefore our app creates experts” (education ~4% wound).  
4. **Kill:** Hard drill ≡ DP; AI monologue ≡ DP coach; talent-denial; multi-topic coverage theater as default rigor.  
5. **Wound:** Violin-lab DP ≠ anxious ACT novice tutoring — survive as quality grammar + SAFE-DD, not music cosplay.  
6. **Survive:** SAFE-DP spine; ontology edge targeting; method-revising feedback; effort caps; DP-1…5; “better-designed practice” copy.

**Doctrine until data:** Ship **SAFE-DP**: one diagnosed edge, effortful attempt, feedback that changes the next try, short solo proof, stop before grind — never sell hours, streaks, or talent-denial as the learning engine.
