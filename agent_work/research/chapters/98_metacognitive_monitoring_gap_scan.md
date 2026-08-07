# Part XCVIII — Metacognitive Monitoring in Gap-Scan

**Chapter status:** Living evidence + Diagnostic / gap-scan UX brief — Researcher tick 2026-08-07 (UTC hour 12 ≡ Red Team slot, but ch98 never written → prefer Researcher per rotation; researcher count since synthesizer v1.12 = 6 → Researcher)  
**Primary question:** How should MindCraft treat *metacognitive monitoring* inside gap-scan and related diagnostics — as a Monitoring Score™ to gamify, a confidence vibe to inflate, or a **control signal** that classifies knowledge vs confident misconception vs uninformed miss and routes FEI without corrupting the graph?  
**Owners:** Product (Diagnostic C4 / gap-scan / soft-wrong) · Engine (`evidence_update_policy` / confidence tiers) · Brand · Red Team  
**Commercial job:** Ship a **SAFE-MONITOR** doctrine that densifies SAFE-CALIB (Part L) and SAFE-COLD (Part LXXXI): elicit the right judgment type, separate absolute vs relative accuracy, use certainty to sort misconception from lack-of-knowledge, refuse Monitoring Score™ / “raise metacognition” theater, and prove value with `confidence_miss_tier` + weakness stability — not Belief Score™.

**Builds on:** Parts L (SAFE-CALIB), XLIX (SAFE-MISCON), LXXXI (SAFE-COLD), XXXIII (AI overtrust as *system* miscalibration), XC (FEI instrumentation). Product seams: gap-scan confidence ratings, hide-correctness probes, `/seed-assessment`, `/record-outcomes`, Layer-4 event schemas.

---

## XCVIII.1 Why this chapter exists

Part L already bans “raise confidence” as North Star and wires item-level confidence to feedback tiers. Gap-scan still tempts a second costume: **metacognition theater** — a Monitoring Score™, a “know thyself” splash, or treating a single easy/kinda/hard slider as proof of self-regulated learning.

MindCraft’s commercial wedge is not that students *feel* more metacognitive. It is that the product **uses monitoring judgments as diagnostic fuel**: distinguishing confident wrong (misconception / hypercorrection path) from low-confidence wrong (uninformed / scaffold path), and refusing to mint mastery fireworks from either. Competitors can ship a confidence emoji; few ship monitoring → classification → graph policy → FEI.

**FOUNDER BELIEF under audit:** Honest gap-scan requires *elicited* monitoring under destaked conditions (C4), not louder certainty — and monitoring without control (no change to routing/updates) is empty UX.

**Claims we refuse as doctrine:**
1. Monitoring Score™ / Metacognition % as North Star or parent KPI.  
2. “We teach metacognition” ads without judgment→control wiring.  
3. Global easy/kinda/hard alone ≡ calibrated monitoring science.  
4. Immediate post-item confidence ≡ delayed judgment-of-learning accuracy.  
5. Confidence slider without miss-class routing (Foster CA-alone null — Part L).  
6. Raise-metacognition / raise-confidence as identity transformation.  
7. Dunning–Kruger shaming as brand voice (Part L wound).  
8. Guaranteed ACT points from “metacognitive gap scan” packaging.

---

## XCVIII.2 Constructs (keep mechanisms distinct)

| Construct | Research meaning | MindCraft analogue | Not the same as |
|-----------|------------------|--------------------|-----------------|
| **Monitoring** | Judging own knowledge/performance (Nelson & Narens) | Item confidence; concept ease ratings | Identity survey |
| **Control** | Acting on those judgments (study, skip, restudy) | Soft-wrong route; challenge unlock; graph weight | Decorative slider |
| **EOL / JOL / FOK / RCJ** | Ease-of-learning; judgment of learning; feeling-of-knowing; retrospective confidence | Gap-scan ease ≈ EOL-ish; post-answer surety ≈ RCJ; restudy prompts ≈ JOL | One fused “metacog” number |
| **Absolute accuracy** | Match of mean confidence to mean accuracy | Bias / overconfidence index | Discrimination |
| **Relative accuracy** | Rank-order: higher conf → more likely correct | Resolution / Gamma-style discrimination | Calibration % vanity |
| **CRI / three-tier logic** | Certainty separates misconception vs don’t-know | High-conf wrong vs low-conf wrong classes | Always-reveal keys |
| **SAFE-MONITOR** | Gap-scan monitoring doctrine under SAFE-CALIB | This chapter | Metacognition costume ads |

