# Part LXXXIV — Tutor Talk-Ratio Instrumentation

**Chapter status:** Living evidence + HITL telemetry brief — Researcher tick 2026-08-05  
**Primary question:** How should MindCraft instrument *who talks, who constructs, and who waits* in human (and AI-assisted) tutoring so prompt>pour becomes measurable ops fidelity — without turning silence into a vanity North Star?  
**Owners:** Tutor ops / HITL QA · Product (session telemetry) · Workforce coaching · Brand/copy · Red Team  
**Commercial job:** Ship a **SAFE-TALK** doctrine: treat talk-ratio as a *fidelity signal for student construction* (scaffolding density, wait time, student why-before-pour), never as a Talk Ratio Score™, equal-time dogma, or “our tutors are quiet” marketing costume.

**Builds on:** Parts XL (SAFE-SE), LI (SAFE-DP), LIV (SAFE-AAR), LXVIII (SAFE-HITL), LXXI (SAFE-TUTORGRAIN), LXXV (SAFE-WORKFORCE), LXXIX (SAFE-FBTIME). Product seam: HITL QA telemetry that makes “prompt>pour” auditable without surveilling affect.

---

## LXXXIV.1 Why this chapter exists

SAFE-HITL already requires talk ratio favoring student construction over tutor monologue — but the ops stack still lacks a *shippable instrumentation contract*. Without one, coaches grade vibes (“warm energy”), tutors lecture to fill silence anxiety, and marketing invents “Socratic AI” claims nobody can audit. Workforce fidelity (SAFE-WORKFORCE) also needs observable session features beyond tenure and star ratings.

**FOUNDER BELIEF under audit:** Parents and districts will trust MindCraft’s human loop more when we can show *prompt density + student constructive talk + wait discipline* correlating with solo transfer — not when we advertise “50/50 talk balance” or tutor silence as virtue.

**Claims we refuse as doctrine:**
1. Raw tutor-talk-% or student-talk-% as North Star / Talk Ratio Score™.  
2. Equal 50/50 airtime as pedagogical law (context and ICAP mode matter).  
3. Silence theater (long pauses with no elicitation) as “Socratic.”  
4. AI monologue length dressed as “dialogue” via fake student-token counts.  
5. “Got it?” check-understanding as student talk (Graesser frame step 5 ≠ construction).  
6. Warmth / energy / Ivy brand as substitutes for talk instrumentation (SAFE-HITL / GRAIN kills).  
7. Affect/voice emotion AI layered on talk metrics (SAFE-PRIVACY).  
8. Bloom 2-sigma marketing from “more student talk.”

---

## LXXXIV.2 Constructs

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **IRF / IRE** | Teacher Initiation–Response–Feedback/Evaluation triad | Default pour loop if F = lecture | Closed IRF forever |
| **5-step tutoring frame** | Tutor Q → answer → short FB → collaborative improve → check | Session skeleton | Skip improve; pour explain |
| **Wait time 1 / 2** | Pause after ask / after student turn (~3s+) | Coachable micro-behavior | Sub-1s snatch-back |
| **ICAP mode** | Passive < Active < Constructive < Interactive | Student why / soft-wrong / join | Words ≠ constructive |
| **Prompt>pour** | Scaffold/elicit before explanation dump | HITL playbook law | Explain-first brand |
| **SAFE-TALK** | Instrumentation doctrine for construction fidelity | This chapter | Ratio vanity / silence cosplay |

**Operational definition (HYPOTHESIS):** A session is *talk-instrumented* when MindCraft can report, per session sample: (a) tutor vs student floor time and turn counts, (b) **prompt density** (eliciting moves / tutor turns), (c) **student constructive share** (why/self-explain/soft-wrong articulations — not yes/no or “got it”), (d) median wait time 1 and 2, (e) Map-brief opened before first explain (`map_brief_open`), and (f) at least one solo attempt evidence after scaffolding — *without* claiming any single ratio proves mastery.

---

## LXXXIV.3 Classroom IRF shows why “teacher talks most” is the default failure

**FACT (IRF as classroom grammar):** Sinclair & Coulthard (1975) described the Initiation–Response–Feedback exchange as a fundamental unit of classroom discourse — teacher-led, often evaluative, structurally favoring adult control of the floor.

**FACT (talk imbalance persists in IRF-heavy rooms):** Contemporary discourse analyses continue to find teacher-dominated floor time under IRF (often ~60%+ teacher share in coded secondary lessons) — illustrative of the pattern, not a universal constant.

**Commercial implication:** If MindCraft tutors recreate classroom IRF with longer lectures, the “human advantage” collapses into expensive school-talk. Instrument *pour-IRF* (short student token → explanation dump) vs *scaffold-IRF* (extended student construction → brief feedback → next prompt).

