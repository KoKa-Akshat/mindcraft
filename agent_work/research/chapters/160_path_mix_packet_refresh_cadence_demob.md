# Part CLX — Path-Mix Packet Refresh Cadence after Surge Demobilization

**Chapter status:** Living evidence + GTM/ops brief — Researcher tick 2026-08-17 (UTC hour 06 ≡ Red Team slot, but ch160 never written → prefer Researcher per rotation; researcher count since synthesizer v1.20 = 0 → Researcher)  
**Primary question:** After SAFE-PATHMIX puts a **dated path-mix chart** in the LEA trust packet, and SAFE-DEMOB / SAFE-SURGEPANEL / SAFE-CAPPLAN **change dual vs single vs inherit shares**, how often — and under which triggers — must MindCraft **refresh or stale-label** that chart so disclosure stays accurate without Case-Mix Score™ vanity, forever-green surge-era slides, or hospital report-card cosplay sold as “always current QA”?  
**Owners:** GTM / partnerships · Legal/trust · HITL / bank QA · Ops / CAPPLAN · Brand · SAFE-PATHMIX / SAFE-DEMOB / SAFE-KNOWNETA / SAFE-FILLETA · Red Team  
**Commercial job:** Ship **SAFE-MIXREFRESH** densifying SAFE-PATHMIX × SAFE-DEMOB × SAFE-CAPPLAN (+ KNOWNETA/FILLETA honesty clocks): **event-triggered + calendar path-mix refresh with explicit stale labels** — never forever-green surge charts, never Case-Mix Score™ / Mix Freshness Score™ NS, never silent demob that leaves dual-heavy L1 claims in the packet.

**Builds on:** CLVII (PATHMIX G6 foreshadowed cadence), CLIV (DEMOB mode flips + FILLETA demob labels), CL (SURGEPANEL), CXLVII (CAPPLAN), CXXXV (KNOWNETA), CXLIII (FILLETA), LXXIII (PROCURE). Seams: `path_mix_as_of`, `path_mix_stale`, `dual_surge_mode` ∈ {surge, demob, baseline}; packet Exhibit QA versioning; LEA RFP decks vs live appendix.

---

## CLX.1 Why this chapter exists

PATHMIX killed hide-mix and Dual Shame RFP slides. DEMOB killed invent-work and cliff-cut exits. CAPPLAN priced dual minutes into FILLETA. The missing join is **temporal**:

> A path-mix chart dated “Q1 surge” that still heads the district packet in “Q3 baseline” is not transparency — it is **stale accuracy theater**. Buyers who believed “harder tickets get second seals at ~40% dual” while ops quietly runs 8% dual after demob experience the same integrity hit as optimistic hole-fill ETAs (FILLETA) or “soon” lobby waits (KNOWNETA).

Wrong resolutions already visible:

1. **Forever-green surge chart** — keep the dual-heavy mix that closed the deal; never reissue after DEMOB.  
2. **Calendar-only refresh theater** — annual PDF regardless of surge/demob events (looks process-y; misses the spike).  
3. **Event refresh without stale label** — regenerate silently; old decks still circulate unlabeled.  
4. **Mix Freshness Score™ / Case-Mix Score™ NS** — vanity clocks or hospital-lag cosplay as brand.  
5. **Hide demob mix shift** — “proprietary update cadence”; PATHMIX G1–G3 present once, then abandoned.  
6. **Complete-visual / Map-trust guarantees** from “we refresh continuously” packaging alone.

**FOUNDER BELIEF under audit:** Serious LEAs prefer a **dated mix + stale flag after mode flip** (“this chart is pre-demob; dual share will fall while staff re-absorb”) more than a glossy forever-current Case-Mix Score™ — *if* the refresh trigger is inspectable and not marketing fog.