**Operational definition (HYPOTHESIS):** Gap-scan monitoring is *SAFE-MONITOR compliant* when (a) judgments are **item- or concept-grain**, not only global vibe, (b) judgment **type** is labeled (prospective ease vs retrospective confidence), (c) outcomes + confidence jointly classify miss types for routing and graph updates, (d) C4 hide-correctness prevents answer-hunting that collapses monitoring into key-chasing, (e) marketing never sells Monitoring Score™, and (f) success is measured by weakness stability, miss-class hit rate, and later FEI — not by rising self-rated “metacognition.”

---

## XCVIII.3 Monitoring and control are a system — not a sticker

**FACT:** Nelson & Narens (1990, in Bower, *The Psychology of Learning and Motivation*, Vol. 26, Academic Press) — metamemory framework separates **monitoring** (EOL, JOL, FOK, retrospective confidence) from **control** (allocation of study, termination, strategy). Judgment types are not highly interchangeable; they can index different aspects of memory.

**Product translation:** Gap-scan’s concept-level easy/kinda/hard is closer to a coarse **EOL / expected competence** signal for seeding (`/seed-assessment`). Practice soft-wrong “how sure?” is closer to **retrospective confidence**. Do not market them as the same “metacognition feature,” and do not assume one slider fixes both.

**Kill:** One Metacognition Score™ merging EOL + RCJ + identity Likert.  
**Survive:** Named judgment types → named control actions.

---

## XCVIII.4 Delayed judgments beat fluency illusions (when the object is future recall)

**FACT:** Nelson & Dunlosky (1991, *Psychological Science, 2*(4), 267–270, doi:10.1111/j.1467-9280.1991.tb00147.x) — judgments of learning made after a short delay (cue-only) predict later recall far better than immediate JOLs (**delayed-JOL effect**). Immediate JOLs often track short-term accessibility, not durable learning.

**FACT:** Rhodes & Tauber (2011, *Psychological Bulletin, 137*(5), 791–813, doi:10.1037/a0021705) — meta-analysis: delaying JOLs yields large gains in **relative** accuracy (gamma; *g* ≈ 0.93) and a small memorial benefit (*g* ≈ 0.08). Delay is not magic for every product metric; it is a robust monitoring-accuracy lever for recall prediction.

**Applied (HYPOTHESIS):** MindCraft should not treat *immediate* post-answer confidence as a durable-mastery oracle. For restudy / spacing decisions (SAFE-SCHED / SAFE-FORGET), prefer delayed or cue-only “will you still get this?” prompts over fluency-right-after-feedback. For **miss classification** in gap-scan, retrospective confidence at answer time remains useful (CRI logic) even when it is a weak JOL for long-term retention.

**Kill:** Instant “I’m sure” after green check ≡ durable learning.  
**Survive:** Separate diagnostic RCJ (classify miss) from delayed JOL (schedule return).

---

## XCVIII.5 Math students mis-monitor — often toward overconfidence

**FACT:** Erickson & Heit (2015, *Frontiers in Psychology, 6*, 742, doi:10.3389/fpsyg.2015.00742) — high-school and undergrad samples showed **overconfidence** predicting math performance, with greater overconfidence in math than in comparison subjects in their designs; anxiety and overconfidence can co-exist and both impair adaptive monitoring/control.

**FACT:** Lingel, Lenhart & Schneider (2019, *ZDM*, ERIC EJ1222655) — seventh-graders showed **pervasive overconfidence**; monitoring precision differed by scale format and prospective vs retrospective timing; absolute, relative, and diagnostic accuracy indices are not interchangeable.

**FACT:** Foster (2021/2022, *IJSME*, doi:10.1007/s10763-021-10207-9) — confidence assessment alone is **non-inferior** on attainment and **not** a proven attainment booster (Part L load-bearing null).

**Commercial implication:** Gap-scan that only asks “how confident are you in algebra?” without item probes will inherit overconfidence bias and mint false greens (anti-SAFE-COLD). Item/concept probes + hide-correctness + confidence×outcome classification are the wedge; “metacognitive onboarding” copy without that spine is costume.

**Kill:** Confidence-only placement ≡ diagnosis.  
**Survive:** Monitoring judgments as *inputs* to classification under C4.

---

## XCVIII.6 Certainty of response — misconception vs don’t-know

**FACT:** Hasan, Bagayoko & Kelley (1999, *Physics Education, 34*(5), 294–299, doi:10.1088/0031-9120/34/5/304) — **Certainty of Response Index (CRI)** with MC items distinguishes misconceptions (wrong + high certainty) from lack of knowledge (wrong + low certainty) and from knowledgeable correct responses.

**HYPOTHESIS for MindCraft:** Gap-scan and FEI probes should treat high-confidence wrongs as **SAFE-MISCON / hypercorrection** candidates (Butterfield & Metcalfe lineage — Part L), and low-confidence wrongs as **uninformed / scaffold** candidates — never identical mastery deltas (Layer-4 `evidence_update_policy`).

