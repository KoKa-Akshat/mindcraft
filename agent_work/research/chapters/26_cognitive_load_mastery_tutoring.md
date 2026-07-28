# Part XXVI — Cognitive Load, Mastery, Tutoring (deep dive)

**Chapter status:** Living evidence brief  
**Primary question:** How do we create earned competence without drowning working memory — and without mythologizing tutoring?  
**Owners:** Cognitive Science · Learning Science · AI Researcher · Red Team

---

## XXVI.1 Cognitive Load Theory — the non-negotiable physics

**FACT / TRADITION:** Cognitive Load Theory (Sweller and colleagues) — working memory is limited; instructional design that forces novices into unguided search can impede schema acquisition.

**FACT:** Worked-example effect — for novices, studying worked examples often beats equivalent time in conventional problem solving for structurally similar later items (classic Sweller & Cooper algebra studies, 1985 line).

**FACT / DESIGN IMPLICATION:** Guidance fading — move from full worked examples → completion problems → independent solving as expertise grows (Renkl/Atkinson fading tradition). Continuing full examples after expertise rises can trigger **expertise reversal** (redundancy).

**Why this matters to identity:** Overloaded novices experience failure as self-indictment. Load mismanagement manufactures fake “I’m bad at math” evidence.

---

## XXVI.2 Reconciling CLT with “attempt before lecture”

SAFE-CRAFT says attempt early. CLT says novices need worked examples. **Is this a contradiction?**

**Resolution (HYPOTHESIS — Attempt Grain Principle):**

| Learner state | Right “attempt” | Wrong “attempt” |
|---------------|-----------------|-----------------|
| True novice, new schema | Attempt a **micro-step** or completion blank inside a worked example | Full novel multi-step problem cold |
| Partial schema | Isomorphic problem with soft-wrong | Leap to transfer without success |
| Anxious + some knowledge | Slightly easier isomorphic first | Public hard problem as opener |
| Advanced | Minimal guidance; generative struggle | Endless examples (expertise reversal) |

**Product rule:** “Struggle first” means **agency at the right grain**, not abandonment into search.

This dissolves a false war between “productive struggle” slogans and cognitive load science.

---

## XXVI.3 Mastery learning — keep the war on the table

**Supporting evidence:** Kulik, Kulik & Bangert-Drowns (1990) meta — mastery programs associated with positive exam effects (often cited ~0.5 SD overall in their synthesis), often stronger for weaker students; time costs can rise; completion can suffer in some self-paced settings.

**Contradicting evidence:** Slavin (1987) “Mastery Learning Reconsidered” — limited support for group-based mastery on standardized measures; stronger on experimenter-made tests; coverage vs depth tradeoff is real.

**MindCraft doctrine:**
1. Mastery means **transfer_pass**, not same-item streak.  
2. Track time-to-mastery; do not hide cost.  
3. Allow strategic coverage decisions (exam track) without pretending infinite time.  
4. Ontology graph is only as good as far-transfer checks.

---

## XXVI.4 Tutoring — calibrate the mythology

**Bloom (1984):** Tutoring + mastery framing popularized as ~2 SD (“2 sigma problem”).

**Calibration FACTS:**
- Cohen, Kulik & Kulik (1982) tutoring meta — much smaller average effects than 2.0.  
- Nickow, Oreopoulos & Quan (2020) tutoring RCT meta — on the order of ~0.37 SD (impressive, not magic).  
- VanLehn (2011) — human tutoring ~0.79 SD vs no tutoring; step-based ITS ~0.76; answer-based CAI smaller. Granularity of feedback matters; beyond a point, finer grain plateaus.

**Strategic reading for MindCraft:**

| Tutoring function | Automate? | Keep human? |
|-------------------|-----------|-------------|
| Step feedback | Yes (ITS-like) | Optional |
| Misconception diagnosis | Partially (ontology + traces) | Human for weird cases |
| Affect co-regulation | Partially (UX) | Human strong |
| Accountability / relationship | Weakly | Human strong |
| Identity witnessing | Poorly | Human strong |

**AI implication:** Compete on diagnosis quality + FEI wrapping; do not sell “we are 2-sigma.”

---

## XXVI.5 Deliberate practice inside sessions

**FACT / TRADITION:** Ericsson et al. (1993) — structured, feedback-rich practice aimed at improvement.

**FACT / CRITIQUE:** Hambrick/Macnamara line — deliberate practice explains substantial but incomplete variance; not a sufficient account of expertise differences.

**Session design (HYPOTHESIS):**
1. Clear target skill (ingredient-level).  
2. Immediate feedback at step grain when possible.  
3. Successive refinement on weak subskill (not random variety first).  
4. Then varied practice for transfer.  
5. Short enough to protect affect; frequent enough to compound.

---

## XXVI.6 Minimal guidance failures

**FACT:** Kirschner, Sweller & Clark (2006) critique pure discovery/minimal guidance for novices — often inferior to guided instruction.

**Implication for story worlds:** Narrative must not become unguided discovery of math. Story wraps guided cognition. World_VISION is compatible with guidance; it is incompatible with vibes-only exploration.

---

## XXVI.7 Systems: Competence Production Line

```
diagnosis (gap) → grain selection → worked/fade → attempt
       → soft-wrong info → repair → transfer check
       → mastery mark → spaced return → challenge raise
```

Balancing loops:
- Too slow fade → boredom  
- Too fast fade → threat + load spike → avoidance  
- Mastery without spacing → illusion of competence  

---

## XXVI.8 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| CLT-1 | Worked-example-first vs problem-first for true novices | Within concept | near & far transfer |
| CLT-2 | Fade schedule adaptive to mastery graph vs fixed | A/B | time-to-transfer_pass |
| TUT-1 | Human tutor + AI brief vs AI-alone on persistence | RCT | retry + 4-week challenge_accept |
| MAS-1 | Mastery gate with transfer_pass vs same-item 3-in-a-row | A/B | 2-week retention |

**Red Team standing kill:** Any claim that MindCraft “replicates Bloom 2-sigma” without citing modern tutoring metas.
