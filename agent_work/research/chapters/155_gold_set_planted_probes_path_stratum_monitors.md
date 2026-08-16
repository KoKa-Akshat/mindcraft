# Part CLV — Gold-Set Planted Probes for Path×Stratum Monitors

**Chapter status:** Living evidence + ops/QA brief — Researcher tick 2026-08-16 (UTC hour 6 ≡ Red Team slot, but ch155 never written → prefer Researcher per rotation; researcher count since synthesizer v1.19 = 4 → Researcher)  
**Primary question:** How does MindCraft **know** that PATHBLAME / REPAIRSTRAT monitors still detect real quality failures — when path mix, dual selection, and repair rates can all look “healthy” while the detector is blind — without a **Gold Set Score™**, canary vanity NS, or hospital-cosplay ACT ads?  
**Owners:** HITL / bank QA · Engine (`promote_path` × `risk_stratum` telemetry) · SAFE-PATHBLAME / SAFE-REPAIRSTRAT / SAFE-INSTRUMENT · SAFE-REVOKE / SAFE-DUALRATE · Brand · Red Team  
**Commercial job:** Ship **SAFE-GOLDSET** densifying SAFE-PATHBLAME × SAFE-REPAIRSTRAT × SAFE-INSTRUMENT (+ REVOKE/FIGKEY/PROMOTE): **sealed, pre-keyed planted probes** (“validity tickets”) seeded into promote queues so path×stratum monitors have a known-signal check — never Gold Set Score™ splash, never student-facing canaries.

**Builds on:** CLII (PATHBLAME foreshadowed planted selection / planted quality-drop sims), CXLIX (REPAIRSTRAT), XC (INSTRUMENT), CLI (REVOKE Shewhart/CUSUM), CXLIV (DUALRATE), CXXXI (FIGKEY). Seams: `gold_probe_id`, `expected_seal_outcome`, path×stratum hit/miss tables; sealed from student Map; no Gold Set Score™.

---

## CLV.1 Why this chapter exists

PATHBLAME gave ops a blame procedure: stratify before dual/single shame. REPAIRSTRAT stratified post-promote repair. REVOKE watches inherit windows. Those dashboards still have a **meta-failure**:

> If the monitor never sees a *known* poison ticket, a green path×stratum table can mean “quality is fine” **or** “our detector is asleep.”

Wrong resolutions already visible:

1. **Gold Set Score™ / Canary Minutes NS** — vanity % agreement with experts sold as Map integrity.  
2. **Open canaries** — raters learn the planted set; gaming replaces monitoring (Shin/Wolfe/Wilson warn that validity-paper practice is standard *and* gameable if fixed).  
3. **Student-facing gold stems** — planted wrongs or seals leak into Practice/C4 and poison FEI or gap-scan.  
4. **Hospital/mammography canary cosplay ACT ads** — “we plant probes like radiology QA” as readiness guarantee.  
5. **Pooled gold hit-rate only** — ignores path×stratum (re-opens Berkeley aggregate error PATHBLAME killed).  
6. **Invent-work gold flood** — pad dual minutes with elective canaries after demob (violates SAFE-DEMOB).

**FOUNDER BELIEF under audit:** LEAs and parents accept “we periodically seed sealed tickets with known correct seals into rater queues and check catches by path and difficulty band” more than a Gold Set Score™ plaque — and tutors accept blind probes more than public shame boards.

**Claims we refuse:** Gold Set Score™ / Canary Minutes / Probe Hit % NS; open or student-facing planted stems; fluency soft-pass on gold; pooled-only gold vanity; ACT / complete-visual guarantees from canary packaging; invent-work gold pad.

---

## CLV.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Gold / validity set** | Pre-consensus tickets with known seal outcomes | Sealed FIGKEY + promote decision labels | Open list / student pool |
| **Planted probe** | Blindly seeded into operational queue | `gold_probe` flag invisible to rater UI | Rater tip-off |
| **Known signal** | Expected admit/deny / repair class | `expected_seal_outcome` | Soft vibes gold |
| **Path×stratum gold table** | Hit/miss by `promote_path` × risk band | PATHBLAME companion view | Pooled hit-% only |
| **SAFE-GOLDSET** | Planted-probe monitor doctrine | This chapter | Gold Set Score™ |

