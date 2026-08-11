# Part CXXII — Partial-Credit & Soft-Wrong Taxonomy Productization

**Chapter status:** Living evidence + Practice/Map mark-type brief — Researcher tick 2026-08-11 (UTC hour 03; hour%6≠0; researcher count since synthesizer v1.15 = 5 → Researcher)  
**Primary question:** How should MindCraft turn **miss types** (slip vs bug vs lack vs partial process) into product mark taxonomy — without gradebook cosplay, Partial Credit Score™ vanity, or treating every red X as the same mastery event?  
**Owners:** Product (Practice / Diagnostic / soft-wrong) · Engine (outcome events + misconception links) · HITL · Brand · Parent GTM · Red Team  
**Commercial job:** Ship **SAFE-TAXON** densifying SAFE-MISCON × SAFE-FBLIT × SAFE-FBTIME: **categorical mark types drive routing and graph updates**; soft-wrong remains destake + next move — never half-credit theater or a student-facing Partial Credit Score™.

**Builds on:** Parts XLIX (SAFE-MISCON), CXII (SAFE-FBLIT), LXXIX (SAFE-FBTIME), CXVIII (SAFE-SOFTMSG), L (SAFE-CALIB), LXXXIII (SAFE-PDASH), XC (SAFE-INSTRUMENT). Product seams: soft-wrong UX, Eedi `mis_` IDs, Layer-4 misconception memory, outcome severity, parent digest grain.

---

## CXXII.1 Why this chapter exists

SAFE-MISCON already kills “all wrongs are equal” as pedagogy. SAFE-FBLIT already kills delivery≡uptake. What remains commercially underspecified is the **product mark layer**: when Maya’s answer is wrong (or only partly right), what *type* of mark fires, what the student sees, what the graph updates, and what parents are told — without reinventing a gradebook.

Default edtech resolves this badly: (1) dichotomous green/red only, (2) “partial credit points” that teach gaming the rubric, (3) soft tone with no diagnostic category, (4) Partial Credit Score™ / Accuracy % as NS, (5) parent portals that show miss counts without grain. Competitors can ship warmer copy; few ship **inspectable mark types → route → retry** as the wedge.

**FOUNDER BELIEF under audit:** Soft-wrong is evaluation *climate*; taxonomy is evaluation *semantics*. Climate without semantics is empty kindness. Semantics without destake is gradebook cosplay. MindCraft needs both — and must refuse points-as-learning theater.

**Claims we refuse as doctrine:**
1. Soft-wrong ≡ automatic half-credit / points-for-almost.  
2. Partial Credit Score™ / Mark Minutes / Accuracy Ladder as student or parent NS.  
3. All incorrect outcomes update mastery the same way (slip ≡ bug ≡ blank ≡ guess).  
4. Gradebook cosplay (letter grades, % correct banners, live point stalk).  
5. Dichotomous-forever as the only honest assessment (kills diagnostic signal).  
6. Ordered PCM steps ≡ identity progress without FEI transfer.  
7. Empty “we celebrate mistakes” without named mark→route.  
8. ACT / grade guarantees from partial-credit packaging.

---

## CXXII.2 Constructs (taxonomy ≠ gradebook)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Dichotomous mark** | Correct / incorrect | Prove-rail KR; key verify | Loses process diagnosis |
| **Partial credit (psychometric)** | Ordered categories of completeness | Optional process steps for *routing*, not % NS | Points theater |
| **Categorical / concept-based score** | Nominal wrong *types* (slip, misconception, strategy) | Soft-wrong mark family + `misconception_id` | Composite Partial Credit Score™ |
| **Slip** | Random / careless error; knowledge present | Light retry cue; weak mastery hit | Treat slip as deep bug |
| **Bug / misconception** | Persistent wrong idea interfering with performance | Route to mis_ family / bridge / SE springboard | Soft tone only |
| **Lack / incomplete** | Missing knowledge or unfinished path | Scaffold / fade grain; not shame | Flood with full dump |
| **Soft-wrong** | Destaked informative miss + next move | Climate wrapper around a mark type | Kindness without type |
| **SAFE-TAXON** | Mark-type product law | This chapter | Gradebook cosplay |

**Operational definition (HYPOTHESIS):** A miss is *SAFE-TAXON complete* when the product (a) assigns a **named mark type** (at least: correct | slip | misconception/bug | lack/incomplete | blank/no-attempt | assist-tainted), (b) maps misconception/bug marks to a diagnostic family when available, (c) updates the graph with **type-conditioned** severity (not one red-X delta), (d) shows the student destaked next-move UX (soft-wrong climate), (e) never surfaces Partial Credit Score™ / % ladders as NS, and (f) proves value with `retry_120s` / `solo_transfer_pass` / type→route hit rate — not points recovered.

