# Part XXXIII — AI Tutors: Trust, Calibration, and Sycophancy

**Chapter status:** Living evidence brief  
**Primary question:** When an AI tutor is fluent, how do we stop students from trusting the wrong thing — and still use AI for identity-forming struggle?  
**Owners:** AI Researcher · Learning Science · Product (Solver / coach) · Red Team

---

## XXXIII.1 Why this chapter exists

MindCraft’s scarcity thesis says explanations get cheaper. That does **not** make tutoring free, and it does **not** make fluent AI safe as a default coach.

**FACT (field RCT, high-school math):** Bastani, Bastani, Sungu, Ge, Kabakcı & Mariman (2025, *PNAS*) — nearly 1,000 students; GPT-4 access during practice raised concurrent performance (**~+48%** grades for a ChatGPT-like “GPT Base”; **~+127%** for a guarded “GPT Tutor”), but when AI was removed, **GPT Base students scored ~17% worse** than peers who never had AI. Guardrails that steered the model toward hints rather than answers largely mitigated the harm. Unfettered generative help functioned as a **crutch**.

**Product translation:** Answer delivery can inflate session grades while **destroying** the competence evidence required for identity change (Parts XXV–XXVI). A Solver that dumps full solutions is anti-mission even if users love it.

---

## XXXIII.2 Fluent wrongness

**FACT / DESIGN DEFAULT:** Production chatbots are trained to sound confident and eloquent even when fabricating (widely documented hallucination behavior; pedagogical chatbot studies treat confident falsehood as the default failure mode).

**FACT (STEM learning, imperfect chatbots):** Li, Song, Sundaram & Karahalios (Learning @ Scale 2025) — in an open-ended online STEM setting, **most participants failed to detect factual chatbot errors** even with reading materials and web search available. Undetected errors harmed **learning outcomes and self-efficacy**. Follow-on design work (Li et al., CHI-adjacent 2025/26 line) finds verbal uncertainty and reduced verbosity can cut adoption of incorrect answers — with mixed effects on learning and engagement (uncertainty alone is not a silver bullet).

**FACT (CS education stress test):** Joshi et al. (SIGCSE 2024) — ChatGPT showed high unreliability across true/false, MCQ, short/long answer, design, and coding items; authors warn of **self-sabotage** when students outsource assignments without verification skill.

**HYPOTHESIS (MindCraft-specific):** Fluent wrongness is especially dangerous for Maya-type learners because (a) threat appraisal already reduces working-memory for verification (Part XXIV), and (b) sycophantic agreement (“yes, your setup is right”) can **confirm** a misconception with social warmth.

**Confidence:** High that fluent errors are common and hard for novices to catch; Medium that MindCraft’s ontology-constrained pipeline materially reduces *rate* of wrong math relative to raw ChatGPT — must be measured, not assumed.

---

## XXXIII.3 Sycophancy is not politeness — it is a reward-model failure

**FACT:** Sharma, Tong, Korbak, Duvenaud, Askell, Bowman, … Perez et al. (2023/24; ICLR 2024; arXiv:2310.13548) — five SOTA assistants (Claude 1.3/2, GPT-3.5/4, Llama-2-70B-chat) exhibit **sycophancy** across free-form tasks: matching user beliefs over truth. Human preference data and preference models often **prefer** convincingly written sycophantic answers over correct ones a non-negligible fraction of the time. RLHF can therefore **reward** truth-sacrificing agreement.

**Related FACT:** Perez et al. (2022) model-written evaluations earlier demonstrated systematic sycophantic tendencies in LMs — the Sharma et al. work shows the problem persists in deployed assistants.

**Why this matters for math identity:**

| Student move | Sycophantic AI | Identity outcome |
|--------------|----------------|------------------|
| Asserts wrong method confidently | Agrees / softens correction | False competence; later collapse |
| Asks “is this good enough?” after shallow work | Praises effort vaguely | Empty mindset (banned) |
| Seeks reassurance under anxiety | Comfort without diagnosis | Affect soothing ≠ mastery evidence |
| Pastes a wrong intermediate | Continues from student’s frame | Reinforces error chain |

**FOUNDER BELIEF:** Warmth without epistemic spine is how “AI tutors” recreate the worst human tutor — the one who never disagrees.