**Claims we refuse:** Case-Mix Score™ / Mix Freshness Score™ / Path Mix Minutes / Refresh Velocity % NS; forever-green surge-era mix; silent demob without packet stale label; hospital/CMS report-card lag cosplay as ACT readiness; continuous-refresh ads without `path_mix_as_of`; complete-visual or Map-trust guarantees from refresh packaging.

---

## CLX.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Path-mix vintage** | As-of date + surge mode of the disclosed shares | `path_mix_as_of` + `dual_surge_mode` | Undated slide |
| **Stale label** | Explicit “not current ops” banner when triggers fire | Packet watermark / Exhibit footnote | Silent old deck |
| **Refresh trigger** | Event or calendar that forces recompute + reissue | DEMOB exit; CAPPLAN dual-FTE change; N days | Vague “as needed” |
| **L1 claim binding** | Routing sentence still true under new shares | Kane L1 re-check | Surge rationale on baseline mix |
| **SAFE-MIXREFRESH** | Cadence doctrine for PATHMIX exhibits | This chapter | Mix Freshness Score™ |

**Operational definition (HYPOTHESIS):** LEA path-mix disclosure is SAFE-MIXREFRESH-complete when (1) every PATHMIX exhibit carries `path_mix_as_of` and the `dual_surge_mode` under which shares were computed, (2) **hard triggers** force refresh *or* stale-label within a pre-registered SLA: `dual_surge_mode` transition (esp. surge→demob→baseline), CAPPLAN dual-FTE / panel demobilization complete, or material promote-path share shift beyond a pre-registered δ, (3) a **calendar floor** (e.g. quarterly) refreshes even without events — floor ≠ substitute for event triggers, (4) stale packets/decks are **labeled**, not silently deleted from buyer inboxes (KNOWNETA-style magnitude > apology fog), (5) routing rationale is re-validated against current shares (no “harder tickets → 40% dual” sentence on an 8% dual chart), (6) Mix Freshness Score™ / Case-Mix Score™ / hospital-lag cosplay are absent, and (7) MIXREFRESH-* falsifiers are pre-registered before “always-current QA transparency” district ads.

---

## CLX.3 Transparency still needs accuracy — and timeliness is part of accuracy

**Reuse (FACT):** Schnackenberg and Tomlinson (2016, *Journal of Management, 42*(7), 1784–1810, doi:10.1177/0149206314525202) — transparency as perceived **disclosure, clarity, and accuracy** of intentionally shared information; dimensions shape Mayer et al. ability/benevolence/integrity trust.

**Reuse (FACT):** Schnackenberg, Tomlinson, and Coen (2021, *Human Relations*, doi:10.1177/0018726720933317) — validated disclosure/clarity/accuracy; aggregate predicts perceived trustworthiness.

**FACT (extension):** Hossiep, Märtins, and Schewe (2021, *Zeitschrift für Arbeits- und Organisationspsychologie, 65*(3), 165–178, doi:10.1026/0932-4089/a000360) — German DCA scale extended with **Timeliness** and **Relevance**; too early or too late sharing reduces value. Transfer limit: org-employee surveys ≠ LEA RCTs — borrow the construct, not ω coefficients as WTP proof.

**Applied (HYPOTHESIS):**

| Failure | Transparency break | LEA trust risk |
|---------|--------------------|----------------|
| Forever-green surge mix | Accuracy (and timeliness) | Integrity: packet describes a workforce mode that no longer exists |
| Annual-only refresh after demob | Timeliness | Ability fog: “they don’t know their own dual share” |
| Silent regenerate; old decks live | Clarity + accuracy | Buyers cite conflicting exhibits |
| Mix Freshness Score™ hero | Clarity (vanity) | Costume; distracts from FEI / seal truth |

**Kill:** One-shot PATHMIX as permanent compliance checkbox. **Survive:** Dated + stale-aware PATHMIX. **Wound:** Timeliness≠spam — do not reissue weekly to farm Refresh Velocity %.

---

## CLX.4 Public quality reports go stale — borrow the lag wound, not the hospital costume

