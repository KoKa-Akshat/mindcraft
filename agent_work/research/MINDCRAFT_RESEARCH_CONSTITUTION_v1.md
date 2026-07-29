# MindCraft Research Constitution v1

**Status:** Living operating document — not a pitch deck  
**Edition:** v1.5 (multi-chapter lab; ongoing evidence program)  
**Research question:** How do humans become *confident mathematical thinkers*?  
**Product thesis under audit:** The product is identity transformation, not mathematics delivery.  
**Last updated:** 2026-07-29  
**Growth model:** Core OS (this file) + `chapters/*.md` via `CHAPTER_MANIFEST.txt` → PDF  
**Scale intent:** Multi-month densification toward 150–300 pages of *evidenced* material — never fluff  
**Epistemic rule:** Every claim is labeled FACT / HYPOTHESIS / FOUNDER BELIEF / SPECULATION.

### Deep-dive chapters currently mounted

| Part | File | Focus |
|------|------|-------|
| XXIV | `chapters/24_affect_anxiety_belonging.md` | Anxiety, WM, stereotype threat, belonging |
| XXV | `chapters/25_self_efficacy_narrative_identity.md` | Bandura sources, narrative identity, habit≠identity |
| XXVI | `chapters/26_cognitive_load_mastery_tutoring.md` | CLT, fading, mastery war, tutoring calibration |
| XXVII | `chapters/27_markets_parents_competition.md` | WTP, parents, competitive teardown |
| XXVIII | `chapters/28_history_meaning_math.md` | Invention-story thesis under trial |
| XXIX | `chapters/29_spacing_retrieval.md` | Spacing, retrieval, memory of competence |
| XXX | `chapters/30_attribution_helplessness.md` | Weiner attributions, helplessness, feedback language |
| XXXI | `chapters/31_flow_challenge_skill.md` | Flow, challenge–skill, difficulty design |
| XXXII | `chapters/32_parent_anxiety_transmission.md` | Maloney/Beilock parent anxiety pathway |
| XXXIII | `chapters/33_ai_tutors_trust_sycophancy.md` | AI trust / sycophancy; RT: Bastani≢PWC, guards≠gain |
| XXXIV | `chapters/34_formal_causal_dag_identification.md` | FEI causal DAG; L0–L4 claim ladder; confounders |
| XXXV | `chapters/35_competitive_session_audits.md` | Khan/Duo/Brilliant/ChatGPT session mechanism audits |
| XXXVI | `chapters/36_equity_audit_story_worlds.md` | Equity audit of story worlds; whose history; tokenism kill |
| XXXVII | `chapters/37_expectancy_value_eccles.md` | Eccles SEVT; utility/cost/attainment → choice; EVT experiments |
| XXXVIII | `chapters/38_goal_orientation.md` | Mastery vs performance goal structures; appearance ban; GO experiments |
| XXXIX | `chapters/39_interleaving_vs_blocking.md` | Interleave vs block; strategy selection; IL experiments |

Queued next: see `NEXT_LAB.md` (self-explanation, then QUEUE_EXTENDED).

---

## 0. How to read this document

This Constitution is the research OS for MindCraft. It exists to prevent the company from building features that feel right and fail quietly.

Rules of engagement:

1. Founder beliefs enter as **FOUNDER BELIEF**, not as law.
2. The Red Team’s job is destruction. Unchallenged claims are invalid.
3. Page count is not quality. A shorter true section beats a longer vague one.
4. “AI will make explanations free” is a hypothesis about markets, not a moral slogan.
5. Product implications must map to experiments with falsifiers.

This v1 is dense and incomplete on purpose. Expanding toward 150–300 pages is allowed only when new evidence, frameworks, or contradicted priors justify the ink.

---

# Part I — Executive Summary

## I.1 The compressed answer

**HYPOTHESIS (confidence: medium–high):** Humans become confident mathematical thinkers when three conditions compound:

1. **Affective permission** — the nervous system stops treating math as social/physical threat.
2. **Competence evidence** — the learner accumulates undeniable, self-attributed successes at the right grain of difficulty.
3. **Identity re-storying** — the person revises the narrative “I am not a math person” into a workable self-story compatible with struggle.

Explanations alone rarely produce (1)–(3). Explanations can accelerate (2) *after* (1) is present. This matches the founder’s tutoring observation and is directionally supported by math-anxiety, SDT, and mindset literatures — with important contradictions (see Red Team).

## I.2 Verdict on the scarcity thesis

**FOUNDER BELIEF under audit:** AI commoditizes knowledge; scarcity shifts to motivation, confidence, identity, trust, curiosity, persistence, emotional safety, meaning.

**Red Team verdict (provisional):**

| Claim | Status | Notes |
|-------|--------|-------|
| Explanations are getting cheaper/faster | **FACT** (directionally) | Generative AI + open content lowers marginal cost of explanation |
| “Tutoring is free” | **FALSE as stated** | High-quality *human* attention, accountability, and diagnosis remain scarce and expensive |
| Content is free | **MOSTLY FACT** for commodity content | Differentiation migrates to curation, sequencing, trust, outcomes |
| Motivation/identity become scarce | **HYPOTHESIS** | Likely true as *product differentiators*; not proven as *sole* moat |
| Emotional safety is first-order | **HYPOTHESIS with supportive evidence** | Math anxiety impairs working memory; interventions that ignore affect underperform for anxious learners |

**Implication:** MindCraft should not bet the company on “better explanations.” It should bet on a **system that converts fear → evidence → identity**, with explanations as infrastructure, not hero feature.

## I.3 What to optimize (North Star debate)

