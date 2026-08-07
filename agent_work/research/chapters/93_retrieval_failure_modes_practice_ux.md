# Part XCIII — Retrieval Failure Modes in Practice UX

**Chapter status:** Living evidence + practice-session brief — Researcher tick 2026-08-06  
**Primary question:** When a learner fails to retrieve mid-practice, which failure mode is occurring — tip-of-tongue / partial access, productive struggle, freeze/blanking, or avoidance — and what product response preserves construction without cosplaying “struggle theater” or dumping answers?  
**Owners:** Product (Practice / Solver timers & hints) · Engine (spacing / soft-wrong) · HITL tutors · Brand · Red Team  
**Commercial job:** Ship a **SAFE-RETRIEVE** doctrine: name the failure mode before treating it; wait + partial cue for TOT-class stalls; contingent soft scaffold for blank/freeze; unsuccessful attempt + feedback can potentiate learning; prove with retry/transfer — never Struggle Score™, blank-time NS, or “always stew / never stuck.”

**Builds on:** Parts XXIX (spacing/retrieval), XLI (desirable difficulties × anxiety), XLIX (productive misconceptions), LXXXVIII–XCII (fade / help / instrument / hint / explain). Sibling queue: id 94 productive failure sequencing. Product seams: dwell timers, tip-cue UI, freeze detection, soft-wrong path, hint contingency.

---

## XCIII.1 Why this chapter exists

Practice UX collapses many stalls into one button: “Need a hint?” Parents hear “struggle” and either panic or romanticize it. Competitors either (a) intervene instantly (ChatGPT dump), (b) gamify stuckness (streaks, pep), or (c) preach productive struggle without instruments.

MindCraft’s FEI loop needs a finer grain: **retrieval failure is not one event.** A tip-of-tongue state that motivates continued search is not the same as working-memory blanking under anxiety, which is not the same as Kapur-style generation before instruction, which is not the same as help-avoidance.

**FOUNDER BELIEF under audit:** Distinguishing failure modes lets MindCraft keep desirable difficulty without flooding Maya after a freeze — and without selling “we never interrupt struggle” as brand.

**Claims we refuse as doctrine:**
1. All struggle ≡ productive struggle / desirable difficulty.  
2. Blank-time, dwell-seconds, or Struggle Score™ as learning North Stars.  
3. Always-wait / never-intervene (silence theater ≡ pedagogy).  
4. Instant hard peek / full solution on first stall (executive dump).  
5. Unsuccessful retrieval ≡ wasted / harmful (so skip attempt and show answer).  
6. “Never stuck” marketing that legitimizes answer delivery.  
7. Tip-of-tongue pep copy without a retrieval path (affirmation without cue).  
8. Streaks/XP for enduring blank screens.

---

## XCIII.2 Constructs (keep modes distinct)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Retrieval attempt** | Effort to access stored knowledge | First try; soft-wrong retry | Skip attempt → restudy tip |
| **TOT (tip-of-the-tongue)** | Feeling that an unretrieved item is known / recoverable; metacognitive state dissociable from access | Partial recall; “I almost have it”; letter/structure cue hunger | Treat as total ignorance |
| **Omission / blanking** | No candidate produced; freeze | Empty response; rapid panic peek | Force endless wait |
| **Commission error** | Wrong candidate produced | Soft-wrong path | Shame / instant dump |
| **Productive struggle** | Effort to make sense of math that is not immediately apparent (Hiebert & Grouws) | Sense-making dwell with progress markers | Romanticize despair |
| **Productive failure (PF)** | Generation/exploration before consolidation (Kapur) — design, not any fail | Optional struggle-first sequences (id 94) | Label every miss “PF” |
| **Anxiety–WM tax** | Anxiety consumes WM needed for math (Ashcraft line) | Freeze under timed/exam chrome | “Try harder” as fix |
| **SAFE-RETRIEVE** | Mode-contingent response to retrieval failure | This chapter | One-size struggle UX |

**Operational definition (HYPOTHESIS):** A stall is *SAFE-RETRIEVE handled* when the product (a) attempts mode classification (TOT/partial vs blank/freeze vs productive progress vs avoidance), (b) defaults to wait + micro-cue for TOT-class, (c) offers contingent soft instrumental scaffold for blank/freeze after a bounded wait (SAFE-HINT), (d) treats commission errors via soft-wrong + SE (not dump), (e) never scores blank-seconds as virtue, and (f) co-primaries prove with `retry_120s` / `solo_transfer_pass` — not Struggle Score™.

