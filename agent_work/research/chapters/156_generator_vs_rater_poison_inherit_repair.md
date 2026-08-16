# Part CLVI — Generator vs Rater Poison Separation on Inherit Repair

**Chapter status:** Living evidence + ops/QA brief — Researcher tick 2026-08-16 (UTC hour 15; hour%6≠0; researcher count since synthesizer v1.19 = 5 → Researcher)  
**Primary question:** When inherit-path repair spikes (SAFE-REVOKE / SAFE-REPAIRSTRAT), how does MindCraft **separate generator poison from rater poison** so the right playbook fires — without a **Generator Shame Score™**, Dual Shame theater, or blaming humans for clone/key bugs (and vice versa)?  
**Owners:** HITL / bank QA · Engine (`promote_path=inherit_solo` × repair class) · SAFE-REVOKE / SAFE-PATHBLAME / SAFE-GENQ / SAFE-FIGKEY · Brand · Red Team  
**Commercial job:** Ship **SAFE-POISONSEP** densifying SAFE-REVOKE × SAFE-PATHBLAME × SAFE-GENQ (+ FIGKEY/GOLDSET/TMPTRUST): **labeled poison sources** on inherit repair tickets — `generator_poison` vs `rater_poison` vs `ambiguous` — with distinct revoke / retrain / regen actions — never Generator Shame Score™ splash.

**Builds on:** CLI (REVOKE), CLII (PATHBLAME selection vs quality), CLV (GOLDSET known-signal), LXXII (GENQ), CXXXI (FIGKEY), CXLVIII (TMPTRUST). Seams: `poison_source` enum on repair tickets; family-level generator quarantine vs rater retrain; no Generator Shame Score™.

---

## CLVI.1 Why this chapter exists

REVOKE says: when inherit_solo repair spikes, tighten or revoke template trust. PATHBLAME says: do not shame dual before path×stratum. GOLDSET says: prove the monitor still wakes. GENQ/FIGKEY say: unverified keys and fluent figures poison Map.

The remaining ops failure is **misattribution**:

> A wrong seal on an inherit clone can mean (a) the **generator** emitted a bad key/figure/family draw, (b) the **rater** soft-passed or mis-sealed a good item, or (c) both / unknown. Treating all three as “rater quality” burns dual minutes and shames people for system faults; treating all three as “AI generation bad” freezes coverage and never retrains humans.

Wrong resolutions already visible:

1. **Generator Shame Score™ / Rater Blame % NS** — vanity leaderboards of “who poisoned Map.”  
2. **Always-blame-rater** — soft-pass culture assumed; ignore clone/key bugs (Glas family variability).  
3. **Always-blame-generator** — freeze inherit; never PANELRAMP/retrain when gold misses are rater-side.  
4. **Pooled repair % only** — re-opens PATHBLAME’s Berkeley aggregate error.  
5. **Hospital root-cause cosplay ACT ads** — “we separate process vs measurement like Six Sigma” as readiness guarantee.  
6. **Silent dual-write of ambiguous tickets as quality_signal** — forces Dual Shame without discrimination.

**FOUNDER BELIEF under audit:** Parents and LEAs accept “when a matching variant fails review, we say whether the bug was in generation or in human seal — and fix that lane” more than a Generator Shame Score™ or a dual-shame board; tutors accept labeled tickets more than unnamed inherit panic.

**Claims we refuse:** Generator Shame Score™ / Rater Poison Minutes / Blame Separation % NS; always-rater or always-generator dogma; pooled inherit repair as quality proof; ACT / complete-visual guarantees from root-cause packaging; MSA/AQL tables as product cut-scores.

---

## CLVI.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Generator poison** | Item/family content or key wrong before seal | GENQ/FIGKEY fail; clone drift | Blame rater for bad stem |
| **Rater poison** | Seal/promote decision wrong on a good ticket | Soft-pass; severity drift | Freeze generator forever |
| **Ambiguous** | Cannot yet separate sources | Needs gold / second seal / regen | Forced Dual Shame |
| **Poison label** | Ticket field for playbook routing | `poison_source` ∈ {gen, rater, ambiguous} | Unlabeled spike |
| **SAFE-POISONSEP** | Source-separation doctrine | This chapter | Generator Shame Score™ |

