# Part LXXVII — Adaptive Spacing Algorithms vs Fixed Calendars

**Chapter status:** Living evidence + product/engine brief — Researcher tick 2026-08-04  
**Primary question:** When (if ever) should MindCraft replace horizon-matched *fixed* return calendars with *adaptive* lag models (SM-2 / FSRS-style / half-life regression), and how do we do that without shipping black-box “perfect brain interval” brand cosplay?  
**Owners:** Engine (return scheduler) · Product (Practice/Map Returns) · Growth/copy · Red Team  
**Commercial job:** Ship a **SAFE-ADAPT** doctrine: keep SAFE-SCHED’s inspectable horizon calendar as the *default*; allow adaptive *modulation inside declared bands*; refuse SM-2/FSRS/Duo-HLR as hero marketing or as a substitute for transfer probes.

**Builds on:** Part XXIX (MoC), LXXIV (SAFE-SCHED), LXXVI (SAFE-FORGET), LXIII (SAFE-EXAM), LXVII (SAFE-ONTOLOGY).

---

## LXXVII.1 Why a third spacing chapter

SAFE-SCHED answered *what schedule shape* (ISI×RI, delayed first return, equal-ish lags). SAFE-FORGET answered *how to show decay honestly*. Competitors and eng blogs answer with a third move: **personalize the lag with an opaque model** — SM-2 ease factors, FSRS stability/difficulty, Duolingo half-life regression — and sell that as the science.

**FOUNDER BELIEF under audit:** Parents will pay for *inspectable returns matched to an exam/homework horizon* more than for “our AI found your perfect interval”; adaptive models may still *win retention efficiency* if they stay subordinate, auditable, and measured on delayed math transfer — not flashcard MAE.

**Claims we refuse as doctrine:**
1. SM-2 / Anki / FSRS as the MindCraft brand story.  
2. Black-box “optimal interval AI” with no parent/student-visible due date rationale.  
3. Flashcard recall-prediction gains ≡ ACT / solo_transfer readiness.  
4. Engagement / DAU lift from adaptive SRS ≡ learning or identity (Settles wound).  
5. Expanding adaptive schedules as default for multi-month RI (SAFE-SCHED kill retained).  
6. Streaks / daily open as the adaptive engine.  
7. Guaranteed retention % or ACT points from any scheduler.

---

## LXXVII.2 Constructs (algorithm language)

| Construct | Research / eng meaning | MindCraft analogue | Failure mode if misused |
|-----------|------------------------|--------------------|-------------------------|
| **Fixed / calendar lag** | Same ISI rule for a cohort (or RI band) | Exam-horizon Return queue | One-size misses item difficulty |
| **Adaptive scheduler** | Next ISI from learner×item history | Optional modulator on due date | Opaque brain-AI cosplay |
| **SM-2** | Heuristic ease-factor expanding schedule (Woźniak / SuperMemo 2) | Anti-pattern as hero | Ease hell; vocab-shaped UX |
| **FSRS / DSR** | Difficulty–Stability–Retrievability models; predict recall prob | Possible *engine* candidate later | Flashcard MAE sold as math science |
| **Half-life regression (HLR)** | Trainable decay half-life (Settles & Meeder) | Lexeme-memory, not FEI | Engagement-as-proof |
| **Personalized review** | Select *what* to review given history (Lindsey et al.) | Priority among due Returns | Random “smart” without lag honesty |
| **SAFE-ADAPT** | Doctrine: calendar first; adapt inside bands | See LXXVII.9 | Black-box SRS brand |

**Operational definition (HYPOTHESIS):** MindCraft may adapt a concept’s next return ISI only inside a **declared band** derived from RI (e.g. ±30% of the SAFE-SCHED horizon lag), using inspectable inputs (last proof age, fail/pass on generation Returns, bridge-gap severity) — never a silent SM-2/FSRS clone that rewrites due dates without showing *why* and *when*.

---

## LXXVII.3 Adaptive scheduling can beat fixed spacing — in the domains studied