**Wound:** CRI was developed in physics MC contexts; HS ACT items and Likert easy/kinda/hard are coarser. Survive the *logic*, not worksheet cosplay.

**Kill:** Equal graph update for every wrong.  
**Survive:** Confidence×correctness classes as first-class events.

---

## XCVIII.7 Practice-test feedback does not automatically fix miscalibration

**FACT:** Persistent miscalibration literature (e.g. introductory biology practice-test feedback studies — Niedjelski & colleagues line summarized in open reports such as PMC8442020 / *CBE—Life Sciences Education* calibration work) shows practice testing can improve average calibration for many students while **low performers often remain overconfident** and high performers can tip underconfident — feedback alone is incomplete.

**Product translation:** Do not promise “gap-scan calibrates you.” Promise: gap-scan **surfaces** mismatch under destaked conditions, then practice springboards + FEI do the hard work. Parent copy: “we separate sure-and-wrong from unsure,” not “we fix metacognition in one scan.”

**Kill:** One diagnostic ⇒ calibrated learner ads.  
**Survive:** Scan as evidence intake; calibration as longitudinal process (SAFE-CALIB + SAFE-LONGID).

---

## XCVIII.8 Gap-scan product spine (SAFE-MONITOR)

1. **Label the judgment** — Concept ease (seed) ≠ item retrospective confidence (probe) ≠ delayed JOL (return schedule).  
2. **Destake** — C4 hide-correctness during scan; no public shame ranks (SAFE-COMPARE).  
3. **Classify** — correct/incorrect × low/med/high → guess / slip / confident misconception / underconfident correct.  
4. **Control** — route: hypercorrection / contradicting-reason for high-conf miss; hug-then-dose for low-conf miss; challenge unlock for underconf correct (SAFE-CALIB stack).  
5. **Weight evidence** — high-conf wrong ≠ low-conf wrong in mastery updates (engine).  
6. **Refuse fireworks** — no day-one greens from ease ratings alone (SAFE-COLD).  
7. **Measure** — `confidence_miss_tier`, bias Δ, `worstWeakness` stability, later `solo_transfer_pass` — never Monitoring Score™.

**Marketing language that survives:** “Know what you know,” “sure-and-stuck vs guessing,” “honest scan,” “confidence that matches skill.”  
**Marketing language that dies:** “Metacognition Score™,” “we raise metacognition,” “calibrated in one quiz,” “guaranteed ACT from monitoring method.”

---

## XCVIII.9 Competitive wedge (brief)

Khan (explain-first, weak miss classification), Duo (binary correctness + streaks), Brilliant (scaffold dopamine), ChatGPT tutors (fluent **system** certainty → student overtrust — Part XXXIII) all under-instrument *student* monitoring→control. MindCraft’s L1-safe line: gap-scan is not a vibe check — it is **monitoring that changes what happens next**.

---

## XCVIII.10 Claim ladder

| Claim | Max ladder without new data |
|-------|------------------------------|
| Monitoring ≠ control; judgment types dissociate (Nelson & Narens) | L1 |
| Delayed JOLs improve relative accuracy vs immediate (Nelson & Dunlosky; Rhodes & Tauber) | L1 |
| Math learners often overconfident; indices are plural (Erickson & Heit; Lingel et al.) | L1 |
| CRI/confidence×accuracy separates misconception vs don’t-know (Hasan et al.) | L1 |
| CA alone does not raise attainment (Foster 2021) — monitoring must wire to control | L1 |
| C4 + confidence×outcome improves weakness ranking vs confidence-only or reveal-as-you-go | L1 product bet (MONITOR-* / CAL-4) |
| Monitoring Score™ / one-scan calibration transforms identity | **Banned** |

---

## XCVIII.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| MONITOR-1 | Item RCJ + outcome classification vs ease-only seed | 2-arm | `worstWeakness` stability; next-session accuracy |
| MONITOR-2 | High-conf-miss hypercorrection path vs uniform feedback | 2-arm | delayed isomorphic correction; `retry_120s` |
| MONITOR-3 | Delayed cue-only JOL for return scheduling vs immediate post-feedback “sure?” | 2-arm | spacing adherence; delayed probe accuracy (SAFE-SCHED) |
| MONITOR-4 | Hide-correctness + confidence vs reveal-as-you-go (shared CAL-4 / MIS-4) | 2-arm | completion; affect; weakness stability |
| MONITOR-5 | Parent CBC: “sure-and-wrong diagnosis” vs “Metacognition Score™” vs “raises confidence” | CBC | WTP; trust (SAFE-WTP) |
| MONITOR-QUAL | 10 Maya: meaning of easy/kinda/hard vs item “how sure?”; shame after high-conf miss | Qual | codebook: threat vs curiosity |

