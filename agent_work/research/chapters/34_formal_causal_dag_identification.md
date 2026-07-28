# Part XXXIV — Formal Causal DAG + Identification

**Chapter status:** Living evidence brief — Researcher tick 2026-07-28  
**Primary question:** What causal claim can MindCraft’s FEI experiments actually *identify* — and which confounders, mediators, and colliders silently kill marketing language?  
**Owners:** Learning Science · Product analytics · Red Team · Growth (claims discipline)  
**Commercial job:** Make every public claim map to an identified estimand, or kill the claim.

---

## XXXIV.1 Why this chapter exists

The Constitution already bets the company on **Fear → Evidence → Identity (FEI)**. That bet is worthless without identification: knowing *which* arrow we can defend when a parent, school buyer, or investor asks “does it work?”

**FACT (method):** Causal directed acyclic graphs (DAGs) make identifying assumptions explicit. Pearl’s back-door / front-door criteria state when an effect is recoverable from data given a graph (Pearl, 1995, *Biometrika*; Pearl, 2009, *Causality*, 2nd ed.; Pearl, 2009 overview, *Statist. Surv.*, doi:10.1214/09-SS057).

**FACT (ed-tech application):** Weidlich, Hicks & Drachsler (2023/24, *ETR&D*, doi:10.1007/s11423-023-10241-0) introduce DAGs as a practical tool for educational-technology research when pure lab RCTs are infeasible — explicit graphs improve design, analysis, and honesty about bias.

**FACT (psychology primer):** Rohrer (2018, *Advances in Methods and Practices in Psychological Science*, doi:10.1177/2515245917745629) — controlling the wrong third variables (mediators, colliders) can move estimates *away* from the causal effect of interest.

**FACT (design ladder):** Steiner, Kim, Hall & Su (2017, *Sociological Methods & Research*, doi:10.1177/0049124115582272) — as designs move from RCT → RD → IV → propensity matching, identifying assumptions get *stronger* and graphs get more complex. Less control over assignment ⇒ harder identification.

**Product translation:** “FEI works” is not a slogan. It is a family of estimands. Experiment A identifies one narrow effect. Observational dashboards usually identify none.

---

## XXXIV.2 Vocabulary MindCraft must use

| Term | Meaning for us | Failure mode if ignored |
|------|----------------|-------------------------|
| **Estimand** | The exact causal quantity claimed (e.g., effect of wizard coach on `retry_120s`) | Vague “works” claims |
| **Identification** | Whether that quantity is recoverable from the design + assumed DAG | Beautiful charts, zero causal authority |
| **Confounder** | Common cause of treatment and outcome (opens a back-door) | Selection bias sold as product lift |
| **Mediator** | Variable on the causal path (e.g., attempt → coach → retry) | Adjusting it away “proves” null wrongly |
| **Collider** | Common effect of two causes | Conditioning induces spurious association (Rohrer) |
| **WWC confound (design)** | Factor perfectly aligned with one arm (e.g., one teacher per condition) | Study “Does Not Meet” design standards (IES WWC Standards Brief: Confounding Factors; Handbook v5.0) |

**FOUNDER BELIEF:** Growth language should name the estimand in one clause. If the clause cannot be written, the claim is banned.

---

## XXXIV.3 Working FEI DAG (MindCraft product graph)

**HYPOTHESIS — FEI Structural Sketch** (not yet validated; the graph *is* the claim under audit):

```
U_anxiety, U_prior, U_parent ──► Treatment assignment (if not randomized)
         \         \         \
          ▼         ▼         ▼
SoftWrongUX ──► CoachShown ──► Retry120s ──► ChallengeAccept ──► TransferPass ──► IdentityItem
     ▲                │              │                │                 │
     │                └─► HintBinge ──┘                │                 │
StoryFrame ───────────────────────────────────────────┘                 │
MapFill ◄───────────────────────────────────────────────────────────────┘
TutorWitness ───────────────────────────────────────────────────────────► IdentityItem
```

Nodes of commercial interest:

1. **Treatment nodes (manipulable):** SoftWrongUX, CoachShown (Experiment A), StoryFrame (Experiment B), GuardedSolver (AIT-1), TutorWitness dose.  
2. **Proximal outcomes:** `retry_120s`, `challenge_accept`, `solo_transfer_pass`.  
3. **Distal outcomes:** identity item, course intent, retention/WTP (parent).  
4. **Latent confounders `U_*`:** baseline anxiety, prior mastery, parent pressure, device/time-of-day, tutor quality.

**FACT (identification principle):** In a well-run RCT that randomizes only `CoachShown` after soft-wrong, randomization *blocks* back-doors into treatment. The total effect of Coach → Retry is identified *without* adjusting for post-treatment mediators — and **must not** adjust away the pathway through reduced hint-binge if that pathway is part of the intended mechanism (Pearl back-door; Rohrer on mediators).