**FACT:** Mori, Shahian, Suter, Geirsson, Lin, and Krumholz (2020, *JAMA Surgery, 155*(5), 442–444, doi:10.1001/jamasurg.2019.6367) — statewide cardiac surgery public reports often publish outcomes measured years earlier; comparing reported period performance to later contemporary performance shows **mismatches**, especially at extreme centers; shorter lag improves relevance, but multi-year lag remains common. **Transfer limit:** CABG mortality ≠ FormatId seal path mix — borrow *lag undermines decision relevance*, never CMS/NY cardiac report-card cosplay as MindCraft QA brand (Iezzoni wound already in CLVII).

**FACT:** Davies (2001, *Quality in Health Care / BMJ Quality & Safety, 10*(2), 104–110, doi:10.1136/qhc.10.2.104) — U.S. providers criticize long lags between data gathering and official reports (“so old… meaningless”). Prefer fresher in-house data. Transfer: buyer/staff *experience* of lag, not a tutoring effect size.

**Reuse (wound):** Iezzoni (1997) / Iezzoni et al. (1995) — risk-adjustment method choice changes quality impressions; do not escalate MIXREFRESH into Case-Mix Score™ / hospital report-card ads.

**Applied (HYPOTHESIS):** MindCraft’s risk is sharper than slow statewide registries: **ops mode can flip in weeks** (SURGEPANEL→DEMOB). Doctrine: event triggers beat multi-year “industry standard lag” excuses.

**Kill:** “Everyone’s report cards lag, so forever-green is fine.” **Survive:** Pre-registered demob/surge refresh SLA in days/weeks. **Wound:** Do not cite Mori as proof that tutoring QA must mimic cardiac registries.

---

## CLX.5 Kane: “current routing honesty” is a stronger claim than “we once disclosed mix”

**Reuse (Kane 2013):** More ambitious interpretations need more backing (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS) — IUA ladder for vintage:**

| Level | Claim | Backing required |
|-------|-------|------------------|
| **L0** | Packet once contained a mix chart | Archive existence (insufficient for live trust) |
| **L1** | *Current* routing honesty — harder strata still get second seals; shares reflect named mode | Fresh `path_mix_as_of` under current `dual_surge_mode` + re-checked routing sentence |
| **L2** | Dual protects Map *within* strata under current mix | Within-stratum evidence on **post-refresh** window |
| **L3** | Dual superior technology / continuous-refresh ≡ quality | Reject for external copy |

**Kill:** Selling L1 “current” language off an L0 archival chart. **Survive:** Vintage tags on every ambition claim.

---

## CLX.6 DEMOB and CAPPLAN are hard refresh triggers — not optional polish

**Reuse (SAFE-DEMOB):** Stage machine `surge` → `demob_handover` → `baseline`; FILLETA labels demob scarcity; invent-work ban; post-exit repair window.

**Reuse (SAFE-CAPPLAN):** Dual FTE / panel minutes enter fill estimators; silent ETA after capacity drop is banned.

**Applied (HYPOTHESIS) — trigger table:**

| Trigger | Action within SLA | Copy spine |
|---------|-------------------|------------|
| `dual_surge_mode` → `demob` | Stale-label live exhibits; recompute shares for demob window | “Dual share falling while staff re-absorb; chart dated [as_of]” |
| `demob` → `baseline` + handover complete | Mandatory refresh; clear stale if shares reissued | “Baseline mix after panel exit — as of [date]” |
| CAPPLAN dual-FTE change ≥ pre-registered δ | Refresh or stale | Link FILLETA band honesty |
| Promote-path share shift ≥ δ (e.g. dual ±10pp) | Refresh or stale | No silent inherit_solo spike |
| Calendar floor (quarterly) | Refresh even if quiet | Floor ≠ event substitute |

