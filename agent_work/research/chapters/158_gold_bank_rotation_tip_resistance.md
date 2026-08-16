# Part CLVIII — Gold-Bank Rotation & Tip-Resistance under Rater Familiarity

**Chapter status:** Living evidence + ops/QA brief — Researcher tick 2026-08-16 (UTC hour 21; hour%6≠0; researcher count since synthesizer v1.19 = 7 → Researcher)  
**Primary question:** Once SAFE-GOLDSET plants sealed probes, how does MindCraft keep those probes from becoming a **memorized tip sheet** — without a **Gold Familiarity Score™**, forever-fixed canary plaque, or radiology-cosplay ACT ads?  
**Owners:** HITL / bank QA · Engine (`gold_probe_id` × exposure telemetry) · SAFE-GOLDSET / SAFE-REVOKE / SAFE-PANELRAMP · Brand · Red Team  
**Commercial job:** Ship **SAFE-GOLDROT** densifying SAFE-GOLDSET × SAFE-REVOKE × SAFE-PANELRAMP (+ FAMHASH/INSTRUMENT): **rotate and exposure-cap the sealed gold bank** so hit rates measure seal skill, not tip-channel recall — never Gold Familiarity Score™ splash.

**Builds on:** CLV (GOLDSET G5 foreshadowed rotate/refresh), CLI (REVOKE time windows), CLIII (PANELRAMP tip risk for contract panels), CXLV (FAMHASH clone seals), XC (INSTRUMENT). Seams: `gold_exposure_count` per rater×probe-family; rotation windows; tip-incident labels; no Gold Familiarity Score™.

---

## CLVIII.1 Why this chapter exists

GOLDSET killed sleeping-detector vanity and student-facing canaries. Rule **G5** already said: rotate / refresh the gold bank; audit for memorization. This chapter densifies that rule into product law before ops ship a **forever gold set** that raters learn the way examinees learn overexposed CAT items.

Wrong resolutions already visible:

1. **Fixed forever gold bank** — same 12 sealed tickets for a whole ACT season; hit rates inflate as familiarity rises.  
2. **Gold Familiarity Score™ / Tip Minutes NS** — vanity “anti-gaming health” sold as Map integrity.  
3. **Open tip sheets** — Slack/Discord “watch for the blue graph with the weird axis” destroys blindness (violates G2).  
4. **Rotate-everything chaos** — thrash the bank so hard that path×stratum cells never accumulate powered exposures (underpowered theater).  
5. **Hospital / exam-security cosplay ACT ads** — “we rotate canaries like CAT item pools” as readiness guarantee.  
6. **Panel-only tip risk ignored** — contract SME panels under PANELRAMP share tips faster than staff; gold stays static.

**FOUNDER BELIEF under audit:** Parents and LEAs accept “we rotate sealed QA tickets and cap how often any rater sees the same gold family” more than a Gold Familiarity Score™ plaque — and tutors accept rotation more than public tip-shame boards.

**Claims we refuse:** Gold Familiarity Score™ / Tip Minutes / Rotation Health % NS; fixed forever open gold; tip-channel theater; thrash-rotation that empties cells; ACT / complete-visual guarantees from rotation packaging; student-facing “spot the canary” games.

---

## CLVIII.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Gold bank** | Sealed tickets with known `expected_seal_outcome` | GOLDSET bank | Open list |
| **Exposure** | Times a rater (or panel cohort) saw a probe/family | `gold_exposure_count` | Untracked |
| **Familiarity / tip risk** | Hit inflation from memory or side-channel | Tip-incident + exposure cap | Familiarity Score™ |
| **Rotation** | Retire / replace / quarantine gold families on cadence | Rotation window + `gold_stale_set` | Forever plaque |
| **SAFE-GOLDROT** | Tip-resistant rotation doctrine | This chapter | Security cosplay ads |

**Operational definition (HYPOTHESIS):** Gold monitoring is SAFE-GOLDROT-complete when (1) each gold probe/family has a **documented exposure cap** per rater and per panel cohort before forced rotate/quarantine, (2) the bank **rotates on a pre-registered cadence** (and on tip-incident), not only when a Gold Familiarity Score™ dips, (3) hit/miss tables are **windowed** and optionally **exposure-conditioned** (first-N exposures vs later) so familiarity inflation is visible, (4) tip-channel incidents (shared keys, open lists, Slack screenshots) are labeled and fire REVOKE/PANELRAMP actions — never Tip Score™ splash, (5) rotation preserves path×stratum **coverage floors** (no thrash that empties hard dual cells), (6) gold still never leaks to student Map/C4, and (7) GOLDROT-* falsifiers are pre-registered before “science-backed tip-resistant canaries” campaigns.

