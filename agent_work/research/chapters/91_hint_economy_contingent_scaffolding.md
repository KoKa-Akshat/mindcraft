# Part XCI — Hint Economy & Contingent Scaffolding

**Chapter status:** Living evidence + Solver/Practice hint-ladder brief — Researcher tick 2026-08-06  
**Primary question:** How should MindCraft price the *cost of a peek* (effort, stage, and timing — not humiliation) and make scaffolding *contingent* (up after miss, down after success) so soft principle hints beat free bottom-out racing — without renaming ChatGPT dump as “adaptive help”?  
**Owners:** Product (Solver / Practice hints) · Engine (fade×hint state) · HITL tutors · Brand · Red Team  
**Commercial job:** Ship a **SAFE-HINT** doctrine: soft before hard; contingency before menu; peek costs construction; fade×hint as one state machine; prove with solo transfer, not hint-click engagement.

**Builds on:** Parts XXVI (fading), XL (SAFE-SE), LXXXVIII (SAFE-FADE), LXXXIX (SAFE-HELP), XC (SAFE-INSTRUMENT). Product seams: hint levels, `hint_binge`, `help_deliberate_ms`, `help_executive_race`, `fade_stage`, SE gates. Sibling: id 92 explanation length (token tax on monologue hints).

---

## XCI.1 Why this chapter exists

SAFE-HELP answered *when* help is instrumental vs abusive. SAFE-FADE answered *what stage* of worked guidance belongs on the learn rail. This chapter answers the *microeconomics of the hint button*: peek cost, soft vs hard levels, and contingency (Wood) + fading (van de Pol) so Maya constructs instead of shopping for answers.

**FOUNDER BELIEF under audit:** Free, instant, hard peeks train executive completion. Making the next *principle* cheap and the *answer* expensive — in effort, not shame — converts Solver from a dump into an identity machine, if parents hear “help that still asks you to think” and students still reach solo transfer.

**Claims we refuse as doctrine:**
1. Costless unlimited peeks / free bottom-out as learning North Star.  
2. Soft-vs-hard confusion: treating static “hard scaffolds” (Saye & Brush) as the same as hard (=answer) hints.  
3. Hint clicks, Hint Score™, or XP-for-hints as engagement success.  
4. Non-contingent fixed chrome (same hard dump forever, or never any hint).  
5. Fade ladder and hint ladder as two disconnected products.  
6. Humiliation economy (shame timers, public peek counts) as “cost.”  
7. “AI always picks the perfect hint” black-box brand without inspectable stage.  
8. Points / streaks unlocked by peeking.

---

## XCI.2 Constructs (keep the two “soft/hard” axes separate)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Scaffolding (classic)** | Temporary support that enables success beyond unassisted ability | Coach / hint / tutor prompt | Permanent crutch |
| **Contingency** | Increase control after failure; decrease after success | Fade up/down + hint level | Fixed menu |
| **Fading / transfer of responsibility** | Support shrinks as competence grows | SAFE-FADE E0–E3 | Never fade / never help |
| **Soft hint (ITS)** | Principle / goal / critical-feature prompt; not the answer | Principle card; “which join?” | Vague pep talk |
| **Hard hint (ITS)** | Near-answer / bottom-out | Full step reveal / expression dump | Executive race |
| **Hard scaffold (Saye & Brush)** | Static, preplanned support in the environment | Ingredient card templates; completion blanks | Mistaken for “hard hint” |
| **Soft scaffold (Saye & Brush)** | Dynamic human/peer contingent aid | Tutor HITL; adaptive coach | Mistaken for “soft hint” |
| **Peek cost** | Friction that preserves sense-making before answer | SE gate; dwell; stage lock | Shame timer |
| **SAFE-HINT** | Contingent soft→hard ladder with priced peeks | This chapter | Free dump |

**Operational definition (HYPOTHESIS):** A hint path is *SAFE-HINT complete* when it (a) opens at a soft/principle grain unless diagnosis already requires harder support, (b) advances hard grain only after miss or deliberate request *with* attempt/SE, (c) decreases control after consecutive solo successes (contingency × fade), (d) makes bottom-out costly in *construction effort* (not humiliation), (e) never awards XP/streak for peeks, and (f) co-primary proves with `solo_transfer_pass` and lower `help_executive_race`.

---

