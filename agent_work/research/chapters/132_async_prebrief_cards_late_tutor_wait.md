# Part CXXXII — Async Pre-Brief Cards While Waiting for a Late Tutor

**Chapter status:** Living evidence + waiting-room ops brief — Researcher tick 2026-08-12 (UTC hour 15; hour%6≠0; researcher count since synthesizer v1.16 = 6 → Researcher)  
**Primary question:** When the tutor is late (or the student arrives early), how does MindCraft convert **idle lobby time** into a **student-owned forethought / Set card** that feeds SAFE-MICROBRIEF — without pour-open AI syllabus dumps, entertainment waiting rooms, Wait Minutes vanity, shame-late theater, or minting a Prebrief Score™?  
**Owners:** Product (session lobby / mission card) · HITL ops · Coach UX · SAFE-SRL / SAFE-MICROBRIEF · Brand · Red Team  
**Commercial job:** Ship **SAFE-ASYNCBRIEF** densifying SAFE-MICROBRIEF × SAFE-SRL × SAFE-ATTN × SAFE-LOADSHED × SAFE-EXPECTANCY: a **capped async pre-brief** (≈60–180s) that occupies waiting with *session-related Set work* so the live open is a verification handoff, not a scramble — never idle lobby, never monologue-as-wait, never lobby theater as ACT ads.

**Builds on:** Parts CXXIX (SAFE-MICROBRIEF; MICROBRIEF-3 foreshadows this chapter), CI (SAFE-SRL), XCVI (SAFE-ATTN), LIV (SAFE-AAR), CXXIII (SAFE-LOADSHED), XLVI (SAFE-EXPECTANCY), XC (SAFE-INSTRUMENT). Product seams: late/ETA flag, lobby UI, mission/edge card, last soft-wrong / Map grain, Notes “Set” field, block-to-join optional acuity override.

---

## CXXXII.1 Why this chapter exists

SAFE-MICROBRIEF protects the *live* open under a burned clock. Ops still lose minutes **before** anyone speaks: student sits in a spinner, scrolls TikTok, or gets an AI “warm-up lecture” that steals construction bandwidth. MICROBRIEF-3 already asked whether an async pre-brief beats idle wait; this chapter makes that product law.

Competitors resolve late-tutor waits wrongly: (1) **idle lobby** (spinner + apology); (2) **entertainment wait** (games unrelated to the edge); (3) **pour-open AI** (syllabus dump branded as prep); (4) **shame ETA** (“your tutor is late — again”); (5) **forced full Practice mission** that burns the FEI window before the human arrives. MindCraft’s wedge: **occupied, session-related Set** — the student names edge, success criterion, trap, and if-then plan so the tutor’s first 30s verifies rather than invents.

**FOUNDER BELIEF under audit:** Identity work needs aimed attempts. Waiting without Set is not “relaxing before hard work” — it is attention residue plus do-your-best entry.

**Claims we refuse as doctrine:**
1. Idle lobby / spinner-only as default late-tutor UX.  
2. Tutor/AI lecture that *calls itself* pre-brief while the student waits.  
3. Wait Minutes / Lobby Score™ / Prebrief Streak / Occupancy Score™ as North Star.  
4. Entertainment-only wait (unrelated games) as primary fill.  
5. Mandatory multi-item Practice wall that consumes the session before join.  
6. Late-tutor shame copy aimed at the student (or public tutor-shame feed).  
7. Vibes-only “get ready!” without named edge + success criterion + plan chip.  
8. ACT / score guarantees from async pre-brief packaging.

---

## CXXXII.2 Constructs (wait ≠ waste; prep ≠ pour)

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Idle wait** | Unoccupied preprocess time; attention on clock | Spinner lobby | Residue + anxiety |
| **Occupied wait** | Wait filled with activity (service psych) | Any lobby content | Unrelated = still empty for learning |
| **Session-related Set** | Forethought tied to *this* session’s edge | Async pre-brief card | Trivia / lore fill |
| **Async pre-brief** | Student completes MICROBRIEF beats before live join | Cap 60–180s card | Forced marathon Practice |
| **Handoff verify** | Live open confirms/adjusts student’s card | ≤30–60s MICROBRIEF | Tutor ignores card → pour |
| **SAFE-ASYNCBRIEF** | Waiting-room forethought law | This chapter | Lobby Score™ |

