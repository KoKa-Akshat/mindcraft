# Part CXLI — Exposure Cool-Down After Reveal Before Same-Stem C4

**Chapter status:** Living evidence + bank/selector brief — Researcher tick 2026-08-13 (UTC hour 21; hour%6≠0; researcher count since synthesizer v1.17 = 7 → Researcher)  
**Primary question:** After a student sees a **revealed** Practice stem (key/lights on), when — if ever — may that **same stem** enter that student’s **C4 hide-correctness** gap-scan — without answer-hunt Map poison, Cool-Down Score™ vanity, or thin-pool starvation that forces pad theater?  
**Owners:** Product (Practice / gap-scan selectors) · Engine (per-student exposure / cool-down clocks) · Bank / COVER / SCANCOMP · Brand · Red Team  
**Commercial job:** Ship **SAFE-COOLDOWN** densifying SAFE-SPLITPOOL × SAFE-SCANCOMP × SAFE-CALIB × SAFE-COLD × pool-exposure science: **per-student cool-down after reveal before same-stem C4** — never immediate dual-use, never forever global bans, never Cool-Down Minutes as North Star.

**Builds on:** Parts CXXXVII (SAFE-SPLITPOOL — foreshadows cool-down), CXXXVIII (SAFE-SCANCOMP — exposure caps under thin stock), CXXXIV (SAFE-HCELIG), LXXXI (SAFE-COLD), L (SAFE-CALIB), CXXV (SAFE-CONFMISS), LXXII (SAFE-GENQ), LXXXVII (SAFE-COVER), CXL (SAFE-PROMOTE). Seams: `revealed_at` / `cooldown_until` per (student, stem_id), isomorphic FormatId substitutes, hole flags when cool-down empties a cell, parent/student copy that does not call memory “diagnosis.”

---

## CXLI.1 Why this chapter exists

SAFE-SPLITPOOL named cool-down as a contract line; SAFE-SCANCOMP capped thin-stock exposure. The selector gap remains: **immediate same-stem C4** after reveal (key memory dressed as diagnosis); **forever/global bans** that starve FormatId cells into pad theater; **Cool-Down Score™**; **clone leak** (same figure, swapped digits). Doctrine: policy cool-down + isomorphic substitutes + honest holes — anti-answer-hunt without infinite-pool cosplay.

**FOUNDER BELIEF under audit:** Parents prefer a **shorter honest probe set** (or labeled hole) over a green Map cell earned by remembering tonight’s key — honesty as WTP, not a tax.

**Claims we refuse:** immediate same-stem C4 after reveal; forever/global locks as default; Cool-Down Score™ / Exposure Minutes NS; pad because cool-down emptied a cell; clone leak as “fresh”; ACT / complete-visual guarantees from cool-down packaging.

---

## CXLI.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Reveal event** | Student saw keyed feedback / worked path on a stem | Practice reveal; Solver dump (out of scope unless same stem) | Silent dual-use without clock |
| **Same-stem** | Identical `item_id` (and sealed isomorphic family) | Stem + figure + key family id | Clone leak |
| **Per-student cool-down** | Bar that student’s C4 draw of family until `cooldown_until` | Selector hard constraint | Global lock / forever ban |
| **Isomorphic substitute** | Different stem, same FormatId×concept ambition | Bank siblings under SCANCOMP | Same figure, swapped digits only |
| **Answer-hunt signal** | Latency/accuracy pattern consistent with key recall | Telemetry companion | Shame feed |
| **SAFE-COOLDOWN** | Reveal→C4 exposure doctrine | This chapter | Cool-Down Score™ |

**Operational definition (HYPOTHESIS):** After a **reveal-class** administration of stem family *F* to student *S*, *S*’s C4 selector **must not** draw any member of *F* until `now ≥ cooldown_until(S,F)`. Default policy window is a **session-scale to multi-day band** tuned by COOLDOWN-* (not a marketing “24h science” badge). During the window, prefer **isomorphic substitutes outside F** for the same FormatId cell; if none exist, emit `format_not_probed` / hole honesty (SAFE-SCANCOMP / SAFE-HOLETRUST) — **never** pad, **never** lift cool-down early to fill quotas. Cool-down is **per student**, not global. Exact duration is experiment-owned; the *existence* of a hard bar is doctrine.

---

## CXLI.3 Disclosure + reuse makes items easier — same-stem after reveal is the extreme case