**HYPOTHESIS:** IdentityItem is *not* identified by a 2-week A/B on coach alone. Path length + measurement demand effects (Part XIII open problem) leave multiple open back-doors (`U_parent` → IdentityItem; tutor talk outside the product).

**Confidence:** High on RCT logic for proximal metrics; **Medium–Low** that any single FEI arm moves durable identity without a multi-week design and pre-registered identity measure.

---

## XXXIV.4 What Experiment A actually identifies

Recall Experiment A (core OS Part IX): wizard coach on soft-wrong → primary `retry_120s`.

**FACT / DESIGN RULE:**

| Estimand | Identified by Exp A? | Notes |
|----------|----------------------|-------|
| Effect of coach on `retry_120s` | **Yes**, if randomized, low attrition, no arm-aligned confound | Primary |
| Effect of coach on same-session accuracy | Partially | Secondary; watch hint-binge mediation |
| Effect of coach on `challenge_accept` @ 1–2 weeks | Only with pre-registered follow-up + analysis set | Often underpowered |
| Effect of coach on math identity | **No** (under this design) | Too distal; demand effects |
| “FEI works” / “identity transformation” | **No** | Category error — A is one arrow |

**WWC-relevant kill conditions (FACT from WWC confounding brief):**

- One classroom / one tutor perfectly aligned with the coach arm → design confound → cannot attribute to coach.  
- Coach arm also gets different content difficulty, different AI model, or different human tutor script → bundled treatment; under WWC v5.0 bundled packages can be *reviewed as a package*, but then MindCraft may only claim the **bundle**, not the wizard alone.  
- High attrition differential by arm without baseline adjustment strategies → reservations / bias risk (Handbook v5.0 compositional-change discussion).

**Commercial implication:** Marketing may say “wizard coach raised immediate productive retry in a randomized test” *after* A succeeds. Marketing may **not** say “FEI proven” or “builds math identity” from A alone.

---

## XXXIV.5 Observational product analytics — what is *not* identified

Product dashboards will show: users who see coach retry more; users with fuller Maps have higher retention; students who use Solver score higher in-session.

**FACT (Rohrer / Pearl):** Those associations are compatible with many graphs:

| Spurious story | Graph sketch | Why it fools growth |
|----------------|--------------|---------------------|
| Motivation confounder | `U_motivation → CoachUse` and `U_motivation → Retry` | Engaged kids click everything |
| Collider stratification | Conditioning on “finished mission” (common effect of skill + treatment) | Looks like treatment hurts finishers |
| Mediator over-control | Regress identity on coach *adjusting for* transfer_pass | Erases the mechanism we sell |
| Reverse causality | Low identity → avoid coach / avoid hard items | “Coach users are already confident” |

**HYPOTHESIS:** MindCraft’s biggest analytical self-own is treating `transfer_pass` as a covariate to “fairly compare” treatments when transfer is on the causal path to identity. That is mechanism erasure, not rigor.

**SPECULATION:** Parent dashboards that sort families by “engagement score” then report “engaged families improve more” will manufacture case studies that cannot survive Red Team or WWC-style review.

**Ban list for GTM:**

1. Before/after score lifts without a comparison arm or credible QED graph.  
2. “Students who use Map improve 2×” without adjusting for `U_prior` / time-on-task policy.  
3. Streak ↔ learning correlations as proof (already banned as North Star).  
4. Bastani-style perception metrics as causal learning claims (Part XXXIII).

---

## XXXIV.6 Identification ladder for MindCraft claims

| Claim strength | Minimum design | DAG requirement | Allowed copy |
|----------------|----------------|-----------------|--------------|
| **L0 — Mechanism story** | None | Graph labeled HYPOTHESIS | “We believe…” / founder belief |
| **L1 — Proximal causal** | RCT / good cluster RCT | Treatment node randomized; primary pre-registered | “Raised retry / challenge-seeking in test” |
| **L2 — Learning causal** | RCT + delayed solo / transfer | AI-off or held-out items; Part XXXIII bar | “Improved solo transfer vs control” |
| **L3 — Identity causal** | Multi-week RCT + identity items + demand controls | Blocks `U_parent`, tutor talk; pre-reg | “Shifted math self-concept measures” |
| **L4 — Market causal** | Field experiment on WTP/retention | Parent/school assignment graph | “Raised retention / WTP intent” |

**FOUNDER BELIEF:** Ship L1 proofs fast; never sell L3 with L1 data. Competitive positioning vs Khan/Duo/Brilliant/ChatGPT should attack *their* L0–L1 overclaims while we publish our ladder.