## XCI.3 Scaffolding is contingent by definition — not a hint vending machine

**FACT (origin metaphor):** Wood, Bruner & Ross (1976, *Journal of Child Psychology and Psychiatry*, 17(2), 89–100) — tutoring as scaffolding: recruitment, reduction of degrees of freedom, direction maintenance, marking critical features, frustration control, and demonstration when the learner can recognize the solution.

**FACT (three characteristics):** van de Pol, Volman & Beishuizen (2010, *Educational Psychology Review*, 22, 271–296) — scaffolding reviews converge on **contingency**, **fading**, and **transfer of responsibility**. Contingency (Wood, Wood & Middleton, 1978 line, carried forward): increase degree of control after failure; decrease after success.

**FACT (computer contingent tutoring):** Wood & Wood (1999, *Computers & Education*, 33(2–3), 153–169) — QUADRATIC algebra tutor implementing contingent support; help-seeking process measures predict learning beyond pretest; prior knowledge moderates how help use relates to outcomes.

**Applied (HYPOTHESIS):** MindCraft’s hint button must encode *contingency*, not a flat shelf of equally cheap peeks. After two soft-wrongs, offer the next soft grain (mark critical feature / reduce degrees of freedom). After a clean solo, *lower* default control on the next isomorphic item. That is the same state machine as SAFE-FADE — not a second product.

**Kill:** Unlimited student-chosen answer menu labeled “scaffolding.”  
**Survive:** Contingent control that moves with evidence.

---

## XCI.4 Soft before hard — Cognitive Tutor ladder evidence

**FACT (hint sequences):** Cognitive Tutors typically expose multi-level on-demand hints from general/goal reminders → increasingly specific → **bottom-out** near-answer (Aleven & Koedinger, 2000/2001; reviewed in Aleven, McLaren, Roll & Koedinger, 2016, *IJAIED*, 26(1), 205–223, doi:10.1007/s40593-015-0089-1).

**FACT (abuse pattern):** Students often race to bottom-out; large shares of pre-bottom levels viewed under ~1s; when help is requested, students frequently advance through all levels to the answer (Aleven & Koedinger, 2000/2001; Aleven et al., 2016). Help abuse correlates negatively with learning in multiple analyses; Baker’s gaming line treats rapid help abuse as a primary gaming category.

**FACT (caveat):** Shih, Koedinger & Scheines (2008) — time spent with bottom-out can correlate positively with learning when treated as a worked-example opportunity (self-explanation), not as copy-paste (cited in Aleven et al., 2016). Soft-before-hard still holds; hard-without-sense-making fails.

**Naming hygiene (FACT about literature collision):** Saye & Brush (2002) call *hard scaffolds* the static, preplanned supports and *soft scaffolds* the dynamic teacher/peer supports. That axis is orthogonal to ITS soft/hard *hint specificity*. Product copy must not say “hard scaffolding” when it means “answer dump,” or parents will hear cruelty; tutors must not hear “soft scaffolding” and think “vague AI pep talk.”

**Applied (FOUNDER BELIEF → testable):** Default open = soft hint (critical feature / principle / “name the bridge”). Hard hint = gated. Bottom-out = last grain + SE/attempt tax (SAFE-HELP × SAFE-SE).

**Kill:** Soft and hard as brand poetry without ladder semantics.  
**Survive:** Named levels: Goal → Principle → Join cue → Step sketch → Bottom-out.

---

## XCI.5 The cost of a peek — effort economy, not shame economy

**HYPOTHESIS (hint economy):** If hard peeks are free in time, clicks, and social cost, rational students (and anxious ones) buy the answer. Learning products that “remove friction from help” optimize completion SaaS. Identity products must put friction on *executive* peeks while keeping *instrumental* peeks low-cost.

**Legitimate costs (product priors):**
1. **Construction cost** — write a why / fill a blank / name the FormatId or bridge before next hard level (SAFE-SE / SAFE-FADE).  
2. **Stage cost** — hard levels unavailable until soft grain shown *or* diagnosed struggle (contingency).  
3. **Dwell cost** — minimum readable time before next level advances (anti-race; Help Tutor behavioral signature).  
4. **Budget cost (optional)** — limited hard peeks per session that refresh with solo successes (not daily streak theater).