---

## CXXII.3 Partial credit is a measurement tool — not a North Star product

**FACT (PCM foundation):** Masters (1982, *Psychometrika, 47*, 149–174, doi:10.1007/BF02296272) — the Rasch Partial Credit Model treats responses scored in two or more *ordered* categories; category structure may vary by item; the model supports objective person/item comparisons from graded responses.

**FACT (dichotomous ≈ PC for some outcomes):** May, Koskey, Bostic, Stone, Kruse, & Matney (2023, *School Science and Mathematics, 123*(2), 54–67, doi:10.1111/ssm.12570) — on the PSM6 constructed-response problem-solving measure, Rasch dichotomous and partial-credit scorings yielded similarly strong psychometric findings; student outcomes correlated strongly/positively; similar demographic patterns. Either method can be appropriate for *that* instrument’s score uses — purpose and constraints decide.

**Applied (HYPOTHESIS):** MindCraft may use ordered process categories internally (e.g., no attempt → wrong join → right join wrong finish → full) for **routing and analytics**. It must not brand PCM-style ladders as “Partial Credit Score™ progress” or sell ordered steps as identity transformation. May et al. also remind: if the *use* is remediation and misconception ID, dichotomous alone is often the wrong *classroom* tool even when total scores correlate.

**Kill:** Partial Credit Score™ / % almost-right as FEI substitute.  
**Survive:** Ordered categories as engine grain when they change the next card — never as vanity NS.

**Wound:** PSM6 is a research assessment, not MindCraft Practice — TAXON-* must calibrate on soft-wrong + MC distractors specifically.

---

## CXXII.4 CAA partial credit — steps for diagnosis, not points theater

**FACT (computer-aided assessment):** Ashton, Beevers, Korabinski, & Youngson (2006, *British Journal of Educational Technology, 37*(1), 93–119, doi:10.1111/j.1467-8535.2005.00512.x) — paper exams normally award partial credit for correct working with wrong finals; binary CAA marks can diverge from that practice. PASS-IT experiments showed optional **steps** / redesigned items can mimic partial credit in automated assessment; feedback modes and expression capture matter; education should drive the tech pattern (not the reverse).

**Applied (HYPOTHESIS):** MindCraft’s analogue is **step / join grain** on Solver and multi-step Practice — mark *which* step failed (bridge vs arithmetic vs FormatId) and route — not award “3/5 points” as the student-facing product. Parent-facing truth: “stuck on the join” beats “72% partial credit.”

**Kill:** Points-for-working as the brand of soft-wrong.  
**Survive:** Optional step capture → mark type → principle-short coach (SAFE-EXPLAINQA) → retry.

---

## CXXII.5 Categorical wrongs beat correctness-only for learning uses

**FACT (concept-based categorical rubrics):** Arieli-Attali & Liu (2016, *Educational Psychology, 36*(6), 1083–1101, doi:10.1080/01443410.2015.1031088) — diagnostic uses are limited when item responses are scored only for correctness; concept-based **nominal** categories preserve error type and strategy information lost under conventional correctness rubrics; Multiple Correspondence Analysis showed categorical scores capture what correctness captures *plus* additional performance aspects crucial for learning.

**Applied (FOUNDER BELIEF → testable):** Soft-wrong taxonomy should prefer **nominal diagnostic categories** (slip / misconception / lack / blank / assist) over a single ordered “how close” number when the commercial job is routing. Closeness can be a secondary engine feature; type is primary for Map and coach.

**Kill:** Correctness-only telemetry as “we diagnose.”  
**Survive:** Category → family ID → next move; prove with route hit + transfer, not category count vanity.

---

## CXXII.6 Slips vs bugs — different updates, different coaches

**FACT (diagnostic assessment framing):** Ketterlin-Geller & Yovanoff (2009, *Practical Assessment, Research & Evaluation, 14*(16), doi:10.7275/vxrk-3190) — error analysis classifies errors into **slips** (random errors in declarative/procedural knowledge *not* from inherent domain misunderstanding) vs **bugs** (persistent misconceptions that consistently interfere). Identifying bugs is the primary interest of diagnostic assessment for instructional decisions; skills analysis that only flags “missed subtraction” without *why* has limited remediation utility.

