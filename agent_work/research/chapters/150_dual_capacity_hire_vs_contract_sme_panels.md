# Part CL — Dual-Capacity Hire vs Contract SME Panels under Exam-Week Spikes

**Chapter status:** Living evidence + ops/workforce brief — Researcher tick 2026-08-15 (UTC hour 12 ≡ Red Team slot, but ch150 never written → prefer Researcher per rotation; researcher count since synthesizer v1.18 = 7 → Researcher)  
**Primary question:** When CAPPLAN dual minutes spike under ACT crunch, should MindCraft **hire W-2 dual raters**, **contract SME panels**, or **hybrid** — without Surge Hire % vanity, unsealed freelancers as second readers, hospital cosplay, or “complete visual by Friday” promises that ignore onboarding lag?  
**Owners:** HITL / bank QA · Ops / WORKFORCE · CAPPLAN / DUALRATE / LOADSHED · Procurement · Brand · Red Team  
**Commercial job:** Ship **SAFE-SURGEPANEL** densifying SAFE-CAPPLAN × SAFE-LOADSHED × SAFE-WORKFORCE (+ DUALRATE / REPAIRSTRAT / TMPTRUST): **make-or-buy dual capacity with seals, ramp gates, and demobilization honesty** — never Surge Hire % NS, never unsealed contractor dump into C4.

**Builds on:** Parts CXLVII (SAFE-CAPPLAN — dual minutes as capacity), CXXIII (SAFE-LOADSHED), LXXV (SAFE-WORKFORCE), CXLIV (SAFE-DUALRATE), CXLIX (SAFE-REPAIRSTRAT), CXLVIII (SAFE-TMPTRUST), LXVIII (SAFE-HITL), LXXIII (SAFE-PROCURE). Seams: dual surge plan (hire vs contract vs hybrid); panel SOW + seal checklist; parallel-run before C4 authority; FILLETA band refresh when surge mode flips; path-tagged admits from `contract_dual` vs `staff_dual`.

---

## CL.1 Why this chapter exists

CAPPLAN made dual minutes a first-class FILLETA line. LOADSHED named exam-week pause lists so tutors do not pour under crunch. WORKFORCE killed headcount≡quality. The missing join:

> When dual-required backlog spikes in ACT week, **who** supplies second-rater minutes — and under what **employment mode** — without lying on parent clocks or poisoning Map?

Wrong resolutions already visible:

1. **Hire-surge theater** — announce dual hires while onboarding lag still zeros capacity.  
2. **Contractor dump** — freelancers click “looks good” without FIGKEY/FAMHASH seals or independent uid.  
3. **Always-hire dogma** — fixed dual FTE for a two-week spike → idle invent-work or soft-pass.  
4. **Always-contract dogma** — treat figure IR as commodity temp labor; firm-specific seal literacy never forms.  
5. **Hospital surge cosplay** / **Surge Hire % NS** — headcount theater sold as ACT readiness.

**FOUNDER BELIEF under audit:** Parents accept **longer honest dual bands under named surge mode** (staff dual / contract panel / hybrid) more than a short band powered by unsealed freelancers — and LEAs accept **documented SOW + ramp gates** more than “we scaled reviewers 3× this week” ads.

**Claims we refuse:** Dual Rater Score™ / Surge Hire % / Contract Minutes NS; hire-before-ACT guarantees; Discord/emoji≡second rater; unsealed contract panel → C4; forever-contract without sample dual / REPAIRSTRAT path; hospital-surge-cosplay ACT ads; complete-visual-by-exam-week from surge packaging.

---