---

## XCIII.3 TOT is metacognitive — not “they don’t know it”

**FACT:** Brown & McNeill (1966) established laboratory elicitation of tip-of-the-tongue states as distinct from simple forgetting — partial phonological/orthographic information often available when the full target is not.

**FACT (review):** Schwartz & Metcalfe (2011, *Memory & Cognition*, 39, 737–749, doi:10.3758/s13421-010-0066-8) synthesize direct-access and heuristic–metacognitive accounts: TOTs accompany some failed or slow retrievals; the *feeling* is informed by cues (partial info, related info, cue familiarity) and can change retrieval *behavior* (persist in search). TOT experience and retrieval success are dissociable.

**Applied (HYPOTHESIS):** In Practice, a student who can name “quadratic formula starts with negative b…” or sketch a triangle but cannot finish is often in a **TOT-class stall**, not a cold start. Correct product move: **bounded wait + partial cue** (first letter of step label, FormatId reminder, “name the bridge”) — not full worked example, not “you don’t know this — here’s the lecture.”

**Kill:** Instant dump on first hesitation; “blank = never learned.”  
**Survive:** Treat recoverable inaccessibility as a search problem; cue, don’t replace.

---

## XCIII.4 Unsuccessful retrieval can potentiate later learning

**FACT:** Kornell, Hays & Bjork (2009, *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 35(4), 989–998) — unsuccessful retrieval attempts followed by study of the correct answer enhanced subsequent learning relative to study-only controls across multiple experiments (failed tests were not mere harm).

**FACT:** Richland, Kornell & Kao (2009, *Journal of Experimental Psychology: Applied*, 15(3), 243–257) — pretesting (often unsuccessful) on prose material improved later retention of those facts vs non-pretested content (pretesting / failed-test potentiation).

**FACT (synthesis):** Vaughn, Hausman & Kornell / Kornell & Vaughn line (e.g. Kornell & Vaughn, 2016, *Psychology of Learning and Motivation*, Vol. 65) — retrieval practice benefits appear even when the attempt fails, provided feedback/study follows; a two-stage view (attempt → process answer) undercuts “only successful retrieval counts.”

**Applied (FOUNDER BELIEF → testable):** MindCraft should **require an attempt** before heavy help (already SAFE-HELP / SAFE-HINT). Marketing must not imply “wrong first tries damage the brain.” Parent copy: “Trying before the coach — even when stuck — sets up the learning that follows.”

**Contradicting pressure (FACT/HYPOTHESIS):** Anxiety–WM literature (Ashcraft & Kirk, 2001; Ashcraft, 2002) — under high anxiety, forced struggle without support can collapse performance. Mode matters: potentiation assumes a *search* is happening, not a panic freeze. Hence SAFE-RETRIEVE’s freeze branch (soft scaffold after bound), not endless blank.

**Kill:** Skip-attempt restudy as default; “errors always scar memory” fear marketing.  
**Survive:** Attempt → feedback; shorten wait when freeze signals dominate.

---

## XCIII.5 Productive struggle ≠ every stuck screen

**FACT:** Hiebert & Grouws (2007) define productive struggle as intellectual effort to make sense of mathematics that is not immediately apparent — sense-making, not despair.

**FACT:** Warshauer (2015, *Journal of Mathematics Teacher Education*, 18, 375–400, doi:10.1007/s10857-014-9286-3) — 186 classroom struggle episodes; taxonomy of struggle types (get started, carry out process, explain, misconception/error) and teacher responses (telling → affordance). Productivity judged by maintaining cognitive demand, addressing the struggle, and building on student thinking — not by duration alone.

**FACT (PF design):** Kapur (2014, *Cognitive Science*, 38, 1008–1022) — productive *failure* is sequenced generation then consolidation, not any unsuccessful miss. Full PF sequencing is queue id 94; this chapter bans mislabeling every miss as “productive failure.”

**Applied (HYPOTHESIS):** Detect **progress markers** during dwell (partial work, SE draft, diagram marks). Progress + TOT → wait/cue. No progress + peek urgency / affect → soft scaffold. Freeze → earlier help (optional SAFE-EXPOSE), not Struggle Score™.

**Kill:** “We maximize productive struggle” measured as blank minutes.  
**Survive:** Sense-making effort with demand maintained; telling as last grain (Warshauer continuum ≈ SAFE-HINT soft→hard).

---

