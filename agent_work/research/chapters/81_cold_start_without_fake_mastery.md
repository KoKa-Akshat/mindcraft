# Part LXXXI — Cold-Start Without Fake Mastery

**Chapter status:** Living evidence + onboarding/copy brief — Researcher tick 2026-08-05  
**Primary question:** How should MindCraft initialize a student graph on day one so recommendations feel personal *without* manufacturing mastery fireworks, inflated greens, or “we already know you” theater?  
**Owners:** Product (gap-scan / PawHub / Map) · Engine (seed-assessment / priors / event sources) · Brand & copy · Parent trust · Red Team  
**Commercial job:** Ship a **SAFE-COLD** doctrine: humble priors + labeled seed evidence + hide-correctness probes; sell *honest mapping*, never day-one mastery or confidence≡mastery.

**Builds on:** Parts L (SAFE-CALIB), LXVII (SAFE-ONTOLOGY), LXXII (SAFE-GENQ), LXXVI (SAFE-FORGET), LXXIX (SAFE-FBTIME), LXXX (SAFE-BRIDGE). Product seam: `/seed-assessment`, C4 hide-correctness diagnostic, `population_priors`, `eventCount === 0` → Learn-next.

---

## LXXXI.1 Why this chapter exists

Every adaptive product faces the same commercial temptation at cold start: empty state feels broken, so the UI invents competence — green trees, “You’re already strong at…,” personalized paths from zero observations. Parents buy the fireworks. Students learn the app rewards confident self-report and hint-skipping. The graph then *lies* for weeks.

MindCraft’s gap-scan already does something sharper: confidence ratings → synthetic `assessment` events (source=`onboarding_assessment`) that *replace* prior seed, plus optional hide-correctness probes. That is the right *family* of move — **if** we refuse to market the seed as mastery, refuse easy-default skips, and keep Map language in “uncertain / untouched / early signal” until delayed proof arrives (SAFE-FORGET).

**FOUNDER BELIEF under audit:** The first session’s job is *diagnosis hygiene*, not delight-as-competence. Personalization that survives is “we asked hard questions and stayed honest about uncertainty,” not “your Map lit up on minute five.”

**Claims we refuse as doctrine:**
1. Day-one green Map / mastery fireworks ≡ personalization.  
2. Self-rated “easy” ≡ mastery or ACT readiness.  
3. Population prior alone ≡ student-specific diagnosis worth selling.  
4. Skip-scan / “I’ll explore” defaults that write easy/high mastery.  
5. Onboarding chat fluency or AI pep ≡ calibrated prior.  
6. Cold-start “Identity Score™” or “math person already” splash.  
7. Unverified generated keys as first diagnostic ground truth (SAFE-GENQ).

---

## LXXXI.2 Constructs

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Cold start** | No / little learner history for KT or recs | New `users/{uid}`; empty graph | Fake greens to fill void |
| **Prior (P(L0))** | Initial P(know skill) before observations | Ontology `population_priors`; Beta seeds | Sell prior as “your level” |
| **Seed evidence** | Labeled synthetic events from onboarding | `/seed-assessment` confidence map | Treat seed as FEI mastery |
| **Probe evidence** | Observed correctness without reveal theater | C4 hide-correctness items | Reveal keys → answer-hunting |
| **Calibration** | Confidence matches accuracy long-run | SAFE-CALIB; hard/kinda/easy | Confidence≡truth |
| **Fake mastery** | UI/state claims competence without durable proof | Fireworks; green untouched nodes | Trust debt; wrong path |
| **SAFE-COLD** | Humble init + labeled seed + probes | This chapter | Personalization cosplay |

**Operational definition (HYPOTHESIS):** A cold-start is *honest* iff (1) every non-prior belief is tagged by source (`onboarding_assessment` / `practice` / session), (2) Map/copy distinguish untouched, seed-only, and delayed-proof states, (3) no mastery confetti or “you’ve mastered X” until criteria beyond seed confidence, and (4) skip paths do not write high mastery. Marketing may claim “personalized from day one” only as *personalized uncertainty + next probe*, not personalized mastery.

---

## LXXXI.3 Knowledge tracing needs a prior — priors are not biographies

**FACT (BKT spine):** Corbett & Anderson (1995, *User Modeling and User-Adapted Interaction*, 4, 253–278, doi:10.1007/BF01099821) — knowledge tracing maintains P(learned) per production rule from observed attempts (prior, learn, guess, slip). Mastery-based sequencing depends on those estimates; the model is only as honest as its updates and its **initial prior**.