| Metric | Predicts short-term engagement? | Predicts durable math identity? | Risk |
|--------|----------------------------------|----------------------------------|------|
| Correct answers | Medium | Low–medium | Teaches gaming / guessing |
| Time spent | High (easy to inflate) | Low | Engagement theater |
| Streaks / DAU | High | Uncertain | Duo-style habit ≠ identity |
| Confidence (self-report) | Medium | Medium | Cheap talk, demand effects |
| Challenge-seeking (advanced course taking) | Medium | **High** (Yeager et al., Nature 2019 signal) | Hard to measure early |
| Voluntary return after failure | Medium | **High** (HYPOTHESIS) | Needs instrumentation |
| “I am a math person” endorsement + behavior | Medium | **Highest target** | Slow, noisy |

**Working North Star (HYPOTHESIS):**  
**Challenge-seeking under safety** — the student chooses a harder problem, returns after a miss, and attributes success to strategy/effort *in math specifically*.

---

# Part II — Key Insights (challenged)

### Insight 1 — Fear is a performance bottleneck, not a personality trait

**FACT:** Math anxiety is associated with reduced working-memory availability during math tasks; anxious learners underperform relative to ability (Ashcraft & Kirk line of work; broader anxiety–WM literature).

**HYPOTHESIS:** For a large subset of MindCraft’s Maya archetype, the binding constraint is not “missing explanation,” it is **threat appraisal** (“I will look stupid”).

**Implication:** Soft-wrong UX, hide-correctness diagnostics, wizard coaching, and narrative framing are not polish — they are load-bearing if the thesis holds.

**Red Team:** Many high performers succeed under stress. Anxiety interventions have heterogeneous effects. Do not medicalize ordinary difficulty.

### Insight 2 — Growth mindset is real, small, and context-dependent

**FACT:** Yeager et al. (2019, *Nature*) — brief online growth-mindset intervention improved grades for lower-achieving students and increased advanced math enrollment in a nationally representative U.S. sample; effects stronger when peer norms supported challenge-seeking.

**FACT / REVIEW:** Domain-general mindset messaging shows mixed results; math-*specific* mindset interventions more often report positive outcomes (2023 systematic review in *Educational Research Review*).

**FACT / CAUTION:** “False growth mindset” (praise effort without teaching strategy / changing environment) is harmful (Dweck’s own caution; Kohn’s critique).

**Implication:** MindCraft must not ship empty “believe in yourself” copy. Mindset must be embodied in **task design, feedback, and tutor norms**.

### Insight 3 — Autonomy, competence, relatedness are the psychological tripod

**FACT:** Self-Determination Theory (Ryan & Deci) — sustained intrinsic motivation requires autonomy, competence, relatedness.

**FACT (meta):** SDT-based education interventions show reliable gains for autonomy and competence support; relatedness effects are less consistent (Wang et al. 2024 meta-analysis).

**Implication:** Product loops must deliver:

- Autonomy: meaningful choice (path, story world, pace)
- Competence: mastery grain that produces earned wins
- Relatedness: tutor presence, parent signal, peer-safe identity (hardest; do not fake with empty social)

### Insight 4 — Mastery learning works — until you measure the wrong thing

**FACT:** Kulik, Kulik & Bangert-Drowns (1990) meta-analysis — mastery programs show positive exam effects (overall ~0.5 SD in their synthesis), stronger for weaker students; can increase time; self-paced college mastery can reduce completion.

**FACT / CONTRADICTION:** Slavin’s “Mastery Learning Reconsidered” (1987) — little support for group-based mastery on *standardized* measures; experimenter-made tests show moderate effects; coverage vs mastery tradeoff is real.

**Implication:** MindCraft’s mastery graph is promising **if** mastery means transferable competence, not local quiz familiarity. Measure far transfer, not only same-item success.

### Insight 5 — Habit products ≠ identity products

**FACT / INDUSTRY:** Duolingo’s public method emphasizes gamification for motivation and return (streaks, leagues, variable rewards) (Duolingo Method whitepaper, 2023). Streaks exploit loss aversion; they drive DAU.

**HYPOTHESIS:** Streaks can increase practice frequency without changing “I am a math person.” Habit without identity yields brittle engagement (stop streak → stop learning).

**Implication:** Use habit mechanics as **on-ramps**, not as the destination. Pair with identity-marking rituals (map fill, story progression, tutor recognition of growth).

### Insight 6 — Narrative is not decoration; it is encoding + meaning

**FOUNDER BELIEF (WORLD_VISION):** Math stripped of invention-story becomes alienating machinery.

**HYPOTHESIS:** Historical/human invention frames increase curiosity and reduce “arbitrary rule” appraisals, improving persistence.

**Evidence status:** Strong tradition in math education (history of math pedagogy); fewer large RCTs than mindset literature. Treat as **design prior + research program**, not settled science.

### Insight 7 — AI commoditizes *answers*, not *becoming*

**HYPOTHESIS:** As answer generation approaches free, willingness-to-pay migrates to:

1. Diagnosis of the *actual* break (gap map)
2. Emotional containment during struggle
3. Accountability relationships (tutor)
4. Identity-consistent practice worlds
5. Trusted outcome signaling to parents

**SPECULATION:** In 30 years, “show me the steps” is ambient. “Help me become the kind of person who stays with hard problems” remains a human+system problem.

---

# Part III — Research Log (v1 seed)