---

## CLVIII.3 Fixed validity sets are already known to be costly and thin

**FACT:** Wang, Song, Wang, and Wolfe (2017, *Applied Psychological Measurement, 41*(1), 60–79, doi:10.1177/0146621616672855) — operational validity scoring often uses **fixed sets** of expert-scored essays seeded blindly; the procedure adds cost (expert true scores; rater minutes spent on monitoring rather than operational work) and coverage limits. They propose **adaptive** selection of validity responses to recover rater-effect parameters with fewer essays, and they explicitly evaluate **essay exposure** balance (chi-square style indices) across selection methods — random selection spreads exposure; information-greedy adaptive methods can **over-expose** some essays.

**Applied (HYPOTHESIS):** MindCraft’s risk is the dual of theirs: not only “too few informative golds,” but “the *same* golds seen too often by the same raters.” Rotation + exposure caps are the security twin of Wang et al.’s efficiency agenda. Adaptive Gold AI™ is still refused as brand (GOLDSET wound); prefer transparent caps + cadence first.

**Kill:** Forever-fixed gold plaque as season-long proof. **Survive:** Finite bank + documented rotate/replace + exposure telemetry.

---

## CLVIII.4 Validity monitoring is standard — blindness is the fragile part

**FACT:** Shin, Wolfe, and Wilson (2019, *Psychological Test and Assessment Modeling, 61*(2), 127–148) — operational human scoring commonly monitors with **validity papers** (expert consensus scores) seeded into queues; their study evaluates automated-engine scores as an alternate gold standard for monitoring under training.

**FACT:** McCaffrey, Casabianca, Ricker-Pedley, Lawless, and Wendler (2022, ETS Research Report RR-22-17, doi:10.1002/ets2.12358) — best-practice CR scoring treats **validity response monitoring** (embedded pre-scored samples) as a core real-time accuracy check; programs should **document** validity-response insertion rates and monitoring schemes, and act on validity + backrating data. Case material in the report illustrates roughly every-*n*th response as a validity insert for experienced pools.

**Applied (HYPOTHESIS):** Insertion-rate documentation is necessary but not tip-resistance. If the *identity* of those every-*n*th tickets is stable and discussable, raters can learn the set. Blind interleave (G2) plus **rotation** is what keeps the insert from becoming a training deck with an answer key.

**Kill:** “We insert validity tickets” as sufficient integrity copy without rotation/exposure claims. **Survive:** Documented insert rate **and** rotate/cap doctrine.

---

## CLVIII.5 Rater behavior drifts in time — familiarity is not the only clock

**FACT:** Myford and Wolfe (2009, *Journal of Educational Measurement, 46*(4), 371–389, doi:10.1111/j.1745-3984.2009.00088.x) — framework for monitoring rater performance **over time**; some raters’ accuracy or scale-category use **changed as scoring progressed**.

**FACT:** Congdon and McQueen (2000, *Journal of Educational Measurement, 37*(2), 163–178, doi:10.1111/j.1745-3984.2000.tb01081.x) — in a large writing program, daily severity estimates for many raters **differed** from whole-period averages; severity on the last day often differed from the first — casting doubt on single-calibration adjustments across a rating window.

**Applied (HYPOTHESIS):** Rising gold-hit rates across a window can mean (a) true seal skill improved, (b) severity/accuracy drifted toward the gold’s expected outcome by chance, or (c) **tip/familiarity**. SAFE-GOLDROT therefore requires **exposure-conditioned** views (hits on first exposures vs after cap threshold) and coupling to REVOKE time windows — not a single Gold Familiarity Score™.

**Kill:** “Hit rate went up = quality went up” without exposure conditioning. **Survive:** Windowed + exposure-split gold tables.

---

## CLVIII.6 Exposure control is a security problem — transfer carefully from CAT

**FACT:** Stocking and Lewis (1998, *Journal of Educational and Behavioral Statistics, 23*(1), 57–75, doi:10.3102/10769986023001057) — in continuous CAT environments, unconstrained selection **overexposes** highly informative items and threatens pool security; they develop methods to control exposure rates **conditional on ability**.

**Applied transfer (HYPOTHESIS):** Gold probes are not student CAT items. Borrow Stocking–Lewis’s *security motive* (cap how often an identity is seen) and *exposure telemetry*, not a student Practice CAT scheduler, and not “CAT-grade security” as ACT marketing. MindCraft caps are per **rater / panel cohort × gold family**, not per examinee θ. Broader Sympson–Hetter-style probabilistic controls in the CAT literature share the same motive; we do not brand them as product.