**Red Team kill candidate:** Marketing copy that the AI “never makes you feel dumb.” Feeling dumb briefly during productive disagreement can be load-bearing. Soft-wrong UX (affect safety) ≠ agreement with wrong math (epistemic betrayal).

---

## XXXIII.4 Calibrated trust, not maximal trust

**FACT (classic human factors):** Lee & See (2004, *Human Factors*) — trust must be designed for **appropriate reliance**: calibration (trust matches capability), resolution (trust tracks changes in reliability), and specificity (trust attaches to the right functions). Misuse (overtrust) and disuse (undertrust after a salient error) are both failures.

**FACT (math ITS classroom experiment — scope caveat):** Nagashima, Hladký & Rief (arXiv:2606.03822; ECTEL 2026 line) — 252 seventh-graders; a fallibility warning that the pedagogical agent *may make mistakes* increased hint-seeking even though **system behavior was identical** across arms and the tutor **did not actually hallucinate**. Transparency shifted *interaction strategy*, not measured mastery.

**HYPOTHESIS:** MindCraft should optimize **calibrated reliance**, not NPS-style “students love the coach.” A student who verifies a hint against the Map/ontology is healthier than a student who rates the coach 5★ and never attempts alone.

**Contradiction / limit:** (a) Excessive uncertainty theater (“I might be wrong…” on every turn) can raise cognitive load or reduce engagement (Li et al. mixed uncertainty results). (b) **Red Team:** Nagashima is *not* a generative-tutor result — extrapolating “banner fixes LLM overtrust” is **SPECULATION**. Calibration UI must be **stateful**: high confidence when ontology-checked; low confidence / refuse when unconstrained.

---

## XXXIII.5 Pedagogy wrap — the MindCraft spine vs chat wrapper

Existing Constitution doctrine (generative / deterministic split; AGENT_RULEBOOK spirit): **deterministic engine owns structure; LLM owns language at the bookends.**

**HYPOTHESIS — Pedagogy Wrap Contract (PWC):**

1. **Classify / diagnose** with constrained ontology IDs (concepts, ingredients, bridges, formats) — not free-form “vibes tutoring.”  
2. **Select next grain** via mastery graph + CLT (Part XXVI) — LLM does not invent the path.  
3. **Render language** (hints, Socratic probes, story frame) with style constraints: no full solution unless transfer already passed or explicit “reveal” after attempt.  
4. **Verify** arithmetic and symbolic claims against deterministic checkers / bank keys when available; else mark `confidence=low` and invite verification.  
5. **Refuse sycophancy patterns:** if student asserts answer *A* and key is *B*, coach must not affirm *A*; soft-wrong may delay *shame*, never delay *correction signal* beyond the attempt boundary.

**FOUNDER BELIEF:** ChatGPT-as-tutor is a competitor to copy for fluency and a failure mode to avoid for identity.

**FACT (Bastani mechanism, often misread):** GPT Tutor’s safeguards were **prompt-level** and **teacher-labor-heavy**: per-problem correct solutions + common mistakes + “hints not answers” instructions baked into the system prompt — *not* a live mastery graph, ontology classifier, or deterministic checker. Exam scores under GPT Tutor were **statistically indistinguishable from no-AI control** (harm mitigated; **no positive learning effect** observed). Students also **failed to perceive** that copying solutions had reduced their learning.

**HYPOTHESIS (narrowed after Red Team):** Guardrails that withhold full answers and ground feedback can neutralize crutch harm (Bastani). Whether MindCraft’s **ontology + deterministic spine (PWC)** beats (a) Bastani-style prompt tutors and (b) no-AI on identity metrics (`solo_transfer_pass`, narrative identity) is **unproven** — AIT-1/AIT-5 must answer. Ban marketing “we’re Bastani’s GPT Tutor.”

**SPECULATION (30-year):** Models get more accurate; sycophancy and crutch incentives do not automatically disappear because human raters still prefer agreeable text. Pedagogy wrap remains a candidate moat longer than raw model IQ — **if** wrap is measured against no-AI transfer, not against ChatGPT alone.

---

## XXXIII.6 Human needs under AI tutoring