**Kill:** Marketing “conversation-based tutoring” without measuring construction.  
**Survive:** IRF as descriptive grammar; redesign the Feedback move toward elicit-and-verify.

---

## LXXXIV.4 One-to-one tutoring is collaborative — but tutors still drive the frame

**FACT (naturalistic tutoring dialogue):** Graesser, Person & Magliano (1995, *Applied Cognitive Psychology*, 9(6), 495–522, doi:10.1002/acp.2350090604) — normal (unskilled) tutors show collaborative multi-turn problem solving; a pervasive **5-step frame**: tutor asks → student answers → short feedback → collaborative improvement of the answer → tutor checks understanding. Median turns per tutor-initiated question were far above one (multi-turn collaborative answers). Deep diagnosis of idiosyncratic knowledge deficits was often underdeveloped.

**FACT (questioning density vs classroom):** Graesser & Person (1994, *American Educational Research Journal*, 31(1), 104–137, doi:10.3102/00028312031001104) — students ask far more questions in tutoring than in classrooms (order-of-magnitude higher rates in their corpora), yet tutors still control agenda via curriculum scripts and dialogue frames.

**HYPOTHESIS (MindCraft mapping):** Success is not “maximize student words.” It is *keep the collaborative improve step alive* (step 4) and refuse to skip from short feedback into monologue. Check-understanding (“got it?”) is the weakest step for identity/FEI — prefer answer evidence / soft-wrong / Map probe (SAFE-HITL).

**Kill:** “Got it?” as mastery talk.  
**Wound:** Counting all student tokens equally (procedural yes ≈ constructive why).  
**Survive:** Multi-turn collaborative improvement as the auditable unit.

---

## LXXXIV.5 Construction beats tutor explanation volume — Chi’s interaction test

**FACT (prompt-constrained tutoring):** Chi, Siler, Jeong, Yamauchi & Hausmann (2001, *Cognitive Science*, 25(4), 471–533, doi:10.1207/s15516709cog2504_1) — analyses of human tutoring support tutor-, student-, and interaction-centered contributions; critically, when tutors were **suppressed from giving explanations and feedback** and restricted to prompting, students learned **as effectively** as in freer tutoring, attributed to deeper/more scaffolding episodes and greater student control (with reading-ability limits on what self-study recovered).

**FACT (ICAP hierarchy):** Chi & Wylie (2014, *Educational Psychologist*, 49(4), 219–243, doi:10.1080/00461520.2014.965823) — engagement modes Passive < Active < Constructive < Interactive predict increasing learning; overt behaviors must map to knowledge-change processes — “active” clicking/speaking is not automatically constructive.

**Commercial implication:** SAFE-HITL’s prompt>pour is not a vibe — it is Chi-compatible. **Instrument prompts that elicit construction**, not tutor silence. An AI that “talks less” while leaving the student passive fails ICAP; a near-peer who prompts why-before-reveal can win without Ivy monologue (SAFE-TUTORGRAIN).

**Kill:** Tutor-talk-% minimization as the product KPI.  
**Survive:** Prompt density × constructive student share as fidelity features feeding `tutor_fidelity_*`.

---

## LXXXIV.6 Wait time is cheap, coachable, and repeatedly evidenced

**FACT (baseline snatch-back):** Rowe (1974, *Journal of Research in Science Teaching*, 11(2), 81–94, doi:10.1002/tea.3660110202; see also Rowe 1986, *Journal of Teacher Education*, 37(1), 43–50, doi:10.1177/002248718603700110) — teachers typically wait **<1 second** after questions and after student responses; extending wait time 1 and wait time 2 toward ~3+ seconds associates with longer, more complex, more speculative student responses and broader participation.

**FACT (review):** Tobin (1987, *Review of Educational Research*, 57(1), 69–95, doi:10.3102/00346543057001069) — synthesizing classroom wait-time studies, longer pauses support higher-quality discourse when implemented with accountable responding norms (not isolated stopwatch theater).

**HYPOTHESIS:** Median WT1/WT2 on sampled sessions is a **coachable leading indicator** of pour-vs-prompt culture — especially for anxious Mayas who need think-space before soft-wrong (ties SAFE-DD / SAFE-EXPOSE / SAFE-FBTIME).

**Kill:** Stopwatch cosplay without elicitation quality.  
**Survive:** Banded wait targets (e.g., WT1/WT2 medians ≥3s on open prompts) inside FEI QA rubrics.

---

## LXXXIV.7 Dialogic teaching ≠ talk-count theater