**Falsifier:** Ease-only seed matches item-classified routing on weakness stability → demote probe cost.  
**Falsifier:** Uniform feedback ≥ tiered after high-conf miss → demote MONITOR/CAL tiering.  
**Falsifier:** Parents prefer Metacognition Score™ CBC → rewrite GTM; do not ship score NS.

**Pre-register:** MONITOR-* before metacognition / Monitoring Score™ / one-scan-calibration / guaranteed-ACT-from-monitoring campaigns (SAFE-LABMETA). Do not steal CAL-*/COLD-*/MIS-*/SCHED-* arms — densify them.

---

## XCVIII.12 So what for MindCraft commercially

- **Copy:** “Honest scan — sure-and-stuck vs guessing.” Never Monitoring Score™ or “we raise metacognition.”  
- **Product:** Named judgments; C4; confidence×outcome classes; tiered control; no day-one fireworks from ease alone.  
- **Positioning:** Against confidence-theater edtech and fluent AI certainty; for monitoring that changes routing and graph weight.  
- **Metric:** `confidence_miss_tier` + weakness stability + FEI — demote Metacognition %.  
- **Kill list:** Monitoring Score™; metacognition ads without control wiring; ease-only ≡ calibration science; immediate surety ≡ delayed JOL; equal wrong updates; one-scan calibration; ACT guarantees from monitoring packaging.  
- **Growth:** Parent decks show a 2×2 (correct/wrong × sure/unsure) with routing consequences, not a metacog leaderboard.  
- **Vision:** Maya leaves gap-scan knowing the product heard *how sure she was*, not that she became a “metacognitive person” by finishing a quiz.

---

## XCVIII.13 Doctrine — SAFE-MONITOR (provisional)

1. **Monitoring without control is costume** — Nelson & Narens: judgments must change study/routing/updates.  
2. **Name the judgment** — EOL-ish ease ≠ RCJ ≠ delayed JOL.  
3. **Math overconfidence is expected** — design for bias, do not shame (Erickson & Heit; Lingel).  
4. **Certainty sorts miss types** — Hasan CRI logic → SAFE-MISCON vs uninformed paths.  
5. **Delay when predicting future recall** — Nelson & Dunlosky; Rhodes & Tauber — not for every UI click.  
6. **CA/slider alone ≠ attainment** — Foster null; wire to SAFE-CALIB.  
7. **No Monitoring Score™** — prove with classification quality + FEI.  
8. **Densifies SAFE-COLD** — humble seed + probes; no fireworks from self-ratings alone.

**Confidence:** High that Nelson & Narens (1990) establish monitoring/control and dissociable judgment types. High that Nelson & Dunlosky (1991) and Rhodes & Tauber (2011) establish delayed-JOL relative-accuracy benefits. High that Erickson & Heit (2015) and Lingel et al. (2019) document math monitoring/overconfidence patterns and measure plurality. High that Hasan et al. (1999) justify certainty×accuracy misconception sorting. High that Foster (2021) blocks CA-alone attainment claims (Part L). Medium that MindCraft’s specific gap-scan UX will move weakness stability — instrument MONITOR-* before metacognition brand campaigns.

---

## References (verified)

- Erickson, S., & Heit, E. (2015). Metacognition and confidence: Comparing math to other academic subjects. *Frontiers in Psychology, 6*, 742. https://doi.org/10.3389/fpsyg.2015.00742  
- Foster, C. (2022). Confidence assessment and achievement in mathematics: A quasi-experimental study. *International Journal of Science and Mathematics Education, 20*, 1411–1429. https://doi.org/10.1007/s10763-021-10207-9  
- Hasan, S., Bagayoko, D., & Kelley, E. L. (1999). Misconceptions and the Certainty of Response Index (CRI). *Physics Education, 34*(5), 294–299. https://doi.org/10.1088/0031-9120/34/5/304  
- Lingel, K., Lenhart, J., & Schneider, W. (2019). Metacognition in mathematics: Do different metacognitive monitoring measures make a difference? *ZDM, 51*, 587–600. ERIC EJ1222655.  
- Nelson, T. O., & Dunlosky, J. (1991). When people’s judgments of learning (JOLs) are extremely accurate at predicting subsequent recall: The “delayed-JOL effect.” *Psychological Science, 2*(4), 267–270. https://doi.org/10.1111/j.1467-9280.1991.tb00147.x  
- Nelson, T. O., & Narens, L. (1990). Metamemory: A theoretical framework and new findings. In G. H. Bower (Ed.), *The psychology of learning and motivation* (Vol. 26, pp. 125–173). Academic Press.  
- Rhodes, M. G., & Tauber, S. K. (2011). The influence of delaying judgments of learning on metacognitive accuracy: A meta-analytic review. *Psychological Bulletin, 137*(5), 791–813. https://doi.org/10.1037/a0021705  