| Date | Finding | Type | Action |
|------|---------|------|--------|
| 2026-07-25 | Constituted Research Lab + Constitution v1 | Process | Create OS |
| 2026-07-25 | Scarcity thesis partially false as slogans; true as product wedge | Analysis | Rewrite pitch language |
| 2026-07-25 | Yeager 2019 constrains mindset claims | Evidence | Ban empty mindset copy |
| 2026-07-25 | Soft-wrong + wizard coach shipped in product | Product | Instrument coach → retry rate |
| 2026-07-25 | Mastery literature split (Kulik vs Slavin) | Evidence | Define mastery measurement carefully |
| 2026-07-25 | Bloom 2-sigma overstated vs VanLehn / modern tutoring metas | Evidence | Stop marketing 2-sigma |
| 2026-07-25 | Founder sequence wounded → SAFE-CRAFT | Synthesis | Attempt earlier; invention-story optional |
| 2026-07-25 | Deliberate practice necessary≠sufficient (Hambrick line) | Evidence | Progress-vs-self framing |

---

# Part IV — Evidence Table (selected)

| Claim | Best supporting evidence | Contradicting / limiting evidence | Confidence | MindCraft implication |
|-------|--------------------------|-----------------------------------|------------|------------------------|
| Brief mindset intervention can move grades + advanced math taking | Yeager et al., Nature 2019 | Effects heterogeneous; peer norms matter; replication debates in broader mindset meta-analyses | Medium–High | Mindset must be ecological, not banner text |
| Math-domain mindset > generic | 2023 Ed Research Review systematic review | Study quality varies; publication bias possible | Medium | Math-specific identity language |
| SDT need support raises motivation | Wang et al. 2024 meta | Relatedness effects weaker | Medium–High | Design for autonomy + competence first |
| Math anxiety impairs performance | Cognitive literature (Ashcraft tradition) | Not all low performers are anxious | Medium–High | Affective onboarding is first-class |
| Mastery learning raises achievement | Kulik et al. 1990 | Slavin 1987 on standardized tests | Medium | Mastery graph + transfer tests |
| Gamified habits raise return | Duolingo method / industry practice | Habit ≠ deep learning; extrinsic traps (Deci) | Medium | Streaks as on-ramp only |
| 1:1 tutoring is uniquely powerful | Bloom “2 sigma” framing (1984) | Often overstated; quality varies; VanLehn etc. nuance tutoring effects | Medium | Keep human tutors; AI amplifies, not replaces |

---

# Part V — Contradictory Evidence (do not skip)

1. **Mindset skepticism:** Some metas find small average effects; school implementations often degrade into posters.
2. **Grit / resilience hype:** Duckworth-style grit is contested; structural inequality and curriculum quality matter more than character slogans.
3. **Discovery learning failures:** Pure constructivism without guidance often fails (Kirschner, Sweller, Clark critiques). Narrative worlds must still teach.
4. **Engagement ≠ learning:** Time-on-app can rise while understanding falls (edtech’s original sin).
5. **AI may *increase* explanation value temporarily:** Novices may trust fluent wrongness; trust becomes the scarce resource, not explanation volume.
6. **Some students want speed and drills:** Identity-through-story is not universal. Offer multiple vessels.

---

# Part VI — Mental Models

## VI.1 The Identity Transformation Cascade (ITC)

**HYPOTHESIS — MindCraft original synthesis**

```
Threat ↓  →  Attention available  →  Micro-success  →  Attribution ("I figured it")
       →  Willingness to re-enter challenge  →  Accumulated competence evidence
       →  Narrative update ("maybe I can")  →  Identity claim ("I do math")
       →  Environment selection (harder courses, peers, tutors)
       →  Reinforcing loop
```

**Balancing loop:** Premature hard problems → threat ↑ → avoidance → identity freeze.

**Product translation:** Gap scan (no shame) → soft-wrong → tiny earned wins → map fill → tutor recognition → advanced path.

## VI.2 The Three Doors (what students actually need in a stuck moment)

| Door | Need | Wrong product response | Right response |
|------|------|------------------------|----------------|
| A | Safety | “Here’s a longer explanation” | Contain affect; normalize miss |
| B | Clarity | Pep talk | Precise model / worked example at right grain |
| C | Agency | Take over and solve for them | Scaffolded choice; student does the decisive step |

**FOUNDER BELIEF:** Tutors often open Door B first. Many students are still behind Door A.

## VI.3 Knowledge commodity stack (post-AI)

```
Layer 0: Facts & procedures          → commoditizing fast
Layer 1: Explanations                 → commoditizing fast
Layer 2: Diagnosis of misconceptions  → partially automatable; trust-sensitive
Layer 3: Adaptive sequencing          → automatable with good ontology
Layer 4: Emotional co-regulation      → scarce (human + careful UX)
Layer 5: Identity & meaning           → scarce
Layer 6: Accountability relationship  → scarce
```

MindCraft’s durable stack lives in **Layers 2–6**, with 0–1 as utilities.

## VI.4 Transfer from outside education

| Domain | Mechanism | Transfer to MindCraft |
|--------|-----------|----------------------|
| Games (Celeste, FromSoftware-lite design) | Fair difficulty + death as information | Soft-wrong as physics, not moral failure |
| Sports coaching | Film study of *specific* error | Gap map + wrong-choice coach |
| Music | Scales before repertoire; recital as identity | Concept drills → story quest → public signal |
| Therapy (exposure) | Graded exposure to feared stimulus | Math anxiety: graded challenge under safety |
| Aviation checklists | Externalize working memory under stress | Procedure scaffolds when anxious |
| Martial arts belts | Visible competence ladder | Mastery pips / map regions |
| Language apps | Habit loops | Daily practice — without Duo’s extrinsic ceiling |
| Religion / ritual | Shared meaning + belonging | Caution: do not cultify; use *light* ritual (map lighting) |