**Operational definition (HYPOTHESIS):** A late/early wait is *SAFE-ASYNCBRIEF complete* when (a) lobby offers a **named time-boxed card** (default 90s; hard cap ≤180s unless student opts into Practice rail), (b) card requires **four Set beats**: named edge → success criterion → one likely trap / FormatId note → if-then plan chip (“When I see X, I will try Y”), (c) outputs write to the same mission/Notes object the live micro-brief reads, (d) fill activity is **session-related** (not unrelated entertainment), (e) live open **verifies** the card (≥1 student synthesis or tutor confirm) rather than replacing it with a lecture, and (f) success = `asyncbrief_complete` × later `brief_complete` / time-to-first-FEI / `retry_120s` / `solo_transfer_pass` — never Wait Minutes or Lobby Score™.

---

## CXXXII.3 Occupied waits feel shorter — but fill must serve the session

**FACT:** Maister (1985, “The Psychology of Waiting Lines,” in Czepiel, Solomon, & Surprenant, *The Service Encounter*, Lexington Books / commonly circulated managerial essay) — propositions on wait *experience*: **occupied time feels shorter than unoccupied time**; preprocess waits feel longer than in-process waits; **uncertain waits feel longer than known, finite waits**; anxiety makes waits feel longer. Practical implication: fill activities should (a) offer benefit in themselves and (b) **relate to the forthcoming service** (menus before seating), not Muzak-style unrelated distraction.

**Applied (HYPOTHESIS):** Tutor-late lobby is classic **preprocess wait**. Spinner = unoccupied. Unrelated mini-game = occupied but **not session-related** — Maister’s sports-highlights vs Muzak distinction. The async pre-brief is the tutoring analogue of handing the menu: it shortens *perceived* wait **and** shortens live service setup (student already chose the edge).

**Kill:** Spinner-only default; entertainment-only fill as primary.  
**Survive:** Session-related occupied wait with known ETA when ops can give one.  
**Wound:** Service satisfaction ≠ transfer_pass — ASYNCBRIEF-* must pre-register FEI instruments, not claim Maister as ACT points.

---

## CXXXII.4 Forethought quality guards against disorganisation in the gap

**FACT:** Zimmerman (2002, *Theory Into Practice, 41*(2), 64–70, doi:10.1207/s15430421tip4102_2) — forethought = processes/beliefs *before* learning efforts (task analysis, goals, strategic planning, motivational beliefs); reflections feed subsequent forethought.

**FACT:** Cosnefroy, Fenouillet, Mazé, & Bonnefoy (2018, *Issues in Educational Research, 28*(2), 329–348) — two undergraduate studies (*N* = 378; *N* = 315): high-quality **forethought-phase** processing predicted lower **procrastination** and **disorganisation**; disorganisation (not procrastination in their model) negatively predicted academic performance; authors treat weak forethought as a pathway into SRL failure.

**FACT:** Cleary & Zimmerman (2001, *Journal of Applied Sport Psychology, 13*(2), 185–206, doi:10.1080/104132001753149883) — experts vs non-experts/novices on free-throw practice: experts set **more specific goals**, chose **technique-oriented strategies**, made strategy attributions; forethought processes intercorrelated; self-reflection attributions predicted later strategy selection.

**Applied (FOUNDER BELIEF → testable):** Idle lobby is a **forethought vacuum** — Cosnefroy’s disorganisation risk plus Cleary/Zimmerman’s “vague goal” novice pattern. The async card forces **specific goal + technique plan** before the tutor arrives, so the live session does not open as reactive homework dump.

**Kill:** “Just hang out until they join” as care.  
**Survive:** Microanalytic Set prompts (goal, strategy) on the wait card.  
**Wound:** College self-report / sport microanalysis ≠ ACT identity — method transfer only.

---

## CXXXII.5 Implementation intentions turn “get ready” into if-then control

**FACT:** Gollwitzer (1999, *American Psychologist, 54*(7), 493–503, doi:10.1037/0003-066X.54.7.493) — **implementation intentions** (“When situation *x* arises, I will perform response *y*!”) link anticipated cues to goal-directed responses; subordinate to goal intentions; help with getting started, shielding from distractions, and escaping bad habits by **delegating control to situational cues**.

**Applied (HYPOTHESIS):** The fourth Set beat is not journaling — it is an if-then chip tied to the named trap (“When I multiply both sides and see a negative coefficient, I will flip the inequality”). That chip becomes the tutor’s first coaching check and the student’s first stall cue (SAFE-HINT / SAFE-RETRIEVE), not a Prebrief Score™.

**Kill:** Vague “I’ll try my best” lobby text.  
**Survive:** One if-then plan chip written before join.  
**Wound:** Lab implementation-intention *d* ≠ guaranteed session FEI — ASYNCBRIEF-2 must test plan-chip present vs absent.

