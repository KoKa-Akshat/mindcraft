# Part LXXXVIII — Worked-Example Fading in Solver UX

**Chapter status:** Living evidence + Solver/Practice UX brief — Researcher tick 2026-08-06  
**Primary question:** How should MindCraft fade guidance from full worked examples → completion steps → solo solve in Solver (and Practice help rails) without permanent solution-dump, expertise-reversal tax, or “instant full answer” as the product brand?  
**Owners:** Product (Solver / Practice) · Engine (ingredient cards / coach) · HITL tutors · Brand · Red Team  
**Commercial job:** Ship a **SAFE-FADE** doctrine: guidance level is a *diagnosed state*, not a permanent chrome; attempt grain before reveal; completion problems as the default bridge; solo transfer as the proof that fading worked.

**Builds on:** Parts XXVI (CLT / fading), XL (SAFE-SE), LI (SAFE-DP), LXXIX (SAFE-FBTIME), LXXXIV (SAFE-TALK), LXXXV (SAFE-STORYLOAD), LXXXVI (SAFE-PROOF). Product seams: Solver help, ingredient cards, soft-wrong / SE gates, `solo_transfer_pass`, hint binge guards.

---

## LXXXVIII.1 Why this chapter exists

Homework Help / Solver is the surface where competitors and ChatGPT win on *fluency*: paste problem → full worked solution → green check feeling. MindCraft already bans unguarded Solver hero (PWC) and AI-monologue≡SE. The remaining product hazard is quieter: **permanent full worked examples** (or always-on step dumps) that help absolute novices once, then become redundant load — and train help-seeking that never fades.

**FOUNDER BELIEF under audit:** A Solver that *fades* (full example → missing last steps → missing more → full problem) converts “I needed help” into “I can finish the join myself” — the identity move — better than unlimited perfect solutions. That claim is commercial only if we instrument attempt grain and solo transfer, not solution views.

**Claims we refuse as doctrine:**
1. Always-full-worked / solution-first Solver as learning North Star.  
2. Never-fade step scaffolding (“we always show every step”).  
3. Completion-of-viewing ≡ mastery (watching steps = doing math).  
4. Instant full answer as brand differentiator vs ChatGPT.  
5. Expertise-blind help (same dump for L1 and near-fluent).  
6. Hint binge / reveal streak without fade-up after success.  
7. Fade Score™ / guidance-% as vanity NS.  
8. Forward-only fade as dogma without local FADE-* check (backward often wins in lab).

---

## LXXXVIII.2 Constructs

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Worked example** | Full problem + solution steps for study | Full coach card / Solver reveal | Permanent dump |
| **Completion problem** | Partial solution; learner finishes | Missing-step Solver; last-step blank | Fake blanks with answer peek |
| **Fading** | Successive removal of worked steps | Guidance ladder per concept/format | One-shot jump to solo |
| **Expertise reversal** | Novice-helpful guidance hurts experts | Same full example for advanced | Redundant load / boredom |
| **Attempt grain** | Learner generates before full reveal | SE / soft-wrong / blank-step gate | Watch-only “learning” |
| **SAFE-FADE** | Diagnosed fade ladder + solo proof | This chapter | Solution theater |

**Operational definition (HYPOTHESIS):** A Solver/help path is *SAFE-FADE complete* when it (a) defaults to **attempt or completion** before full worked reveal on learn rail, (b) fades **backward** (omit final steps first) unless FADE-* prefers otherwise for that schema, (c) raises guidance only on diagnosed struggle (not permanent chrome), (d) fades *up* after consecutive solo successes, (e) never counts solution-view as mastery, and (f) co-primary proves with `solo_transfer_pass` / delayed mixed accuracy — not hint satisfaction NPS.

---

## LXXXVIII.3 Novices need worked examples — search is the tax

**FACT (worked-example effect):** Sweller & Cooper (1985, *Cognition and Instruction*, 2(1), 59–89, doi:10.1207/s1532690xci0201_3) — for algebra novices, studying worked examples as a substitute for conventional problem solving reduced time and errors on subsequent similar problems; conventional search imposed heavy load that retarded schema acquisition.