## CL.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Dual surge** | Exam-week jump in dual-required arrivals | CAPPLAN λ spike | Ignore; ETA-skip dual |
| **Staff dual** | W-2 / ongoing dual raters | Internal development / acquisition | Hire theater without ramp |
| **Contract SME panel** | Time-boxed external second raters | Contracting / alliance mode | Unsealed dump |
| **Surge mode tag** | Which capacity mix is live | Ops + FILLETA input | Silent mode flip |
| **Parallel-run gate** | New panelists shadow before C4 authority | Onboarding seal | Day-one C4 clicks |
| **SAFE-SURGEPANEL** | Hire vs contract dual doctrine | This chapter | Surge Hire Score™ |

**Operational definition (HYPOTHESIS):** Exam-week dual staffing is SAFE-SURGEPANEL-complete when (1) CAPPLAN publishes a **make-or-buy rule** keyed to spike duration and seal uniqueness, (2) every dual admit carries `dual_source` ∈ {`staff`,`contract_panel`,`hybrid_pair`} into REPAIRSTRAT, (3) contract panelists cannot set `hcelig_pass` until **parallel-run + seal checklist** pass, (4) FILLETA **lengthens or labels surge scarcity** when ramp/hire lag binds, (5) LOADSHED pauses electives before burning dual minutes on low-acuity theater, (6) demobilization is planned (no invent-work; no fidelity cliff), and (7) instruments are `dual_surge_mode`, `contract_parallel_run_pass`, `dual_source_repair_rate` — never Surge Hire % NS.

---

## CL.3 Employment externalization: temps for variable load — not for firm-specific seal skill

**FACT:** Davis-Blake & Uzzi (1993, *Administrative Science Quarterly, 38*(2), 195–223, doi:10.2307/2393411) — analyze determinants of employment **externalization**. Variation in employment needs **positively** predicts use of temporary workers; requirements for high informational/technical skill and **firm-specific training** **negatively** predict temp use. Independent contractors follow a partly different pattern (size, multi-site, bureaucratization) but the core lesson is: organizations externalize when load varies **and** when skills are less firm-specific.

**Applied (HYPOTHESIS):** MindCraft dual IR is **high firm-specificity** (FormatId traps, FAMHASH families, promote_path codes, soft-wrong taxonomy). Pure temp dump for T4/T5 figured admits violates the Davis-Blake–Uzzi prediction and predicts seal error. Contract panels may still cover **variable dual minutes** if MindCraft invests in **panel-specific training + seals** (moving the work toward “trained contractor with firm SOP,” not anonymous piecework).

**Kill:** Untrained freelancer≡dual. **Survive:** Variable-load contracting **only with** seal literacy ramp. **Wound:** 1990s establishment surveys ≠ edtech QA — borrow externalization *logic*, not industry coefficients.

---

## CL.4 HR architecture: internal development vs contracting is a portfolio, not a slogan

**FACT:** Lepak & Snell (1999, *Academy of Management Review, 24*(1), 31–48, doi:10.5465/amr.1999.1580439) — propose an HR **architecture** of employment modes (internal development, acquisition, contracting, alliance) keyed to human-capital **value** and **uniqueness**. Not all roles deserve the same employment mode; contracting fits more generic, lower-uniqueness work; internal development fits high-value, high-uniqueness skills.

**Applied (HYPOTHESIS):**

| Dual work slice | Suggested mode (HYPOTHESIS) | Rationale |
|-----------------|----------------------------|-----------|
| Blueprint / first-of-cell T5 dual; TMPTRUST grant | Staff (internal) | Highest uniqueness; trust revoke authority |
| Routine dual on sealed FAMHASH clones under TMPTRUST sample | Staff or trained panel | Lower uniqueness if template sealed |
| Exam-week overflow on already-sealed T1–T3 | Contract panel with parallel-run | Variable load; Davis-Blake fit |
| Arbitration / demote authority | Staff lead | Accountability; Kane higher-ambition use |

**Kill:** “We only hire” / “we only contract” brand. **Survive:** Portfolio by uniqueness × spike duration. **Wound:** Architecture is theory — MindCraft must still measure repair by `dual_source` (REPAIRSTRAT).

---

## CL.5 Mixing standard and nonstandard workers has social costs — design contact and status