**Operational definition (HYPOTHESIS):** Path×stratum monitors are SAFE-GOLDSET-complete when (1) a **sealed gold bank** exists with expert-consensus seal outcomes (FIGKEY + promote decision), (2) probes are **blindly interleaved** into promote/dual queues at a pre-registered cadence (not invent-work pad), (3) hit/miss is logged by **`promote_path` × `risk_stratum`** before any pooled %, (4) gold tickets **never** enter student Practice/C4 Map writes, (5) gold bank rotates / is audited so fixed-set gaming fails, (6) miss patterns fire REVOKE / DUALRATE / PANELRAMP actions with Kane-ladder ambition matching the claim, and (7) instruments are `gold_hit_by_path_stratum`, `gold_exposure_count`, `gold_leak_to_student=0` — never Gold Set Score™ / Canary Minutes NS.

---

## CLV.3 Validity papers are standard ops — not a MindCraft invention

**FACT:** Shin, Wolfe, & Wilson (2019, *Psychological Test and Assessment Modeling, 61*(2), 127–148) — operational human scoring commonly monitors quality with **validity papers**: student responses pre-assigned **consensus scores by expert raters**, then **blindly seeded** into raters’ scoring queues so leaders can compare assigned scores to expert consensus and intervene when discrepancies are large. They cite monitoring needs in real time and over time (Myford & Wolfe, 2009).

**FACT:** Wang, Song, Wang, & Wolfe (2017, *Applied Psychological Measurement, 41*(1), 60–79, doi:10.1177/0146621616672855) — describe **validity scoring** as the current monitoring process: raters score fixed sets of validity essays with expert “true” scores, often **seeded into the queue blindly**; correspondence of assigned vs true scores flags questionable raters. They also document cost/coverage limits of small fixed validity sets and propose **adaptive** selection of validity responses to recover rater-effect parameters more efficiently (Rasch partial-credit framing).

**Applied (HYPOTHESIS):** MindCraft’s analogue is not essay score points — it is **seal / promote decisions** on FormatId tickets (admit C4, deny, flag repair class). Gold probes = validity tickets with known `expected_seal_outcome`. Blind seeding transfers; essay-rubric severity models transfer only as *monitoring architecture*, not as an ACT scoring product.

**Wound:** Wang et al. adaptive essay selection ≠ Adaptive Gold AI™ brand — prefer transparent cadence + stratum coverage first.

---

## CLV.4 Monitoring must watch drift over time — a static plaque is not a probe

**FACT:** Myford & Wolfe (2009, *Journal of Educational Measurement, 46*(4), 371–389, doi:10.1111/j.1745-3984.2009.00088.x) — framework for monitoring rater performance **over time**; indices for differential accuracy and differential scale-category use; AP English Literature operational illustration with multifaceted Rasch — some raters’ accuracy or category use **changed as scoring progressed**.

**Reuse (SAFE-REVOKE):** Shewhart (1931) chance vs assignable cause; Page (1954) CUSUM for persistent shifts.

**Applied (HYPOTHESIS):** Gold-hit tables need a **time window** (week / surge / demob phase), not a forever Gold Set Score™. A path×stratum cell that caught gold last month and misses this week is an assignable signal for REVOKE / PANELRAMP / DEMOB handover QA — not a seasonal “quality vibe.”

**Kill:** Launch-week gold plaque as ongoing proof. **Survive:** Windowed gold hit/miss + Shewhart/CUSUM into REVOKE.

---

## CLV.5 Hierarchical / multi-rater models warn: agreement alone is thin

**FACT:** Patz, Junker, Johnson, & Mariano (2002, *Journal of Educational and Behavioral Statistics, 27*(4), 341–384, doi:10.3102/10769986027004341) — hierarchical rater model (HRM) for polytomous rated items treats examinee responses as latent and models **rater proficiency** (accuracy) alongside examinee proficiency; compares to Facets-style approaches; aims to improve rating-process quality using information about consensus and individual rater severity/consistency.

**Applied (HYPOTHESIS):** Pooled “raters agreed with gold 92%” is the thin index class PATHBLAME/REPAIRSTRAT demoted. Prefer **where** misses land (path × stratum × seal type). Dual missing hard-stratum gold while single looks green is a **quality_signal** candidate; dual missing only because gold was never seeded into hard strata is a **coverage** failure, not Dual Shame.

---

## CLV.6 Ambition of the claim still follows Kane

**Reuse (Kane 2013):** Higher-ambition interpretations need more backing; rejecting a use need not kill a weaker interpretation (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS) — IUA ladder for gold probes:**