**Kill:** CAT-security cosplay ACT ads; “Sympson–Hetter inside” splash. **Survive:** Explicit exposure caps + rotate-on-breach for gold families.

---

## CLVIII.7 Ambition still follows Kane

**Reuse (Kane 2013):** Higher-ambition interpretations need more backing (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS) — IUA ladder for rotation:**

| Claim ambition | Required GOLDROT backing |
|----------------|--------------------------|
| “We rotate sealed QA tickets” | Cadence logs + retire/replace events |
| “Hits are not tip-inflated” | Exposure-conditioned hit tables; tip-incident rate |
| “Panelists stay blind under surge” | Cohort exposure caps + PANELRAMP parallel-run gold |
| “Complete visual / ACT integrity from rotation” | **Refuse** |

**Kill:** Complete-visual / ACT guarantees from rotation packaging. **Survive:** Laddered ops/LEA claims.

---

## CLVIII.8 Design rules (doctrine core)

**HYPOTHESIS — tip-resistant gold machine:**

| Rule | Requirement | Stop if… |
|------|-------------|----------|
| **R1** | Per-rater and per-panel-cohort **exposure cap** per gold family | Untracked repeats |
| **R2** | Pre-registered **rotation cadence** + rotate-on-tip-incident | Forever fixed set |
| **R3** | Report hits **first-N vs post-cap** before pooled season % | Familiarity Score™ only |
| **R4** | Tip channels (open lists, shared keys, screenshots) → labeled incident → REVOKE/PANELRAMP | Vibes-only “be careful” |
| **R5** | Rotation preserves path×stratum **coverage floors** | Thrash-empty hard cells |
| **R6** | FAMHASH: isomorphic gold clones count toward the **same family cap** | Clone leak as “fresh” |
| **R7** | Student firewall remains absolute (`gold_leak_to_student=0`) | Practice/C4 gold |
| **R8** | No Gold Familiarity Score™ / Tip Minutes / Rotation Health % NS | Vanity dash |

**Decision labels (ops, not scores):** `gold_fresh` | `gold_near_cap` | `gold_rotated` | `gold_tip_incident` | `gold_underpowered_after_rotate`. Ban Gold Familiarity Score™.

---

## CLVIII.9 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Fixed validity sets are costly and coverage-limited; adaptive selection can change exposure balance | FACT | High | Wang et al. 2017 |
| Validity-response embedding is standard CR monitoring practice; programs should document insert schemes | FACT | High | Shin et al. 2019; McCaffrey et al. 2022 |
| Rater severity/accuracy can drift across a rating window | FACT | High | Congdon & McQueen 2000; Myford & Wolfe 2009 |
| Uncontrolled overexposure threatens continuous-testing item security | FACT | High | Stocking & Lewis 1998 (CAT context) |
| Exposure-capped, rotating gold banks reduce tip-inflated hit rates vs forever-fixed banks | HYPOTHESIS | Medium–High | Needs GOLDROT-* |
| Readable exposure-split gold tables beat Gold Familiarity Score™ for LEA/ops trust | FOUNDER BELIEF | Medium | CBC later |
| Full Adaptive Gold AI™ / student CAT exposure scheduler required this quarter | SPECULATION | Low | Refuse |
| Rotation ≡ ACT-point or complete-visual proof | SPECULATION | Low | Refuse |

---

## CLVIII.10 Product surface — SAFE-GOLDROT claim contract

1. Ops: **exposure count** per rater×gold-family beside GOLDSET path×stratum hit table.  
2. Gold Familiarity Score™ / Tip Minutes splash **off**.  
3. Telemetry: `gold_family_id`, `gold_exposure_count`, `exposure_cap`, `rotated_at`, `tip_incident_id`.  
4. Rotation UI: retire/replace with **coverage-floor check** before apply.  
5. PANELRAMP: new panel cohorts start with **fresh** gold draws; shared tip → cohort quarantine.  
6. Copy (ops/LEA): “We rotate sealed QA tickets and cap repeats — so a green canary table isn’t a memorized tip sheet.”  
7. Ban CAT-security / radiology-canary ACT ads from rotation packaging.  
8. Couple tip incidents to REVOKE / PANELRAMP — not to tutor Tip Shame boards.  
9. Parent packets may mention rotation at L1; never child-facing canary hunts.  
10. Underpowered cells after rotate → accumulate; do not invent `gold_catch`.

---

## CLVIII.11 Doctrine — SAFE-GOLDROT (provisional)