**Operational definition (HYPOTHESIS):** Inherit repair is SAFE-POISONSEP-complete when (1) every critical inherit repair ticket carries a **required** `poison_source` (gen / rater / ambiguous) before REVOKE or Dual Shame actions escalate, (2) **generator_poison** triggers family quarantine + regen/FIGKEY re-verify + TMPTRUST revoke without automatic rater CUSUM shame, (3) **rater_poison** triggers sample tighten / PANELRAMP / retrain without freezing a sealed family that gold still passes, (4) **ambiguous** routes to GOLDSET / dual re-seal before blame, (5) path×stratum tables keep separate columns for gen vs rater labels (PATHBLAME densifier), (6) instruments are `inherit_repair_by_poison_source`, `gen_quarantine_latency`, `rater_retrain_latency` — never Generator Shame Score™ / Blame Separation % NS.

---

## CLVI.3 Measurement itself is a process — do not confuse it with the product

**FACT:** Deming (1975, *Interfaces / American Scientist* tradition; essay “On Some Statistical Aids Toward Economic Production”) argues that **inspection/measurement must itself be viewed as a process** whose product is figures; unless measurement reaches statistical control, results are unreliable and become sources of strife — people fighting about numbers that mix process faults with gauge faults. He distinguishes system/common causes from local/special causes and warns that textbooks stop at special-cause detection while the larger problem is faults of the *system*.

**FACT:** Shewhart (1931, *Economic Control of Quality of Manufactured Product*) — chance vs assignable cause; control charts exist to separate them so workers are not punished for system noise (SAFE-REVOKE reuse).

**Applied (HYPOTHESIS):** Inherit repair rate mixes (a) generator/system variation and (b) rater/measurement variation. SAFE-POISONSEP is the ops analogue of “do not fire the operator for a bad gauge / do not redesign the line for a bad appraiser” — without AIAG %GRR cut-scores as ACT law (same wound class as ISO AQL in CLI).

**Kill:** Unlabeled inherit spike → automatic rater shame. **Survive:** Separate seal faults from item faults before action. **Wound:** MSA/hospital cosplay ads.

---

## CLVI.4 Clone families carry generator-side variability by design

**FACT:** Glas & van der Linden (2003, *Applied Psychological Measurement, 27*(4), 247–261, doi:10.1177/0146621603027004001) — item cloning induces **parameter variability** across clones; multilevel IRT treats clones as draws from a family distribution, not identical twins. Ignoring within-family variation mis-calibrates pools and adaptive selection.

**Reuse (SAFE-GENQ / FIGKEY):** MindCraft’s ~30% verify-drop lesson — fluent generation ≠ keyed correctness; figure keys fail silently under C4.

**Applied (HYPOTHESIS):** A cluster of inherit_solo repairs sharing `template_id` / FAMHASH with **consistent seal-type failures** (wrong key, wrong figure geometry, trap mismatch) is **generator_poison**-primary until proven otherwise — even if a single rater “should have caught it.” Quarantine the family, revoke TMPTRUST, regenerate/re-FIGKEY. Blaming the last human who touched a systematically bad draw is Deming-tampering.

**Kill:** “Rater should have caught it” as sole inherit narrative when family repair clusters. **Survive:** Family quarantine + regen as first move on clustered key/figure fails.

---

## CLVI.5 Automated production and human judgment are different quality surfaces

**FACT:** Bejar (2011, *Assessment in Education: Principles, Policy & Practice, 18*(3), 319–341, doi:10.1080/0969594X.2011.555329) — quality assurance for **automated scoring** should be aligned with **validity**, not treated as a separate admin ritual; quality must be **designed into** assessment components because scoring interdepends with task design and evidence extraction; defects in design erode score validity.

**FACT:** Bennett & Bejar (1998, *Educational Measurement: Issues and Practice, 17*(4), 9–17, doi:10.1111/j.1745-3992.1998.tb00631.x) — validity issues for automated scoring are **not only the scoring engine**; construct definition, task design, interface, and reporting interact with scoring.

**Applied (HYPOTHESIS):** MindCraft’s generator is closer to Bejar’s automated *production/design surface*; raters are the human judgment surface. Validity-aligned QA **names which surface failed**. One “QA fail %” collapses that separation.

**Kill:** Single “bank QA health” KPI as both gen and rater proof. **Survive:** Component-tagged defects (item model vs seal decision).

---

## CLVI.6 Rater monitoring literature is about humans — do not use it to diagnose generators

**FACT:** Myford & Wolfe (2009, *Journal of Educational Measurement, 46*(4), 371–389, doi:10.1111/j.1745-3984.2009.00088.x) — frameworks for monitoring **rater** accuracy and scale-category use **over time**; some raters drift as a campaign progresses.

