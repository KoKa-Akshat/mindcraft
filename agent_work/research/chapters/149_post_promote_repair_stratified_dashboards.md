# Part CXLIX — Post-Promote Repair Stratified Dashboards (Single vs Dual)

**Chapter status:** Living evidence + ops/QA brief — Researcher tick 2026-08-15 (UTC hour 09 → Researcher per rotation; researcher count since synthesizer v1.18 = 6 → Researcher)  
**Primary question:** After C4 admits via **single-rater**, **dual-rater**, or **TMPTRUST inherit**, how must MindCraft surface **post-promote repair** — without a pooled Kappa % North Star, Dual Rater Score™ vanity, “our IRR is science-backed” ads, or a single repair rate that hides which path is poisoning Map — so ops can revoke trust, retune DUALRATE triggers, and defend parent hole clocks with path-true integrity?  
**Owners:** HITL / bank QA · Engine (promote path tags + repair telemetry) · SAFE-PROMOTE / SAFE-DUALRATE / SAFE-TMPTRUST / SAFE-INSTRUMENT · Brand · Red Team  
**Commercial job:** Ship **SAFE-REPAIRSTRAT** densifying SAFE-DUALRATE × SAFE-PROMOTE × SAFE-INSTRUMENT (+ TMPTRUST / CAPPLAN): **stratified post-promote repair + agreement monitors** — path-split rates, contingency tables, drift alerts — never Kappa % as the learning or trust score.

**Builds on:** Parts CXL (SAFE-PROMOTE — post-promote repair rate foreshadowed), CXLIV (SAFE-DUALRATE), CXLVIII (SAFE-TMPTRUST — revoke on repair / sample discord), CXLVII (SAFE-CAPPLAN), XC (SAFE-INSTRUMENT), LX (SAFE-REPAIR), LXXII (SAFE-GENQ). Seams: `promote_path` ∈ {single, dual, inherit_sample, inherit_solo}; stratified repair dashboards; sample-dual contingency exports; no Kappa Score™ splash.

---

## CXLIX.1 Why this chapter exists

PROMOTE made post-promote repair a first-class metric. DUALRATE split admits into single vs dual. TMPTRUST added inherit + sample dual + revoke. INSTRUMENT forbade vanity KPIs as North Stars. The missing join: **one pooled repair % or one Kappa %** that looks green while inherit-solo silently demotes Map, or dual looks “worse” only because hard cases are routed there.

Failure modes: (1) pooled post-promote repair hides path poison; (2) Kappa % as ops NS / marketing hero; (3) Landis–Koch band costume as “almost perfect” brand; (4) dual path blamed for higher repair when selection (harder tickets) confounds; (5) no drift monitor → raters soften mid-exam-week; (6) Discord-emoji “agreement” theater.

**FOUNDER BELIEF under audit:** Parents and LEAs accept slower visual fill when ops can name **which admit path** failed and what tightened — more than a glossy IRR badge with no demote story.

**Claims we refuse:** Kappa % / Dual Rater Score™ / Agreement Minutes NS; pooled-only repair dashboards; “science-backed double-check” ads from a single κ; mammography-cosplay IRR heroes; ACT / complete-visual guarantees from dashboard packaging.

---

## CXLIX.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Promote path** | How the item entered C4 | `single` / `dual` / `inherit_solo` / `inherit_sample` | Untagged admits |
| **Post-promote repair** | Critical REPAIR or demote after C4 admit | Ticket + `hcelig_pass` clear | Leave broken in scan |
| **Stratified repair rate** | Repair incidence **by path** (and FormatId / cell) | Ops dashboard rows | Pooled-only vanity |
| **Pair agreement table** | Contingency of rater A vs B on dual/sample | Export for investigate | κ-only without table |
| **Rater drift signal** | Standards shift over time within rater | Trend / windowed alerts | One-shot κ forever |
| **SAFE-REPAIRSTRAT** | Stratified repair + agreement doctrine | This chapter | Kappa Score™ NS |

**Operational definition (HYPOTHESIS):** Post-promote QA monitoring is SAFE-REPAIRSTRAT-complete when (1) every C4 admit carries an immutable `promote_path` tag, (2) critical repair / demote events join back to that path within SLA, (3) ops dashboards show **path-stratified** repair rates (and cell/FormatId slices) before any pooled rollup, (4) dual and inherit-sample pairs store **raw contingency counts** (admit/reject/repair codes) — κ may be computed as a *diagnostic aide*, never as the sole displayed health, (5) windowed monitors flag path-specific repair spikes and sample-dual discord spikes (tighten TMPTRUST / DUALRATE / training), (6) parent-/LEA-facing copy never cites a Kappa % or “almost perfect agreement” band as product proof, and (7) instrumented events feed INSTRUMENT-style FEI-adjacent ops health — not DAU cosplay.

