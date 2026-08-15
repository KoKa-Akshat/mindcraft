# Part CLII — Path-Conditioned Dual Blame Tests (Selection vs Quality)

**Chapter status:** Living evidence + ops/QA brief — Researcher tick 2026-08-15 (UTC hour 21 → Researcher per rotation; hour%6≠0; researcher count since synthesizer v1.19 = 1 → Researcher)  
**Primary question:** When REPAIRSTRAT shows **higher raw repair or discord on dual / inherit_sample** than on single / inherit_solo, how must MindCraft decide whether that is **selection** (harder tickets routed to dual — good triage) vs **quality failure** (second-rater / process poison) — without Dual Shame Score™ boards, pooled κ theater, or “kill dual because the bar is red”?  
**Owners:** HITL / bank QA · Engine (`promote_path` + T-trigger + risk strata) · SAFE-REPAIRSTRAT / SAFE-DUALRATE / SAFE-CAPPLAN / SAFE-REVOKE · Brand · Red Team  
**Commercial job:** Ship **SAFE-PATHBLAME** densifying REPAIRSTRAT × DUALRATE × CAPPLAN (+ TMPTRUST/REVOKE): **path-conditioned, risk-stratified blame tests** — compare paths inside comparable ticket strata; never naive dual-vs-single shame.

**Builds on:** CXLIX (REPAIRSTRAT foreshadowed selection confounding), CXLIV (DUALRATE risk triggers), CXLVIII/CLI (TMPTRUST/REVOKE inherit paths), CXLVII (CAPPLAN dual minutes), XC (INSTRUMENT). Seams: `promote_path` × `dual_trigger` / risk stratum tables; selection-adjusted repair deltas; no Dual Shame Score™.

---

## CLII.1 Why this chapter exists

REPAIRSTRAT killed pooled repair vanity and warned: dual can look “worse” because DUALRATE **selects harder tickets** (T4 ambiguity, first-of-cell, self-flag). CAPPLAN and SURGEPANEL then put dual minutes under crunch. REVOKE reacts to inherit_solo poison. The missing join is **an ops-legal blame procedure**: before ops “fix dual,” “fire the second rater,” or “widen FILLETA because dual is broken,” the dashboard must answer — *same difficulty mix, different path?* or *same path, different difficulty?*

Failure modes: (1) naive dual > single repair ⇒ Dual Shame board / kill dual; (2) inherit_solo looks green only because easy clones inherit while hard stems go dual; (3) Propensity Theater™ / Causal DAG Score™ as NS; (4) hospital case-mix cosplay ACT ads; (5) silent ignore of path gaps when dual is politically sacred; (6) κ / Dual Rater Score™ as substitute for stratum tables.

**FOUNDER BELIEF under audit:** Leadership and LEAs accept “dual takes the hard tickets; within hard tickets, dual repair is flat/lower” more than a red dual bar that scares them into single-rater-only Map — if the tables are readable without biostat cosplay.

**Claims we refuse:** Dual Shame Score™ / Selection-Adjusted Repair % / Path Blame Minutes NS; unconditioned dual-vs-single rankings; “science-backed dual is safer” ads from naive path deltas; hospital case-mix / propensity cosplay as product brand; ACT / complete-visual guarantees from blame packaging.

---

## CLII.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Path mix** | Share of admits by `promote_path` | single / dual / inherit_solo / inherit_sample | Untagged admits |
| **Risk stratum** | Ticket difficulty / DUALRATE trigger class | T-trigger bucket; FormatId×cell hardness | Path-only tables |
| **Raw path repair** | Repair rate within path, unadjusted | REPAIRSTRAT row | Treated as causal |
| **Stratum-conditioned repair** | Repair within path **and** risk stratum | Primary blame table | Optional “nice to have” |
| **Selection story** | Dual volume concentrates in hard strata | Mix charts | Hidden |
| **Quality story** | Within stratum, path A worse than path B | Within-cell deltas | Dual Shame without strata |
| **SAFE-PATHBLAME** | Blame doctrine for path deltas | This chapter | Dual Shame Score™ |