**Illegitimate costs (kills):** Public peek shaming; parent live stalk of hint count; countdown humiliation; XP penalties that feel like punishment for asking; Anxiety Score™ gated on peeks.

**FACT (support):** Roll et al. (2011, *Learning and Instruction*, 21(2), 267–280, doi:10.1016/j.learninstruc.2010.07.004) — metacognitive feedback increased deliberate help (more time, fewer levels) without reliable domain-gain magic (Aleven et al., 2016). Cost that changes *behavior* is not automatically an ACT-point engine — co-primary stays transfer/solo (SAFE-INSTRUMENT).

**Kill:** Free hard peek as brand kindness.  
**Survive:** Cheap soft peek + expensive hard peek in *effort*.

---

## XCI.6 Fade × hint — one state machine

**HYPOTHESIS:** Running SAFE-FADE (E0 full example → E3 solo) and a separate always-on hard-hint menu recreates ChatGPT inside the “faded” product. The hint ladder *is* the local control knob inside a fade stage:

| Fade stage | Default hint open | Hard peek policy |
|------------|-------------------|------------------|
| E0 (full example study) | Soft marks on the example | Bottom-out redundant — ban dump-over-example |
| E1 (completion) | Soft → principle on blank | Hard only after miss + SE on blank |
| E2 (sparse scaffold) | Soft first | One hard grain / attempt budget |
| E3 (near solo) | Soft invite after 2 misses | Hard rare; prove rail near zero |

**SPECULATION:** Inspectable chip (“Stage E1 · next soft: name the join”) beats black-box “AI chose your hint” for parent trust and tutor QA (SAFE-ADAPT inspectability pattern).

**Kill:** Fade theater with free hard menu underneath.  
**Survive:** Coupled fade×hint state; tutor briefs read the same chip.

---

## XCI.7 Product surface — SAFE-HINT claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Solver learn rail | Soft-first ladder; hard behind construction cost | Instant bottom-out |
| Practice hints | Contingent up/down; dwell anti-race | Hint spam = XP |
| Prove / exam rail | Soft only or none; no hard peeks as default | Learn-rail dump under stakes |
| Tutor HITL | Soft prompt before pour; match stage chip | Tutor as hard-hint vending |
| Parent view | Aggregate deliberate-help / solo — not peek ranks | Live “hints used” shame |
| Marketing | “Next-step hints that still ask you to think” | “Unlimited free hints / never stuck” |
| Analytics | `help_deliberate_ms`, `help_executive_race`, peek-budget use | Hint Score™ / peeks-as-DAU |

**Competitive foil:** ChatGPT = costless hard peek. Struggle-only apps = infinite soft silence. Duo-like loops = XP for peeks. MindCraft = priced peeks under contingency that graduate into solo transfer.

---

## XCI.8 Doctrine — SAFE-HINT (provisional)

1. **Soft before hard** — principle / critical-feature before bottom-out; name levels in UX.  
2. **Contingency is law** — control up after failure, down after success (Wood; van de Pol).  
3. **Peek cost = construction** — SE/blank/dwell/stage; never humiliation or parent stalk.  
4. **Fade × hint = one machine** — no free hard menu under a “faded” costume.  
5. **Two soft/hard vocabularies stay separate** — ITS hint specificity ≠ Saye & Brush hard/soft scaffolds.  
6. **No reward for peeking** — no XP, streak, or Hint Score™ for reveals.  
7. **Inspectable stage** — chip states why this grain; ban perfect-AI-hint mystique.  
8. **Proof** — `solo_transfer_pass` + lower executive race; deliberate soft use OK.

**Confidence:** High that contingency/fading/transfer-of-responsibility define scaffolding (van de Pol et al., 2010; Wood et al., 1976). High that free bottom-out racing is common and often anti-learning (Aleven/Koedinger; Aleven et al., 2016; Baker). High that soft-before-hard is the right default. Medium that specific peek-budget numbers generalize — run HINT-*. High that shame economies violate SAFE-PDASH. Medium parent CBC for “next-step cost” copy (HINT-5). High that fade×hint decoupling recreates ChatGPT.

---