## XCIII.6 Anxiety blanking — different medicine than TOT

**FACT:** Ashcraft (2002, *Current Directions in Psychological Science*, 11(5), 181–185) — math anxiety as tension/fear that interferes with performance; associated educational and cognitive consequences.

**FACT:** Ashcraft & Kirk (2001, *Journal of Experimental Psychology: General*, 130(2), 224–237) — math anxiety relates to reduced working-memory capacity available for math; dual-task-like tax.

**Bridge to Part XLI:** Desirable difficulties that raise challenge without WM support can become *undesirable* under anxiety. Timed chrome, shame clocks, and public blank timers are anti-patterns (also SAFE-EXAM / SAFE-PDASH).

**Applied (HYPOTHESIS):**

| Signal (product proxies) | Likely mode | Default response |
|--------------------------|-------------|------------------|
| Partial work / self-report “almost” / slow edits | TOT / partial | Wait band + micro-cue; no full dump |
| Empty + rapid rage-click hint / affect spike | Freeze / blank | Soft instrumental after short bound; lower timer salience |
| Wrong worked path | Commission | Soft-wrong + SE before wrap (SAFE-EXPLAIN) |
| Idle + no interaction + skip | Avoidance | Help-invite (SAFE-HELP); do not score as grit |
| Generation phase before teach (designed) | PF (id 94) | Separate experiment arm — not default Practice miss |

**Kill:** One dwell timer policy for all stalls; shame countdown.  
**Survive:** Mode-contingent clocks and scaffolds.

---

## XCIII.7 Product surface — SAFE-RETRIEVE claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Practice first stall | Classify; TOT → cue; freeze → soft soon | Instant hard peek |
| Soft-wrong | Attempt counted as retrieval work | Treat miss as moral failure |
| Hint ladder | Soft before hard; SE cost (SAFE-HINT) | Free bottom-out menu |
| Timers | Bound waits; no public blank shame | Struggle Score™ / blank-seconds XP |
| Coach copy | “Keep searching” only with a cue path | Empty pep / “embrace struggle” poster |
| Exam / prove rail | KR timing per SAFE-FBTIME / SAFE-EXAM | Flood after first blank |
| Tutor HITL | Prompt; name mode in brief | “Let them suffer” cosplay |
| Parent view | “Attempt before coach” honesty | “Never stuck” or “max struggle minutes” |
| Marketing | Recoverable difficulty + mode-smart help | Struggle theater / answer-dump hero |
| Analytics | `stall_mode`, `cue_shown`, `attempt_before_help`, `retry_120s` | Struggle Score™ / dwell-as-virtue |

**Competitive foil:** ChatGPT = zero attempt dump. Duo = streak through shallow items. “Grit” apps = blank-time theater. MindCraft = **mode-contingent retrieval support** under FEI.

---

## XCIII.8 Doctrine — SAFE-RETRIEVE (provisional)

1. **Name the mode** — TOT/partial ≠ blank/freeze ≠ PF design ≠ avoidance.  
2. **Attempt before heavy help** — unsuccessful retrieval + feedback can potentiate (Kornell/Bjork line).  
3. **TOT → wait + micro-cue** — preserve search; do not replace with lecture.  
4. **Freeze → bounded soft scaffold** — anxiety–WM honesty; no endless stew.  
5. **Progress marks productive struggle** — not clock alone (Warshauer / Hiebert).  
6. **No Struggle Score™** — ban blank-seconds / dwell-XP / “maximize struggle” NS.  
7. **No never-stuck dump brand** — ban executive rescue as identity.  
8. **Proof** — `retry_120s`, near/solo transfer, lower freeze-binge peeks — not pep NPS.

**Confidence:** High that TOT is a studied metacognitive state distinct from mere absence of knowledge (Brown & McNeill; Schwartz & Metcalfe, 2011). High that failed retrieval + feedback can enhance later learning (Kornell, Hays & Bjork, 2009; Richland et al., 2009). High that productive struggle is sense-making effort, not duration (Hiebert & Grouws; Warshauer, 2015). High that anxiety taxes WM (Ashcraft line). Medium on automatic stall-mode classifiers in-product — run RETRIEVE-* + qual. High that one-size “always wait” or “always hint” will fail FEI.

---