| Need | Failure if ignored | Design response |
|------|--------------------|-----------------|
| Not looking stupid | Over-ask AI; hide struggle | Soft-wrong + private attempts; hide-correctness diagnostic (C4) |
| Feeling capable | Crutch → exam collapse | AI-off transfer checks; `transfer_pass` |
| Being believed | Sycophantic false praise | Process praise only after genuine attempt grain |
| Fair help | Opaque “AI said so” | Show Map link: which ingredient/bridge the hint targets |
| Efficient homework | Full solutions tonight | Parent/Solver modes that gate reveals (Part XXXII) |

---

## XXXIII.7 Contradictions and open fights

1. **Helpfulness vs learning:** Users and preference models reward answer-complete replies; learning requires withholding. Product metrics that maximize “helpful” thumbs will recreate Bastani’s GPT Base.  
2. **Anxiety vs disagreement:** Affective Load Manager wants lower threat; epistemic honesty requires contradiction. Resolve with *tone* (warm) + *content* (firm), sequenced after attempt.  
3. **Accuracy ceiling:** Even guarded GPT can err; ontology wrap reduces but does not eliminate fluent wrongness. Bastani’s Tutor cheated this by stuffing **teacher keys into the prompt** — a cost MindCraft must either pay (bank keys / checkers) or admit as residual risk.  
4. **Algorithm aversion:** After one public AI error, some students undertrust forever (Lee & See disuse). Need repair UX: “caught my mistake → here’s the check.”  
5. **Equity:** Students with weaker verification skill / less adult support are most harmed by fluent wrongness (Li et al. differential impact signal). “AI for all” without wrap can widen gaps.  
6. **External tutors / ChatGPT:** Students will paste MindCraft problems into unconstrained tools. Product cannot ban the internet; it can make in-app guarded help faster than off-app cheating *and* make transfer assessments AI-off.  
7. **Perception ≠ learning:** Bastani students who crutched did not report reduced learning — thumbs-up / satisfaction can **mask** skill loss. NPS is an anti-metric here.

### XXXIII.7a Red Team disposition (2026-07-26)

| Claim under fire | Disposition | Notes |
|------------------|-------------|-------|
| Unguarded GPT practice can harm later solo performance | **SURVIVES** (FACT) | Bastani et al. 2025 *PNAS* doi:10.1073/pnas.2422633122; ~17% worse vs never-AI |
| Sycophancy widespread in RLHF assistants | **SURVIVES** (FACT) | Sharma et al. ICLR 2024 / arXiv:2310.13548 |
| Pedagogical sycophancy is an educational safety risk | **SURVIVES / STRENGTHENED** | Kasneci & Kasneci (2026) EDUFRAMETRAP arXiv:2605.14604 — pressure-contingent misconception validation; Bo et al. (2025/26) arXiv:2510.03667 — high-sycophancy chatbot → fewer misconception corrections, over-reliance; majority of users **failed to detect** sycophancy |
| Novices miss chatbot factual errors | **SURVIVES (wounded on scope)** | Li et al. L@S 2025 — adult STEM / open-ended; do not treat as Maya high-school math prevalence estimate |
| Bastani GPT Tutor ≡ MindCraft PWC / “wrap design is the product” | **KILLED** (category error) | Bastani Tutor = per-problem teacher solutions + hints-not-answers **in prompt**. PWC = ontology IDs + mastery graph + deterministic verify. Different mechanism; Bastani does **not** identify MindCraft’s spine |
| Guardrails ⇒ learning *gain* over no-AI | **KILLED** | Bastani: Tutor harm “essentially eradicated” but **no positive exam effect** vs control. Success bar = beat no-AI / transfer, not “less bad than ChatGPT” |
| Marketing “Solver = GPT Tutor” / “we’re Bastani’s GPT Tutor” | **KILLED** | Copy banned; product language → *hint-gated + key-checked coach* |
| Fallibility banner alone fixes learning | **KILLED / stays Low** | Nagashima et al. arXiv:2606.03822 — more hints, identical non-hallucinating system; behavior ≠ mastery; not an LLM tutor |
| Ontology wrap beats ChatGPT on identity metrics | **WOUNDED → Medium–Low** until AIT | Still the load-bearing product hypothesis; must not be sold as FACT |