| Claim ambition | Required gold backing |
|----------------|----------------------|
| “We seed sealed QA tickets into rater queues” | Cadence logs + `gold_leak_to_student=0` |
| “Monitors still catch known seal failures” | Path×stratum hit rates above pre-registered floor in powered cells |
| “Dual protects hard diagram admits” | Hard-stratum gold catches on dual ≥ single (or better) — PATHBLAME B2 |
| “Complete visual diagnostic integrity” | **Refuse** — gold ≠ coverage (SAFE-COVER / SCANCOMP) |

**Kill:** Complete-visual / ACT guarantees from canary packaging. **Survive:** Laddered claims tied to gold evidence grain.

---

## CLV.7 Design rules (doctrine core)

**HYPOTHESIS — gold probe machine:**

| Rule | Requirement | Stop if… |
|------|-------------|----------|
| **G1** | Expert-consensus seal outcome locked before seed | Soft/unkeyed gold |
| **G2** | Blind interleave; rater UI hides `gold_probe` | Tip sheets / open list |
| **G3** | Cover path × stratum blueprint (incl. dual hard cells) | Only easy single gold |
| **G4** | Never write gold outcomes to student Map / C4 / Practice | Leak flag |
| **G5** | Rotate / refresh gold bank; audit for memorization | Fixed forever set |
| **G6** | Report hit/miss **by path×stratum** before pooled % | Scoreboard-only |
| **G7** | Misses route to REVOKE / DUALRATE / PANELRAMP playbooks | Vanity log only |
| **G8** | Cadence pre-registered; no invent-work gold pad under DEMOB | Utilization theater |

**Decision labels (ops, not scores):** `gold_catch` | `gold_miss` | `gold_underpowered_cell` | `gold_leak` | `gold_stale_set`. Ban Gold Set Score™ numeric vanity.

---

## CLV.8 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Blindly seeded validity papers with expert consensus scores are a documented operational monitoring practice | FACT | High | Shin et al. 2019; Wang et al. 2017 |
| Fixed small validity sets have cost/coverage limits; adaptive selection can improve efficiency in simulations | FACT | High | Wang et al. 2017 |
| Rater accuracy / category use can drift during a scoring window | FACT | High | Myford & Wolfe 2009 |
| HRM-style models treat rater proficiency as estimable alongside examinee proficiency | FACT | High | Patz et al. 2002 |
| Control charts / CUSUM detect assignable shifts better than static plaques | FACT | High | Shewhart 1931; Page 1954 (via REVOKE) |
| MindCraft seal/promote gold probes will catch path×stratum monitor blindness better than repair tables alone | HYPOTHESIS | Medium–High | Needs GOLDSET-* |
| Readable path×stratum gold tables beat Gold Set Score™ for LEA trust | FOUNDER BELIEF | Medium | CBC later |
| Adaptive Gold AI™ / full HRM scoring product is required this quarter | SPECULATION | Low | Refuse |
| Planted probes ≡ ACT-point or complete-visual proof | SPECULATION | Low | Refuse |

---

## CLV.9 Product surface — SAFE-GOLDSET claim contract

1. Ops screen: **gold hit/miss by path × risk_stratum** adjacent to PATHBLAME B2 repair table.  
2. Gold Set Score™ / Probe Hit % splash **off**; require authority to enable pooled rollup.  
3. Telemetry: `gold_probe_id`, `expected_seal_outcome`, `observed_seal_outcome`, `promote_path`, `risk_stratum`, `gold_leak_to_student`.  
4. Student surfaces: **zero** gold stems in Practice / gap-scan / Solver.  
5. Copy (ops/LEA): “We seed sealed tickets with known correct seals into QA queues and check catches **by path and difficulty band**.”  
6. Ban hospital canary / radiology-QA cosplay ACT ads.  
7. Underpowered cells → accumulate exposures; do not invent `gold_catch` from n=2.  
8. Couple misses to REVOKE / DUALRATE / PANELRAMP — not to tutor Dual Shame boards.  
9. DEMOB / SURGEPANEL: gold cadence may **throttle** with λ, never invent-work pad.  
10. Parent packets may mention sealed QA probes; never child-facing canary games.

---

## CLV.10 Doctrine — SAFE-GOLDSET (provisional)