## XCIII.9 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| RETRIEVE-1 | TOT micro-cue vs instant soft hint vs wait-only on partial-work stalls | A/B/C | `retry_120s`; solve without hard peek; near transfer |
| RETRIEVE-2 | Freeze: short-bound soft scaffold vs long forced wait vs instant hard peek | A/B/C | Solo transfer; anxiety self-report; peek binge |
| RETRIEVE-3 | Require attempt before any help vs optional skip-to-coach | A/B | Delayed retention; `attempt_before_help` rate |
| RETRIEVE-4 | Progress-aware dwell (partial marks extend wait) vs fixed dwell timer | A/B | Transfer; freeze false-positives |
| RETRIEVE-5 | Parent CBC: “attempt then coach” vs “never stuck” vs “max struggle time” | CBC | WTP; trust (SAFE-WTP) |
| RETRIEVE-QUAL | 10 Maya: phenomenology of almost-have-it vs blank panic vs fruitful stuck | Qual | Mode codebook |

**Falsifier:** Instant hard peek wins delayed solo transfer *and* 26w identity equally on freeze *and* TOT stalls → still ban as brand vs ChatGPT; allow emergency reveal off default.  
**Falsifier:** Micro-cues never beat wait-only for TOT-class → keep wait bands; demote cue chrome.  
**Falsifier:** Parents reject attempt-first CBC entirely → rewrite (“short try, then a nudge”) before surrendering to never-stuck.

**Pre-register:** RETRIEVE-* before any “maximize productive struggle minutes / Struggle Score™ / never interrupt / never stuck” campaign (SAFE-LABMETA). Do not steal Kapur PF sequencing arms — those belong to id 94; this family owns *in-session stall response*.

---

## XCIII.10 So what for MindCraft commercially

- **Copy:** “When you’re stuck, we read the stuck — almost-there gets a nudge; freeze gets a next step.” Never “unlimited struggle” or “never stuck.”  
- **Product:** Stall-mode proxies; TOT cues; freeze-bound soft hints; attempt-before-help gate; no blank-time XP.  
- **Positioning:** Against answer-dump tutors *and* grit-theater apps; for recoverable, mode-smart difficulty.  
- **Metric:** `stall_mode`, `cue_shown`, `attempt_before_help`, `retry_120s` — demote Struggle Score™ / dwell-as-virtue.  
- **Kill list:** All-struggle≡productive; blank-time NS; always-wait; instant dump; never-stuck hero; errors-always-scar fear.  
- **Growth:** Parent decks sell attempt→coach honesty; tutors brief on mode naming (SAFE-HITL / SAFE-TALK).  
- **Vision:** Maya learns to stay with *almost* — and to accept a soft scaffold when the mind blanks — without becoming either helpless or performatively stuck.

---

## References (verified)

- Ashcraft, M. H. (2002). Math anxiety: Personal, educational, and cognitive consequences. *Current Directions in Psychological Science, 11*(5), 181–185. https://doi.org/10.1111/1467-8721.00196  
- Ashcraft, M. H., & Kirk, E. P. (2001). The relationships among working memory, math anxiety, and performance. *Journal of Experimental Psychology: General, 130*(2), 224–237.  
- Brown, R., & McNeill, D. (1966). The “tip of the tongue” phenomenon. *Journal of Verbal Learning and Verbal Behavior, 5*(4), 325–337.  
- Hiebert, J., & Grouws, D. A. (2007). The effects of classroom mathematics teaching on students’ learning. In F. K. Lester Jr. (Ed.), *Second handbook of research on mathematics teaching and learning* (pp. 371–404). Information Age.  
- Kapur, M. (2014). Productive failure in learning math. *Cognitive Science, 38*(5), 1008–1022. https://doi.org/10.1111/cogs.12107  
- Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval attempts enhance subsequent learning. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 35*(4), 989–998.  
- Kornell, N., & Vaughn, K. E. (2016). How retrieval attempts affect learning: A review and synthesis. In B. H. Ross (Ed.), *Psychology of Learning and Motivation* (Vol. 65, pp. 183–215). Academic Press.  
- Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect: Do unsuccessful retrieval attempts enhance learning? *Journal of Experimental Psychology: Applied, 15*(3), 243–257.  
- Schwartz, B. L., & Metcalfe, J. (2011). Tip-of-the-tongue (TOT) states: Retrieval, behavior, and experience. *Memory & Cognition, 39*(5), 737–749. https://doi.org/10.3758/s13421-010-0066-8  
- Warshauer, H. K. (2015). Productive struggle in middle school mathematics classrooms. *Journal of Mathematics Teacher Education, 18*(4), 375–400. https://doi.org/10.1007/s10857-014-9286-3  
