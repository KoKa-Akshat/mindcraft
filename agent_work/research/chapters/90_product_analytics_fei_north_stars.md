# Part XC — Product Analytics for FEI North Stars

**Chapter status:** Living evidence + instrumentation brief — Researcher tick 2026-08-06  
**Primary question:** How should MindCraft instrument, govern, and commercially use FEI North Star events (`retry_120s`, `challenge_accept`, `transfer_pass`, `solo_transfer_pass`) without recreating vanity-metric theater or Goodhart-corrupted dashboards?  
**Owners:** Product analytics · Engineering · Brand · HITL ops · Red Team · Founders  
**Commercial job:** Ship a **SAFE-INSTRUMENT** doctrine: one FEI-aligned scoreboard that predicts durable competence and identity movement; demote DAU/streak/XP/accuracy as North Stars; validate leading events before marketing them; protect against metric gaming by students *and* by the company.

**Builds on:** Parts I.3 / VIII / IX Experiment C / XXI (Metrics Dictionary), XXXIV (claim ladder), XLIII (SAFE-HABIT), LXX (SAFE-LABMETA), LXXXVI (SAFE-PROOF). Immediate product ask in `NEXT_LAB.md`: align analytics with Part XXI. Sibling queue: 91 hint economy (peek cost once help metrics exist).

---

## XC.1 Why this chapter exists

The Constitution already *named* the right events. Production still mostly optimizes what is easy to count: opens, minutes, streaks, tonight-% correct, tokens, “felt helpful.” That gap is not a documentation problem — it is a **commercial operating system** problem.

**FOUNDER BELIEF under audit:** If MindCraft cannot see Fear → Evidence → Identity in the telemetry, the company will sell the competitors’ story by accident: engagement theater (Duo-like), answer fluency (ChatGPT-like), or blocked accuracy (cram-pack-like). Identity transformation without instrumented FEI is a speech, not a product.

**Claims we refuse as doctrine:**
1. DAU / streak / XP / time-on-app as learning North Stars.  
2. Blocked-session accuracy or Map green-% as readiness.  
3. Coach thumbs-up / help NPS / “felt helpful” without `solo_transfer_pass`.  
4. Shipping Experiment A–D without pre-registered primary events.  
5. A single composite FEI Score™ sold to parents as proof.  
6. Optimizing `retry_120s` alone until students click-farm retries.  
7. Marketing “science-backed metrics” without Kane-style interpretation/use arguments.  
8. Analytics as surveillance shame for parents or tutors (SAFE-PDASH / SAFE-HITL dignity).

---

## XC.2 Constructs

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Vanity metric** | Looks good; does not change decisions (Croll & Yoskovitz) | Raw DAU, downloads, streak length | Fake growth |
| **OMTM / NSM** | Focus metric for stage vs enduring success metric | Stage OMTM = `retry_120s`; NSM stack = challenge + transfer | Metric soup |
| **Goodhart / Campbell** | Target corrupts measure and process | Optimize accuracy → gaming | Corrupted FEI |
| **Gaming the system** | Exploit software regularities without learning (Baker) | Hint race, spam-retry, soft-wrong farm | Fake persistence |
| **IUA (Kane)** | Claims about *uses* of scores need evidence proportional to ambition | Parent deck claiming “identity” from 7-day retry | Overclaim |
| **SAFE-INSTRUMENT** | FEI events as governed product law | This chapter | Dashboard cosplay |

**Operational definition (HYPOTHESIS):** Analytics are *SAFE-INSTRUMENT complete* when (a) the four FEI core events fire reliably in production, (b) Experiment C–style lagged prediction ranks them above streak/DAU for 8-week challenge-seeking, (c) anti-gaming companions (`hint_binge`, `ai_reveal_rate`, motive tags) are co-primary gates, (d) marketing uses only IUA-backed interpretations (L0–L2 until L3 evidence), and (e) no composite FEI Score™ is sold as a product hero.

---

## XC.3 The four events — what they measure

**FACT (internal doctrine spine):** Part XXI already defines:

| Event | Definition (abridged) | FEI role |
|-------|----------------------|---------|
| `retry_120s` | New attempt within 120s of soft-wrong | Persistence under safety |
| `challenge_accept` | Chose harder level when offered (+ motive code) | Challenge-seeking |
| `transfer_pass` | Correct on varied item after mastery mark | Anti-fake-mastery |
| `solo_transfer_pass` | Transfer with AI/Solver closed or denied | Anti-crutch |