**FACT:** Appelhaus, Werner, Grosse, & Kämmer (2023, *Medical Education Online, 28*(1), 2143298, doi:10.1080/10872981.2022.2143298) — in a large European medical school that began disclosing MCQs with keys, reused **disclosed** items were significantly easier (M difficulty coefficient 0.83) than reused non-disclosed (0.71) and new items (0.66); disclosure aids feedback/transparency but can cost item reliability when disclosed items are reused.

**Applied (HYPOTHESIS):** MindCraft Practice **intentionally discloses** keys for learning and REPAIR. That is pedagogically good (Butler & Roediger below) and psychometrically expensive for **same-stem diagnostic reuse**. Immediate C4 on a just-revealed stem is not “efficient bank use”; it is the Appelhaus problem at session timescale. Transfer limits: medical end-of-term exams ≠ teen gap-scan; the directional claim (disclosed reuse ≠ fresh measurement) still holds.

**Kill:** “They already practiced it, so diagnose on it now.”  
**Survive:** Reveal is a different use; cool-down before same-family C4.

---

## CXLI.4 Feedback after MC strengthens memory of the key — that is the point of Practice, the poison for C4

**FACT:** Butler & Roediger (2008, *Memory & Cognition, 36*(3), 604–616, doi:10.3758/MC.36.3.604) — feedback after multiple-choice testing increases later correct responses and reduces lure intrusions vs no feedback; educators should provide feedback when using MCQs.

**FACT:** Roediger & Marsh (2005, *Journal of Experimental Psychology: Learning, Memory, and Cognition, 31*(5), 1155–1159, doi:10.1037/0278-7393.31.5.1155) — multiple-choice testing can produce positive testing effects **and** negative suggestion from exposure to lures; selecting wrong alternatives can create false knowledge.

**Applied (HYPOTHESIS):** Practice reveal is designed to **install correct keys** and reduce lure damage. C4 hide-correctness is designed to measure **unassisted** competence + confidence without answer-hunting (SAFE-CALIB / SAFE-COLD). Re-administering the same stem minutes later with the key hidden measures **retention of tonight’s feedback**, not FormatId diagnosis. That confounds Map updates and CONFMISS recovery (confident false weakness / false strength).

**Kill:** Hide-correctness on a stem whose key the product just taught.  
**Survive:** Cool-down; probe with a different family member or leave a hole.

---

## CXLI.5 Spacing science says delay changes what a second encounter measures — it does not license “perfect cool-down AI”

**FACT:** Cepeda, Pashler, Vul, Wixted, & Rohrer (2006, *Psychological Bulletin, 132*(3), 354–380, doi:10.1037/0033-2909.132.3.354) — meta-analysis of distributed practice; inter-study interval and retention interval jointly affect final retention; optimal gaps grow with desired retention interval.

**Applied (HYPOTHESIS, careful transfer):** Cepeda et al. justify **that lag matters**, not a branded “scientifically perfect 47-hour cool-down.” For MindCraft, cool-down is a **validity gate for use ambition** (Kane: different interpretation), borrowing the insight that immediate re-test after feedback is a different cognitive event than a delayed unassisted probe. Do not ship Cool-Down AI / expanding-SRS theater as the product hero (SAFE-ADAPT / SAFE-SCHED bans still apply).

**Kill:** Perfect-interval cool-down marketing.  
**Survive:** Policy band + A/B; isomorphic substitutes; hole honesty.

---

## CXLI.6 Pool integrity and exposure control are ops policies — not folder aesthetics

**FACT:** Way (1998, *Educational Measurement: Issues and Practice, 17*(4), 17–27, doi:10.1111/j.1745-3992.1998.tb00632.x) — computerized programs must actively protect item-pool integrity; exposure and pool-management strategies matter under continuous delivery.

**FACT:** Georgiadou, Triantafillou, & Economides (2007, *Journal of Technology, Learning and Assessment, 5*(8)) — review of item-exposure control strategies for CAT (1983–2005); overexposure of popular items and underexposure of others are managed with explicit control procedures (including probabilistic approaches such as Sympson–Hetter–style methods discussed in that literature).

**FACT:** van der Linden, Ariel, & Veldkamp (2006, *Journal of Educational and Behavioral Statistics, 31*(1), 81–99, doi:10.3102/10769986031001081) — principled pool assembly / constrained selection improves control of content and exposure properties vs unconstrained greedy selection.

