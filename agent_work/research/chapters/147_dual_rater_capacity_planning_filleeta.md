# Part CXLVII — Dual-Rater Capacity Planning vs FILLETA Band Honesty

**Chapter status:** Living evidence + ops/capacity brief — Researcher tick 2026-08-15 (UTC hour 00 ≡ Red Team slot, but ch147 never written → prefer Researcher per rotation; researcher count since synthesizer v1.18 = 4 → Researcher)  
**Primary question:** Once SAFE-DUALRATE requires second raters on triggered figured C4 admits, how must MindCraft **plan reviewer capacity** and **refresh FILLETA bands** — without Dual Rater Score™ vanity, always-dual costume that explodes ETAs, ETA-skipped dual under backlog heat, or “we’ll hire our way to complete visual by Friday” theater — so parent hole clocks stay capacity-true while Map integrity stays dual-true?  
**Owners:** HITL / bank QA · Ops capacity · Product (FILLETA / ParentDashboard) · WORKFORCE · DUALRATE / PROMOTE / FIGKEY · Brand · Red Team  
**Commercial job:** Ship **SAFE-CAPPLAN** densifying SAFE-DUALRATE × SAFE-FILLETA × SAFE-WORKFORCE × queue physics: **dual minutes are a first-class capacity line** in the fill estimator — never a costume that is waived when the parent clock looks bad, never a black-box Dual Rater Score™.

**Builds on:** Parts CXLIV (SAFE-DUALRATE), CXLIII (SAFE-FILLETA), CXL (SAFE-PROMOTE), LXXV (SAFE-WORKFORCE), CXXIII (SAFE-LOADSHED), CXXXV (SAFE-KNOWNETA), CXXXIX (SAFE-HOLETRUST). Seams: dual-minute budget in FILLETA estimator, second-rater roster / headroom, labeled scarcity when dual capacity is the bottleneck, hire/contract plan without Dual Rater Score™ splash.

---

## CXLVII.1 Why this chapter exists

SAFE-DUALRATE fixed *when* dual is mandatory (T1–T6). SAFE-FILLETA fixed *how* parents hear verify bands (capacity-grounded, no soon/play-count/soft-pass). The missing join:

> Dual review that is not staffed is either **lied about** (ETA-skipped dual; soft-pass first-rater) or **honestly exploded** into forever holes — unless ops plans **dual minutes as capacity**, refreshes bands when dual load rises, and hires/contracts before marketing “complete visual.”

Wrong resolutions already visible in edtech and in borrowed “double-check” industries:

1. **Always-dual costume without headcount** — Wing & Langelier-style workforce shock; FILLETA bands become fiction.  
2. **ETA panic clears T1–T6** — DUALRATE already bans this; CAPPLAN makes the ban *operational* (estimator refuses to assume single-rater throughput on dual-required tickets).  
3. **Dual Rater Score™ / Reviewer Minutes NS** — vanity that rewards short announced bands or high dual %.  
4. **Hire-surge theater** — announce dual capacity that does not exist (WORKFORCE kill pattern).  
5. **Ignore variability** — plan at 100% reviewer utilization; queues explode nonlinearly when GENQ/FIGKEY spikes arrive.  
6. **Hospital cosplay capacity ads** — “double-read like radiology” sold as ACT readiness.

Without SAFE-CAPPLAN, DUALRATE is a policy PDF and FILLETA is a marketing clock. Parents who buy labeled FormatId holes deserve bands that **already price in** second-rater minutes.

**FOUNDER BELIEF under audit:** Families prefer a **longer honest verify band that includes dual minutes** over a short band that silently skips the second sealed check — and prefer labeled dual-capacity scarcity over Dual Rater Score™ dashboards.

**Claims we refuse:** dual-omitted FILLETA; ETA-skipped dual / soft-pass under date heat; always-dual without dual FTE; Dual Rater Score™ / Capacity Score™ / Reviewer Minutes NS; complete-visual-by-date or ACT guarantees from dual packaging; hospital double-read cosplay; 100% dual-util plans; Discord-emoji / same-uid “second rater” as capacity filler.

---

## CXLVII.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Dual-required arrival rate** | Tickets/week hitting T1–T6 | Promote queue filter | Treat all tickets as single |
| **Dual minutes / admit** | Median second-rater + discord arbitration time | Ops handle time | Ignore discord tail |
| **Dual capacity** | Available independent second-rater minutes/week | Roster × protected QA hours | Count tutors mid-session as dual capacity |
| **Capacity buffer** | Planned idle dual capacity vs mean load | Headroom % | Run at 100% util |
| **FILLETA dual line** | Estimator term: backlog_dual × (1/dual_throughput) | Parent verify band input | Hide dual term |
| **SAFE-CAPPLAN** | Dual-capacity × band-honesty doctrine | This chapter | Dual Rater Score™ |