1. **Known signal before trust** — green PATHBLAME tables need planted-poison checks.  
2. **Blind seed** — validity-paper practice transferred to seal/promote tickets.  
3. **Path×stratum first** — pooled gold % is secondary (Berkeley lesson).  
4. **Student firewall** — gold never writes Map / C4 student evidence.  
5. **Time-aware** — windowed hits + Shewhart/CUSUM into REVOKE; no forever plaque.  
6. **Kane ladder** — gold backs monitoring claims, not complete-visual ads.  
7. **Rotate the set** — fixed open gold becomes a game.  
8. **No invent-work gold** under demob utilization pressure.  
9. **No Gold Set Score™ / Canary Minutes / Probe Hit % NS**.  
10. Copy spine: “We plant sealed QA tickets with known answers into rater queues — and we read catches **inside path×difficulty bands**, so a green Map isn’t just a sleeping detector.”

**Confidence:** High on validity-paper / Myford–Wolfe / Wang et al. / Patz et al. / Shewhart–Page facts *with transfer limits*. Medium on exact seed rates and gold-bank size (pre-register GOLDSET-*). High that Gold Set Score™ vanity and student-facing canaries are commercially toxic.

---

## CLV.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| GOLDSET-1 | Blind gold seed vs repair-table-only monitoring | Ops A/B | Time-to-detect planted seal miss; false calm weeks |
| GOLDSET-2 | Path×stratum gold UI vs pooled Gold Set Score™ board | Ops A/B | Wrong REVOKE/kill-dual; narrative accuracy |
| GOLDSET-3 | Planted hard-stratum dual miss — does B2+gold catch faster than κ? | Sim | Detection lag; CAPPLAN waste |
| GOLDSET-4 | Fixed open gold vs rotating sealed gold under tip-risk | Sim/ops | Gaming rate; hit inflation |
| GOLDSET-5 | LEA CBC: path×band canary honesty vs Gold Set Score™ / radiology cosplay | CBC | Trust; backlash; WTP |
| GOLDSET-QUAL | Codebook: gold_miss → which playbook (REVOKE/DUALRATE/PANELRAMP)? | Qual | Action IRR (aide) |

**Falsifiers:** Gold adds no detection lift over PATHBLAME tables → demote cadence (keep rare smoke). Gold increases rater fear / throughput collapse without quality gain → redesign seed rate + destake copy. Leak to student >0 → hard stop ship. Pre-register GOLDSET-* before “science-backed canary integrity” campaigns.

---

## CLV.12 So what for MindCraft commercially

- **Copy:** “Sealed QA tickets with known seals, planted blind, read by path and difficulty — so we know the detector still wakes.” Ban Gold Set Score™ and radiology-canary ACT ads.  
- **Product:** Gold bank + blind seed + path×stratum hit/miss beside PATHBLAME; leak alarm; REVOKE coupling.  
- **Growth / positioning:** Integrity that survives mix confounding *and* sleeping monitors — against IRR-badge vendors and “green dashboard” folklore.  
- **Metric:** gold exposures per path×stratum cell; miss→action latency; `gold_leak_to_student` — demote Gold Set Score™.  
- **Kill list:** Pooled gold vanity; open/student canaries; invent-work gold pad; complete-visual-from-canaries.  
- **Vision:** Maya’s Map is dual-checked on hard cells — and ops can prove the check isn’t a silent green lie.

---

## References (verified)

- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Myford, C. M., & Wolfe, E. W. (2009). Monitoring rater performance over time: A framework for detecting differential accuracy and differential scale category use. *Journal of Educational Measurement, 46*(4), 371–389. https://doi.org/10.1111/j.1745-3984.2009.00088.x  
- Page, E. S. (1954). Continuous inspection schemes. *Biometrika, 41*(1–2), 100–115. https://doi.org/10.1093/biomet/41.1-2.100  
- Patz, R. J., Junker, B. W., Johnson, M. S., & Mariano, L. T. (2002). The hierarchical rater model for rated test items and its application to large-scale educational assessment data. *Journal of Educational and Behavioral Statistics, 27*(4), 341–384. https://doi.org/10.3102/10769986027004341  
- Shewhart, W. A. (1931). *Economic control of quality of manufactured product*. D. Van Nostrand Company.  
- Shin, H. J., Wolfe, E., & Wilson, M. (2019). Human rater monitoring with automated scoring engines. *Psychological Test and Assessment Modeling, 61*(2), 127–148.  
- Wang, C., Song, T., Wang, Z., & Wolfe, E. (2017). Essay selection methods for adaptive rater monitoring. *Applied Psychological Measurement, 41*(1), 60–79. https://doi.org/10.1177/0146621616672855  