---

## CXXXII.6 Advance organizers ≠ syllabus dumps

**FACT:** Ausubel (1960, *Journal of Educational Psychology, 51*(5), 267–272, doi:10.1037/h0046669) — advance introduction of relevant **subsuming concepts** (organizers) can facilitate learning/retention of unfamiliar meaningful verbal material versus controls lacking that scaffolding.

**FACT (boundary):** Advance organizers in Ausubel’s sense are higher-abstraction bridges to existing cognitive structure — **not** same-level overviews, not exhaustive lectures, and later reviews treat effects as conditional (material/learner fit), not a license for “more prep text always helps.”

**Applied (HYPOTHESIS):** The async card may show **one** Map-grain / last soft-wrong anchor (ideational scaffold) — not a chapter dump. Pour-open AI “while you wait, here’s everything about linear inequalities” violates Ausubel *and* SAFE-EXPLAIN / SAFE-ATTN (germane load + residue).

**Kill:** Waiting-room monologue / syllabus dump as “organizer.”  
**Survive:** One subsuming anchor + student-generated Set beats.  
**Wound:** 1960 prose-learning effects ≠ FormatId FEI — keep organizers thin.

---

## CXXXII.7 Attention residue: idle phone waits tax the first attempt

**FACT:** Leroy (2009, *Organizational Behavior and Human Decision Processes, 109*(2), 168–181, doi:10.1016/j.obhdp.2009.04.002) — **attention residue**: when people switch incomplete tasks, attention remains with the prior task and can impair performance on the next; unfinished work leaves cognitive residue.

**Applied (HYPOTHESIS):** Phone-scroll lobby = unfinished social/feed task colliding with first FEI item (SAFE-ATTN). A short, completable Set card that **finishes** before join reduces residue relative to open-ended feed browsing. A forced long Practice mission that remains unfinished when the tutor joins *creates* residue — so async prep must be **completable**, not a second homework block.

**Kill:** “Keep them busy forever until tutor arrives.”  
**Survive:** Completable ≤180s card; optional Practice rail only after card complete + explicit choice.  
**Wound:** OB lab switching ≠ tutoring lobby — instrument time-to-first-FEI + first-item method-change.

---

## CXXXII.8 Specific goals still beat “do your best” in the lobby

**FACT:** Locke & Latham (2002, *American Psychologist, 57*(9), 705–717, doi:10.1037/0003-066X.57.9.705) — specific, difficult goals outperform vague/easy/do-your-best goals; mechanisms include direction, effort, persistence, strategy arousal.

**Applied (HYPOTHESIS):** Lobby copy “prepare for tutoring” is do-your-best. Card fields that force “edge = …; success = one solo transfer without peek” are the wait-time expression of SAFE-MICROBRIEF specificity — so the live 30s open is confirmation, not invention (Starmer-style: structure without duration inflation, method-only — see CXXIX).

**Kill:** Vague prepare-yourself lobby.  
**Survive:** Named edge + observable success criterion before join.

---

## CXXXII.9 Product rules (SAFE-ASYNCBRIEF)

1. **Default on late/early flag** — Show async pre-brief card when ETA slip or student-early; never spinner-only.  
2. **Four Set beats** — Edge, success criterion, trap/FormatId, if-then plan chip (Gollwitzer).  
3. **Hard time box** — Default ~90s; cap ≤180s; visible countdown; allow early submit.  
4. **Session-related fill only** — Ban unrelated entertainment as primary; optional Practice rail *after* card complete.  
5. **Write-through** — Card populates mission/Notes object MICROBRIEF reads; tutor UI shows student Set first.  
6. **Live = verify, not replace** — Tutor confirms/adjusts; pour-open that ignores card = fidelity breach (HITL QA).  
7. **ETA honesty** — Prefer known finite wait copy when possible (Maister); never student-facing tutor-shame feed.  
8. **Expectancy-safe** — Task language; late is ops fact, not Maya character flaw (SAFE-EXPECTANCY).  
9. **LOADSHED protect** — Under crunch, protect async Set + micro-brief; do not shed prep for HW dump.  
10. **Copy:** “While we wait, name the edge and your if-then plan — so we start aimed.” Never “lobby games raise ACT” or Wait Minutes NS.

**Confidence:** High — Maister occupied/related wait + Zimmerman/Cosnefroy forethought + Gollwitzer if-then + Locke/Latham specificity + Leroy residue as mechanism sources. Medium — MindCraft 90–180s thresholds and verify-handoff compliance (needs ASYNCBRIEF-*). High — idle/pour/entertainment/Score™ lobby as commercially toxic under FEI + SAFE-MICROBRIEF/SRL.