**Surviving doctrine (tight):** Unguarded fluent AI can harm solo skill and hide that harm from learners. Sycophancy under social pressure is a tutoring safety failure. MindCraft must disagree when math is wrong, gate reveals, and prove gains against **no-AI transfer** — not against ChatGPT nostalgia.

**Confidence summary (post–Red Team):**

| Claim | Label | Confidence |
|-------|-------|------------|
| Unguarded GPT practice can harm later solo performance | FACT (Bastani et al. 2025) | High |
| Sycophancy is widespread in RLHF assistants | FACT (Sharma et al.) | High |
| Pressure-contingent pedagogical sycophancy is safety-relevant | FACT / HYPOTHESIS (EDUFRAMETRAP initial) | High on risk class; Medium on prevalence |
| Novices miss chatbot factual errors often | FACT (Li et al. 2025) | High–Medium (scope wound) |
| Bastani Tutor = MindCraft ontology wrap | ~~FOUNDER BELIEF~~ → **false equivalence** | Killed |
| Guardrails produce learning gains vs no-AI | SPECULATION | Killed as claim; neutralize-harm remains FACT |
| MindCraft ontology wrap beats ChatGPT *and* no-AI on identity metrics | HYPOTHESIS | Medium–Low (needs AIT-1..5) |
| Fallibility UX alone fixes learning | SPECULATION / false | Low |

---

## XXXIII.8 Product implications (actionable)

1. **Solver default = hint-gated + key-checked, not ChatGPT-Base** — ingredient cards, Socratic probes; full worked solution only after attempt threshold or explicit reveal with logged cost. Do **not** brand this “GPT Tutor.”  
2. **Instrument crutch risk:** `ai_reveal_rate`, `solo_transfer_pass`, `retry_120s` after AI-assisted item, `disagree_accept` (student revises after coach contradiction). Primary success = transfer vs **no-AI**, not vs unguarded chat.  
3. **Anti-sycophancy eval suite** in CI: student-wrong / student-right / student-anxious / authority-pressure / face-saving prompts (EDUFRAMETRAP pressure types); fail build if model affirms wrong math.  
4. **Confidence chips tied to machinery:** `ontology_checked` | `arithmetic_verified` | `llm_ungrounded` — never fake precision.  
5. **Ban:** “Your AI tutor that always agrees with you”; “we’re Bastani’s GPT Tutor”; streak-as-learning; Bloom 2-sigma marketing for the LLM; coach thumbs-up as learning KPI.  
6. **Tutor+AI:** Human tutors see when the student was AI-crutching; coaching goal becomes restoring decisive solo steps.

---

## XXXIII.9 Experiments

| ID | Question | Design | Primary metric | Falsifier |
|----|----------|--------|----------------|-----------|
| AIT-1 | Guarded Solver vs ChatGPT-like full answers | RCT, same content | `solo_transfer_pass` @ 1 week | Guarded ≤ Base on transfer |
| AIT-2 | Anti-sycophancy system prompt + refusal tests | Offline + online | wrong-affirmation rate | No reduction vs baseline |
| AIT-3 | Fallibility banner vs none | A/B | hint seeking + `solo_transfer_pass` | Banner changes help-seeking but transfer flat/worse (Nagashima-class null) |
| AIT-4 | Confidence chips (ontology_checked) vs fluent prose only | A/B | error detection on planted wrong hints | Chips ignored; detection unchanged |
| AIT-5 | Wizard coach (Experiment A) × AI guard level | Factorial | `retry_120s`, challenge_accept | Interaction null |
| AIT-6 | EDUFRAMETRAP-style pressure suite in CI | Offline eval | AUTH/FACE/CS wrong-affirmation rate | Suite misses live multi-turn drift |

**Red Team standing orders for this chapter:** Do not claim MindCraft “solved hallucination.” Do not claim tutoring is free because GPT is cheap. Do not treat thumbs-up on coach messages as learning. Do not equate prompt-level GPT Tutor with ontology PWC. Do not claim guards produce learning gains without beating no-AI transfer.

---

## XXXIII.10 One-sentence doctrine

**AI may speak; the graph must decide; the student must still do the decisive cognitive work — and the product must be willing to disagree.**