---

## CXLIX.3 Chance-corrected agreement is a tool — not a North Star

**FACT:** Cohen (1960, *Educational and Psychological Measurement, 20*(1), 37–46, doi:10.1177/001316446002000104) — κ corrects observed nominal agreement for chance agreement expected from marginal base rates; it is a **coefficient of agreement**, not a measure of educational impact or product quality by itself.

**FACT:** Landis & Koch (1977, *Biometrics, 33*(1), 159–174, doi:10.2307/2529310) — develop generalized kappa-type statistics for observer agreement on categorical data and popularize interpretive bands (slight → almost perfect); their framework also supports examining agreement structure beyond a single omnibus number (including stratified/observer-reliability analyses in the broader Landis–Koch program).

**Applied (HYPOTHESIS):** Dual/sample-dual QA may compute κ on promote decisions (admit vs reject vs send-to-repair) as a **process diagnostic**. Shipping “κ = 0.81 ⇒ almost perfect visual diagnostics” as marketing is a category error: κ says raters often match each other, not that Map diagnoses are true for Maya or that parents should trust a hole-fill date.

**Kill:** Kappa % NS; Landis–Koch band as brand hero. **Survive:** κ + contingency table as investigate tools behind ops login.

---

## CXLIX.4 High agreement can look “bad” on κ — and pooling hides that

**FACT:** Feinstein & Cicchetti (1990, *Journal of Clinical Epidemiology, 43*(6), 543–549, doi:10.1016/0895-4356(90)90158-l) — document **paradoxes** where observed agreement \(p_0\) is high yet κ is low when margins are imbalanced; a second paradox concerns asymmetrical vs symmetrical imbalance. They warn that omnibus κ alone can mislead.

**FACT:** Cicchetti & Feinstein (1990, *Journal of Clinical Epidemiology, 43*(6), 551–558, doi:10.1016/0895-4356(90)90159-m) — argue for reporting separate positive/negative agreement indexes alongside κ so operators can see *where* concordance lives.

**Applied (HYPOTHESIS):** Promote decisions are often **prevalence-skewed** (most sealed tickets admit). A lonely κ can tank while raw agreement stays high — or look fine while one path (inherit_solo) carries asymmetric repair. SAFE-REPAIRSTRAT requires **path strata + contingency (or \(p_{pos}/p_{neg}\)-style splits)** before celebrating or panicking on κ.

**Kill:** Single κ as promote health. **Survive:** Stratified repair + agreement components. **Wound:** Clinical binary markers ≠ figure-IR promote codes — borrow paradox warning, not medical cut-scores.

---

## CXLIX.5 Agreement is not stationary — monitor drift, not a launch-week κ

**FACT:** Myford & Wolfe (2009, *Journal of Educational Measurement, 46*(4), 371–389, doi:10.1111/j.1745-3984.2009.00088.x) — provide an operational framework for **monitoring rater performance over time**, detecting differential accuracy and differential scale-category use (DRIFT) as scoring progresses; some raters change accuracy or category use mid-campaign.

**FACT:** Sgammato & Donoghue (2017, *Applied Psychological Measurement, 42*(4), 307–320, doi:10.1177/0146621617730390) — evaluate Stuart’s Q for detecting **rater drift** in trend-scoring designs; show drift detection is a first-class monitoring problem, not a one-time IRR ceremony.

**Applied (HYPOTHESIS):** Exam-week LOADSHED and CAPPLAN pressure change rater behavior. SAFE-REPAIRSTRAT uses **rolling windows** of path-stratified repair and sample-dual discord (and optional trend-rescore of a sealed gold set) — not a frozen “κ at launch” plaque. When inherit_solo repair spikes, revoke TMPTRUST; when dual discord spikes on T4 IR, retrain or narrow triggers — do not “average it away” in a company κ.

**Kill:** One-shot IRR certificate. **Survive:** Windowed path monitors + revoke/tighten hooks. **Wound:** AP English Rasch DRIFT ≠ MindCraft promote codes — borrow *monitoring over time*, not many-facet Rasch as required stack.

---

## CXLIX.6 Higher-ambition use still needs stratified backing