**FACT (individualizing P(L0)):** Pardos & Heffernan (2010, in *UMAP 2010*, LNCS 6075, pp. 255–266, doi:10.1007/978-3-642-13470-8_24) — standard deployed BKT often used skill-specific but not student-specific initial knowledge; individualizing the prior (especially pooling information across skills for each student) improved prediction on ASSISTments problem sets (lower error on 33/42 sets in their evaluation). Cold start is a *parameter* problem, not a license to invent greens.

**FACT (prior sensitivity):** Students enter with heterogeneous P(L0); a single global “everyone starts at 0.1” or “everyone starts mastered” both mis-sequence practice (BKT robustness / prior-variation literature; Pardos & Heffernan individualization agenda).

**HYPOTHESIS (MindCraft):** Ontology `population_priors` are the right *default* P(L0) layer — inspectable, shared, not personalized theater. Student-specific movement must come from labeled seed + probes + practice, with decay toward prior (align copy with engine honesty).

**Kill:** Population prior sold as “we know Maya.”  
**Survive:** Prior as humble shared baseline; personalization = updates with provenance.

---

## LXXXI.4 Self-report is necessary and systematically biased

Gap-scan asks hard / kinda / easy. That is commercially necessary (coverage across ~29 ACT concepts without a three-hour exam) and epistemically dangerous.

**FACT (overconfidence):** Fischhoff, Slovic & Lichtenstein (1977, *Journal of Experimental Psychology: Human Perception and Performance*, 3(4), 552–564) — people are often wrong when “certain”; calibration curves show hit rates below stated confidence.

**FACT (reasons bias):** Koriat, Lichtenstein & Fischhoff (1980, *Journal of Experimental Psychology: Human Learning and Memory*, 6(2), 107–118) — confidence is inflated by evidence *for* the chosen answer; prompting contradicting reasons improves appropriateness of confidence.

**FACT (unskilled–unaware pattern):** Kruger & Dunning (1999, *Journal of Personality and Social Psychology*, 77(6), 1121–1134, doi:10.1037/0022-3514.77.6.1121) — bottom-quartile performers grossly overestimated ability. (Directional product risk — not a student-facing label.)

**FACT (math metacognition):** Erickson & Heit (2015, *Frontiers in Psychology*, 6, 742, doi:10.3389/fpsyg.2015.00742) — students overpredicted math test scores alongside math anxiety; not simply “low confidence everywhere.”

**FACT (item-level blindness):** Lindsey & Nagel (2015, *Physical Review Special Topics — Physics Education Research*, 11, 020103, doi:10.1103/PhysRevSTPER.11.020103) — at item level, students of all abilities struggle to foresee which questions they will miss — self-assessment is a blunt prior, not a key.

**Commercial implication:** Map “easy” → L3 gating is coherent; Map “easy” → green mastery badge is a lie. Pair confidence seed with hide-correctness probes (SAFE-CALIB / C4); never reveal keys during diagnostic (SAFE-GENQ).

**Kill:** Confidence≡mastery; “raise onboarding confidence” as success metric.  
**Survive:** Confidence as *routing prior* + miss-tier signal; probes as corrective evidence.

---

## LXXXI.5 Gaming the onboarding is fake mastery’s twin

**FACT (gaming + harm):** Baker, Corbett, Koedinger & Wagner (2004, *CHI ’04*, pp. 383–390) — “gaming the system” = succeeding by exploiting system properties rather than learning; gaming frequency correlated negatively with learning, distinct from other off-task behavior.

**HYPOTHESIS (product):** Cold-start analogues include tapping “easy” on everything, skipping gap-scan, or hint-binging first Practice to farm greens. Designs that reward scan-completion over scan-honesty invite this.

**Product translation:**
1. No streak/XP for “finished diagnostic.”  
2. Skip-scan must not write optimistic mastery; prefer untouched + population prior.  
3. Retake gap-scan *replaces* onboarding seed — do not stack optimistic layers.  
4. PawHub Practice/Learn-next read `eventCount` honesty — do not celebrate seed as conquered islands.

**Kill:** Diagnostic completion % as North Star.  
**Wound:** Anxious under-raters (“hard” everywhere) — SAFE-CALIB underconfidence unlock still applies.  
**Survive:** Friction that makes honest mapping cheaper than fake competence.