---

# Part VII — Universal Learning Principles (provisional)

1. **Emotion gates cognition** in threatened domains.  
2. **Earned difficulty** beats random difficulty.  
3. **Feedback should be information, not identity judgment.**  
4. **Attribution matters:** strategy > talent for growth; luck attributions kill agency.  
5. **Spaced retrieval** beats massed re-reading (cognitive science consensus).  
6. **Worked examples → fading guidance** for novices (cognitive load).  
7. **Belonging uncertainty** destroys persistence for stereotyped groups (Walton/Cohen tradition).  
8. **Transfer requires varied practice**, not identical clones.  
9. **Human accountability** multiplies AI tools.  
10. **Identity is a lagging indicator**; design leading indicators (challenge-seeking, return-after-fail).

---

# Part VIII — Product Implications (systems, not features)

## VIII.1 Core system: Fear → Evidence → Identity (FEI Loop)

**Reinforcing loop R1 (desired):**  
Safety UX → attempt → informative miss → coach → success → map fill → identity → more attempts.

**Balancing loop B1 (threat):**  
Public shame / red buzz → avoidance → less practice → skill lag → more shame.

**MindCraft already partially implements FEI:** hide-correctness diagnostic, soft-wrong, wizard coach, story chapters, knowledge map. **Missing instrumentation:** does coach raise retry rate and later challenge-seeking?

## VIII.2 What to stop optimizing

- Vanity DAU without learning transfer  
- Explanation length as quality proxy  
- Points that do not mark identity-relevant milestones  

## VIII.3 What to instrument next (minimum viable science)

1. **Retry rate within 2 minutes of soft-wrong** (with vs without wizard coach)  
2. **Challenge-seeking:** % choosing harder level when offered  
3. **Return after fail session** (D1 retention after a loss session)  
4. **Self-identity item** (pre/post, 1–2 items, math-specific)  
5. **Advanced course intent / enrollment** (slow, gold)

## VIII.4 Tutor system role

Tutors are not content pipes. They are:

- Affect regulators  
- Attribution coaches  
- Bridge diagnosticians (concept A known, link A→B broken)  
- Identity witnesses (“I saw you become someone who stays”)

AI should brief tutors, not replace witnessing.

---

# Part IX — Experiments (pre-registered style)

### Experiment A — Wizard coach on soft-wrong
- **Question:** Does the under-Graph wizard increase productive retry vs soft-wrong alone?
- **Design:** A/B, chapter + practice  
- **Primary:** retry within 120s; secondary: eventual correct without hint binge  
- **Falsifier:** no lift; or lift only in engagement with worse accuracy  

### Experiment B — Story-first vs bare stem
- **Question:** Does invention-story framing raise persistence on first miss?
- **Design:** within-concept crossover  
- **Primary:** time-to-abandon after first miss  
- **Falsifier:** story slows without improving retention/transfer  

### Experiment C — North Star validation
- **Question:** Which early metric best predicts 8-week challenge-seeking?
- **Candidates:** streak length, soft-wrong retry, identity item, map mastery Δ  
- **Method:** observational + lagged prediction  

### Experiment D — Explanation timing
- **Question:** Is explanation-before-attempt worse than attempt-with-safety for anxious students?
- **Design:** screen with anxiety pretest; randomize explanation-first vs attempt-first  
- **Falsifier:** explanation-first wins for all segments  

---

# Part X — Weekly Priorities (research × product)

1. Instrument FEI loop events in analytics (retry, coach shown, write-mode exit).  
2. Run Experiment A for 2 weeks.  
3. Red Team the WORLD_VISION narrative claims with one outside learning scientist.  
4. Interview 10 Mayas: “When did math stop feeling dangerous?” (qual).  
5. Define “mastery” operationally so Slavin’s critique cannot gut the graph.  

---

# Part XI — Founder Questions (do not dodge)

1. If ChatGPT tutors become “good enough,” what *relationship* do parents still buy?  
2. Are we building for Maya’s identity — or for parents’ anxiety about scores? Both? Tradeoff?  
3. Would we accept lower short-term accuracy for higher long-term challenge-seeking?  
4. Is the story world load-bearing, or is gap+tutor enough?  
5. What would falsify the identity-transformation thesis in 90 days?  

---

# Part XII — Long-term Roadmap (research horizons)

**H1 (now):** Prove FEI loop moves retry + challenge-seeking.  
**H2:** Prove identity language + map produce durable self-concept change.  
**H3:** Prove human tutor + AI diagnosis beats AI-alone on persistence and transfer.  
**H4:** Generalize beyond math (science/identity) only after math identity mechanism is solid.

---

# Part XIII — Open Problems

1. Causal path from narrative history-of-math to identity (under-identified).  
2. Relatedness at scale without creepy social.  
3. Measuring identity without demand effects.  
4. Preventing gamification from colonizing meaning.  
5. AI fluent nonsense vs trust calibration for teens.  
6. Equity: does story-world privilege culturally specific narratives?  

---

# Part XIV — Red Team Dossier (destroy weak arguments)

### Kill #1: “Explanations are free, therefore MindCraft should not explain”
**Destroyed form:** Absolutism.  
**Surviving form:** Explanations are *necessary infrastructure* with collapsing *willingness-to-pay*; differentiation is diagnosis + affect + identity + accountability.

### Kill #2: “Just fix mindset”
**Destroyed:** Poster mindset.  
**Surviving:** Ecological mindset (task + feedback + peer/tutor norms), math-specific.