**FACT (error-analysis tradition):** Radatz (1979, *Journal for Research in Mathematics Education, 10*(3), 163–172, doi:10.5951/jresematheduc.10.3.0163) — systematic error analysis has long diagnostic value for teachers; patterns matter more than isolated wrongs.

**Reuse (SAFE-MISCON):** Smith, diSessa & Roschelle — misconceptions are flawed *and* productive; refinement routes beat purge theater.

**Applied (HYPOTHESIS):** Graph update law: **slip** → small/no concept mastery hit + light retry; **bug/misconception** → stronger evidence + springboard SE + mis_ route; **lack** → scaffold/fade, not confrontation; **blank** → retrieval/help policy (SAFE-RETRIEVE / SAFE-HINT), not “wrong idea” labeling. Collapsing these into one red-X poisons both Map honesty and student identity.

**Kill:** One mastery delta for every miss.  
**Survive:** Type-conditioned outcomes + tutor briefs that distinguish slip vs bug (SAFE-HITL).

**Wound:** Teachers (and models) often confuse slips and bugs — product needs multi-signal classification (latency, confidence, distractor map, repeat pattern), not a single LLM guess as ground truth (SAFE-LABMETA / SAFE-EXPLAINQA).

---

## CXXII.7 Soft-wrong climate wraps taxonomy — it does not replace it

**Reuse (SAFE-MISCON / SAFE-ERRCLIMATE / SAFE-SOFTMSG):** Destake makes struggle survivable; parent copy after streaks must name grain + one CTA, not Miss Streak scoreboards.

**HYPOTHESIS:** Soft-wrong UX without taxonomy is Duo-with-nicer-copy. Taxonomy without soft-wrong is a gradebook. Product contract: **climate first, then typed mark, then actionable uptake** (SAFE-FBLIT).

**SPECULATION:** Parents will tolerate destake longer when digests say “pattern: equal-sign join (bug family)” than when they see “3 wrongs / 60% partial.” Honesty is categorical, not percentage theater.

**Kill:** Soft-wrong slogan without mark types; Partial Credit % parent widgets.  
**Survive:** Grain-named soft-wrong + type-private analytics for tutors/engine.

---

## CXXII.8 Product surface — SAFE-TAXON claim contract

| Mark type | Student sees | Graph / route | Banned substitute |
|-----------|--------------|---------------|-------------------|
| Correct | Destaked confirm / prove KR by mode | Positive evidence | Fireworks mastery belt |
| Slip | Soft retry cue; “check that step” | Weak negative / ignore if isolated | Deep misconception badge |
| Bug / misconception | Soft-wrong + SE / contrast + mis_ card | Stronger evidence; family link | Shame reel; purge language |
| Lack / incomplete | Soft scaffold / fade grain | Incomplete event; not “wrong theory” | Full solution dump default |
| Blank / no-attempt | Wait / tip / contingent hint policy | Non-commission event | Struggle Score™ for dwell |
| Assist-tainted | Labeled help path; solo gate later | Do not count as solo proof | Assisted≡ready banner |
| Metrics | `retry_120s`; type→route hit; `solo_transfer_pass` | — | Partial Credit Score™ / % |

**Competitive foil:** Khan/Duo = binary or XP. Grade apps = %. ChatGPT = fluent re-explain without type. MindCraft = **typed soft-wrong → route**.

---

## CXXII.9 Doctrine — SAFE-TAXON (provisional)

1. **Type before points** — every scored miss carries a mark type; points/% are not the product.  
2. **Soft-wrong wraps type** — climate is destake + next move; taxonomy is the semantic payload.  
3. **Slip ≠ bug ≠ lack ≠ blank** — different coaches and different graph updates (Ketterlin-Geller & Yovanoff).  
4. **Categorical > closeness for routing** — Arieli-Attali & Liu; ordered PCM steps optional for process grain only.  
5. **Steps diagnose joins** — Ashton et al. CAA lesson: capture where process breaks; do not sell partial marks as trophies.  
6. **No Partial Credit Score™ / gradebook cosplay** — no letter grades, live % stalk, or Miss Streak NS (SAFE-PDASH / SAFE-SOFTMSG).  
7. **Misconception families when known** — Eedi / Layer-1 links; else “untyped bug” + SE, not invented disease labels.  
8. **Human/audit for ambiguous type** — model classifier assists; sample audit; never LLM-type as sole authority.  
9. **Copy:** “We name the kind of miss — then the next move.” Never “earn partial credit like school.”