**Applied (HYPOTHESIS, careful transfer):** MindCraft is not selling high-stakes CAT security. Transferable: **exposure is a first-class selector constraint**. Per-student cool-down after reveal is the educational analogue of exposure control for *use compromise* (key known → hide-correctness pretends novelty). Under thin C4 stock (SAFE-SCANCOMP), constraints fail open into **holes**, not same-family reuse or Practice-only pad. Per-student family clocks + isomorphic preference beat global Sympson–Hetter theater.

**Kill:** Unconstrained “best item” draw that ignores recent reveal.  
**Survive:** Hard cool-down; constrained assembly with honest holes.

---

## CXLI.7 Thin pools: cool-down must not recreate pad theater

**Reuse (SAFE-SCANCOMP / SAFE-HOLETRUST / SAFE-COVER):** When sealed C4 stock for a FormatId cell is N=1–2, cool-down after Practice reveal can empty the cell for that student.

**HYPOTHESIS:** Empty cell ⇒ `format_not_probed` + parent/student honesty, **or** an out-of-family isomorphic C4 item if seals allow — **not** (a) lift cool-down, (b) pad with symbolic, (c) dual-write from Practice reveal as if it were C4. Promote backlog (SAFE-PROMOTE) remains the fill path for holes, not cool-down violation.

**Kill:** “Cool-down made the scan incomplete, so reuse the revealed graph.”  
**Survive:** Hole label; promote more C4 stock; isomorphic siblings.

---

## CXLI.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Disclosed reused MCQs become easier than new/undisclosed reused | FACT | High | Appelhaus et al. 2023 |
| Feedback after MC strengthens correct retention / reduces lure damage | FACT | High | Butler & Roediger 2008 |
| MC lures can create false knowledge without feedback | FACT | High | Roediger & Marsh 2005 |
| Spacing/lag jointly affect what a later test measures | FACT | High | Cepeda et al. 2006 |
| Pool exposure needs active management under continuous delivery | FACT | High | Way 1998; Georgiadou et al. 2007; van der Linden et al. 2006 (transfer limits) |
| Per-student cool-down after reveal before same-family C4 | HYPOTHESIS | Medium–High | Densifies SPLITPOOL × SCANCOMP × CALIB |
| Exact cool-down hours are settled science | SPECULATION | Low | Refuse badge; run COOLDOWN-* |
| Forever ban / global lock is required | SPECULATION | Low | Refuse |
| Parents prefer honest holes over answer-hunt greens | FOUNDER BELIEF | Medium | Needs COOLDOWN-* × HOLETRUST |

---

## CXLI.9 Product surface — SAFE-COOLDOWN claim contract

1. On reveal-class event for stem family *F* and student *S*, set `cooldown_until(S,F)` (hard selector bar for C4).  
2. C4 selector: **exclude** *F* for *S* while cool-down active; Practice may still use other families (and may re-practice *F* with reveal if pedagogy wants — that extends the clock).  
3. Prefer **out-of-family isomorphic** C4 substitutes for the same FormatId×concept cell.  
4. If no substitute ⇒ emit hole / `format_not_probed` — **never** pad; **never** early-lift cool-down for quota.  
5. Cool-down is **per student**, never global from one reveal.  
6. Define **family** wider than `item_id` when figure+key path is shared (clone seal).  
7. Telemetry: `reveal_at`, `cooldown_until`, `blocked_draw_count`, `substitute_used`, `hole_due_to_cooldown` — demote Cool-Down Score™ / Exposure Minutes.  
8. Copy: “We don’t re-quiz the same problem with the answer hidden right after we show the key.” Parent: “Diagnosis waits until a fresh problem — holes beat memory greens.”  
9. No ACT / complete-visual guarantees from cool-down packaging.  
10. Companion anti-gaming: rapid Practice-reveal→C4 attempts logged as answer-hunt signal for ops — not student shame feed.

---

## CXLI.10 Doctrine — SAFE-COOLDOWN (provisional)

1. **Reveal changes the use** — disclosed practice ≠ fresh hide-correctness evidence (Appelhaus; Kane ambition).  
2. **Per-student cool-down** before same-family C4 — hard bar, not soft suggestion.  
3. **Family > item_id** when clones share figure/key path.  
4. **Isomorphic substitutes first**; holes second; pad never.  
5. **No forever ban / no global lock** as default doctrine.  
6. **Duration is experiment-owned** — no perfect-interval Cool-Down AI brand.  
7. **Densifies SPLITPOOL × SCANCOMP** — exposure caps become clocks, not vibes.  
8. **No Cool-Down Score™ / Exposure Minutes / Lock Duration % NS**.  
9. **No ACT / identity / complete-visual guarantees** from cool-down packaging.  
10. Copy: “Fresh probe or honest hole — never memory dressed as diagnosis.”