**HYPOTHESIS (working North Star composite, not a Score™):** Challenge-seeking under safety *with* transfer — mastery-motive `challenge_accept`, return after miss (`retry_120s`), delayed mixed / solo transfer — predicts identity movement better than streaks (I.3; Experiment C prior).

**Applied:** Ship these four first. Secondary Part XXI events (`coach_shown`, `write_exit_to_retry`, `hint_binge`, …) are *guards and mediators*, not substitute North Stars.

**Kill:** “We measure learning” while only shipping session accuracy + DAU.  
**Survive:** Named FEI events with motive tags and transfer co-primaries.

---

## XC.4 Vanity metrics lose — on purpose

**FACT (product analytics practice):** Lean Analytics distinguishes vanity metrics (impressive, non-actionable totals) from actionable metrics that change behavior; it further advocates focusing on a stage-appropriate One Metric That Matters rather than “data puking” dashboards (Croll & Yoskovitz, *Lean Analytics*, O’Reilly; OMTM essays at leananalyticsbook.com / O’Reilly).

**Applied (FOUNDER BELIEF → testable):** MindCraft’s *enduring* North Star is not a single SaaS OMTM forever — identity is lagging — but early-stage focus should pick **one FEI leading indicator at a time** (today: `retry_120s` under coach experiments) while keeping the **NSM stack** (`challenge_accept` + `transfer_pass` / `solo_transfer_pass`) as the company scoreboard that OMTMs must ladder into.

**Commercial implication:** Investor and parent decks may show growth oxygen (activation, retention) in an appendix. The *hero* learning claim must name FEI events or dated solo-transfer artifacts (SAFE-PROOF) — never streak length.

**Kill:** Streak / DAU / XP velocity as learning proof.  
**Survive:** FEI NSM stack + stage OMTM discipline.

---

## XC.5 When measures become targets — Campbell & Goodhart

**FACT:** Campbell’s law — the more a quantitative social indicator is used for decision-making, the more subject it is to corruption pressures and the more apt it is to distort the processes it monitors (Campbell, 1979, *Evaluation and Program Planning*, 2(1), 67–90, doi:10.1016/0149-7189(79)90048-X).

**FACT:** Goodhart’s law (and Strathern’s popular paraphrase) — when a measure becomes a target, it ceases to be a good measure — is the economics twin of the same corruption dynamic (Goodhart, 1975 monetary-policy statement; Strathern, 1997 paraphrase widely cited in accountability debates).

**Applied (HYPOTHESIS):** If tutors are paid on `retry_120s`, students will be coached to tap retry without sense-making. If marketing celebrates rising `challenge_accept` without motive codes, appearance-climate CTA wins (SAFE / TARGET / Part XXXVIII). If `transfer_pass` is gamed with isomorphic clones, fake mastery returns.

**Design rule:** Never attach high-stakes pay, shame ranks, or public heroboards to a *single* FEI event. Use **co-primary gates**: raise retry *without* raising `hint_binge` / `ai_reveal_rate`; raise challenge_accept *with* mastery-motive tag; raise transfer *with* declared hop + delayed mix (XXI.4).

**Kill:** FEI Score™ / single-KPI tutor commissions / parent shame ranks on retry.  
**Survive:** Multi-metric decision rule + qualitative spot-checks (SAFE-LABMETA).

---

## XC.6 Student gaming is also company risk

**FACT:** In intelligent tutoring systems, “gaming the system” — succeeding by exploiting software regularities (hint abuse, systematic guessing) rather than learning — is common and associated with poorer learning (Baker, Corbett, Koedinger & Wagner, 2004 line; Baker et al., 2009, AIED — tutor features explained a large share of gaming variance; Cocea, Hershkovitz & Baker — harmful gaming wastes learning opportunities).

**FACT:** Help-abuse / executive racing is already Constitution law under SAFE-HELP (Aleven/Koedinger; Roll et al., 2011; Aleven et al., 2016) — analytics must treat `hint_binge` and `help_executive_race` as *first-class companions* to FEI wins, not afterthoughts.

**Applied:** Instrument anti-gaming detectors *in the same ship* as FEI events. A week where `retry_120s` rises and `hint_binge` rises is **not** a FEI win — it is Campbell corruption in progress.

**Kill:** Celebrate raw retry/challenge lifts without gaming companions.  
**Survive:** XXI.4 decision rule as shipping gate.

---