**Reuse (Kane 2013):** More ambitious interpretations/uses need more backing; rejecting a use need not kill a weaker interpretation (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS):** Parent-facing “we dual-check diagram probes” is higher ambition than internal ops hygiene. A dashboard that shows only pooled repair while selling dual-check language is a Kane lie if dual volume is tiny and inherit_solo carries the repairs. Honest IUA: show **path mix** + stratified repair to leadership; external copy names seals + demote-on-repair without κ theater.

**Kill:** IRR badge as substitute for demote evidence. **Survive:** Stratified ops truth as backing for claimed uses.

---

## CXLIX.7 Selection confounding — dual is not “worse” by default

**HYPOTHESIS:** Dual and inherit_sample paths **select harder tickets** (T4 ambiguity, first-of-cell, self-flag). Higher raw repair or discord on dual can be **good triage**, not dual failure. Dashboards must show:

1. Repair rate by path (numerator = critical repairs attributed to admits from that path; denominator = admits on that path in window).  
2. Optional **risk-adjusted** view (e.g., within T-trigger strata) so dual is compared to single on comparable tickets — not a naive dual-vs-single shame board.  
3. Inherit_solo vs inherit_sample split — sample discord that does not revoke is SAFE-TMPTRUST theater.

**Kill:** “Dual has higher repair ⇒ kill dual.” **Survive:** Path + trigger-conditioned tables. **SPECULATION (low):** Exact risk model form — pre-register REPAIRSTRAT-*.

---

## CXLIX.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| κ corrects chance agreement for nominal categories | FACT | High | Cohen 1960 |
| Observer-agreement methodology + interpretive bands exist; omnibus κ is incomplete alone | FACT | High | Landis & Koch 1977; Feinstein/Cicchetti 1990 |
| High \(p_0\) can coexist with low κ under margin imbalance | FACT | High | Feinstein & Cicchetti 1990 |
| Rater standards can drift over a scoring campaign; monitoring over time is operationally warranted | FACT | High | Myford & Wolfe 2009; Sgammato & Donoghue 2017 |
| Higher-ambition uses need more backing | FACT | High | Kane 2013 |
| Path-stratified repair + contingency beats pooled κ as ops health | HYPOTHESIS | Medium–High | Needs REPAIRSTRAT-* |
| Parents prefer path-honest integrity stories over IRR badges | FOUNDER BELIEF | Medium | CBC × HOLETRUST |
| Landis–Koch bands are MindCraft product cut-scores | SPECULATION | Low | Refuse |
| Company κ predicts ACT gains | SPECULATION | Low | Refuse |

---

## CXLIX.9 Product surface — SAFE-REPAIRSTRAT claim contract

1. Tag every C4 admit with `promote_path` ∈ {`single`,`dual`,`inherit_solo`,`inherit_sample`} — immutable after write.  
2. Ops dashboard **defaults to stratified rows** (path × FormatId or path × concept cell); pooled rollup is secondary and labeled “descriptive only.”  
3. Dual / inherit_sample stores contingency counts (and optional \(p_{pos}/p_{neg}\)-style splits); κ is an optional drill-down, never the hero tile.  
4. Alerts: rolling-window repair spike by path; sample-dual discord spike → TMPTRUST revoke queue; dual discord spike → DUALRATE/training review.  
5. Ban Kappa % / Dual Rater Score™ / Agreement Minutes / “Almost Perfect” Landis band on student, parent, or marketing surfaces.  
6. Leadership weekly: path mix % + stratified repair + demote latency (PROMOTE) — not a single IRR badge.  
7. CAPPLAN may read dual discord / repair as **capacity quality** signals (rework), never as Dual Rater Score™.  
8. INSTRUMENT: events `c4_admit_path`, `post_promote_repair`, `sample_dual_discord`, `template_trust_revoke` — demote vanity scores.  
9. Ban Discord-emoji / same-uid agreement as dual evidence (reuse DUALRATE/TMPTRUST).  
10. Copy spine for ops/GTM: “We track which review path admitted a diagram probe — and we yank it when repair proves it wrong.” Ban “κ-certified visual diagnostic.”

---

## CXLIX.10 Doctrine — SAFE-REPAIRSTRAT (provisional)

1. **Stratify first** — path-tagged repair before pooled health.  
2. **κ is a drill-down, not a North Star** — Cohen/Landis tools stay behind the ops wall.  
3. **Show the table** — contingency / positive-negative agreement components beat omnibus vanity (Feinstein/Cicchetti warning).  
4. **Monitor drift** — windowed path rates + optional trend gold; launch-week κ is not a certificate (Myford/Wolfe; Sgammato/Donoghue).  
5. **Respect selection** — dual may look “worse” because it takes harder tickets; condition before blaming.  
6. **Wire revoke/tighten** — inherit repair → TMPTRUST revoke; dual discord storms → DUALRATE/CAPPLAN review.  
7. **Kane honesty** — do not sell dual-check IUA from unstratified dashboards.  
8. **No Kappa % / Dual Rater Score™ / Agreement Minutes NS**.  
9. **No ACT / complete-visual / “almost perfect agreement” guarantees** from IRR packaging.  
10. Copy spine: “Integrity is path-true demote evidence — not a single agreement percent.”