**FACT (lab optimization):** Pavlik & Anderson (2008, *Journal of Experimental Psychology: Applied*, 14(2), 101–117, doi:10.1037/1076-898X.14.2.101) — ACT-R–based scheduler that chooses practice timing to maximize long-term gain per unit practice time outperformed comparison schedules on recall accuracy and latency for paired-associate / fact learning; optimal intervals *lengthen* as items stabilize.

**FACT (classroom personalized review):** Lindsey, Shroyer, Pashler & Mozer (2014, *Psychological Science*, 25(3), 639–647, doi:10.1177/0956797613504302) — middle-school foreign-language course; semester-long retrieval software; on a cumulative exam ~1 month after semester end, **personalized** review beat **massed** (~+16.5% retention) and beat **one-size-fits-all spaced** (~+10.0%). Personalization here selected *which* material to review given inferred memory strength — not merely expanding flashcard ease cosplay.

**FACT (trainable production SRS):** Settles & Meeder (2016, *ACL*, 1848–1858, doi:10.18653/v1/P16-1174) — half-life regression on Duolingo data reduced recall-prediction error >45% vs several baselines; an operational study reported **~12% higher daily student engagement**. HLR generalizes Leitner/Pimsleur-style ladders with fitted features.

**Commercial implication:** “Adapt > fixed” is a *real* claim in vocab / flashcard / lexeme settings. MindCraft cannot Red-Team it out of existence. The fight is **domain transfer + brand honesty**, not denial of personalization.

**Kill:** “All adaptive SRS is pseudoscience.”  
**Survive:** Personalized review can beat generic spacing for item memory — measure whether that transfers to MindCraft’s FEI endpoints.

---

## LXXVII.4 SM-2 and FSRS are engineering lineages — not math-identity science

**FACT (SM-2 origin):** Woźniak’s SuperMemo SM-2 algorithm (documented 1987; SuperMemo 2 era) sets early intervals (classically 1 day then 6) then multiplies by an ease factor updated from 0–5 quality ratings — a hand-tuned expanding heuristic that powered decades of SRS apps (incl. Anki’s legacy default). It is **not** a peer-reviewed math-education RCT.

**FACT (modern flashcard ML):** Ye, Su & Cao (2022, *KDD ’22*, 4381–4390, doi:10.1145/3534678.3539081) — MaiMemo-scale memory model + stochastic shortest-path scheduler; reported ~12.6% improvement over SOTA methods on review-cost / memorization efficiency for language learning; deployed in production. Open FSRS builds on related DSR/DHP memory-state ideas and is widely used to **predict flashcard recall probability** and reduce review load vs SM-2 on Anki-style logs (engineering benchmarks; recall calibration ≠ transfer).

**HYPOTHESIS (domain mismatch):** Math FEI depends on *ingredient/bridge transfer under variation*, not binary “card recalled?” grades. Mapping a concept node to an SM-2 “card” collapses diagnosis (SAFE-ONTOLOGY), soft-wrong science (SAFE-MISCON), and solo transfer into a flashcard grade — the wrong grain.

**Wound:** Cite FSRS/Anki MAE wins as *engine inspiration* for predicting return urgency; do **not** cite them as evidence MindCraft will raise ACT or `solo_transfer_pass`.

**Kill:** “We use FSRS / SM-2 — therefore science-backed ACT prep.”  
**Survive:** Optional recall-probability models as *priority signals* among already-due Returns.

---

## LXXVII.5 Engagement and prediction accuracy are not identity outcomes

**FACT / Red Team wound (Settles):** The production win highlighted for HLR includes **daily engagement +12%**. Engagement is not FEI. Duo-shaped products can improve revisit rates while still selling streak theater and short-horizon expanding schedules that SAFE-SCHED already rejects for long RI.

**Cross-link (SAFE-FORGET):** Koriat & Bjork foresight bias — learners (and UIs) confuse fluent recent success with future recall. An adaptive model that *schedules* well can still be wrapped in mastery fireworks that *communicate* poorly.