## XC.7 Validity of uses — Kane before decks

**FACT:** Kane’s argument-based approach holds that what is validated are proposed *interpretations and uses* of scores, not the numbers themselves; more ambitious claims require more evidence; evaluating score *uses* requires evaluating consequences (Kane, 2013, *Journal of Educational Measurement*, 50(1), 1–73, doi:10.1111/jedm.12000; see also Kane, 1992, *Psychological Bulletin*).

**Applied (HYPOTHESIS):** Emitting `retry_120s` is an L0/L1 engineering fact. Saying “FEI is working” from a 2-week A/B is L1. Saying “we build math identity” from those events without 26w triangulation is an L3 claim without warrant (SAFE-LONGID / claim ladder XXXIV). Parent-facing “proof” should prefer dated solo-transfer artifacts (SAFE-PROOF) over composite meters.

**Commercial implication:** Marketing and sales get an **IUA card** per claim: event → interpretation → allowed use → required evidence → banned overclaim. No card → no ad.

**Kill:** “Science-backed identity growth” from unvalidated dashboards.  
**Survive:** Claim-laddered FEI reporting + Experiment C lagged prediction.

---

## XC.8 Product surface — instrumentation contract

| Surface | Required event / behavior | Banned substitute |
|---------|---------------------------|-------------------|
| Soft-wrong path | `retry_120s`, `coach_shown`, binge guards | Thumbs-up only |
| Level offer | `challenge_accept` + motive enum (mastery/appearance/norm) | Harder-click without why |
| Mastery mark | Delayed `transfer_pass` probe scheduled | Instant blocked green |
| Solver / AI | `solo_transfer_pass` / `ai_reveal_rate` | “Felt helpful” chat NPS |
| Experiment A | Pre-reg primary = `retry_120s` | Engagement-only success |
| Parent deck | Proof-age + named hop artifact | Streak / tonight-% hero |
| Tutor QA | FEI sample + talk/help guards | Hours booked NS |
| Board OMTM | One FEI leading metric per stage | Metric soup / DAU hero |

**Competitive foil:** Duo wins streak oxygen. ChatGPT wins executive completion counts. Cram packs win blocked accuracy. MindCraft differentiates by publishing (internally first, externally carefully) **persistence under safety + challenge with motive + delayed solo transfer** — the FEI scoreboard competitors cannot honestly claim without changing their products.

---

## XC.9 Doctrine — SAFE-INSTRUMENT (provisional)

1. **Ship the four** — `retry_120s`, `challenge_accept` (+motive), `transfer_pass`, `solo_transfer_pass` before any new vanity KPI.  
2. **NSM stack, stage OMTM** — enduring scoreboard is FEI+transfer; current sprint focuses one leading event.  
3. **Co-primary gates** — XXI.4: no FEI “win” if binge/reveal rises or transfer falls.  
4. **Anti-Goodhart** — no single-event pay, shame, or public heroboard; rotate checks; keep qualitative audits.  
5. **Anti-gaming companions** — `hint_binge`, `help_executive_race`, `ai_reveal_rate` ship with FEI.  
6. **Kane IUA for uses** — decks/ads need interpretation/use cards; ambition ≤ evidence (L0–L4).  
7. **Dignity** — analytics for product learning and tutor coaching, not parent/student humiliation.  
8. **Copy:** “We measure return after a miss, choosing harder for mastery reasons, and solving later without the model.” Never “we’re #1 for engagement.”

**Confidence:** High that vanity engagement metrics are weak durable-learning proxies (Lean Analytics practice + Constitution HID / SAFE-HABIT). High that Campbell/Goodhart corruption applies once FEI events become high-stakes targets. High that ITS gaming literature predicts students will exploit naive persistence metrics (Baker line). High that Kane IUA is the right hygiene for marketing uses. Medium that Experiment C will rank FEI events above streaks for 8-week challenge-seeking (pre-registered prior, not yet run). Medium on exact 120s window / motive enum reliability until instrumentation QA.

---