**Operational definition (HYPOTHESIS):** Dual/path blame is SAFE-PATHBLAME-complete when (1) every admit carries immutable `promote_path` + `dual_trigger` (or `risk_stratum`) tags, (2) ops default view is **path × stratum** repair (and discord) before any pooled or path-only rollup, (3) “dual worse” claims require within-stratum evidence or an explicit selection narrative with mix charts, (4) CAPPLAN/DUALRATE/REVOKE actions that cite repair deltas must cite the conditioned table (or a pre-registered adjusted estimate), (5) κ / Dual Shame Score™ / Selection-Adjusted % are not North Stars or splash metrics, (6) parent/LEA copy may say “harder diagram tickets get a second check” without ranking paths by raw repair, and (7) PATHBLAME-* falsifiers are pre-registered before kill-dual campaigns.

---

## CLII.3 Aggregation reverses the story — condition on the department (stratum)

**FACT:** Bickel, Hammel, & O’Connell (1975, *Science, 187*(4175), 398–404, doi:10.1126/science.187.4175.398) — UC Berkeley graduate admissions: **aggregate** rates suggested bias against women; **department-stratified** rates showed little anti-woman bias and often the reverse. The aggregate pattern reflected **differential application mix** across departments with different admission difficulties — not a single pooled discrimination parameter.

**Applied (HYPOTHESIS):** Replace “department” with **risk stratum / DUALRATE trigger**, and “admit rate by sex” with **repair rate by promote_path**. Dual may show higher raw repair because it **applies into harder strata** (ambiguity, first-of-cell, surge IR), while single/inherit_solo apply into easier sealed clones. A Dual Shame board that ranks paths on raw repair is a Berkeley-aggregate error.

**Kill:** Path-only shame rankings. **Survive:** Mix chart + within-stratum tables. **Wound:** Admissions fairness ≠ item QA — borrow *stratify before blame*, not Title IX cosplay.

---

## CLII.4 Selection into the analysis set can invent associations

**FACT:** Berkson (1946, *Biometrics Bulletin, 2*(3), 47–53, doi:10.2307/3002000) — fourfold analyses on **hospital-selected** populations can show spurious disease associations because admission probabilities differ across conditions; the selected table is not the parent-population table.

**FACT:** Hernán, Hernández-Díaz, & Robins (2004, *Epidemiology, 15*(5), 615–625, doi:10.1097/01.ede.0000135174.63482.43) — unify many “selection bias” examples as **conditioning on a common effect (collider)** of variables related to exposure and outcome; distinguish that structure from confounding by common causes; argue diagrams clarify when associations among the selected are not the associations of interest.

**FACT:** Elwert & Winship (2014, *Annual Review of Sociology, 40*, 31–53, doi:10.1146/annurev-soc-071913-043455) — label **endogenous selection bias** as collider-conditioning (including Berkson-type cases); warn that bias can arise from analysis choices that condition on colliders even when no rows are discarded.

**Applied (HYPOTHESIS):** MindCraft’s dual path is a **selected set**: tickets enter dual because of triggers correlated with repair risk. Comparing dual vs single repair **unconditionally** estimates a mixture of (a) selection intensity and (b) path quality. Conditioning further on post-repair outcomes alone (e.g., only demoted items’ path mix) can open collider paths — ops should prefer **design strata fixed at promote time** (`dual_trigger`, hardness band) over outcome-conditioned blame slices.

**Kill:** “Dual repair high ⇒ dual causes Map poison” from selected aggregates. **Survive:** Promote-time strata + within-stratum contrasts. **Wound:** Do not require full do-calculus UI; require stratum discipline.

---

## CLII.5 When the question is causal (“does dual help?”), balance observed risk — don’t cosplay RCT

**FACT:** Austin (2011, *Multivariate Behavioral Research, 46*(3), 399–424, doi:10.1080/00273171.2011.568786) — propensity scores (probability of treatment given baseline covariates) support matching, stratification, weighting, or covariate adjustment so observational contrasts better approximate balanced comparisons on **observed** confounders; balance diagnostics matter; methods reduce confounding under stated assumptions, not magic.

**Applied (HYPOTHESIS):** Optional ops tool: estimate P(dual | risk features) or simply **stratify/match on DUALRATE trigger + FormatId + cell age**, then compare repair within matched/stratum sets. Prefer **transparent stratum tables** as default; propensity models are an advanced aide for CAPPLAN debates (“is dual worth minutes?”), never a Propensity Score™ splash or Dual Efficacy Guarantee.

**Kill:** Unadjusted dual-vs-single as causal proof. **Survive:** Stratum or matched contrasts before process change. **Wound:** Unobserved generator bugs can still confound — PATHBLAME does not replace FIGKEY/GENQ seals.