**Cross-link (SAFE-SCHED / Karpicke & Roediger 2007):** Expanding schedules that look “smart” can lose to equal spacing at longer delays. Adaptive ≠ expanding; if the learner model quietly expands first intervals for dopamine, it collides with equal-ish long-RI doctrine.

**Commercial implication:** Never advertise “more daily opens from our scheduler” as learning proof. Instrument `retention_probe_7d/28d`, `solo_transfer_pass`, and `return_completed` — co-primary with any ADAPT A/B.

---

## LXXVII.6 Fixed calendars remain the right *product* default

**FACT (reuse — ISI×RI):** Cepeda et al. (2006; 2008) — optimal lag scales with retention interval; educational systems that ignore RI are inefficient. A **visible calendar** tied to homework/ACT date is the UX that makes ISI×RI *legible* to parents (SAFE-WTP / SAFE-FORGET proof-age).

**HYPOTHESIS — Calendar-first stack:**
1. **Layer A (default):** Horizon-matched equal-ish lags from exam/homework RI (SAFE-SCHED Exam Horizon Scheduler).  
2. **Layer B (optional adapt):** Within ± band, pull forward Returns with weak last proof / bridge-gap / failed generation; push back only after strong delayed probe — never past RI honesty.  
3. **Layer C (selection):** When many Returns are due, personalized *priority* (Lindsey-style) picks which concept to surface first — still showing due dates.  
4. **Hard ban:** Silent SM-2 ease hell; student-facing “easiness 2.1”; FSRS Score™; streak as scheduler.

**SPECULATION:** Inspectable Layer B will beat black-box Layer-B-as-brand on parent WTP even if flashcard MAE is slightly worse — test via CBC (LIX), not founder vibes.

---

## LXXVII.7 Anxiety, load, and adaptive aggression

**Ties to SAFE-DD / SAFE-EXPOSE / SAFE-PRIVACY:** Adaptive systems that schedule reviews at low predicted retrievability maximize desirable difficulty — and can spike threat for high-anxiety Maya.

**HYPOTHESIS:** Cap adaptive “pull forward” under high self-authored stress modifiers (shorten challenge density / soften stakes, not erase Returns). Never use affect to *delete* horizon honesty.

**Kill:** Anxiety Score™ that auto-masses practice “for comfort.”  
**Survive:** Affect → lag *aggression* caps inside SAFE-SCHED bands.

---

## LXXVII.8 Competitive positioning

| Competitor pattern | Mechanism | MindCraft response |
|--------------------|-----------|-------------------|
| Anki / FSRS mystique | Recall-prob optimization | Engine-only; no SRS brand |
| Duo HLR + streak | Engagement + lexeme half-life | Returns + MoC probes; streak demoted |
| Khan clear-and-forget | Local mastery | Aged evidence + calendar Returns |
| “AI perfect interval” edtech ads | Authority cosplay | Inspectable due + why chip |
| ACT cram packs | Massed week | Horizon calendar + late prove rail |

**Competitive wedge (FOUNDER BELIEF):** Sell “your Map shows the next return and why” — not “smarter than Anki.”

---

## LXXVII.9 Doctrine — SAFE-ADAPT (provisional)

1. **Calendar-first:** SAFE-SCHED horizon lags are the default product surface.  
2. **Adapt inside bands:** Personalization may modulate ISI only within declared RI-derived bounds; show due date + reason.  
3. **Selection ≠ mystique:** Prefer Lindsey-style *what to review among due* over silent SM-2 *rewrite of science*.  
4. **Flashcard lineage ≠ FEI proof:** SM-2 / FSRS / HLR evidence is vocab/item-memory; do not claim ACT/transfer from it.  
5. **Engagement ≠ learning:** Ban DAU/streak lifts as scheduler success.  
6. **No black-box brand:** No “perfect interval AI,” FSRS Score™, or easiness theater.  
7. **Anxiety caps:** Stress modifiers limit adaptive aggression; never erase returns.  
8. **Measure FEI:** ADAPT-* wins only if delayed probes / solo transfer hold or rise vs fixed calendar.