## XC.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| INSTR-1 | Do `retry_120s` / mastery-motive `challenge_accept` / `transfer_pass` beat streak & DAU predicting 8w challenge-seeking? | Lagged observational (Experiment C densify) | Ranked predictive validity; calibration plots |
| INSTR-2 | Does publishing `retry_120s` as tutor KPI without co-gates raise binge/spam-retry? | Ops A/B (gate vs single KPI) | `hint_binge`; true retry quality sample |
| INSTR-3 | Soft-wrong → coach instrumentation completeness vs dark funnel | Audit + fix ship | Event fire rate; missingness by surface |
| INSTR-4 | Motive-coded `challenge_accept` vs uncoded harder-click | A/B CTA | Mastery-motive share; later transfer |
| INSTR-5 | Parent CBC: FEI report card vs streak/accuracy hero deck | CBC (SAFE-WTP) | WTP; trust; comprehension |
| INSTR-QUAL | 10 Maya + 5 tutors: which dashboard numbers feel honest vs gamable? | Qual | Corruption codebook |

**Falsifier:** Streak/DAU predict 8w challenge-seeking and 26w identity as well as FEI events → still ban as *marketing* North Stars (habit≠identity); allow as oxygen metrics only.  
**Falsifier:** Co-primary gates stall shipping for >1 quarter with no better learning outcomes → simplify to two-event gate (`retry_120s` + `solo_transfer_pass`) temporarily; keep anti-gaming.  
**Falsifier:** Motive tags unreliable / demand-laden → drop parent-facing motive; keep internal coding research-only.

**Pre-register:** INSTR-* / Experiment C before any “our North Star proves identity” campaign (SAFE-LABMETA). Do not invent FEI Score™ packaging experiments that recreate Belief Score™ failures (SAFE-CALIB).

---

## XC.11 So what for MindCraft commercially

- **Copy:** Lead with “return after a miss,” “choose harder to learn,” “prove it later without the model.” Ban engagement/streak/accuracy hero claims as learning proof.  
- **Product:** Instrument Part XXI FEI core + gaming companions this quarter; wire Experiment A primary to `retry_120s`.  
- **Positioning:** Against Duo streak oxygen, GPT completion counts, and cram accuracy — for a FEI scoreboard tied to solo transfer.  
- **Metric law:** NSM = challenge-seeking under safety with transfer; OMTM rotates among FEI leadings; vanity demoted.  
- **Kill list:** DAU/streak/XP NS; blocked accuracy NS; FEI Score™; single-KPI tutor pay; thumbs-up≡learning; science-backed identity ads without IUA.  
- **Growth:** Parent/LEA decks sell dated proof + FEI process honesty (SAFE-PROOF × SAFE-PDASH); sales enablement uses IUA cards.  
- **Vision:** A thirty-year identity company measures the loop that builds identity — fear metabolized into evidence — not the vanity that only looks like school.

---

## References (verified)

- Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the Cognitive Tutor classroom: When students “game the system.” In *Proceedings of ITS / related Cognitive Tutor classroom studies* (gaming-the-system foundational line).  
- Baker, R. S. J. d., de Carvalho, A. M. J. B., Raspat, J., Aleven, V., Corbett, A. T., & Koedinger, K. R. (2009). Educational software features that encourage and discourage “gaming the system.” In *AIED 2009* (pp. 475–482). IOS Press. doi:10.3233/978-1-60750-028-5-475.  
- Campbell, D. T. (1979). Assessing the impact of planned social change. *Evaluation and Program Planning, 2*(1), 67–90. https://doi.org/10.1016/0149-7189(79)90048-X  
- Cocea, M., Hershkovitz, A., & Baker, R. S. J. d. (2009). The impact of off-task and gaming behaviors on learning: Immediate or aggregate? (EDM / ITS analyses of harmful gaming).  
- Croll, A., & Yoskovitz, B. (2013). *Lean Analytics: Use Data to Build a Better Startup Faster*. O’Reilly Media. (Vanity vs actionable metrics; One Metric That Matters.)  
- Goodhart, C. A. E. (1975). Problems of monetary management: The UK experience. (Origin of Goodhart’s law; later paraphrased in accountability literature.)  
- Kane, M. T. (1992). An argument-based approach to validity. *Psychological Bulletin, 112*(3), 527–535.  
- Kane, M. T. (2013). Validating the interpretations and uses of test scores. *Journal of Educational Measurement, 50*(1), 1–73. https://doi.org/10.1111/jedm.12000  
- Strathern, M. (1997). “Improving ratings”: Audit in the British university system. *European Review* (popular “when a measure becomes a target…” paraphrase of Goodhart in accountability contexts).  
- Internal Constitution: Parts I.3, VIII.3, IX Experiment C, XXI Metrics Dictionary; SAFE-HABIT / SAFE-HELP / SAFE-PROOF / SAFE-LABMETA / claim ladder XXXIV.