**FACT:** Broschak & Davis-Blake (2006, *Academy of Management Journal, 49*(2), 371–393, doi:10.5465/amj.2006.20786085) — higher proportions of nonstandard workers associate with less favorable supervisor/peer attitudes, higher turnover intentions, and less helping — contingent on mobility location, arrangement type, and contact.

**FACT:** Davis-Blake, Broschak, & George (2003, *Academy of Management Journal, 46*(4), 475–485, doi:10.5465/30040639) — nonstandard workers can affect exit, voice, and loyalty among **standard** employees.

**Applied (HYPOTHESIS):** ACT-week panelists who outrank staff on “dual authority” without status rules burn WORKFORCE fidelity. Require named staff dual leads; panelists as **capacity under staff SOPs**; no Surge Hire % hero that shames staff for “not scaling.”

**Kill:** Freelancer hero brand that demoralizes staff duals. **Survive:** Hybrid with status clarity.

---

## CL.6 Nonstandard jobs are often lower quality — do not build integrity on precarious piecework alone

**FACT:** Kalleberg, Reskin, & Hudson (2000, *American Sociological Review, 65*(2), 256–278, doi:10.2307/2657440) — show nonstandard employment strongly increases exposure to “bad job” characteristics (low pay, no health insurance, no pension) net of controls.

**Applied (HYPOTHESIS):** Paying panelists pennies-per-admit predicts speed-over-seals and repair spikes. Commercial implication: contract rates must fund **careful IR time** comparable to staff dual handle-time assumptions in CAPPLAN — or FILLETA must assume higher rework. Cheap surge is fake capacity.

**Kill:** Race-to-bottom dual piece rates. **Survive:** Rate floors tied to median dual minutes. **Wound:** Bad-jobs macro pattern ≠ every SME contractor — still refuse predatory piecework as integrity strategy.

---

## CL.7 Double-reading programs staff carefully — they do not “Uber” second readers under surge

**FACT:** Taylor-Phillips & Stinton (2020, *British Journal of Radiology, 93*(1106), 20190610 / PMC7055445) — breast-screening double reading emphasizes independent reads and consensus/arbitration — **quality design**, not headcount theater.

**FACT:** Taylor-Phillips et al. (2018, *Radiology*, doi:10.1148/radiol.2018171010) — NHSBSP CO-OPS: double reading with arbitration changes recall/detection vs first reader alone — dual **process** matters, not “two people clicked.”

**Applied (HYPOTHESIS / transfer wound):** Borrow independence, arbitration, and training volume — **never** mammography mortality claims or hospital-surge ACT ads. Panelists need DUALRATE independence/uid; arbitration stays with staff leads on TMPTRUST/REPAIRSTRAT discord.

**Kill:** Hospital-surge cosplay marketing. **Survive:** Independence + arbitration + training volume as surge non-negotiables.

---

## CL.8 Kane: “we scaled dual review for exam week” is higher-ambition

**Reuse (Kane 2013):** Higher-ambition uses need more backing (*Journal of Educational Measurement, 50*(1), 1–73, doi:10.1111/jedm.12000).

**Applied (HYPOTHESIS):** “Exam-week dual capacity” claims need dual_source mix, parallel-run pass rates, path-stratified repair not worse on `contract_panel`, and FILLETA bands that priced surge — not hire counts or invoice totals.

**Kill:** Surge headcount as trust proof. **Survive:** Mode-tagged integrity evidence.

---