**Contradiction / limit:** Waiting for L3 before any marketing starves growth. Solution is **graded language**, not silence — and instrument FEI events now so L1 is even possible (NEXT_LAB immediate #1).

---

## XXXIV.7 Confounders specific to FEI / story / AI stacks

**HYPOTHESIS — MindCraft confound registry** (measure or randomize away):

| Confounder / bias | Hits which claim? | Mitigation |
|-------------------|-------------------|------------|
| Baseline anxiety / stereotype threat | Soft-wrong, coach, story | Stratify or measure pretest (Part XXIV) |
| Prior concept mastery | Transfer, Map fill | Gap-scan / graph eventCount as covariate *pre-treatment* |
| Parent homework pressure | Identity, retention | Separate parent messaging A/B; don’t pool |
| Tutor quality (human) | “AI + tutor” package | Nested assignment; avoid one-tutor-per-arm |
| Content difficulty drift | Any practice A/B | Fix item bank per arm (Part XXXIII keys lesson) |
| Time-on-task / session length | Engagement→learning | Cap or equalize exposure policy |
| AI model version change mid-test | Solver guards | Pin model; log version as design factor |
| Selection into Solver help | Crutch vs learning | Randomize offer; instrument `ai_reveal_rate` |

**FACT (Steiner et al.):** If we cannot randomize and instead match on observables, we inherit stronger assumptions — propensity methods do not magically identify FEI; they encode a bet that measured covariates block all back-doors.

**FACT (Weidlich et al.):** Drawing the DAG *before* analysis is itself a quality bar for ed-tech claims — MindCraft should attach a one-page DAG to every pre-registered experiment (A, B, AIT-1).

---

## XXXIV.8 Commercial implication — positioning and kill rules

**So what for MindCraft commercially:**

1. **Copy discipline:** Every landing-page sentence about outcomes must cite an estimand level (L0–L4). Default public claims stay at L0/L1 until A/AIT land.  
2. **Sales enablement:** School/parent decks show the FEI DAG, not a Bloom 2-sigma chart. Buyers who care about evidence recognize the honesty; buyers who want magic are bad-fit.  
3. **Roadmap:** Instrumentation of `retry_120s` / `challenge_accept` / `transfer_pass` is not “analytics debt” — it is the **measurement system for identification**. Without it, no L1.  
4. **Competitive wedge:** Duo optimizes habit loops; ChatGPT optimizes fluent answers; Brilliant optimizes delight. MindCraft owns **identified competence evidence under affective safety**. That wedge dies if we market unidentified vibes.  
5. **Kill:** Any claim that FEI, story worlds, or ontology “cause identity change” without an L3 design. Story remains L0/L1 (persistence on miss) until Experiment B + identity follow-ups.

**Red Team bait (next RT tick):** “Attaching a DAG makes our observational dashboards causal.” — Should be killed; graphs without design still leave `U_*` open.

---

## XXXIV.9 Experiments spawned / tightened

| ID | Question | Design | Primary | Falsifier |
|----|----------|--------|---------|-----------|
| DAG-0 | Can we publish a one-page FEI DAG + estimand card for Exp A / AIT-1? | Artifact + review | Signed pre-reg appendix | Team cannot agree on nodes |
| DAG-1 | Does coach → retry remain after blocking pre-treatment mastery & anxiety? | Exp A + covariates **pre** only | `retry_120s` | Effect vanishes → was selection |
| DAG-2 | Does adjusting for `transfer_pass` (mediator) spuriously null coach → identity? | Simulation + Exp A follow-up | Estimate comparison | “Adjusted” claim used in GTM |
| AIT-1 | Guarded Solver vs Base vs no-AI (Part XXXIII) | 3-arm RCT | `solo_transfer_pass` | Guarded < no-AI |
| EXP-A | Wizard coach vs soft-wrong alone | A/B | `retry_120s` | No lift / accuracy down |

---

## XXXIV.10 Confidence table

| Claim | Label | Confidence | Needs |
|-------|-------|------------|-------|
| DAGs clarify identification in ed-tech | FACT | High | Cite Weidlich; use in pre-reg |
| Exp A identifies coach → retry under RCT | FACT (logic) | High | Run A without arm confounds |
| Observational “Map users improve” is causal | SPECULATION if claimed | Kill until QED/RCT | — |
| FEI distal identity identified by 2-week coach A/B | HYPOTHESIS (false) | High that **not** identified | Longer design |
| Graded L0–L4 claim ladder is commercially optimal | FOUNDER BELIEF | Medium | Test sales call comprehension |
| Propensity matching recovers FEI without randomization | HYPOTHESIS (optimistic) | Low–Medium | Steiner assumptions rarely hold |

---

## XXXIV.11 What this chapter refuses

- Bloom 2-sigma as MindCraft proof.  
- “Tutoring is free” / explanations-as-product.  
- Streaks as causal learning evidence.  
- Fabricated DOIs.  
- Equating a drawn DAG with a completed experiment.

**Bottom line:** The FEI loop is the product thesis. Identification is the honesty layer. Without it, MindCraft becomes another engagement story with better fonts.