**Operational definition (HYPOTHESIS):** Dual+FILLETA is SAFE-CAPPLAN-complete when (1) the fill estimator **splits** single-path vs dual-required backlog, (2) dual-required latency uses **dual capacity** (not first-rater-only throughput), (3) planned utilization of dual capacity stays below a written headroom ceiling (not 100%), (4) when dual capacity is the binding constraint, parent/student copy **labels dual-verify scarcity** (not child-deficit shame), (5) raising dual % via always-dual costume without hiring **lengthens** published bands before marketing, (6) hitting a parent band never clears T1–T6, and (7) instruments are `dual_capacity_util`, `fill_eta_dual_component_ok`, `eta_skipped_dual_flag` — never Dual Rater Score™ / Capacity Score™ NS.

---

## CXLVII.3 Little’s Law: backlog, throughput, and wait are one equation

**FACT:** Little, J. D. C. (1961, *Operations Research, 9*(3), 383–387, doi:10.1287/opre.9.3.383) — under stated stationarity conditions, the mean number in system \(L\) equals arrival rate \(\lambda\) times mean time in system \(W\): \(L = \lambda W\).

**Applied (HYPOTHESIS):** For dual-required promote tickets, if ops wants a parent-facing verify window \(W\) near a chosen band, then either dual throughput \(\lambda\) must rise (hire/protect second-rater minutes; narrow triggers only via DUALRATE evidence) or dual WIP \(L\) must fall (stop padding always-dual costume; reject/repair faster; stop GENQ floods into figured C4 ambition). Publishing a short \(W\) while \(\lambda\) is unchanged and \(L\) is high is **not optimism — it is denying Little’s Law**.

**Kill:** Fill bands that ignore dual backlog depth.  
**Survive:** Capacity-grounded \(W \approx L/\lambda\) bands with conservative rounding (FILLETA grain).  
**Wound:** Exact Little conditions (strict stationarity) rarely hold in startup ops — use as **diagnostic identity**, not as a precision stopwatch for parents.

---

## CXLVII.4 Variability + high utilization → nonlinear waits (capacity buffer required)

**FACT / textbook law (transfer):** Hopp, W. J., & Spearman, M. L. (2011, *Factory Physics*, 3rd ed., Waveland Press) — production systems with variability must buffer with **inventory, time, and/or capacity**; attempting to run near 100% utilization without reducing variability inflates cycle time (popularized via Kingman-style VUT intuition: queue time grows as utilization \(u/(1-u)\) blows up).

**Applied (HYPOTHESIS):** Dual QA is a **variable** station: figure IR ambiguity, discord arbitration, GENQ repair storms, exam-week ticket spikes (LOADSHED). Planning second raters at full calendar occupancy guarantees FILLETA slip loops. CAPPLAN requires a **capacity buffer** (idle dual minutes against mean dual load) so parent bands stay finite under ordinary spikes — or else bands must widen *before* the spike, not after “almost ready” insults (Maister × KNOWNETA).

**Kill:** 100% dual-util plans; “we’ll catch up Friday” without headroom.  
**Survive:** Written util ceiling + band refresh when util crosses threshold.  
**Wound:** Factory lines ≠ tutoring QA — borrow buffer logic, not takt-time cosplay ads.

---

## CXLVII.5 Universal double reading is a workforce multiplier — not a free integrity upgrade

**FACT:** Wing, P., & Langelier, M. (2009, *AJR, 192*(2), 370–378, doi:10.2214/ajr.08.1665) — workforce forecasts for breast imaging; implementing double reading for all mammograms would **significantly increase** radiologist demand; illustrative scenarios (assuming ~10% already double-read) span roughly **13%–90%** more mammographers depending on second-read time relative to first-read time (thousands of additional practitioners in national scenarios).

**FACT (reuse):** Posso et al. (2016, *PLOS ONE*) — double vs single cost-effectiveness is **not automatic**. Brown et al. (1996, *BMJ*) — consensus vs non-consensus policies change cost structure.

**Transfer limits:** Mammography ≠ FormatId promote QA (base rates, regulation, labor markets differ). Borrow only: **always-dual is a staffing decision**; second-read duration dominates capacity shock; policy without headcount is fantasy.

**Applied (HYPOTHESIS):** MindCraft must not ship “every figured item is dual-certified” brand language unless CAPPLAN shows dual \(\lambda\) can clear dual \(L\) at published \(W\). Prefer DUALRATE triggers (risk-weighted dual) + CAPPLAN headroom over always-dual costume that either (a) lies on FILLETA or (b) starves Practice→C4 forever.