## XCI.9 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| HINT-1 | Soft-first contingent ladder vs free hard menu | A/B within concept | `solo_transfer_pass`; `help_executive_race`; near transfer |
| HINT-2 | SE/blank cost before hard vs dwell-only vs neither | A/B/C | Deliberate ms; binge; transfer |
| HINT-3 | Coupled fade×hint vs faded stage + free hard submenu | A/B | Solo transfer; hard-peek rate |
| HINT-4 | Peek budget (N hard/session, refill on solo) vs unlimited hard | A/B | Executive race; avoidance; retention |
| HINT-5 | Parent CBC: “next-step hints” vs “unlimited free hints” vs “we never hint” | CBC | WTP; trust (SAFE-WTP) |
| HINT-QUAL | 10 Maya: when does a peek feel earned vs stolen? | Qual | Soft/hard phenomenology codebook |

**Falsifier:** Free hard menu wins delayed solo transfer *and* 26w identity equally → still ban as *brand* vs ChatGPT; allow rare emergency reveal off-learn-rail.  
**Falsifier:** Peek budgets spike avoidance and drop retention with no solo gain → drop budgets; keep soft-first + SE cost.  
**Falsifier:** Soft-first harms true novices vs E0 full example → keep E0 stage; do not open with hard silence.

**Pre-register:** HINT-* before any “unlimited free hints / AI perfect peeks / Hint Score™” campaign (SAFE-LABMETA). Do not duplicate HELP-1 pricing arms — HINT owns peek-cost; HELP owns instrumental vs executive typology.

---

## XCI.10 So what for MindCraft commercially

- **Copy:** “Next-step hints that still ask you to think.” Lead with soft-first + solo proof. Never “unlimited free hints so you’re never stuck.”  
- **Product:** Contingent soft→hard ladder coupled to fade stage; construction cost on hard peeks; inspectable stage chip.  
- **Positioning:** Against ChatGPT costless dump and struggle-theater silence; for an *economy of peeks* that transfers responsibility.  
- **Metric:** `help_deliberate_ms`, `help_executive_race`, hard-peek rate by stage, co-primary `solo_transfer_pass` — demote raw hint count / Hint Score™.  
- **Kill list:** Free hard peeks as kindness brand; Hint Score™ / XP-for-hints; shame timers; black-box perfect-hint AI; fade costume with free dump underneath.  
- **Growth:** Parent decks sell earned independence of peeks; tutors QA soft-before-pour (SAFE-HITL × SAFE-TALK).  
- **Vision:** Teach Maya to recruit the smallest scaffold that works — then to need less of it.

---

## References (verified)

- Aleven, V., & Koedinger, K. R. (2000). Limitations of student control: Do students know when they need help? In *ITS 2000* / related PACT reports; see also Aleven & Koedinger (2001) help-seeking investigations.  
- Aleven, V., McLaren, B. M., Roll, I., & Koedinger, K. R. (2016). Help helps, but only so much: Research on help seeking with intelligent tutoring systems. *International Journal of Artificial Intelligence in Education, 26*(1), 205–223. https://doi.org/10.1007/s40593-015-0089-1  
- Baker, R. S., Corbett, A. T., Koedinger, K. R., & colleagues. Gaming-the-system line (help abuse as a primary gaming category; multiple EDM/AIED papers 2004–2013).  
- Roll, I., Aleven, V., McLaren, B. M., & Koedinger, K. R. (2011). Improving students’ help-seeking skills using metacognitive feedback in an intelligent tutoring system. *Learning and Instruction, 21*(2), 267–280. https://doi.org/10.1016/j.learninstruc.2010.07.004  
- Saye, J. W., & Brush, T. (2002). Scaffolding critical reasoning about history and social issues in multimedia-supported learning environments. *Educational Technology Research and Development, 50*(3), 77–96. (Hard vs soft *scaffolds* axis — distinct from ITS soft/hard hint specificity.)  
- Shih, B., Koedinger, K. R., & Scheines, R. (2008). A response time model for bottom-out hints as worked examples (EDM analyses; cited in Aleven et al., 2016).  
- van de Pol, J., Volman, M., & Beishuizen, J. (2010). Scaffolding in teacher–student interaction: A decade of research. *Educational Psychology Review, 22*, 271–296. https://doi.org/10.1007/s10648-010-9127-6  
- Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and Psychiatry, 17*(2), 89–100.  
- Wood, H., & Wood, D. (1999). Help seeking, learning and contingent tutoring. *Computers & Education, 33*(2–3), 153–169.  