---

## CLII.6 Higher-ambition “dual protects Map” needs conditioned backing

**Reuse (Kane 2013):** More ambitious interpretations/uses need more backing; rejecting a use need not kill a weaker interpretation (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS):** Claiming “second checks catch hard diagram failures” is higher ambition than “we route hard tickets to dual.” IUA backing: (1) mix chart shows dual concentrates in hard strata, (2) within hard strata, dual discord/repair is not worse than single (or is better on pre-registered endpoints), (3) REVOKE still fires on inherit_solo poison. If only (1) holds, demote copy to routing honesty — do not sell dual as quality-proven from selection alone.

**Kill:** Dual-protects-Map ads from raw path bars. **Survive:** Conditioned evidence ladder.

---

## CLII.7 Blame procedure (doctrine core)

**HYPOTHESIS — before any “blame dual / blame single / kill inherit” action:**

| Step | Required view | Stop if… |
|------|---------------|----------|
| **B1** | Path mix by risk stratum (volume) | Mix unknown / untagged |
| **B2** | Repair (and sample discord) **within** each stratum by path | Only pooled or path-only rates exist |
| **B3** | Selection narrative: does dual’s excess raw repair vanish inside strata? | If yes → selection story; do not Dual-Shame |
| **B4** | If within-stratum dual worse → quality story: check rater drift, seal leaks, surge mix (SURGEPANEL), not κ alone | |
| **B5** | If inherit_solo worse inside easy strata → REVOKE/TMPTRUST, not “dual is fine so ignore” | |
| **B6** | CAPPLAN change that cites repair must paste stratum table id + window | ETA theater without B2 |

**Decision labels (ops, not scores):** `selection_explained` | `quality_signal` | `underpowered_stratum` | `tags_missing`. Ban Dual Shame Score™ numeric vanity.

---

## CLII.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Aggregate association can reverse or vanish after stratifying on a mix confounder | FACT | High | Bickel et al. 1975 |
| Hospital/selection mechanisms can induce spurious associations in selected tables | FACT | High | Berkson 1946 |
| Selection bias often shares a collider-conditioning structure distinct from confounding | FACT | High | Hernán et al. 2004; Elwert & Winship 2014 |
| Propensity methods can reduce confounding by observed baselines in observational contrasts | FACT | High | Austin 2011 |
| Dual vs single raw repair is not a causal quality ranking without stratum/mix discipline | HYPOTHESIS | Medium–High | Needs PATHBLAME-* |
| Readable stratum tables beat Dual Shame boards for ops and LEA trust | FOUNDER BELIEF | Medium | CBC later |
| Full propensity UI / DAG explorer is required product surface | SPECULATION | Low | Refuse |
| Case-mix adjustment ≡ ACT-point proof for dual | SPECULATION | Low | Refuse |

---

## CLII.9 Product surface — SAFE-PATHBLAME claim contract

1. Default REPAIRSTRAT screen: **path × risk_stratum** repair + volume; path-only chart secondary.  
2. Dual Shame / “worst path” leaderboards **off** by default; require authority + stratum paste to enable.  
3. Telemetry: `path_stratum_repair`, `path_mix_by_stratum`, `blame_label` ∈ {selection_explained, quality_signal, underpowered_stratum, tags_missing}.  
4. DUALRATE/CAPPLAN/REVOKE runbooks must reference B1–B6 before kill-dual or forever-dual.  
5. Copy: “Harder diagram tickets get a second check; we judge those checks **inside** difficulty bands — not by a raw dual bar.”  
6. Ban Propensity Score™ / Dual Shame Score™ / Case-Mix Minutes NS splash.  
7. Ban hospital/mammography case-mix cosplay ACT ads.  
8. Underpowered strata → accumulate or widen band; do not invent quality_signal from n=3.  
9. κ remains aide (REPAIRSTRAT), never blame verdict.  
10. Parent/LEA packets may show mix honesty; never child-facing Dual Shame.

---

## CLII.10 Doctrine — SAFE-PATHBLAME (provisional)