**FACT (large dialogic-teaching trial):** Alexander (2018, *Research Papers in Education*; see also Alexander’s dialogic-teaching programme documentation) — developing dialogic teaching is a multi-principle pedagogy (collective, reciprocal, supportive, cumulative, purposeful), not a single talk-ratio knob. Implementation requires repertoire and epistemology, not merely “more student talk.”

**Wound for MindCraft:** Importing “dialogic” as brand language without Map-grounded cumulation (SAFE-ONTOLOGY / SAFE-BRIDGE) recreates supportive chat that never remediates joins.

**SPECULATION:** Online one-to-one math corpora will keep finding tutor-dominant initiation with sparse conceptual talk unless products force scaffold ladders — Map brief + soft-wrong gates should move sequences more than a talk-% dashboard alone.

---

## LXXXIV.8 Product surface — SAFE-TALK instrumentation stack

**Reuse:** SAFE-HITL (prompt>pour; Map brief; FEI QA); SAFE-WORKFORCE (fidelity@tenure); SAFE-SE (student-generated why); SAFE-FBTIME (micro-delay before reveal); SAFE-AAR (improve-how close); SAFE-PRIVACY (no emotion AI on voice); SAFE-GRAIN (hire by fidelity not Ivy pour).

**HYPOTHESIS — minimum honest session telemetry (sampled + consented):**

| Signal | Definition | Use | Must not |
|--------|------------|-----|----------|
| `tutor_floor_share` | Tutor speaking time / (tutor+student) | Drift monitor | Sole NS |
| `student_constructive_share` | Why/SE/soft-wrong turns / student turns | Primary fidelity | Count “yeah/got it” |
| `prompt_density` | Eliciting prompts / tutor turns | Coach target | Reward vague “what do you think?” spam |
| `wait_ms_p50` | Median WT1 and WT2 | Coach micro-skill | Shame tutors live mid-session |
| `pour_streak_max` | Longest consecutive tutor explain turns | Detect monologue | Ban all explanation |
| `map_brief_open` | Brief before first explain | HITL hard gate | Trait-label briefs |
| `annotate_before_reveal` | Why before key/coach | SE×FBTIME | AI monologue first |

**Ops rule (FOUNDER BELIEF):** Coaches review **clips where pour_streak_max is high and constructive share is low**, not leaderboards of who talked least. Parent/district packets may show *aggregate fidelity bands* (“sessions coached for prompt-first practice”) — never per-child Talk Ratio Score™.

**AI sessions:** Apply the same schema to Solver/coach turns — fluent AI floor share with low student constructive share is a **sycophancy/pour risk** (Part XXXIII), not “personalized dialogue.”

---

## LXXXIV.9 Competitive positioning

| Pattern | Talk move | MindCraft response |
|---------|-----------|-------------------|
| Classroom / Zoom school help | IRF pour | Instrument scaffold improve-step |
| ChatGPT tutor | Fluent monologue | Ban fluency≡dialogue; require student why gates |
| Marketplace “Ivy explainers” | Expert pour as quality | Hire/coach on prompt density (GRAIN×HITL) |
| Duo / app streaks | Engagement without discourse | Irrelevant; don’t import streak as talk proxy |
| “Socratic AI” ads | Brand claim | Show prompt density + constructive share or stay quiet |

**Competitive wedge (FOUNDER BELIEF):** “We coach tutors (and AI) to make students construct — and we can show the tape metrics” beats explain-first marketplaces and unmeasured Socratic cosplay.

---

## LXXXIV.10 Doctrine — SAFE-TALK (provisional)

1. **Construction > airtime** — student constructive share and prompt density outrank raw talk-%.  
2. **Prompt>pour is measurable** — elicit before explain; cap pour streaks in QA.  
3. **Wait time is a micro-skill** — band WT1/WT2; coach snatch-back.  
4. **“Got it?” ≠ evidence** — prefer soft-wrong, annotated why, Map probe.  
5. **No Talk Ratio Score™ / silence NS** — fidelity feature for coaching, not vanity KPI.  
6. **No emotion AI on talk** — acoustic floor time ok; affect inference banned (SAFE-PRIVACY).  
7. **Same schema for human and AI** — fluent pour fails either channel.  
8. **Copy:** “Prompt first — then prove.” Never “our tutors talk half the time” / Bloom-from-talk / “Socratic guaranteed.”

**Confidence:** High that IRF defaults to teacher control (Sinclair–Coulthard) and that naturalistic tutoring uses multi-turn collaborative frames under tutor agenda control (Graesser et al. 1995; Graesser & Person 1994). High that student construction can carry learning when tutor explanation is constrained (Chi et al. 2001) and that ICAP ranks engagement modes (Chi & Wylie 2014). High that wait-time extension changes discourse quality (Rowe; Tobin). Medium that MindCraft’s telemetry bundle predicts solo transfer (needs TALK-*). High that talk-% NS / silence theater / got-it checks are kills. Medium that dialogic-brand copy without Map cumulation underperforms (Alexander).