### Kill #3: “Engagement is the goal”
**Destroyed:** Engagement without transfer.  
**Surviving:** Engagement as oxygen for the FEI loop, not the fire.

### Kill #4: “Mastery graph = Bloom 2-sigma”
**Destroyed:** Inflated tutoring mythology.  
**Surviving:** Mastery *can* help weaker students if mastery is real and time costs are managed.

### Kill #5: “Identity transformation is unmeasurable, so ship vibes”
**Destroyed:** Vibes-as-strategy.  
**Surviving:** Leading indicators (retry, challenge-seeking) + lagging identity items.

---

# Part XV — References (verified starting set)

Do not invent citations. Expand this list only with retrieved sources.

1. Yeager, D. S., et al. (2019). A national experiment reveals where a growth mindset improves achievement. *Nature*. https://doi.org/10.1038/s41586-019-1466-y  
2. Dweck, C. S. (2006/2007). *Mindset*. Random House.  
3. Ryan, R. M., & Deci, E. L. (2000). Self-determination theory… *American Psychologist* / later handbooks.  
4. Wang, Y., et al. (2024). Meta-analysis of SDT-based interventions in education. (Self-Determination Theory site PDF).  
5. Kulik, C.-L. C., Kulik, J. A., & Bangert-Drowns, R. L. (1990). Effectiveness of mastery learning programs: A meta-analysis. *Review of Educational Research*.  
6. Slavin, R. E. (1987). Mastery learning reconsidered. *Review of Educational Research*.  
7. Boaler, J., et al. — mathematical mindset course / classroom studies (Frontiers Education 2018; later scale papers).  
8. Systematic review: mindset interventions in mathematics classrooms (2023). *Educational Research Review*, 100554.  
9. Johnston-Wilder, S., & Lee, C. — mathematical resilience / SDT framing (2021).  
10. Duolingo (2023). *The Duolingo Method* whitepaper.  
11. Bloom, B. S. (1984). The 2 sigma problem. *Educational Researcher*.  
12. Ashcraft, M. H., & Kirk, E. P. (2001). The relationships among working memory, math anxiety, and performance. *Journal of Experimental Psychology: General*.  
13. Suárez-Pellicioni, M., Núñez-Peña, M. I., & Colomé, À. (2016). Math anxiety: A review of its cognitive consequences… *Cognitive, Affective, & Behavioral Neuroscience*.  
14. Caviola, S., et al. / related metas — WM mediating role in math anxiety–performance (e.g., *Frontiers in Psychology*, 2021 meta, r ≈ −0.17 MA–MP).  
15. Kirschner, P. A., Sweller, J., & Clark, R. E. (2006). Why minimal guidance during instruction does not work. *Educational Psychologist*.  
16. Walton, G. M., & Cohen, G. L. — belonging interventions tradition.  
17. VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems… *Educational Psychologist*.  
18. Nickow, A., Oreopoulos, P., & Quan, V. (2020). Tutoring RCT meta-analysis (effects ~0.37 SD — see Education Next summary).  
19. Hambrick, D. Z., et al. (2014). Deliberate practice: Is that all it takes… *Intelligence*; Macnamara, Hambrick & Oswald (2014) deliberate practice meta-analysis.  
20. Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of deliberate practice… *Psychological Review*.  
21. Howard, J. L., Slemp, G. R., & Wang, X. (2024/2025). Need support and need thwarting meta-analysis (student populations).  
22. MindCraft internal: `WORLD_VISION.md`, `BRAND_BOOK.md`, `MindCraft_Viability_Research_Strategy.md`.

---

# Part XVI — Mechanism Deep Dive: How identity actually changes

This part answers the research question at mechanism grain. It is synthesis, not settled science.

## XVI.1 What “confident mathematical thinker” means (operational)

**Do not use:** “likes math apps” or “says math is fun once.”

**Working definition (HYPOTHESIS):** A confident mathematical thinker is a person who, in math-relevant contexts:

1. **Approaches** moderately hard problems without immediate avoidance.
2. **Persists** after a miss long enough to extract information.
3. **Attributes** success primarily to controllable causes (strategy, practice, help-seeking) rather than luck or tutor magic.
4. **Selects** into harder future opportunities when available (courses, contests, careers) at rates above their prior baseline.
5. **Endorses** a math-capable self-concept *and* behaves consistently with that endorsement.

Items 1–4 are leading. Item 5 is lagging. Product should optimize leading indicators while periodically measuring the lagging identity claim.

## XVI.2 The threat–competence–narrative triad

Three literatures converge on the same transformation engine:

| Mechanism | Core claim | Confidence | Key sources |
|-----------|------------|------------|-------------|
| Threat / affect | Math anxiety transiently reduces working-memory resources available for math | **High (FACT direction)** | Ashcraft & Kirk (2001); Suárez-Pellicioni et al. review (2016); WM mediation meta (2021) |
| Competence evidence | Motivation requires felt competence; mastery structures can raise achievement when mastery is real | **Medium–High** | SDT (Ryan & Deci); Kulik mastery meta; Slavin critique |
| Narrative / identity | Self-stories and belonging cues shape challenge-seeking and persistence | **Medium** | Yeager et al. (2019); Walton/Cohen belonging tradition; narrative psychology |

**HYPOTHESIS — Triad necessity:** For students starting from “I am bad at math,” improving any one factor alone is usually insufficient:

- Safety without competence → comfort without skill → identity still fragile.
- Competence without safety → possible for some; many never enter the practice volume.
- Narrative without either → empty affirmation (false growth mindset).

## XVI.3 Founder tutoring sequence — audit