**Confidence:** High — Masters PCM existence; May et al. purpose-dependence; Ashton CAA steps; Arieli-Attali & Liu categorical gain; Ketterlin-Geller slips/bugs; Radatz diagnostic tradition. Medium — MindCraft auto-type accuracy and severity weights (needs TAXON-*). High — Partial Credit Score™ / all-wrongs-equal / gradebook cosplay as commercially toxic under FEI.

---

## CXXII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| TAXON-1 | Typed soft-wrong (slip/bug/lack) vs binary soft-wrong | A/B | `retry_120s`; `solo_transfer_pass`; route hit |
| TAXON-2 | Type-conditioned mastery deltas vs uniform miss delta | Offline + A/B | Calibration; transfer; false “mastered” |
| TAXON-3 | Step-join mark (CAA-style) vs final-answer-only | A/B multi-step items | Join repair rate; abandon |
| TAXON-4 | Parent digest: categorical grain vs partial-credit % | CBC | WTP; trust; nag/shame (SAFE-WTP/SOFTMSG) |
| TAXON-5 | Auto-type + human audit vs auto-type alone | Ops | False bug-rate; cost; tutor override |
| TAXON-QUAL | 10 students + 5 tutors: which mark language felt informative vs graded? | Qual | TAXON codebook |

**Falsifier:** Binary soft-wrong matches typed on transfer and route quality → keep private engine types; still ban Partial Credit Score™ NS.  
**Falsifier:** Points-for-almost raises retention without hurting solo transfer → still refuse % NS; segregate engagement.  
**Falsifier:** Auto-type equals human audit at acceptable risk → keep sample audit (SAFE-LABMETA).  
**Pre-register:** TAXON-* before “diagnostic partial credit” ads.  
**Family note:** TAXON-* densifies MISCON/FBLIT/FBTIME; do not collapse into Soft-Wrong Score™ or Partial Credit OKRs.

---

## CXXII.11 So what for MindCraft commercially

- **Copy:** “We name the kind of miss — then the next move.” Lead with typed soft-wrong, not school-style partial credit.  
- **Product:** Ship mark enum on outcomes; wire slip/bug/lack/blank to distinct coaches and graph deltas; optional step-join capture on multi-step items.  
- **Positioning:** Against binary apps, gradebook portals, and ChatGPT re-explain-without-type; for diagnostic climate that protects identity while updating Map honestly.  
- **Metric:** type→route hit, `retry_120s`, `solo_transfer_pass`, false-bug rate — demote Partial Credit Score™ / Accuracy %.  
- **Kill list:** Soft-wrong≡half-credit; all-wrongs-equal mastery; gradebook cosplay; Partial Credit Score™; ACT guarantees from taxonomy UI.  
- **Growth:** Trust packets show mark taxonomy + audit — procurement asset vs black-box “AI knows why you missed.”  
- **Vision:** Thirty-year identity company treats wrong answers as **typed information**, not moral failure or points residue — so Maya becomes someone who uses misses, not someone who collects partial credit.

---

## References (verified)

- Arieli-Attali, M., & Liu, Y. (2016). Beyond correctness: Development and validation of concept-based categorical scoring rubrics for diagnostic purposes. *Educational Psychology, 36*(6), 1083–1101. https://doi.org/10.1080/01443410.2015.1031088  
- Ashton, H. S., Beevers, C. E., Korabinski, A. A., & Youngson, M. A. (2006). Incorporating partial credit in computer-aided assessment of Mathematics in secondary education. *British Journal of Educational Technology, 37*(1), 93–119. https://doi.org/10.1111/j.1467-8535.2005.00512.x  
- Ketterlin-Geller, L. R., & Yovanoff, P. (2009). Diagnostic assessments in mathematics to support instructional decision making. *Practical Assessment, Research & Evaluation, 14*(16). https://doi.org/10.7275/vxrk-3190  
- Masters, G. N. (1982). A Rasch model for partial credit scoring. *Psychometrika, 47*, 149–174. https://doi.org/10.1007/BF02296272  
- May, T. A., Koskey, K. L. K., Bostic, J. D., Stone, G. E., Kruse, L. M., & Matney, G. T. (2023). Examining how using dichotomous and partial credit scoring models influence sixth-grade mathematical problem-solving assessment outcomes. *School Science and Mathematics, 123*(2), 54–67. https://doi.org/10.1111/ssm.12570  
- Radatz, H. (1979). Error analysis in mathematics education. *Journal for Research in Mathematics Education, 10*(3), 163–172. https://doi.org/10.5951/jresematheduc.10.3.0163  