**Confidence:** High on Appelhaus/Butler–Roediger/Roediger–Marsh/Cepeda/Way/Georgiadou/van der Linden as method sources (with CAT/medical transfer limits). Medium on exact hours, family-hash rules, and isomorphic-generation capacity (needs COOLDOWN-*). High that immediate same-stem C4 after reveal is commercially toxic (Map distrust + CALIB poison).

---

## CXLI.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| COOLDOWN-1 | Same-stem C4 allowed immediately after reveal vs hard cool-down | Selector A/B | False mastery / false weakness vs tutor gold; answer-hunt latency |
| COOLDOWN-2 | Cool-down 0 / ~1 session / ~3 days / ~7 days bands | Engine A/B | Map↔tutor agreement; hole rate; abandon |
| COOLDOWN-3 | Exact `item_id` cool-down vs family-hash (figure+key path) | Engine A/B | Clone leak rate; pool starvation |
| COOLDOWN-4 | Isomorphic substitute vs hole when cool-down empties FormatId cell | Product A/B | Format-route quality; HOLETRUST WTP |
| COOLDOWN-5 | Parent CBC: “fresh probe” honesty vs “we reuse for efficiency” | CBC | WTP; trust; abandon |
| COOLDOWN-QUAL | Planted: student revealed graph G then sees G in C4 — does Map write look like format mastery? | Qual | Codebook / tutor review |

**Falsifiers:** Immediate same-stem equals cool-down on Map↔tutor gold *and* no answer-hunt signals → audit instrumentation before collapsing cool-down; still prefer cool-down for liability/IUA clarity. Forever ban beats timed cool-down on gold without starving FormatId practice → reconsider duration upward, not pad. Family-hash never catches clones beyond item_id → simplify to item_id + human clone tagging. Pre-register COOLDOWN-* before “instant practice→diagnose on the same problem” campaigns.

---

## CXLI.12 So what for MindCraft commercially

- **Copy:** “We don’t hide the answer on the same problem we just showed you.” Parent: “Format diagnosis uses a fresh probe — or we leave a hole.”  
- **Product:** Per-student family cool-down clocks; isomorphic preference; hole emission; clone-family seals.  
- **Growth:** Sell **measurement honesty** vs competitors that recycle revealed stems into “adaptive diagnostics.”  
- **Positioning:** Against ChatGPT one-blob practice=test fluency *and* against edtech that treats bank reuse as free diagnosis.  
- **Metric:** blocked same-family draws; hole_due_to_cooldown; Map↔tutor gold — demote Cool-Down Score™.  
- **Kill list:** Immediate same-stem C4; forever/global lock defaults; pad under cool-down; Cool-Down Score™; ACT/complete-visual guarantees.  
- **Vision:** Maya’s Map records what she can do **without tonight’s key in working memory** — while Practice still gets to teach with the lights on.

---

## References (verified)

- Appelhaus, S., Werner, S., Grosse, P., & Kämmer, J. E. (2023). Feedback, fairness, and validity: Effects of disclosing and reusing multiple-choice questions in medical schools. *Medical Education Online, 28*(1), 2143298. https://doi.org/10.1080/10872981.2022.2143298  
- Butler, A. C., & Roediger, H. L., III. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition, 36*(3), 604–616. https://doi.org/10.3758/MC.36.3.604  
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354  
- Georgiadou, E. G., Triantafillou, E., & Economides, A. A. (2007). A review of item exposure control strategies for computerized adaptive testing developed from 1983 to 2005. *Journal of Technology, Learning and Assessment, 5*(8). https://ejournals.bc.edu/index.php/jtla/article/view/1647  
- Roediger, H. L., III, & Marsh, E. J. (2005). The positive and negative consequences of multiple-choice testing. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 31*(5), 1155–1159. https://doi.org/10.1037/0278-7393.31.5.1155  
- van der Linden, W. J., Ariel, A., & Veldkamp, B. P. (2006). Assembling a computerized adaptive testing item pool as a set of linear tests. *Journal of Educational and Behavioral Statistics, 31*(1), 81–99. https://doi.org/10.3102/10769986031001081  
- Way, W. D. (1998). Protecting the integrity of computerized testing item pools. *Educational Measurement: Issues and Practice, 17*(4), 17–27. https://doi.org/10.1111/j.1745-3992.1998.tb00632.x  