**Confidence:** High on Cohen/Landis/Feinstein–Cicchetti/Myford–Wolfe/Sgammato–Donoghue/Kane facts *with transfer limits*. Medium on exact window lengths, alert thresholds, and risk-adjustment formula. High that pooled κ-as-NS and unstratified repair are commercially toxic under TMPTRUST inheritance.

---

## CXLIX.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| REPAIRSTRAT-1 | Stratified path dashboard vs pooled-only repair % for ops decisions | Ops A/B | Time-to-revoke; illicit C4 draws after known poison |
| REPAIRSTRAT-2 | κ-hero tile vs contingency-first drill-down | Ops UX A/B | False panic/complacency; investigate quality |
| REPAIRSTRAT-3 | Windowed alerts (7d vs 28d) on inherit_solo repair spikes | Ops A/B | Revoke latency; false alarms; Map gold |
| REPAIRSTRAT-4 | Risk-conditioned dual-vs-single repair table vs naive shame board | Ops A/B | Mis-blame rate; trigger retune quality |
| REPAIRSTRAT-5 | Parent/LEA CBC: path-honest demote story vs “κ-certified dual-check” badge | CBC | Trust; WTP; backlash |
| REPAIRSTRAT-QUAL | Planted inherit_solo poison: does stratified alert beat pooled green κ? | Qual | REPAIRSTRAT codebook |

**Falsifiers:** Stratified dashboards increase ops time with no revoke/repair latency gain *and* Map gold equal → simplify UI but keep path tags in warehouse. κ-hero equals contingency-first on investigate quality → still ban κ on marketing; keep ops preference test. Windowed alerts thrash TMPTRUST with no poison catch → widen windows / raise thresholds; do not delete revoke path. Pre-register REPAIRSTRAT-* before “science-backed IRR” campaigns.

---

## CXLIX.12 So what for MindCraft commercially

- **Copy:** “When a diagram probe is wrong, we pull it — and we know whether it entered under single, dual, or template-inherit review.” Ban κ-certified / almost-perfect agreement heroes.  
- **Product:** Path-tagged admits; stratified repair dashboard; contingency drill-down; alert→revoke/tighten hooks.  
- **Growth:** Sell **auditable integrity** against ChatGPT fluency *and* against edtech that flashes a single IRR badge while clones leak.  
- **Positioning:** Ops maturity without psychometric cosplay — Kane-honest uses, Feinstein-aware metrics.  
- **Metric:** path-stratified post-promote repair; sample-dual discord; revoke latency — demote Kappa % / Dual Rater Score™.  
- **Kill list:** Kappa % NS; pooled-only repair vanity; Landis-band marketing; unconditioned dual-shame boards; ACT/complete-visual from IRR packaging.  
- **Vision:** Maya’s Map stays lit only while the **path that admitted the probe** still survives repair fire — and leadership can see which path is burning.

---

## References (verified)

- Cicchetti, D. V., & Feinstein, A. R. (1990). High agreement but low kappa: II. Resolving the paradoxes. *Journal of Clinical Epidemiology, 43*(6), 551–558. https://doi.org/10.1016/0895-4356(90)90159-m  
- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement, 20*(1), 37–46. https://doi.org/10.1177/001316446002000104  
- Feinstein, A. R., & Cicchetti, D. V. (1990). High agreement but low Kappa: I. The problems of two paradoxes. *Journal of Clinical Epidemiology, 43*(6), 543–549. https://doi.org/10.1016/0895-4356(90)90158-l  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics, 33*(1), 159–174. https://doi.org/10.2307/2529310  
- Myford, C. M., & Wolfe, E. W. (2009). Monitoring rater performance over time: A framework for detecting differential accuracy and differential scale category use. *Journal of Educational Measurement, 46*(4), 371–389. https://doi.org/10.1111/j.1745-3984.2009.00088.x  
- Sgammato, A., & Donoghue, J. R. (2017). On the performance of the marginal homogeneity test to detect rater drift. *Applied Psychological Measurement, 42*(4), 307–320. https://doi.org/10.1177/0146621617730390  