**FACT (CLT framing):** Sweller (1988, *Cognitive Science*, 12(2), 257–285, doi:10.1207/s15516709cog1202_4) — problem-solving search can consume working memory needed for schema construction; reducing extraneous search supports learning of complex material.

**Applied (HYPOTHESIS):** Day-one Solver that *only* withholds all guidance (pure struggle theater) violates CLT for true novices. SAFE-FADE is not “never help” — it is **help that starts complete enough to build schema, then steps down**.

**Kill:** Discovery-only / no-example Solver for first acquisition.  
**Survive:** Full worked study *as a stage*, not as the product forever.

---

## LXXXVIII.4 Expertise reverse — permanent examples become clutter

**FACT (expertise reversal):** Kalyuga, Ayres, Chandler & Sweller (2003, *Educational Psychologist*, 38(1), 23–31, doi:10.1207/s15326985ep3801_4) — instructional methods highly effective for inexperienced learners can lose effectiveness or become detrimental as expertise grows, because guidance becomes redundant and loads working memory with unnecessary cross-checking.

**FACT (when solving beats examples):** Kalyuga, Chandler, Tuovinen & Sweller (2001, *Journal of Educational Psychology*, 93(3), 579–588, doi:10.1037/0022-0663.93.3.579) — as learners gain expertise in a domain, problem solving can become superior to studying worked examples (classic reverse pattern under CLT).

**Commercial implication:** Marketing “we show every step, always” is a **novice costume** that taxes Maya once she has partial schemas — and looks identical to ChatGPT solution dump. Map/level/format evidence must *lower* default guidance after demonstrated competence.

**Kill:** Expertise-blind always-full-worked brand.  
**Survive:** Guidance that tracks diagnosed grain (ties SAFE-COLD / SAFE-FORMAT / SAFE-ONTOLOGY).

---

## LXXXVIII.5 Completion problems bridge example → solve

**FACT (completion as bridge):** van Merriënboer and colleagues introduced *completion problems* — given state, goal, and partial solution the learner must finish — as intermediates between fully worked examples and conventional problems; completion strategies emphasize completing increasingly larger parts of incomplete solutions (see van Merriënboer, 1990; van Merriënboer & de Croock, 1992, in programming; reviewed in Paas & van Merriënboer instructional-control work).

**FACT (mental effort / transfer):** Paas (1992, *Journal of Educational Psychology*, 84(4), 429–434, doi:10.1037/0022-0663.84.4.429) — in statistics problem solving, training with completion problems or worked examples yielded better transfer with lower test-phase mental effort than conventional problem training (completion ≈ worked examples on effort during training; both beat conventional on transfer efficiency).

**Applied (HYPOTHESIS):** Solver’s default “help” should often be a **blank last step / blank middle join**, not a monologue. Ingredient cards already suggest multi-representation scaffolds — fade means those scaffolds lose steps over successes, not that more cards appear forever.

**Kill:** Help ≡ paste full solution.  
**Survive:** Help ≡ completion problem with named missing grain (procedure, bridge, format).

---

## LXXXVIII.6 Smooth fading beats static example–problem pairs

**FACT (fading procedure):** Renkl, Atkinson, Maier & Staley (2002, *Journal of Experimental Education*, 70(4), 293–315, doi:10.1080/00220970209599510) — successive integration of problem-solving elements into example study (complete example → increasingly incomplete → to-be-solved) fostered near-transfer learning vs traditional example–problem pairs; errors during learning mediated the effect; **backward fading** (omit last solution steps first) outperformed forward fading.

**FACT (CLT transition argument):** Renkl & Atkinson (2003, *Educational Psychologist*, 38(1), 15–22, doi:10.1207/S15326985EP3801_3) — as intrinsic load falls with schema growth, problem-solving demands can increase without overload; fading structures that transition; later stages change which activities are germane vs extraneous.

**Applied (FOUNDER BELIEF → testable):** MindCraft Solver ladder:

| Stage | UX | Gate to next |
|-------|-----|--------------|
| E0 Full example | Study + SE prompt on a marked step | SE / principle tag |
| E1 Backward fade | Last step blank | Correct completion |
| E2 Deeper fade | Last two / critical join blank | Correct + no peek |
| E3 Full problem | Solo attempt | `solo_transfer_pass` delayed |

Raise guidance only after miss class / pour streak — never as default forever.

**Kill:** Static example then unrelated dump; jump from E0 to E3 without completions.  
**Survive:** Backward-first fade ladder with local FADE-* override rights.

---

## LXXXVIII.7 Attempt grain — watching is not doing

**FACT (passive example risk):** Worked-example literature repeatedly notes that *passive* viewing weakens the effect; prompting self-explanation and active study of solutions strengthens learning (ties Chi / Renkl SE line — Part XL). MIT TLL synthesis of Sweller & Cooper (1985) and later work: insufficient examples and passive demos neutralize the worked-example effect.

**HYPOTHESIS:** Solver telemetry that optimizes `solution_reveal_rate` or time-on-help will invent help abuse (next chapter 89). Co-primary must be **student-generated steps before reveal** + delayed solo.

**Reuse:** SAFE-SE (why before wrap); SAFE-FBTIME (micro-delay on learn rail); SAFE-TALK (construction > pour); SAFE-PROOF (solo artifact).

**Kill:** View-complete ≡ session success.  
**Survive:** `fade_step_attempt` events before unlock of next worked line.

---

## LXXXVIII.8 Product surface — SAFE-FADE claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Solver first open (learn) | Attempt or completion before full dump | Instant ChatGPT-style full solution |
| After consecutive solos | Fade *up* (less guidance) | Keep dumping “to be helpful” |
| After struggle | Fade *down* one stage; name the missing grain | Permanent max scaffolding |
| Ingredient / coach cards | Steps can blank; SE on blank | Always-complete card deck |
| Marketing | “We fade help as you prove the join” | “Unlimited full solutions” |
| Prove / exam rail | Minimal worked reveal; KR timing (SAFE-FBTIME) | Learn-rail full examples under stakes |

**Competitive foil:** Khan/Brilliant often lean example+practice; ChatGPT leans full solution fluency. MindCraft differentiates on **diagnosed fade + solo transfer**, not on prettier monologues.

---

## LXXXVIII.9 Competitive positioning

| Competitor pattern | Guidance move | MindCraft response |
|--------------------|---------------|--------------------|
| ChatGPT homework | Full fluent solution | Completion + fade + Map-check (SAFE-REPAIR) |
| Instant-feedback AI | Always show steps | Mode-conditional; attempt grain |
| Cram packs | Worked keys as content | Dual-rail; fade on learn, prove alone |
| “Socratic” bots | Endless questions *or* dump | Construction metrics; not talk-% (SAFE-TALK) |
| Static textbooks | Fixed example then exercises | Adaptive fade from evidence state |

**Competitive wedge (FOUNDER BELIEF):** “Help that disappears when you can carry the step” beats both abandonment struggle and infinite solution theater.

---

## LXXXVIII.10 Doctrine — SAFE-FADE (provisional)

1. **Stage, don’t costume** — full worked examples are an *acquisition stage*, not the brand forever.  
2. **Completion is the default bridge** — blank critical / final steps before full reveal.  
3. **Backward fade first** — omit last steps first unless FADE-* shows forward better for that schema.  
4. **Expertise-aware** — raise guidance on struggle; lower after consecutive solos (expertise reversal).  
5. **Attempt grain** — student-generated step / SE before unlocking more worked lines.  
6. **Proof = solo transfer** — not solution views, Fade Score™, or help NPS.  
7. **Copy:** “We fade the steps as you prove them.” Never “unlimited perfect solutions” or “we always show every step.”  
8. **Tie rails** — learn rail may use E0–E2; prove/exam rail stays near E3 (SAFE-EXAM / SAFE-DURABLE).