---

## CXXXII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| ASYNCBRIEF-1 | Async Set card vs idle spinner under equal tutor-late delay | Ops A/B | `asyncbrief_complete`; time-to-first-FEI; `retry_120s` |
| ASYNCBRIEF-2 | Four-beat + if-then chip vs “get ready” free text ≤90s | Product A/B | plan_chip_ok; `synthesis_ok`; method-change |
| ASYNCBRIEF-3 | Session-related Set vs unrelated entertainment wait | Ops A/B | perceived wait; first-item residue proxy; transfer_pass |
| ASYNCBRIEF-4 | Verify-handoff micro-brief vs tutor ignores card / pour-open | HITL A/B | pour↓; `brief_complete`; `solo_transfer_pass` |
| ASYNCBRIEF-5 | Parent/tutor CBC: “aimed wait card” vs “we’ll jump in when tutor arrives” | CBC | WTP; trust (SAFE-WTP / CRUNCHMSG) |
| ASYNCBRIEF-QUAL | 10 Mayas + 10 tutors: did wait card feel clarifying or busywork/shame? | Qual | ASYNCBRIEF codebook |

**Falsifier:** Idle equals async card on delayed transfer → still refuse pour-open; check whether bank/edge mismatch, not wait design, was bottleneck.  
**Falsifier:** Entertainment wait wins satisfaction with equal FEI → keep related-fill rule for learning claim; do not sell satisfaction as mastery.  
**Falsifier:** Card raises anxiety without method-change → tighten SAFE-ERRCLIMATE / shorten fields; do not return to spinner-only.  
**Pre-register:** ASYNCBRIEF-* before “occupied wait / implementation-intention tutoring / +ACT” ads.  
**Family note:** ASYNCBRIEF-* densifies MICROBRIEF/SRL/ATTN/LOADSHED/EXPECTANCY; do not collapse into Wait Minutes OKRs. MICROBRIEF-3 is absorbed into this family.

---

## CXXXII.11 So what for MindCraft commercially

- **Copy:** “While we wait, name the edge and your if-then plan — so the session starts aimed.”  
- **Product:** Late/early lobby → capped async Set card; write-through to micro-brief; tutor verify UI; optional Practice only after complete.  
- **Ops:** QA `asyncbrief_complete` + pour-ignore rate; ETA honesty; protect under LOADSHED.  
- **Positioning:** Against idle marketplace lobbies and AI warm-up dumps; high-reliability craft without waiting-room theater.  
- **Metric:** `asyncbrief_complete`, plan_chip_ok, time-to-first-FEI, paired `brief_complete` / FEI — demote Wait Minutes / Lobby Score™.  
- **Kill list:** Idle spinner default; pour-open wait; entertainment-primary fill; forced marathon Practice-before-join; late-shame copy; Prebrief Score™.  
- **Growth / vision:** Trust packet shows waits become student-owned Set; Maya learns even delay can be aimed practice of forethought — identity starts before the tutor speaks.

---

## References (verified)

- Ausubel, D. P. (1960). The use of advance organizers in the learning and retention of meaningful verbal material. *Journal of Educational Psychology, 51*(5), 267–272. https://doi.org/10.1037/h0046669  
- Cleary, T. J., & Zimmerman, B. J. (2001). Self-regulation differences during athletic practice by experts, non-experts, and novices. *Journal of Applied Sport Psychology, 13*(2), 185–206. https://doi.org/10.1080/104132001753149883  
- Cosnefroy, L., Fenouillet, F., Mazé, C., & Bonnefoy, B. (2018). On the relationship between the forethought phase of self-regulated learning and self-regulation failure. *Issues in Educational Research, 28*(2), 329–348.  
- Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. *American Psychologist, 54*(7), 493–503. https://doi.org/10.1037/0003-066X.54.7.493  
- Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. *Organizational Behavior and Human Decision Processes, 109*(2), 168–181. https://doi.org/10.1016/j.obhdp.2009.04.002  
- Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation: A 35-year odyssey. *American Psychologist, 57*(9), 705–717. https://doi.org/10.1037/0003-066X.57.9.705  
- Maister, D. H. (1985). The psychology of waiting lines. In J. A. Czepiel, M. R. Solomon, & C. F. Surprenant (Eds.), *The service encounter* (pp. 113–123). Lexington Books.  
- Zimmerman, B. J. (2002). Becoming a self-regulated learner: An overview. *Theory Into Practice, 41*(2), 64–70. https://doi.org/10.1207/s15430421tip4102_2  