## CL.9 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Variable load predicts temp use; firm-specific skill predicts against temps | FACT | High | Davis-Blake & Uzzi 1993 |
| Employment modes should fit human-capital value/uniqueness | FACT | High | Lepak & Snell 1999 (theory) |
| Higher nonstandard share can harm standard-worker relations/helping | FACT | High | Broschak & Davis-Blake 2006; Davis-Blake et al. 2003 |
| Nonstandard jobs often carry worse pay/benefits characteristics | FACT | High | Kalleberg et al. 2000 |
| Double-reading literature emphasizes process design (independence, arbitration), not mere headcount | FACT | High | Taylor-Phillips & Stinton 2020; NHSBSP dual-read evidence |
| Higher-ambition uses need more backing | FACT | High | Kane 2013 |
| Hybrid portfolio (staff core + sealed contract overflow) beats always-hire or always-contract for ACT dual spikes | HYPOTHESIS | Medium–High | Needs SURGEPANEL-* |
| Parents prefer labeled surge scarcity over freelancer-powered short ETAs | FOUNDER BELIEF | Medium | CBC × FILLETA/HOLETRUST |
| Contract panel κ predicts ACT gains | SPECULATION | Low | Refuse |
| Uber-style dual marketplace ≡ Map integrity | SPECULATION | Low | Refuse |

---

## CL.10 Product surface — SAFE-SURGEPANEL claim contract

1. Publish a **make-or-buy matrix** (spike weeks × uniqueness tier → staff / panel / hybrid) owned by CAPPLAN+WORKFORCE — review each exam season.  
2. Tag every dual admit with `dual_source` ∈ {`staff`,`contract_panel`,`hybrid_pair`}; join to REPAIRSTRAT dashboards.  
3. Contract panelists: **independent uid**, seal checklist, **parallel-run gate** before C4 authority; staff lead owns arbitration/demote.  
4. FILLETA: when surge mode is `contract_ramp` or `hire_lag`, **lengthen or label** dual-verify scarcity — never ETA-skip dual (CAPPLAN ban).  
5. LOADSHED: pause electives before burning dual minutes on low-acuity GENQ vanity.  
6. Ban Dual Rater Score™ / Surge Hire % / Contract Minutes / “3× reviewers this week” marketing heroes.  
7. Rate floor: contract $/admit ≥ CAPPLAN median dual-minute cost assumption (or raise rework factor).  
8. Demobilization plan: end dates, knowledge handoff, no invent-dual-work; no abrupt exit that spikes staff repair.  
9. PROCURE: SOW includes discordance/repair SLAs, data handling, and sample-dual rights (TMPTRUST).  
10. Copy spine: “Exam-week dual capacity is staff-led; contractors only after seals and a parallel run — and parent clocks name the surge mode.” Ban hospital-surge / Uber-rater ads.

---

## CL.11 Doctrine — SAFE-SURGEPANEL (provisional)

1. **Portfolio, not slogan** — Lepak–Snell modes by uniqueness; Davis-Blake variable load ≠ unskilled dump.  
2. **Staff core owns trust** — blueprint dual, TMPTRUST grant/revoke, arbitration.  
3. **Contract overflow only behind gates** — parallel-run + seals + independent uid.  
4. **Tag the source** — `dual_source` into REPAIRSTRAT; blame/repair conditioned on source.  
5. **Price surge in FILLETA** — labeled scarcity / longer bands beat silent freelancer speed.  
6. **Protect staff climate** — Broschak mixing costs; no freelancer-hero shame.  
7. **Refuse predatory piece rates** — Kalleberg bad-job pattern as integrity risk.  
8. **Borrow dual-read process, not hospital brand** — independence/arbitration without cosplay.  
9. **No Dual Rater Score™ / Surge Hire % / Contract Minutes NS**.  
10. **No ACT / complete-visual-by-exam-week guarantees** from surge packaging.

**Confidence:** High on externalization / HR-architecture / mixing / bad-jobs / Kane facts *with transfer limits*. Medium on exact uniqueness tiers, parallel-run length, and rate-floor formula. High that unsealed contractor dump and hire-surge marketing are commercially toxic under CAPPLAN honesty.

---