**Kill:** Always-dual marketing without dual FTE plan; hospital double-read ACT ads.  
**Survive:** Triggered dual + explicit dual-minute budget; longer honest bands when dual load rises.

---

## CXLVII.6 Wait psychology + Kane ambition still bind the clock

**Reuse (SAFE-FILLETA / KNOWNETA):** Maister (1985) — uncertain waits feel longer than known finite waits; “almost” after a miss insults. Whitt (1999) — delay information changes balking/reneging; **accuracy** matters.

**Reuse (SAFE-DUALRATE):** Kane (2013) — higher-ambition uses need more backing. Parent-/Map-facing FormatId diagnosis fires dual triggers more often → **CAPPLAN must size dual capacity to the ambition sold**, or dial ambition down (honest holes; Practice-only until dual capacity exists).

**Applied (HYPOTHESIS):** When dual is the bottleneck, the finite band should **name the constraint class** without shame: “Diagram diagnosis needs a second sealed reviewer — about 3–5 weeks at current dual capacity.” Dual-omitted short bands produce Whitt-style later reneging. COVER/SCANCOMP/HOLETRUST already ban pad theater; CAPPLAN bans **ambition–capacity mismatch theater**.

**Kill:** Soon-default; dual-omitted short bands; coverage ads implying dual-backed C4 without dual roster.  
**Survive:** Finite dual-aware bands + Practice alternate; ambition ↔ dual FTE linkage.  
**Wound:** Multi-week bank QA ≠ lobby minutes — keep days/weeks grain.

---

## CXLVII.7 Claim table

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| \(L=\lambda W\) links backlog, throughput, wait | FACT | High | Little 1961; stationarity caveats |
| Near-100% util + variability inflates waits; buffer with capacity/time/inventory | FACT (textbook) | High | Hopp & Spearman 2011; transfer limits |
| Universal double reading multiplies workforce need | FACT | High | Wing & Langelier 2009; domain transfer |
| Dual cost-effectiveness not automatic | FACT | High | Posso 2016; Brown 1996 |
| Dual-aware FILLETA bands + headroom > dual-omitted short clocks | HYPOTHESIS | Medium–High | Needs CAPPLAN-* |
| Parents accept longer bands when dual constraint is named | FOUNDER BELIEF | Medium | CBC × HOLETRUST/WTP |
| Dual Rater Score™ improves learning or trust | SPECULATION | Low | Refuse |
| Exact national mammography FTE deltas apply to MindCraft | SPECULATION | Low | Mechanism only |

---

## CXLVII.8 Product surface — SAFE-CAPPLAN claim contract

1. FILLETA estimator exposes a **dual component**: dual-required backlog ÷ dual throughput (plus arbitration tail).  
2. Dual throughput uses **independent second-rater roster minutes**, not first-rater leftover vibes or mid-session tutors.  
3. Written **utilization ceiling** for dual capacity; breach → widen bands and/or hire — never clear T1–T6.  
4. Copy may name **“second sealed check / dual capacity”** — ban child-deficit and hospital cosplay.  
5. Always-dual proposals need a **CAPPLAN sheet** (dual FTE, util, projected \(W\)) before brand language.  
6. `eta_skipped_dual_flag` is a **critical integrity incident** (same family as softpass-for-date).  
7. Hire/contract dual capacity under WORKFORCE rules — no Dual Rater Score™; no Discord-emoji panel.  
8. Telemetry: `dual_capacity_util`, `fill_eta_dual_component_ok`, `dual_backlog_age_p50` — demote Dual Rater Score™ NS.  
9. Practice alternate remains mandatory while dual wait runs (FILLETA × STUDHOLE).  
10. Template-trust inheritance (NEXT_LAB 148) may later cut dual load — never assume clone single-rater early.

---

## CXLVII.9 Doctrine — SAFE-CAPPLAN (provisional)

1. **Dual minutes are capacity** — first-class FILLETA line, not optional polish.  
2. **Little identity governs honesty** — short \(W\) without \(\lambda\) or lower \(L\) is a lie.  
3. **Headroom against variability** — refuse 100% dual util as plan (Hopp/Spearman buffer logic).  
4. **Triggers stay sacred** — capacity pain widens bands or hires; never clears T1–T6 / seals.  
5. **Always-dual is a staffing program** — Wing/Langelier lesson; not a free integrity sticker.  
6. **Name the dual constraint** in wait copy when it binds (Maister × Whitt accuracy).  
7. **Ambition ≤ dual roster** — Kane use evidence requires funded dual for parent-facing figured C4.  
8. **No Dual Rater Score™ / Capacity Score™ / Reviewer Minutes NS**.  
9. **No hospital-cosplay / ACT / complete-visual-by-date guarantees** from dual capacity packaging.  
10. Copy spine: “Diagram diagnosis for this topic: not sealed yet. Needs a second reviewer — about 3–5 weeks at current dual capacity. Sealed Practice with the key shown can start sooner when available.”