---

## LXXXI.6 Adaptive testing envy — shorter ≠ fireworks

**FACT (CAT premise):** Adaptive testing selects informative items given current estimates and can shorten tests when banks/models are calibrated (CAT survey/primer tradition). Early steps still start from a prior; stopping rules are about *measurement error*, not celebration.

**HYPOTHESIS:** Borrow CAT’s *information* ethic (ask what reduces uncertainty) without placement trophies or “you placed into Gold” skins. Gap-scan + sparse probes ≈ poor-man’s adaptive placement; sell “where to start,” not a belt.

**Kill:** Placement-league / belt / IQ-cosplay cold start.  
**Survive:** Uncertainty-reducing item selection as the onboarding craft.

---

## LXXXI.7 Engine + UI stack (SAFE-COLD)

**Reuse:** SAFE-ONTOLOGY (inspectable state); SAFE-CALIB + C4 hide-correctness; SAFE-FORGET (age evidence; no fireworks≡durable); SAFE-FBTIME (diagnostic hide); SAFE-GENQ (verified keys only for probes that write mastery).

**HYPOTHESIS — product stack:**
1. **Prior layer:** Population / ontology priors visible as *shared* baselines — never “your mastery.”  
2. **Seed layer:** `/seed-assessment` writes labeled synthetic events; UI copy: “your confidence map” / “starting signals,” not “mastered.”  
3. **Probe layer:** Short hide-correctness set across concepts/formats; record outcomes without reveal; optional contradicting-reason micro-prompt on high-confidence picks (Koriat et al. mechanism, light-touch).  
4. **Map:** Untouched ≠ red failure; seed-only ≠ green mastery; reserve strong chrome for delayed/generation proof.  
5. **PawHub:** Learn-next = first `eventCount === 0` playable on exam path; Practice = worst playable weakness — both read honesty, not confetti.  
6. **Parent:** “We started with an honest map” CBC arm vs “personalized genius path from minute one.”

**SPECULATION:** Competitors can ship prettier empty-state trees; MindCraft’s wedge is *provenance* — every early claim has a source tag parents and tutors can understand.

---

## LXXXI.8 Competitive positioning

| Pattern | Cold-start move | MindCraft response |
|---------|-----------------|-------------------|
| Duo skill tree | Early greens / crowns | Untouched honesty; ban XP-as-mastery |
| Khan mastery | Energy + % bars from thin attempts | Seed ≠ mastery bar; delayed proof |
| Brilliant | Delight puzzle → “you’re clever” | Delight ok; no cleverness≡graph |
| ChatGPT tutors | Instant “I know your level” from chat | Chat ≠ prior; refuse fluency prior |
| Bootcamp quizzes | Placement score theater | Uncertainty map; no belt |
| Adaptive apps | “AI personalized path” from 3 clicks | Label seed; show what was never probed |

**Competitive wedge (FOUNDER BELIEF):** “We refuse to fake knowing you” is sellable trust — especially to parents burned by apps that looked personal and taught nothing.

---

## LXXXI.9 Doctrine — SAFE-COLD (provisional)

1. **Humble prior first** — population/ontology priors initialize; they are not biography.  
2. **Labeled seed only** — confidence → synthetic events with source tag; replace-on-retake, don’t stack lies.  
3. **Probes without reveal** — C4 hide-correctness; verified keys only; no answer-hunting diagnostic.  
4. **Confidence ≠ mastery** — hard/kinda/easy routes level + struggle prior; never crowns.  
5. **Map chrome matches evidence age** — untouched / seed-only / proved (SAFE-FORGET).  
6. **No skip-to-green** — skip leaves untouched + prior; completion is not a learning KPI.  
7. **Anti-gaming** — no streak/XP for scan finish; watch uniform-easy patterns as QA.  
8. **Copy:** “Honest starting map” / “where to begin” — never “you’ve already mastered” / Identity Score™.

**Confidence:** High that BKT-style systems need explicit priors and that individualizing P(L0) matters (Corbett & Anderson; Pardos & Heffernan). High that confidence is miscalibrated and especially risky for low performers (Fischhoff et al.; Kruger & Dunning; Erickson & Heit). High that gaming harms learning when systems can be exploited (Baker et al.). Medium that MindCraft’s current seed→event map is well-calibrated to later practice (needs COLD-* ). Medium that honest-cold-start copy wins parent WTP vs fireworks (needs CBC). High that day-one mastery fireworks and confidence≡mastery are kills.