1. **Familiarity is a threat model** — fixed gold becomes a tip sheet.  
2. **Cap then rotate** — exposure limits precede vanity scores.  
3. **Condition the hits** — first-N vs post-cap before season rollup.  
4. **Tip incidents are assignable causes** — label and route (Shewhart via REVOKE).  
5. **Coverage floors beat thrash** — rotation must not empty hard dual cells.  
6. **Family caps** — FAMHASH clones share the exposure budget.  
7. **Kane ladder** — rotation backs monitoring honesty, not ACT ads.  
8. **Panel cohorts are tip amplifiers** — PANELRAMP gets stricter gold hygiene.  
9. **No Gold Familiarity Score™ / Tip Minutes / Rotation Health % NS**.  
10. Copy spine: “We plant sealed QA tickets — and we **retire them before they become tips** — so the detector’s green light still means something.”

**Confidence:** High on Wang/Shin/McCaffrey/Myford–Wolfe/Congdon–McQueen/Stocking–Lewis facts *with transfer limits*. Medium on exact cap values and cadence (pre-register GOLDROT-*). High that Gold Familiarity Score™ and forever-fixed gold are commercially toxic.

---

## CLVIII.12 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| GOLDROT-1 | Fixed gold vs rotating+capped gold under simulated tip channels | Sim/ops | Hit inflation; time-to-detect real miss |
| GOLDROT-2 | Exposure-split UI vs Gold Familiarity Score™ board | Ops A/B | Wrong REVOKE; narrative accuracy |
| GOLDROT-3 | Aggressive thrash vs coverage-floor rotation | Sim | Underpowered hard cells; false calm |
| GOLDROT-4 | Panel cohort tip incident → quarantine vs ignore | Ops drill | Leak duration; repair spike |
| GOLDROT-5 | LEA CBC: rotation honesty vs Familiarity Score™ / CAT-security cosplay | CBC | Trust; backlash; WTP |
| GOLDROT-QUAL | Codebook: tip_incident → REVOKE vs PANELRAMP vs bank replace? | Qual | Action IRR (aide) |

**Falsifiers:** Rotation adds no tip-resistance lift over blind fixed gold → demote cadence (keep rare refresh). Caps collapse throughput without quality gain → raise caps with destake copy. Coverage floors fail after rotate → redesign bank size before marketing. Pre-register GOLDROT-* before tip-resistant canary campaigns.

---

## CLVIII.13 So what for MindCraft commercially

- **Copy:** “Sealed QA tickets that rotate — capped so they don’t become tip sheets.” Ban Gold Familiarity Score™ and CAT-security ACT ads.  
- **Product:** Exposure telemetry + rotate/retire workflow + tip-incident labels beside GOLDSET tables.  
- **Growth / positioning:** Integrity against vendors selling a static canary plaque or IRR badge while raters memorize the set.  
- **Metric:** exposures-to-cap; tip-incident rate; post-cap hit delta; `gold_leak_to_student` — demote Familiarity Score™.  
- **Kill list:** Forever-fixed gold; tip-channel theater; thrash-empty cells; complete-visual-from-rotation.  
- **Vision:** Maya’s Map is checked by probes that still surprise the checker.

---

## References (verified)

- Congdon, P. J., & McQueen, J. (2000). The stability of rater severity in large-scale assessment programs. *Journal of Educational Measurement, 37*(2), 163–178. https://doi.org/10.1111/j.1745-3984.2000.tb01081.x  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- McCaffrey, D. F., Casabianca, J. M., Ricker-Pedley, K. L., Lawless, R., & Wendler, C. (2022). Best practices for constructed-response scoring (ETS Research Report No. RR-22-17). Educational Testing Service. https://doi.org/10.1002/ets2.12358  
- Myford, C. M., & Wolfe, E. W. (2009). Monitoring rater performance over time: A framework for detecting differential accuracy and differential scale category use. *Journal of Educational Measurement, 46*(4), 371–389. https://doi.org/10.1111/j.1745-3984.2009.00088.x  
- Shin, H. J., Wolfe, E., & Wilson, M. (2019). Human rater monitoring with automated scoring engines. *Psychological Test and Assessment Modeling, 61*(2), 127–148.  
- Stocking, M. L., & Lewis, C. (1998). Controlling item exposure conditional on ability in computerized adaptive testing. *Journal of Educational and Behavioral Statistics, 23*(1), 57–75. https://doi.org/10.3102/10769986023001057  
- Wang, C., Song, T., Wang, Z., & Wolfe, E. (2017). Essay selection methods for adaptive rater monitoring. *Applied Psychological Measurement, 41*(1), 60–79. https://doi.org/10.1177/0146621616672855  