1. **Stratify before blame** — Berkeley lesson transferred to promote paths.  
2. **Selection ≠ quality** — dual’s hard-ticket mix is often the point of DUALRATE.  
3. **Promote-time strata** — prefer trigger/hardness tags over outcome-conditioned slices (collider caution).  
4. **Optional propensity/matching** — ops aide under Austin-style discipline; not brand.  
5. **Kane ladder** — dual-protects-Map needs within-stratum backing.  
6. **Couple to REVOKE** — inherit_solo poison still revokes even if dual looks “busy.”  
7. **Couple to CAPPLAN** — dual minutes defended only with selection-aware story.  
8. **No Dual Shame Score™ / Selection-Adjusted Repair % NS**.  
9. **No ACT / complete-visual / case-mix-cosplay guarantees** from blame packaging.  
10. Copy spine: “We send ambiguous diagram probes to a second rater — and we **compare repair inside the same difficulty band**, so we don’t punish the path that took the hard tickets.”

**Confidence:** High on Bickel / Berkson / Hernán / Elwert–Winship / Austin facts *with transfer limits*. Medium on exact stratum taxonomy and default bands (pre-register PATHBLAME-*). High that Dual Shame boards are commercially and epistemically toxic.

---

## CLII.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| PATHBLAME-1 | Path×stratum default UI vs path-only Dual Shame board | Ops A/B | Wrong kill-dual rate; time-to-correct narrative |
| PATHBLAME-2 | Planted selection (route hard→dual) with equal within-stratum quality — does shame board false-alarm? | Sim | False quality_signal rate |
| PATHBLAME-3 | Planted dual quality drop inside one stratum — does stratum table catch faster than κ/pooled? | Sim | Time-to-detect; CAPPLAN waste |
| PATHBLAME-4 | Matched/stratum-adjusted estimate vs raw delta for CAPPLAN “is dual worth it?” | Ops A/B | Decision stability; dual util |
| PATHBLAME-5 | LEA/parent CBC: mix+within-band copy vs Dual Shame % / case-mix cosplay | CBC | Trust; backlash; WTP |
| PATHBLAME-QUAL | Codebook: when do ops label selection_explained vs quality_signal in live weeks? | Qual | Label IRR (aide only) |

**Falsifiers:** Stratum tables≈path-only for decision quality → simplify to path-only (unlikely). Adjusted view increases wrong kill-dual → redesign strata/tags. Underpowered noise → mandatory minimum-n gates. Pre-register PATHBLAME-* before “dual is scientifically safer” campaigns.

---

## CLII.12 So what for MindCraft commercially

- **Copy:** “Second checks go to the hard diagram tickets — we read repair **inside** those bands so we don’t shame the path that did the hard work.” Ban Dual Shame leaderboards in sales decks.  
- **Product:** Path×stratum REPAIRSTRAT default; blame labels; runbook gates into DUALRATE/CAPPLAN/REVOKE.  
- **Growth / positioning:** Integrity analytics that survive mix confounding — against IRR-badge vendors and against “red bar = fire dual” ops folklore.  
- **Metric:** share of blame decisions with B2 table; false kill-dual rate; within-stratum dual vs single repair delta — demote Dual Shame Score™.  
- **Kill list:** Unconditioned dual shame; Propensity Theater™ brand; case-mix ACT cosplay; κ-as-verdict.  
- **Vision:** Maya’s Map earns dual minutes because hard cells are checked — and ops can prove the check isn’t a selection mirage.

---

## References (verified)

- Austin, P. C. (2011). An introduction to propensity score methods for reducing the effects of confounding in observational studies. *Multivariate Behavioral Research, 46*(3), 399–424. https://doi.org/10.1080/00273171.2011.568786  
- Berkson, J. (1946). Limitations of the application of fourfold table analysis to hospital data. *Biometrics Bulletin, 2*(3), 47–53. https://doi.org/10.2307/3002000  
- Bickel, P. J., Hammel, E. A., & O’Connell, J. W. (1975). Sex bias in graduate admissions: Data from Berkeley. *Science, 187*(4175), 398–404. https://doi.org/10.1126/science.187.4175.398  
- Elwert, F., & Winship, C. (2014). Endogenous selection bias: The problem of conditioning on a collider variable. *Annual Review of Sociology, 40*, 31–53. https://doi.org/10.1146/annurev-soc-071913-043455  
- Hernán, M. A., Hernández-Díaz, S., & Robins, J. M. (2004). A structural approach to selection bias. *Epidemiology, 15*(5), 615–625. https://doi.org/10.1097/01.ede.0000135174.63482.43  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