**Confidence:** High on Little / Hopp–Spearman buffer logic / Wing–Langelier workforce multiplier *with transfer limits*, and on Posso/Brown cost non-automaticity. Medium on exact util ceilings, dual-minute medians, and whether naming “dual capacity” helps or confuses parents (CAPPLAN-*). High that dual-omitted ETAs and ETA-skipped dual are commercially toxic under Map trust.

---

## CXLVII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| CAPPLAN-1 | Dual-aware FILLETA estimator vs single-rater-fantasy estimator under equal dual backlog | Ops A/B | `fill_eta_honesty_ok`; `eta_skipped_dual_flag`; slip count |
| CAPPLAN-2 | Headroom util ceiling (e.g. 70% vs 95%) under injected ticket spike | Ops A/B | Band stability; dual backlog age; post-promote repair |
| CAPPLAN-3 | Parent copy names “second sealed check capacity” vs vague “verifying” under equal actual \(W\) | Copy A/B | Trust; anger/uncertainty; WTP |
| CAPPLAN-4 | Triggered dual + CAPPLAN vs always-dual costume at fixed dual FTE | Ops A/B | Fill bands; repair catch; throughput |
| CAPPLAN-5 | Parent CBC: longer dual-honest band vs short band that skips dual | CBC | Trust; backlash; purchase intent |
| CAPPLAN-QUAL | 8 ops + 8 parents: what dual-capacity sentence is clear vs hospital-cosplay? | Qual | CAPPLAN codebook |

**Falsifiers:** Dual-aware bands worsen trust vs vague “verifying” *and* honesty_ok equal → keep dual in estimator silently; still refuse ETA-skipped dual. Headroom unused for 90 days with zero spikes → thin buffer carefully; do not celebrate 100% util. Always-dual at fixed FTE matches triggered dual on repairs *and* keeps bands acceptable → revisit DUALRATE breadth only with CAPPLAN sheet. Pre-register CAPPLAN-* before “double-verified complete visual” campaigns.

---

## CXLVII.11 So what for MindCraft commercially

- **Copy:** “Second sealed check — about N–M weeks at current dual capacity.” Ban hospital cosplay and Dual Rater Score™.  
- **Product:** Split backlog estimator; dual util ceiling; `eta_skipped_dual_flag`; Practice alternate while waiting.  
- **Growth:** Sell **funded integrity** — dual minutes budgeted like tutor hours — against fake-fast visual diagnosis.  
- **Positioning:** Against ChatGPT fluency *and* against edtech that stamps “double-checked” without a second human or burns two SMEs on every MC for costume.  
- **Metric:** `dual_capacity_util`; `fill_eta_dual_component_ok`; dual backlog age; stratified repair — demote Dual Rater Score™.  
- **Kill list:** Dual-omitted FILLETA; ETA-skipped dual; always-dual without FTE; 100% util plans; Capacity Score™; complete-visual-by-date / ACT guarantees from dual packaging.  
- **Vision:** Maya’s diagram Map cells light when a **staffed** second reviewer could defend them — parents see slower dual-aware bands, not marketing clocks that quietly skipped the check.

---

## References (verified)

- Brown, J., Bryan, S., & Warren, R. (1996). Mammography screening: an incremental cost effectiveness analysis of double versus single reading of mammograms. *BMJ, 312*(7034), 809–812. https://doi.org/10.1136/bmj.312.7034.809  
- Hopp, W. J., & Spearman, M. L. (2011). *Factory Physics* (3rd ed.). Waveland Press.  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Little, J. D. C. (1961). A proof for the queuing formula: \(L = \lambda W\). *Operations Research, 9*(3), 383–387. https://doi.org/10.1287/opre.9.3.383  
- Maister, D. H. (1985). The psychology of waiting lines. In J. A. Czepiel, M. R. Solomon, & C. F. Surprenant (Eds.), *The service encounter* (pp. 113–123). Lexington Books.  
- Posso, M., Carles, M., Rué, M., Puig, T., & Bonfill, X. (2016). Cost-effectiveness of double reading versus single reading of mammograms in a breast cancer screening programme. *PLOS ONE, 11*(7), e0159806. https://doi.org/10.1371/journal.pone.0159806  
- Whitt, W. (1999). Improving service by informing customers about anticipated delays. *Management Science, 45*(2), 192–207. https://doi.org/10.1287/mnsc.45.2.192  
- Wing, P., & Langelier, M. (2009). Workforce shortages in breast imaging: Impact on mammography utilization. *AJR. American Journal of Roentgenology, 192*(2), 370–378. https://doi.org/10.2214/ajr.08.1665  