---

## LXXXI.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| COLD-1 | Seed-only vs seed+hide-correctness probes | A/B new users | 7d `/recommend` stability; probe–seed disagreement rate; abandon |
| COLD-2 | Map chrome: seed-as-mastery greens vs honest untouched/seed labels | A/B | Trust items; wrong-path starts; parent CBC |
| COLD-3 | Uniform-easy / skip patterns → QA flag vs ignore | Observational + intervene | Later miss rate; gaming-like behavior |
| COLD-4 | Contradicting-reason micro-prompt on “easy” ratings | A/B | Calibration vs probes; time cost |
| COLD-5 | Parent CBC: “honest map” vs “personalized from minute one” | CBC | WTP; trust; stigma |
| COLD-QUAL | 10 Maya: what felt fake vs useful in first session | Qual | Language for copy; fireworks allergy |

**Falsifier:** Seed-as-mastery greens raise 7d retention *and* delayed transfer vs honest chrome → revisit chrome (unlikely; if retention-only, treat as engagement trap).  
**Falsifier:** Probes add abandon without improving recommend quality → shorten probe set; keep seed.  
**Falsifier:** Honest-map copy loses WTP with no trust gain → reframe dignity without fireworks; do not restore fake greens.

**Pre-register:** COLD-* before any “personalized genius path from day one” campaign (SAFE-LABMETA).

---

## LXXXI.11 So what for MindCraft commercially

- **Copy:** “An honest starting map — not a fake report card.” Never day-one “mastered” / belts / Identity Score™.  
- **Product:** Prior → labeled seed → hide-correctness probes → provenance on Map; PawHub reads `eventCount` and seed humility.  
- **Positioning:** Against Duo greens, chat “I know you,” and placement theater; for inspectable cold-start (with SAFE-ONTOLOGY).  
- **Metric:** Probe–seed disagreement, recommend stability 7d, skip/uniform-easy rate, parent trust; demote diagnostic completion % and early green counts.  
- **Kill list:** Fake mastery fireworks; confidence≡mastery; skip-to-green; population-prior-as-biography; unverified diagnostic keys.  
- **Growth:** Trust compounds when week-two practice matches week-one honesty — fireworks create churn when the lie shows.  
- **Vision:** Identity transformation starts with *accurate self-location*, not premature crowning.

---

## References (verified)

- Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the Cognitive Tutor classroom: When students game the system. In *Proceedings of CHI 2004* (pp. 383–390). ACM.  
- Corbett, A. T., & Anderson, J. R. (1995). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction*, 4, 253–278. https://doi.org/10.1007/BF01099821  
- Erickson, S., & Heit, E. (2015). Metacognition and confidence: Comparing math to other academic subjects. *Frontiers in Psychology*, 6, 742. https://doi.org/10.3389/fpsyg.2015.00742  
- Fischhoff, B., Slovic, P., & Lichtenstein, S. (1977). Knowing with certainty: The appropriateness of extreme confidence. *Journal of Experimental Psychology: Human Perception and Performance*, 3(4), 552–564.  
- Koriat, A., Lichtenstein, S., & Fischhoff, B. (1980). Reasons for confidence. *Journal of Experimental Psychology: Human Learning and Memory*, 6(2), 107–118.  
- Kruger, J., & Dunning, D. (1999). Unskilled and unaware of it: How difficulties in recognizing one’s own incompetence lead to inflated self-assessments. *Journal of Personality and Social Psychology*, 77(6), 1121–1134. https://doi.org/10.1037/0022-3514.77.6.1121  
- Lindsey, B. A., & Nagel, M. L. (2015). Do students know what they know? Exploring the accuracy of students’ self-assessments. *Physical Review Special Topics — Physics Education Research*, 11, 020103. https://doi.org/10.1103/PhysRevSTPER.11.020103  
- Pardos, Z. A., & Heffernan, N. T. (2010). Modeling individualization in a Bayesian networks implementation of knowledge tracing. In P. De Bra, A. Kobsa, & D. Chin (Eds.), *UMAP 2010* (LNCS 6075, pp. 255–266). Springer. https://doi.org/10.1007/978-3-642-13470-8_24  