## CL.12 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| SURGEPANEL-1 | Staff-only dual vs hybrid sealed panel under simulated ACT spike | Ops A/B (shadow week) | Dual latency; path-stratified repair; FILLETA honesty |
| SURGEPANEL-2 | Parallel-run gate (N tickets) vs day-one C4 authority for panelists | Ops A/B | Repair rate; discord; time-to-useful-capacity |
| SURGEPANEL-3 | Rate floor vs cheap piecework panel | Ops A/B | Seal miss rate; rework minutes; quit mid-spike |
| SURGEPANEL-4 | Parent CBC: labeled surge scarcity vs “we hired 10 dual raters” hero | CBC | Trust; WTP; backlash |
| SURGEPANEL-5 | Demobilization plan vs abrupt panel cutoff | Ops A/B | Post-spike staff repair spike; helping climate |
| SURGEPANEL-QUAL | SME panel onboarding diary — where seal literacy fails | Qual | SURGEPANEL codebook |

**Falsifiers:** Hybrid panel equals staff-only on repair *and* latency with lower cost → keep hybrid but retain staff core for TMPTRUST. Parallel-run adds delay with no repair gain → shorten gate but keep seal checklist. Parent CBC prefers hire-count hero with equal retention → still ban guarantee copy; test honesty separately. Pre-register SURGEPANEL-* before exam-week dual-scaling campaigns.

---

## CL.13 So what for MindCraft commercially

- **Copy:** “ACT-week dual capacity is staff-led; contractors only after seals and a parallel run — and verify clocks name the surge mode.” Ban Uber-rater / hospital-surge / Surge Hire % heroes.  
- **Product:** Make-or-buy matrix; `dual_source` tags; parallel-run gate; FILLETA surge labels; demobilization checklist.  
- **Growth / positioning:** Capacity-true integrity under crunch vs ChatGPT fluency and freelance “scale reviewers” theater.  
- **Metric:** dual_surge_mode; contract_parallel_run_pass; dual_source-stratified repair — demote Surge Hire % / Dual Rater Score™.  
- **Kill list:** Hire-surge theater; unsealed contractor dump; Discord≡dual; hospital cosplay; complete-visual-by-exam-week from surge packaging.  
- **Vision:** Maya’s Map stays dual-true in crunch because **who** second-read the probe is named, trained, and demotable — not because a surge invoice looked large.

---

## References (verified)

- Broschak, J. P., & Davis-Blake, A. (2006). Mixing standard work and nonstandard deals: The consequences of heterogeneity in employment arrangements. *Academy of Management Journal, 49*(2), 371–393. https://doi.org/10.5465/amj.2006.20786085  
- Davis-Blake, A., Broschak, J. P., & George, E. (2003). Happy together? How using nonstandard workers affects exit, voice, and loyalty among standard employees. *Academy of Management Journal, 46*(4), 475–485. https://doi.org/10.5465/30040639  
- Davis-Blake, A., & Uzzi, B. (1993). Determinants of employment externalization: A study of temporary workers and independent contractors. *Administrative Science Quarterly, 38*(2), 195–223. https://doi.org/10.2307/2393411  
- Kalleberg, A. L., Reskin, B. F., & Hudson, K. (2000). Bad jobs in America: Standard and nonstandard employment relations and job quality in the United States. *American Sociological Review, 65*(2), 256–278. https://doi.org/10.2307/2657440  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Lepak, D. P., & Snell, S. A. (1999). The human resource architecture: Toward a theory of human capital allocation and development. *Academy of Management Review, 24*(1), 31–48. https://doi.org/10.5465/amr.1999.1580439  
- Taylor-Phillips, S., et al. (2018). Double reading in breast cancer screening: Cohort evaluation in the CO-OPS trial. *Radiology*. https://doi.org/10.1148/radiol.2018171010  
- Taylor-Phillips, S., & Stinton, C. (2020). Double reading in breast cancer screening: Considerations for policy-making. *British Journal of Radiology, 93*(1106), 20190610. https://doi.org/10.1259/bjr.20190610 (PMC7055445)  