**FACT:** Shin, Wolfe, & Wilson (2019, *Psychological Test and Assessment Modeling, 61*(2), 127–148) — compare automated-engine vs human-expert references for monitoring human raters; agreement with AE vs HE can diverge by effect type (severity vs accuracy), so AE-as-monitor is not a free substitute for expert consensus.

**Applied (HYPOTHESIS):** Gold probes and sample-dual discord that implicate **severity/accuracy on known-good seals** are **rater_poison** candidates (Myford/Wolfe; Shin et al.). Using the same CUSUM chart to “prove generators are bad” without item-level key audit is category error — generators do not have rater severity parameters. Conversely, using GENQ drop-rate alone to shame a panelist who soft-passed a verified-good clone is also category error.

**Kill:** One CUSUM board for “all inherit pain.” **Survive:** Dual instruments — family key/figure fail clustering (gen) vs gold/sample discord on sealed-good tickets (rater).

---

## CLVI.7 AIG literature still separates model quality from scoring judgment

**FACT:** Gierl & Lai (2013, *Medical Education, 47*(7), 726–733, doi:10.1111/medu.12202) — evaluate quality of **automatically generated** MC items vs traditional items via expert panel indicators; AIG can match traditional quality on most indicators, but distractor plausibility and expert review remain necessary — generation quality is assessed as **item production**, not as rater kindness.

**Applied (HYPOTHESIS):** When MindCraft inherits clones, expert/FIGKEY failure modes that look like Gierl/Lai item-quality indicators (implausible distractor, wrong key, stem defect) route **generator_poison**. Failures that look like soft-pass on an item that later dual/gold confirms as sealed-correct route **rater_poison**. Ambiguous tickets stay unlabeled until a second sealed judgment or gold exposure.

**Wound:** Medical AIG ≠ ACT FormatId — borrow production-vs-scorer QA separation, not “AIG≡ready” ads (SAFE-GENQ).

---

## CLVI.8 Ambition of the claim still follows Kane

**Reuse (Kane 2013):** More ambitious interpretations need more backing; rejecting a use need not kill a weaker interpretation (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS):** Parent/LEA copy “we separate generation bugs from review mistakes so the Map isn’t punished for the wrong fault” is ambition-conditional on live `poison_source` fields + distinct playbooks. If all inherit repairs still open as unnamed Dual Shame, demote to “we pause family speed-lanes when checks disagree” (REVOKE language) until separation ships. External copy must not cite Generator Shame Score™ or Six Sigma ACT guarantees.

**Kill:** Root-cause theater ads without ticket labels. **Survive:** Named quarantine vs named retrain.

---

## CLVI.9 Separation gates (doctrine core)

**HYPOTHESIS — label before escalate:**

| Signal pattern | Default `poison_source` | Primary action |
|----------------|-------------------------|----------------|
| **S1** Clustered inherit repairs on same FAMHASH with key/figure/trap mismatch | `generator_poison` | Quarantine family; revoke TMPTRUST; FIGKEY/GENQ re-verify; regen |
| **S2** Gold/sample-dual miss on ticket with confirmed sealed-good content | `rater_poison` | Tighten sample; PANELRAMP/retrain; no family freeze if gold family still passes |
| **S3** Single isolated inherit fail; mixed indicators | `ambiguous` | Dual re-seal + optional gold; no Dual Shame board row yet |
| **S4** Rater catch rate high on planted gen-poison gold | Monitor OK; gen pipeline still broken | Do not celebrate rater %; fix generator |
| **S5** Gen quarantine clear but rater discord continues on unrelated families | `rater_poison` systemic | Workforce/PLAYBOOK — not GENQ freeze |

**Hard bans:** Escalate REVOKE→public Dual Shame without `poison_source`; auto-set `generator_poison` from rater ID; auto-set `rater_poison` from model name; publish Generator Shame Score™.

---

## CLVI.10 Experiments

| ID | Question | Design | Primary metrics |
|----|----------|--------|-----------------|
| POISONSEP-1 | Required poison_source vs unlabeled inherit tickets | Ops A/B | Wrong playbook rate; time-to-correct-action |
| POISONSEP-2 | Family quarantine on S1 vs rater-only tighten | Sim/ops | Recurring family repair; dual-minute waste |
| POISONSEP-3 | Gold S2 detection → retrain vs family freeze | Sim | False family freezes; residual rater discord |
| POISONSEP-4 | Ambiguous hold vs forced quality_signal | Ops | Dual Shame false positives; Map poison |
| POISONSEP-5 | LEA CBC: poison-lane honesty vs Generator Shame Score™ / MSA cosplay | CBC | Trust; backlash; WTP |
| POISONSEP-QUAL | Codebook: ticket → gen/rater/ambiguous IRR | Qual | Label IRR (aide, not NS) |