**Confidence:** High that personalized review can beat massed and generic spaced for *item* memory (Lindsey; Pavlik). Medium that MindCraft Layer-B banding helps retention without hurting trust. Low–medium that off-the-shelf FSRS on concept nodes helps `solo_transfer_pass` (domain mismatch). High that SRS-as-brand collides with SAFE-SCHED / SAFE-FORGET / competitive wedge.

---

## LXXVII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| ADAPT-1 | Fixed horizon calendar vs calendar + within-band lag modulation | A/B after transfer_pass | retention@7/28; solo_transfer_pass |
| ADAPT-2 | Due-set priority (personalized selection) vs FIFO due queue (same lags) | A/B | 28d retention; return_completed |
| ADAPT-3 | Inspectable “due + why” UI vs opaque “smart review” queue | A/B + parent CBC | trust / WTP; retention (non-inferiority) |
| ADAPT-4 | FSRS-like urgency score as *priority only* vs full ISI rewrite | A/B | 28d retention; complaint/confusion rate |
| ADAPT-5 | Adaptive pull-forward under high stress: capped vs uncapped | A/B | anxiety state; retry_120s; retention |
| ADAPT-QUAL | 10 Maya + 10 parent: “smart algorithm” vs “returns on your calendar” copy | Qual | message resonance; SRS-brand allergy |

**Falsifier:** Adaptive arm raises opens/streaks while `retention_probe_28d` or `solo_transfer_pass` falls → demote adaptive claims; keep calendar-first.

**Pre-register:** ADAPT-* before any “AI spaced repetition” marketing (SAFE-LABMETA).

---

## LXXVII.11 So what for MindCraft commercially

- **Copy:** “Returns on your calendar — adjusted when evidence says so” — never “FSRS-powered brain optimization.”  
- **Product:** Ship Layer A Returns first; Layer B/C behind flags; every due chip shows horizon basis.  
- **Engine:** Decay + proof-age already exist — wire them to *visible* due dates before importing Anki math.  
- **Metric:** Co-primary retention/transfer; demote scheduler engagement vanity.  
- **Kill list:** SM-2/FSRS hero, black-box perfect-interval AI, engagement≡learning, flashcard MAE≡ACT.  
- **Growth:** Parent dashboard = next returns + why — feeds WTP without SRS cosplay.  
- **Vision:** Identity needs durable competence evidence; algorithms may *protect* evidence efficiently, but the product promise is honesty and transfer — not scheduler mystique.

---

## References (verified)

- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380. https://doi.org/10.1037/0033-2909.132.3.354  
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science*, 19(11), 1095–1102. https://doi.org/10.1111/j.1467-9280.2008.02209.x  
- Karpicke, J. D., & Roediger, H. L. (2007). Expanding retrieval practice promotes short-term retention, but equally spaced retrieval enhances long-term retention. *Journal of Experimental Psychology: Learning, Memory, and Cognition*, 33(4), 704–719. https://doi.org/10.1037/0278-7393.33.4.704  
- Lindsey, R. V., Shroyer, J. D., Pashler, H., & Mozer, M. C. (2014). Improving students’ long-term knowledge retention through personalized review. *Psychological Science*, 25(3), 639–647. https://doi.org/10.1177/0956797613504302  
- Pavlik, P. I., & Anderson, J. R. (2008). Using a model to compute the optimal schedule of practice. *Journal of Experimental Psychology: Applied*, 14(2), 101–117. https://doi.org/10.1037/1076-898X.14.2.101  
- Settles, B., & Meeder, B. (2016). A trainable spaced repetition model for language learning. In *Proceedings of the 54th Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 1848–1858). ACL. https://doi.org/10.18653/v1/P16-1174  
- Woźniak, P. A. (1987/archived). *SuperMemo 2: Algorithm* [technical documentation]. https://www.super-memory.org/archive/english/ol/sm2.htm  
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. In *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining* (pp. 4381–4390). ACM. https://doi.org/10.1145/3534678.3539081  