**FOUNDER BELIEF (observed in tutoring):**

1. Reduce fear  
2. Demystify mathematics  
3. Explain why humanity invented it  
4. Simplify the narrative  
5. Create a tiny success  
6. Reinforce success  
7. Celebrate progress → identity shifts  

**Red Team audit:**

| Step | Universal? | Evidence status | Failure mode |
|------|------------|-----------------|--------------|
| 1 Fear ↓ | Common for anxious subset; not for all | Strong for anxious learners | Over-soothing that removes challenge |
| 2 Demystify | Often helpful | Medium (cognitive clarity) | Over-simplification that lies |
| 3 Invention story | Founder prior | **Under-evidenced at RCT scale** | Cultural mismatch; time cost |
| 4 Simplify narrative | Often helpful | Medium | Removes necessary difficulty |
| 5 Tiny success | Near-universal lever | High (competence need) | Too-easy wins → hollow identity |
| 6 Reinforce | High if attribution-correct | High (feedback literature) | Praise of talent or praise of empty effort |
| 7 Celebrate | Helpful if genuine | Medium | Performative celebration → cynicism |

**Improved sequence (HYPOTHESIS — “SAFE-CRAFT”):**

1. **S**afety: threat appraisal ↓ (tone, privacy, soft-wrong, no public shame)  
2. **A**ttempt: student acts before receiving a full lecture (productive struggle at right grain)  
3. **F**eedback-as-information: miss becomes diagnosis, not character  
4. **E**arned micro-win: success the student can own  
5. **C**ausal story: “what worked” (strategy), optionally “why humans invented this tool”  
6. **R**e-entry: immediate second attempt / next slightly harder item  
7. **A**ttribution + witness: tutor/system names the growth specifically  
8. **F**uture self: map fill / path unlock that marks identity-relevant progress  
9. **T**ransfer check: varied item so win was not clone memorization  

**What changed vs founder sequence:** Attempt moves earlier; invention-story becomes optional enrichment inside step 5, not a prerequisite to agency; transfer check prevents fake mastery.

## XVI.4 Math anxiety — what is known, what is not

**FACT:** Higher math anxiety correlates with lower math performance (meta r ≈ −0.17 in one 2021 synthesis of 57 studies — modest average, not destiny).

**FACT:** Ashcraft & Kirk (2001) show math anxiety can act like a dual-task load: worry competes for working memory, especially on computation-span / carry-heavy tasks.

**HYPOTHESIS:** In product UX, anything that increases social-evaluative threat (red buzzers, public leaderboards for novices, tutor contempt, parent hovering UI) will shrink effective WM and look like “they don’t get it.”

**Contradictions / limits:**

- Not all underperformance is anxiety; some is missing knowledge, poor curriculum, sleep, language barriers.
- Trait vs state anxiety differ; trait may partly reflect prior failures (reverse causality possible).
- High performers can be anxious and still succeed via avoidance of hard electives — a hidden identity cost.

**MindCraft rule:** Treat anxiety as a first-class load on the learning system, not as a soft skill sidebar.

## XVI.5 Deliberate practice — necessary, not sufficient

**FACT / TRADITION:** Ericsson’s deliberate practice emphasizes structured, feedback-rich, effortful practice aimed at improvement (not mere repetition).

**FACT / CRITIQUE:** Hambrick and colleagues argue deliberate practice is important but not sufficient; in chess/music reanalyses, deliberate practice often explains roughly ~1/3 of reliable variance, leaving most unexplained (abilities, starting age, opportunity, etc.).

**Implication for MindCraft:** Do not sell “10,000 hours.” Sell **high-quality attempts under feedback**. Also respect individual differences: same practice volume will not equalize outcomes. Identity work must include “progress relative to self,” not only absolute rank.

## XVI.6 Tutoring effects — demythologize Bloom

**FACT:** Bloom (1984) popularized the “2 sigma” tutoring + mastery framing.

**FACT / CALIBRATION:** Broader tutoring metas are far smaller (often ~0.3–0.4 SD in modern RCT syntheses cited by Education Next). VanLehn (2011) estimated human tutoring ~0.79 SD vs no tutoring, with step-based ITS nearly comparable (~0.76).

**Implication:** Human tutors remain valuable, especially for affect + accountability + diagnosis of weird misconceptions. They are not magic 2-sigma machines. AI step-level feedback can capture much of the *cognitive* tutoring benefit; the scarce remainder is Layers 4–6 (emotion, identity, accountability).

---

# Part XVII — Scarcity Thesis: Full Red Team Trial

## XVII.1 The claim under oath

**FOUNDER BELIEF:** AI commoditizes knowledge; future scarcity is motivation, confidence, identity, trust, curiosity, persistence, emotional safety, meaning.

## XVII.2 Cross-examination

### Claim A — “Explanations are free”
**Verdict:** Directionally **FACT** for commodity explanations; **FALSE** for *trusted, personalized, correct, curriculum-aligned* explanations under time pressure.

**Evidence:** Generative AI + open platforms collapse marginal cost of text explanation.  
**Contradiction:** Hallucinations, shallow fluency, and misalignment create a *trust tax*. Parents may still pay for verified human judgment.

### Claim B — “Tutoring is free”
**Verdict:** **FALSE.**

AI chat is cheap. High-quality tutoring includes scheduling, relationship, emotional labor, accountability, and reputation. Those remain expensive. Nickow et al.–style tutoring metas still show meaningful effects when tutoring is structured — it is not free at scale.

### Claim C — “Content is free”
**Verdict:** **MOSTLY FACT** for undifferentiated content; **FALSE** for sequenced, assessed, outcome-linked content systems.