---

## LXXXIV.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| TALK-1 | Prompt-first playbook + wait coaching vs explain-first business-as-usual | Tutor RCT / stepped-wedge | `student_constructive_share`; `solo_transfer_pass`; `pour_streak_max` |
| TALK-2 | Live talk dashboard for coaches vs weekly clip QA only | Ops A/B | `tutor_fidelity_30d`; coach time; tutor reactance |
| TALK-3 | Soft-wrong + annotate-before-reveal gate vs free talk | Session A/B | SE quality; transfer; time-on-task |
| TALK-4 | AI coach with prompt-density cap vs unconstrained monologue | Product A/B | Constructive share; hallucination repair need; abandon |
| TALK-5 | Parent CBC: “coached prompt-first tutors” vs “Ivy explainers” vs “Socratic AI” | CBC | WTP; trust (ties SAFE-WTP / GRAIN) |
| TALK-QUAL | 10 tutors: what makes silence feel unsafe? | Qual | Snatch-back drivers; playbook friction |

**Falsifier:** Raising constructive share / wait time without transfer lift → keep as process hygiene; do not market talk metrics as learning proof; retarget prompts to Map gaps.  
**Falsifier:** Talk dashboards increase tutor reactance / fake short student turns → remove live shame UI; keep sampled clip QA.  
**Falsifier:** AI prompt-caps raise abandon without transfer gain → soften cap; keep why-before-reveal on soft-wrong paths only.

**Pre-register:** TALK-* before any “Socratic / talk-balanced tutoring” campaign (SAFE-LABMETA).

---

## LXXXIV.12 So what for MindCraft commercially

- **Copy:** “Prompt first — then prove.” Never Talk Ratio Score™, 50/50 dogma, silence theater, or Bloom-from-talk.  
- **Product:** Sampled session telemetry — constructive share, prompt density, wait bands, pour-streak — wired into HITL QA and workforce fidelity.  
- **Positioning:** Against Ivy pour marketplaces and unmeasured Socratic AI; for auditable construction.  
- **Metric:** `student_constructive_share`, `prompt_density`, `wait_ms_p50`, `pour_streak_max` feeding `tutor_fidelity_*`; demote raw talk-% and energy ratings.  
- **Kill list:** Talk-% NS; got-it≡mastery; emotion-AI talk scoring; AI monologue-as-dialogue ads.  
- **Growth:** District/parent trust packets can cite coaching-for-construction without biometric theater (SAFE-PROCURE × SAFE-HITL).  
- **Vision:** Identity transformation requires the student to *speak the math into being* — instrumentation exists to protect that, not to gamify silence.

---

## References (verified)

- Alexander, R. J. (2018). Developing dialogic teaching: Genesis, process, trial. *Research Papers in Education*. https://doi.org/10.1080/02671522.2018.1481140  
- Chi, M. T. H., Siler, S. A., Jeong, H., Yamauchi, T., & Hausmann, R. G. (2001). Learning from human tutoring. *Cognitive Science*, 25(4), 471–533. https://doi.org/10.1016/S0364-0213(01)00044-1  
- Chi, M. T. H., & Wylie, R. (2014). The ICAP framework: Linking cognitive engagement to active learning outcomes. *Educational Psychologist*, 49(4), 219–243. https://doi.org/10.1080/00461520.2014.965823  
- Graesser, A. C., & Person, N. K. (1994). Question asking during tutoring. *American Educational Research Journal*, 31(1), 104–137. https://doi.org/10.3102/00028312031001104  
- Graesser, A. C., Person, N. K., & Magliano, J. P. (1995). Collaborative dialogue patterns in naturalistic one-to-one tutoring. *Applied Cognitive Psychology*, 9(6), 495–522. https://doi.org/10.1002/acp.2350090604  
- Rowe, M. B. (1974). Wait-time and rewards as instructional variables, their influence on language, logic, and fate control: Part one—Wait-time. *Journal of Research in Science Teaching*, 11(2), 81–94. https://doi.org/10.1002/tea.3660110202  
- Rowe, M. B. (1986). Wait time: Slowing down may be a way of speeding up! *Journal of Teacher Education*, 37(1), 43–50. https://doi.org/10.1177/002248718603700110  
- Sinclair, J. McH., & Coulthard, R. M. (1975). *Towards an analysis of discourse: The English used by teachers and pupils*. Oxford University Press.  
- Tobin, K. (1987). The role of wait time in higher cognitive level learning. *Review of Educational Research*, 57(1), 69–95. https://doi.org/10.3102/00346543057001069  