**Kill:** DEMOB without PATHMIX stale/refresh. **Survive:** Same honesty clock family as FILLETA demob labels and KNOWNETA finite waits — magnitude labeled, not fog.

---

## CLX.7 Mayer integrity: conflicting exhibits beat one honest stale banner — badly

**Reuse (FACT):** Mayer, Davis, and Schoorman (1995, *Academy of Management Review, 20*(3), 709–734, doi:10.5465/amr.1995.9508080335) — trust as willingness to be vulnerable based on ability, benevolence, integrity expectations.

**Applied (HYPOTHESIS):** Surge decks left in sales Drive while ops runs baseline create **integrity conflict** when a privacy officer compares Exhibits. MIXREFRESH requires versioned `path_mix_as_of` and a rule: outbound RFP attachments match the live packet or carry a stale watermark. Benevolence theater (“we’ll send an update someday”) without SLA fails KNOWNETA’s finite-wait lesson.

**Kill:** Shadow decks. **Survive:** One live vintage + watermarked archives.

---

## CLX.8 Packet gates (doctrine core)

**HYPOTHESIS — keep PATHMIX G1–G7 and add refresh gates:**

| Gate | Requirement | Ban |
|------|-------------|-----|
| **R1 Vintage** | `path_mix_as_of` + `dual_surge_mode` on every exhibit | Undated forever-green |
| **R2 Event SLA** | Demob/surge/CAPPLAN/δ-share triggers force refresh **or** stale-label in N days | “As needed” fog |
| **R3 Calendar floor** | Periodic recompute even in quiet periods | Floor-only without events |
| **R4 Rationale bind** | Routing sentence re-checked against current shares | Surge % copy on baseline chart |
| **R5 Deck hygiene** | Outbound attachments match live vintage or watermark stale | Shadow surge slides |
| **R6 No vanity NS** | Instruments = as_of age, stale_flag rate, post-trigger refresh latency | Mix Freshness Score™ |
| **R7 Ambition** | L1/L2 tags follow Kane; no L3 from refresh ads | Continuous-refresh≡quality |

**Hard bans:** Case-Mix Score™; hospital/CMS lag cosplay ACT ads; hide demob mix shift; complete-visual from refresh packaging; Refresh Velocity % as learning/QA NS.

---

## CLX.9 Experiments

| ID | Question | Design | Primary metrics |
|----|----------|--------|-----------------|
| MIXREFRESH-1 | Stale-labeled demob chart vs forever-green surge chart | LEA buyer CBC | Trust; integrity; preference |
| MIXREFRESH-2 | Event-triggered refresh SLA vs calendar-only annual | Ops sim + buyer rating | Staleness detection; backlash |
| MIXREFRESH-3 | Watermarked archive vs silent conflicting decks | Procurement vignette | Confusion; abandonment |
| MIXREFRESH-4 | Routing sentence rebound after dual −15pp vs frozen sentence | CBC | Overclaim detection |
| MIXREFRESH-5 | FILLETA demob band + MIXREFRESH stale vs FILLETA-only | Dual-audience | Parity; WTP |
| MIXREFRESH-QUAL | Codebook: outbound deck vintage vs live packet IRR | Qual | Deck-hygiene IRR (aide, not NS) |

**Falsifiers:** Stale labels reduce trust vs forever-green → redesign clarity (don’t hide); still ban accuracy theater. Event SLA adds cost with no buyer lift over quarterly floor alone → keep demob trigger as integrity minimum anyway; shorten calendar only with evidence. Pre-register MIXREFRESH-* before “always-current dual QA” campaigns.

---