Khan/YouTube prove content abundance. Differentiation is curation + measurement + human wrap.

### Claim D — “Motivation/identity become the scarce goods”
**Verdict:** **HYPOTHESIS with strategic plausibility.**

As cognitive help approaches free, *willingness to engage difficulty* becomes the binding constraint for many students. This does not mean motivation products automatically win — many habit apps fail to produce identity.

### Claim E — “Emotional safety is first-order”
**Verdict:** **HYPOTHESIS — true for anxious / threatened learners; not universal.**

For some, speed drills and competition *increase* engagement. Segment, do not romanticize softness.

## XVII.3 Surviving thesis (company doctrine)

**Adopted doctrine (refined):**

> MindCraft does not compete primarily on explanation volume. It competes on converting threatened learners into challenge-seeking mathematical agents through diagnosis, affective design, mastery evidence, narrative meaning, and human accountability — with AI as infrastructure.

**Falsifiers (90-day capable):**

1. Anxious segment shows no FEI lift vs explanation-first control.  
2. Parents refuse to pay when score gains lag identity metrics.  
3. AI-alone matches human+AI on persistence + transfer for target segment.

---

# Part XVIII — Systems Maps (loops, not features)

## XVIII.1 FEI reinforcing loop (desired)

```
     +------------------ identity claim ("I do math") <---+
     |                                                    |
     v                                                    |
 safety UX ----> attempt ----> informative miss ----> coach
     ^              |                                 |
     |              v                                 v
     +------ map fill / witness <---- earned success <+
```

## XVIII.2 Shame balancing loop (destroy this)

```
 public failure signal -> threat ↑ -> avoidance -> fewer attempts
        ^                                         |
        +--------- skill lag / worse scores ------+
```

## XVIII.3 Extrinsic colonization loop (danger)

```
 streak / points ↑ -> return ↑ -> shallow grinding ↑
        |                              |
        +-- identity unchanged --------+--> burnout / streak break → exit
```

**Design rule:** Habit loops may feed FEI but must not replace identity markers.

## XVIII.4 Parent trust loop

```
 visible diagnosis + honest progress -> parent trust ↑ -> continued purchase
                ^                              |
                +---- outcome evidence (scores / challenge-seeking) 
```

**FOUNDER QUESTION unresolved:** Optimize Maya’s identity or parent’s anxiety? Doctrine: report *both* challenge-seeking and skill evidence; never fake either.

## XVIII.5 Network effects (honest)

MindCraft today has weak classic network effects. Do not pretend otherwise.

**Possible compounding advantages (HYPOTHESIS):**

1. Ontology + misconception memory → better diagnosis over time (data moat if privacy-respecting).  
2. Tutor playbooks trained on FEI outcomes → service quality moat.  
3. Story worlds with longitudinal character arcs → switching costs of meaning (fragile; easy to cargo-cult).

---

# Part XIX — Cross-Domain Transfer Catalog

Principles that repeatedly change human behavior outside classrooms — filtered for MindCraft use.

| Domain | Robust mechanism | Transfer | 30-year durable? | AI improve? |
|--------|------------------|----------|------------------|-------------|
| Exposure therapy | Graded exposure under safety | Anxiety-graded problem sets | Yes | Yes (personalize gradient) |
| Sports film study | Specific error review | Wrong-choice coach | Yes | Yes (auto clip of miss type) |
| Music pedagogy | Technique → repertoire → performance | Drill → quest → “recital” signal | Yes | Partial |
| Martial arts | Visible ranks + dojo norms | Map regions + tutor dojo culture | Yes | Weak for norms |
| Aviation | Checklists under stress | Procedure scaffolds when anxious | Yes | Yes |
| Games (Celeste-like) | Fair failure + retry culture | Soft-wrong physics | Yes | Yes |
| Chess | Annotated game review | Session postmortems | Yes | Yes |
| Coaching | Identity + accountability | Tutor as witness | Yes | Assist, not replace |
| Religion/ritual | Meaning + belonging | Light rituals only; avoid cult dynamics | Yes (human) | Risky |
| Creator economy | Public craft identity | Optional shareable math artifacts | Uncertain | Yes |

**Anti-transfer:** Casino variable rewards → addiction without skill. Do not copy engagement maxing from social media.

---

# Part XX — Competitive Landscape (mechanism lens)

| Product | Primary scarce resource they sell | Identity claim? | Risk |
|---------|-----------------------------------|-----------------|------|
| Khan Academy | Free mastery content + reputation | Weak–medium | Explanation commodity |
| Duolingo | Habit / streak motivation | Weak (language identity sometimes) | Extrinsic ceiling |
| Brilliant | Aesthetic problem joy + prestige | Medium | Narrow segment |
| Coursera/edX | Credentials | Medium (career identity) | Completion collapse |
| Chegg / homework help | Answers under deadline | Anti-identity (outsourcing) | Integrity & AI shock |
| Private tutors | Human accountability + customization | High when good | Supply constrained |
| ChatGPT tutors | Instant explanation | Low unless wrapped | Trust / hallucination |
| MindCraft (target) | FEI conversion + tutor witness + gap diagnosis | **Intended high** | Must prove, not assert |

**Strategic implication:** Do not out-Khan Khan on content breadth. Do not out-Duo Duo on streaks. Out-tutor mediocre marketplaces on *diagnosed emotional-cognitive loop*.

---

# Part XXI — Metrics Dictionary (instrumentation)

## XXI.1 Banned as North Stars