**Falsifiers:** Labels add no lift over PATHBLAME path tables alone → demote to optional aide. Quarantine over-fires and starves FormatId cells without quality gain → raise S1 cluster threshold. Rater fear rises without quality gain → destake copy + private coaching only. Pre-register POISONSEP-* before “science-backed root-cause integrity” campaigns.

---

## CLVI.11 Confidence and contradictions

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Mixing gen and rater faults into one shame board misroutes REVOKE | HYPOTHESIS | Medium–High | Densifies PATHBLAME + Deming measurement-as-process |
| Clone/key clusters are generator-primary until proven otherwise | HYPOTHESIS | Medium | Glas; GENQ/FIGKEY |
| Rater monitoring tools diagnose humans, not item models | FACT→applied | High | Myford/Wolfe; Shin et al. |
| Bejar/Bennett require component-aware automated QC | FACT→applied | High | Validity≠admin ritual |
| Generator Shame Score™ helps GTM | KILLED | High | Standing ban class |
| MSA %GRR tables are MindCraft cut-scores | KILLED | High | Analogy only (CLI AQL wound) |

**Contradicting pressures:** Thin dual capacity (CAPPLAN) tempts unlabeled bulk revoke; exam-week (LOADSHED) tempts “blame the panel” theater; GENQ scale pressure tempts “always rater” to keep shipping clones.

---

## CLVI.12 So what for MindCraft commercially

- **Copy:** “When a matching variant fails, we say whether the bug was in generation or in human seal — and fix that lane.” Ban Generator Shame Score™ and Six Sigma ACT ads.  
- **Product:** `poison_source` on inherit repair; family quarantine vs rater tighten playbooks; PATHBLAME columns for gen vs rater; GOLDSET for ambiguous.  
- **Growth / positioning:** Integrity that does not confuse **model bugs** with **reviewer drift** — against IRR-badge vendors and “AI wrote N questions” heroes that hide key poison.  
- **Metric:** inherit repairs by poison_source; quarantine latency; false family freezes — demote Blame Separation % / Generator Shame Score™.  
- **Kill list:** Always-rater / always-generator dogma; unlabeled Dual Shame; MSA cosplay guarantees; complete-visual-from-root-cause packaging.  
- **Vision:** Maya’s Map is protected by the *right* fix — regen when the stem is wrong, coach when the seal is wrong — never a blended shame number.

---

## References (verified)

- Bejar, I. I. (2011). A validity-based approach to quality control and assurance of automated scoring. *Assessment in Education: Principles, Policy & Practice, 18*(3), 319–341. https://doi.org/10.1080/0969594X.2011.555329  
- Bennett, R. E., & Bejar, I. I. (1998). Validity and automated scoring: It’s not only the scoring. *Educational Measurement: Issues and Practice, 17*(4), 9–17. https://doi.org/10.1111/j.1745-3992.1998.tb00631.x  
- Deming, W. E. (1975). On some statistical aids toward economic production. *Interfaces, 5*(4), 1–15. (Also circulated via American Scientist / Deming Institute reprints; measurement-as-process argument.)  
- Gierl, M. J., & Lai, H. (2013). Evaluating the quality of medical multiple-choice items created with automated processes. *Medical Education, 47*(7), 726–733. https://doi.org/10.1111/medu.12202  
- Glas, C. A. W., & van der Linden, W. J. (2003). Computerized adaptive testing with item cloning. *Applied Psychological Measurement, 27*(4), 247–261. https://doi.org/10.1177/0146621603027004001  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Myford, C. M., & Wolfe, E. W. (2009). Monitoring rater performance over time: A framework for detecting differential accuracy and differential scale category use. *Journal of Educational Measurement, 46*(4), 371–389. https://doi.org/10.1111/j.1745-3984.2009.00088.x  
- Shewhart, W. A. (1931). *Economic control of quality of manufactured product*. D. Van Nostrand Company.  
- Shin, H. J., Wolfe, E., & Wilson, M. (2019). Human rater monitoring with automated scoring engines. *Psychological Test and Assessment Modeling, 61*(2), 127–148.  