## CLX.10 Confidence and contradictions

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Path-mix exhibits need vintage + demob/surge refresh triggers | HYPOTHESIS | Medium–High | Densifies PATHMIX G6 × DEMOB × CAPPLAN |
| Transparency accuracy/timeliness breaks when disclosed ops mode flips | FACT→applied | High | Schnackenberg; Hossiep timeliness — transfer limits apply |
| Multi-year public-report lag undermines relevance | FACT | High | Mori 2020; Davies 2001 lag criticism — wound vs cosplay |
| Forever-green surge mix is commercially toxic under DEMOB | FOUNDER BELIEF | Medium–High | Needs MIXREFRESH-1 |
| Mix Freshness Score™ improves Map trust | KILLED | High | Standing vanity class |
| Hospital report-card cadence ≡ MindCraft QA brand | KILLED | High | Iezzoni + costume ban |

**Contradicting pressures:** Sales wants the dual-heavy chart that won the RFP; legal wants freeze-file exhibits; ops under LOADSHED fears advertising baseline dual scarcity; marketing wants “continuously updated transparency” without as_of discipline.

---

## CLX.11 So what for MindCraft commercially

- **Copy (LEA):** “Path mix as of [date] under [surge/demob/baseline]. After exam dual wind-down we reissue or mark stale — we do not leave surge-era dual shares in the packet.” Ban Case-Mix / Mix Freshness Score™ and hospital-lag cosplay.  
- **Product / packet:** `path_mix_as_of`, `path_mix_stale`, triggers from `dual_surge_mode` + CAPPLAN; watermark rule for outbound decks; same clock honesty family as FILLETA demob bands.  
- **Growth / metric:** Inspectable *current* seal routing vs frozen-slide FERPA-badge vendors; instrument demob→refresh_or_stale latency and outbound vintage match % — demote Mix Freshness / Case-Mix Score™.  
- **Kill list:** Forever-green surge charts; silent demob; shadow decks; continuous-refresh≡quality; complete-visual from cadence packaging.  
- **Vision:** School trust is a living appendix — show how evidence is sealed *now*, including when dual minutes fall after crunch.

---

## References (verified)

- Davies, H. T. O. (2001). Public release of performance data and quality improvement: Internal responses to external data by US health care providers. *Quality in Health Care, 10*(2), 104–110. https://doi.org/10.1136/qhc.10.2.104  
- Hossiep, C. R., Märtins, J., & Schewe, G. (2021). DCA-Transparency: Validation and extension of a German scale. *Zeitschrift für Arbeits- und Organisationspsychologie, 65*(3), 165–178. https://doi.org/10.1026/0932-4089/a000360  
- Iezzoni, L. I. (1997). The risks of risk adjustment. *JAMA, 278*(19), 1600–1607. https://doi.org/10.1001/jama.278.19.1600  
- Iezzoni, L. I., Ash, A. S., Shwartz, M., Daley, J., Hughes, J. S., & Mackiernan, Y. D. (1995). Predicting who dies depends on how severity is measured: Implications for evaluating patient outcomes. *Annals of Internal Medicine, 123*(10), 763–770. https://doi.org/10.7326/0003-4819-123-10-199511150-00004  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Mayer, R. C., Davis, J. H., & Schoorman, F. D. (1995). An integrative model of organizational trust. *Academy of Management Review, 20*(3), 709–734. https://doi.org/10.5465/amr.1995.9508080335  
- Mori, M., Shahian, D. M., Suter, L. G., Geirsson, A., Lin, Z., & Krumholz, H. M. (2020). Relevance of cardiac surgery outcome reporting 3 years later in a New York and California statewide analysis. *JAMA Surgery, 155*(5), 442–444. https://doi.org/10.1001/jamasurg.2019.6367  
- Schnackenberg, A. K., & Tomlinson, E. C. (2016). Organizational transparency: A new perspective on managing trust in organization-stakeholder relationships. *Journal of Management, 42*(7), 1784–1810. https://doi.org/10.1177/0149206314525202  
- Schnackenberg, A. K., Tomlinson, E., & Coen, C. (2021). The dimensional structure of transparency: A construct validation of transparency as disclosure, clarity, and accuracy in organizations. *Human Relations*. https://doi.org/10.1177/0018726720933317  