- Raw DAU / time-on-app without transfer  
- Streak length alone  
- Explanation open-rate  
- Points / coins  

## XXI.2 Leading indicators (ship first)

| Metric ID | Definition | Why |
|-----------|------------|-----|
| `retry_120s` | New attempt on same or isomorphic item within 120s of soft-wrong | Persistence under safety |
| `coach_shown` | Wizard/coach surfaced | Treatment exposure |
| `write_exit_to_retry` | Leave write mode then attempt | Agency after reflection |
| `challenge_accept` | Chose harder level when offered | Challenge-seeking |
| `hint_binge` | ≥3 hints without independent solve | Gaming / helplessness |
| `transfer_pass` | Correct on varied item after mastery mark | Anti-fake-mastery |

## XXI.3 Lagging indicators

| Metric ID | Definition |
|-----------|------------|
| `math_person_item` | 1–7 agreement: “I am a math person” (math-specific) |
| `anxiety_state_item` | Short state anxiety before session |
| `advanced_intent` | Intent to take harder course / contest |
| `tutor_witness_note` | Tutor tagged identity-relevant growth |

## XXI.4 Decision rule (HYPOTHESIS)

Ship changes that raise `retry_120s` and `challenge_accept` without raising `hint_binge` or dropping `transfer_pass`.

---

# Part XXII — Appendices

## Appendix A — Glossary

| Term | Meaning |
|------|---------|
| FEI Loop | Fear → Evidence → Identity system |
| ITC | Identity Transformation Cascade |
| Soft-wrong | Miss treated as information, not shame theater |
| Gap scan | Low-shame diagnostic of confidence/exposure |
| Challenge-seeking | Choosing harder math opportunity when optional |
| False growth mindset | Effort praise without strategy / conditions |
| SAFE-CRAFT | Improved tutoring sequence (Part XVI.3) |
| Layers 0–6 | Knowledge commodity stack (Part VI.3) |

## Appendix B — Maya interview protocol (qual)

**Goal:** Map moments when math stopped (or started) feeling dangerous.

1. “Tell me about a time math felt dangerous or humiliating.”  
2. “What did your body do? What did you do next?”  
3. “Tell me about a time you surprised yourself in math.”  
4. “Who saw that moment? Did it matter that someone saw it?”  
5. “If an app celebrated you, would that feel real or fake? Why?”  
6. “What would make you take a harder math class next year?”  
7. “When you get stuck, do you want comfort, a hint, or the answer? In what order?”  

**Coding:** threat markers; attribution language; witness presence; desire for story vs drill.

## Appendix C — Causal DAG (provisional)

```
prior failures → math anxiety → WM load → performance ↓
       \              \             \→ avoidance → practice ↓ → skill lag
        \              \→ fixed identity narrative
         \→ missing knowledge ─────────────────────────────→ performance ↓

safety UX → threat ↓ → WM available ↑ → attempt quality ↑
coach + diagnosis → misconception repair → competence evidence ↑
competence evidence + witness → identity update → challenge-seeking ↑
challenge-seeking → harder practice → skill ↑  (reinforcing)
```

**Open identification problem:** Does identity cause challenge-seeking, or does challenge-seeking cause identity? Likely bidirectional. Measure both.

## Appendix D — Experiment pre-registration sketches

### A — Wizard coach
- Population: chapter/practice users with soft-wrong enabled  
- Arms: coach on / coach off  
- Primary: `retry_120s`  
- Guardrail: `transfer_pass`, session completion  
- Stop rule: clear harm on transfer or spike in hint binge  

### B — Story frame
- Arms: invention-story wrapper vs bare stem (same math)  
- Primary: time-to-abandon after first miss  
- Secondary: enjoyment, retention @ 7d  

### D — Explanation timing × anxiety
- Screen: brief anxiety item  
- Arms: explain-first vs attempt-first  
- Heterogeneity: high vs low anxiety  

## Appendix E — Red Team standing orders

1. Attack any claim that cannot name a falsifier.  
2. Attack any metric that can be gamed without learning.  
3. Attack any narrative feature without a learning outcome.  
4. Attack Bloom 2-sigma mythology on sight.  
5. Attack “AI makes tutoring free” slogans on sight.  

## Appendix F — Future chapters (queued, not padded)

1. Neuroscience of math anxiety (amygdala/WM models; cautious translation)  
2. History of mathematics as meaning technology  
3. Parent trust economics & willingness-to-pay experiments  
4. Equity audit of story worlds — **DONE** (Part XXXVI)  
5. Full competitive teardown with usage telemetry (when available) — partial via Part XXXV session audits  
6. Formal Bayesian update process for Constitution claims  

---

# Part XXIII — Research Lab Operating Cadence

**Weekly (60–90 min):**

1. One claim enters trial (evidence + contradiction).  
2. Red Team attempts kill.  
3. Surviving claim updates Constitution with confidence tag.  
4. One experiment metric reviewed.  

**Monthly:**

- Rewrite one weak chapter.  
- External reader (learning scientist or skeptical founder).  
- Regenerate PDF.  

**Quarterly:**

- Kill or promote North Star metric.  
- Publish internal “what we believed that was wrong” memo.  

---

## Closing stance

MindCraft’s deepest risk is not technical failure. It is **winning the wrong game**: becoming the best explanation engine in a world where explanations are cheap, while losing the only game that compounds — helping a human revise who they are in the presence of difficulty.

This Constitution exists so the company notices that risk early, and runs experiments that can kill beloved ideas.

**v1.1 expanded mechanisms, scarcity trial, systems maps, and instrumentation. The lab continues. Page count is not the finish line — falsifiable truth is.**