**Confidence:** High that worked examples help novices vs conventional search (Sweller & Cooper 1985; Sweller 1988). High that expertise reverses example benefits (Kalyuga et al. 2003; Kalyuga et al. 2001). High that fading/completion structures transition better than static pairs (Renkl et al. 2002; Renkl & Atkinson 2003; Paas 1992). Medium that backward fade is the right default for MindCraft algebra/bridge schemas (needs FADE-*). Medium that parent WTP prefers fade story over unlimited solutions (needs WTP/FADE CBC). High that permanent full-dump Solver is commercially indistinguishable from ChatGPT and anti-identity.

---

## LXXXVIII.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| FADE-1 | Backward completion ladder vs always-full-worked Solver | A/B within concept | Near transfer; `solo_transfer_pass`; hint binge |
| FADE-2 | Backward vs forward fade order | A/B | Transfer; errors during learning |
| FADE-3 | Expertise-aware fade-up after 2 solos vs fixed E1 forever | A/B | Time-on-task; transfer; boredom/skip |
| FADE-4 | SE-on-blank-step vs passive completion | A/B | Transfer; SE quality |
| FADE-5 | Parent CBC: “fades help as you prove” vs “unlimited full solutions” vs “never shows answers” | CBC | WTP; trust (SAFE-WTP) |
| FADE-QUAL | 10 Maya: when does a shown step feel like rescue vs theft of the win? | Qual | Fade UX codebook |

**Falsifier:** Always-full-worked wins transfer *and* 26w identity equally → still ban as *brand* vs ChatGPT; segregate acquisition-stage examples from marketing hero.  
**Falsifier:** Aggressive fade tanks novice retention with no solo gain → hold longer at E0/E1; do not restore permanent dump.  
**Falsifier:** Forward fade beats backward on MindCraft bank → update ladder default; keep completion doctrine.

**Pre-register:** FADE-* before any “AI shows every step / unlimited solutions / never-fade scaffold” campaign (SAFE-LABMETA).

---

## LXXXVIII.12 So what for MindCraft commercially

- **Copy:** “We fade the steps as you prove them.” Lead with completion → solo, not unlimited solutions.  
- **Product:** Solver/help ladder E0→E3; blank-step attempt events; fade-up after solos; prove rail near E3; ingredient cards lose steps over success.  
- **Positioning:** Against ChatGPT solution dump and struggle-theater apps; for diagnosed guidance that earns identity via solo carry.  
- **Metric:** `fade_stage`, `fade_step_attempt`, `hint_binge`, co-primary `solo_transfer_pass` — demote `solution_reveal_rate` as success.  
- **Kill list:** Always-full-worked hero; never-fade scaffolding; view≡mastery; expertise-blind dump; Fade Score™ NS; unlimited-solutions ads.  
- **Growth:** Parent decks sell *earned independence of steps*; tutors QA to completion prompts not monologues (SAFE-HITL × SAFE-TALK).  
- **Vision:** Thirty-year identity company teaches Maya to need the worked line less — help that graduates her, not a solution vending machine.

---

## References (verified)

- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist, 38*(1), 23–31. https://doi.org/10.1207/s15326985ep3801_4  
- Kalyuga, S., Chandler, P., Tuovinen, J., & Sweller, J. (2001). When problem solving is superior to studying worked examples. *Journal of Educational Psychology, 93*(3), 579–588. https://doi.org/10.1037/0022-0663.93.3.579  
- Paas, F. G. W. C. (1992). Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach. *Journal of Educational Psychology, 84*(4), 429–434. https://doi.org/10.1037/0022-0663.84.4.429  
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition: A cognitive load perspective. *Educational Psychologist, 38*(1), 15–22. https://doi.org/10.1207/S15326985EP3801_3  
- Renkl, A., Atkinson, R. K., Maier, U. H., & Staley, R. (2002). From example study to problem solving: Smooth transitions help learning. *Journal of Experimental Education, 70*(4), 293–315. https://doi.org/10.1080/00220970209599510  
- Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science, 12*(2), 257–285. https://doi.org/10.1207/s15516709cog1202_4  
- Sweller, J., & Cooper, G. A. (1985). The use of worked examples as a substitute for problem solving in learning algebra. *Cognition and Instruction, 2*(1), 59–89. https://doi.org/10.1207/s1532690xci0201_3  
