# Part XXXIII — AI Tutors: Trust, Calibration, and Sycophancy

**Chapter status:** Living evidence brief (Red-Teamed 2026-07-26)  
**Primary question:** When an AI tutor is fluent, how do we stop students from trusting the wrong thing — and still use AI for identity-forming struggle?  
**Owners:** AI Researcher · Learning Science · Product (Solver / coach) · Red Team  
**Last Red Team:** 2026-07-26 — killed “guards ⇒ learning gain” and Bastani-Tutor≡PWC category error (see XXXIII.7a)

---

## XXXIII.1 Why this chapter exists

MindCraft’s scarcity thesis says explanations get cheaper. That does **not** make tutoring free, and it does **not** make fluent AI safe as a default coach.

**FACT (field RCT, high-school math):** Bastani, Bastani, Sungu, Ge, Kabakcı & Mariman (2025, *PNAS*, doi:10.1073/pnas.2422633122) — nearly 1,000 students; GPT-4 access during practice raised concurrent performance (**~+48%** grades for a ChatGPT-like “GPT Base”; **~+127%** for a guarded “GPT Tutor”), but when AI was removed, **GPT Base students scored ~17% worse** than peers who never had AI. Unfettered generative help functioned as a **crutch**.

**FACT (same RCT — what “mitigated” actually means):** On the unassisted exam, the GPT Tutor arm’s negative effect was “essentially eradicated,” **yet the authors still do not observe a positive effect** vs no-AI control (Tutor ≈ control, not Tutor > control). Tutor’s prompt was also **not** “hints-only pedagogy”: it injected teacher-authored **correct solutions**, common mistakes, and feedback scripts — labor-intensive, problem-specific keys that suppress hallucination. That is a different product than an ontology-routed LLM that invents hints without per-item answer keys.

**Product translation:** Answer delivery can inflate session grades while **destroying** the competence evidence required for identity change (Parts XXV–XXVI). A Solver that dumps full solutions is anti-mission even if users love it. Matching Bastani’s Tutor is a **harm-floor** (don’t be worse than textbooks), not a **mission win** (identity-forming gain over control).

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

**FACT (math ITS classroom experiment — scoped):** Nagashima, Hladký & Rief (arXiv:2606.03822; ECTEL 2026 line) — 252 school students; a fallibility warning that the pedagogical agent *may make mistakes* increased hint-seeking even when system behavior was identical across arms and **contained no actual errors**. Agent was a **rule-based CTAT** tutor (fox “Maddox”), not an LLM. Result = interaction-strategy shift, **not** a demonstrated learning gain and **not** a hallucination-mitigation proof.

**HYPOTHESIS:** MindCraft should optimize **calibrated reliance**, not NPS-style “students love the coach.” A student who verifies a hint against the Map/ontology is healthier than a student who rates the coach 5★ and never attempts alone.

**Contradiction / limit:** Excessive uncertainty theater (“I might be wrong…” on every turn) can raise cognitive load, reduce engagement, or teach learned helplessness toward tools. Nagashima shows banners can *increase* help-seeking (possible crutch risk if hints are cheap). Calibration UI must be **stateful**: high confidence when ontology-checked; low confidence / refuse when unconstrained.

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

**HYPOTHESIS (narrowed after Red Team):** Bastani et al. is strong evidence that **unguarded chat can harm** and that **some wrap beats Base on the harm margin**. It is **not** proof that MindCraft’s Pedagogy Wrap Contract (ontology + mastery graph + deterministic checkers) works, nor that wrap beats no-AI control on identity metrics. Treat Bastani Tutor as a **category cousin** (prompt + teacher keys), not a validation of PWC.

**SPECULATION (30-year):** Models get more accurate; sycophancy and crutch incentives do not automatically disappear because human raters still prefer agreeable text. Pedagogy wrap remains a moat longer than raw model IQ — *if* wrap is measured against control and transfer, not against Base alone.

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
3. **Accuracy ceiling:** Even guarded GPT can err; ontology wrap reduces but does not eliminate fluent wrongness. Bastani Tutor cheated this ceiling with **per-problem teacher keys** — MindCraft cannot assume the same unless bank keys / checkers cover the item.  
4. **Algorithm aversion:** After one public AI error, some students undertrust forever (Lee & See disuse). Need repair UX: “caught my mistake → here’s the check.”  
5. **Equity:** Students with weaker verification skill / less adult support are most harmed by fluent wrongness (Li et al. L@S 2025 differential-impact signal; adult STEM learners, not HS Maya). “AI for all” without wrap can widen gaps.  
6. **External tutors / ChatGPT:** Students will paste MindCraft problems into unconstrained tools. Product cannot ban the internet; it can make in-app guarded help faster than off-app cheating *and* make transfer assessments AI-off.  
7. **Perception lag:** Bastani finds students often **do not perceive** that copying solutions hurt later performance — self-report “I learned” is an invalid success metric for Solver.

### XXXIII.7a Red Team disposition (2026-07-26)

| Claim under fire | Verdict | Why |
|------------------|---------|-----|
| “Guards ⇒ learning gain” / Tutor proves wrap improves learning | **KILLED** | Bastani: Tutor ≈ control on exam; “still do not observe a positive effect.” Harm neutralized ≠ skill gained. |
| Bastani GPT Tutor ≡ MindCraft PWC / ontology spine | **KILLED** (category error) | Tutor = GPT-4 + teacher solutions + mistake scripts in prompt. PWC = deterministic graph decides path; LLM speaks at bookends. Different mechanism, different cost structure. |
| “Solver default = GPT Tutor” as product slogan | **WOUNDED** | Keep as *anti-Base* naming only. Success bar is `solo_transfer_pass` ≥ no-AI / ≥ textbook control, not “less bad than ChatGPT.” |
| Fallibility banner → better learning | **WOUNDED** (already low) | Nagashima: more hints, rule-based agent, no real errors, no learning gain shown. Banner may *increase* crutch-seeking. |
| Unguarded GPT can harm solo performance | **SURVIVES** | Bastani Base −17% vs control — high confidence. |
| Sycophancy widespread in RLHF assistants | **SURVIVES** | Sharma et al. ICLR 2024 / arXiv:2310.13548. |
| Novices often miss chatbot factual errors | **SURVIVES** (scope note) | Li et al. L@S 2025 (doi:10.1145/3698205.3729550); adult open-ended STEM — transfer to anxious HS math is HYPOTHESIS. |
| PWC beats ChatGPT on identity metrics | **SURVIVES as HYPOTHESIS** | Needs AIT-1..5; confidence **Medium → Medium-Low** until transfer > control is shown. |

**Confidence summary (post–Red Team):**

| Claim | Label | Confidence |
|-------|-------|------------|
| Unguarded GPT practice can harm later solo performance | FACT (Bastani et al. 2025) | High |
| Guarded Tutor *improves* learning vs no-AI | FALSE / unsupported by Bastani | — **killed** |
| Sycophancy is widespread in RLHF assistants | FACT (Sharma et al.) | High |
| Novices miss chatbot factual errors often | FACT (Li et al. 2025); HS transfer = HYPOTHESIS | High (adults) / Medium (Maya) |
| MindCraft ontology wrap beats ChatGPT *and* control on identity metrics | HYPOTHESIS | Medium-Low (AIT-1 must beat control) |
| Fallibility UX alone fixes learning | SPECULATION / likely false | Low — behavior shifts ≠ mastery |

---

## XXXIII.8 Product implications (actionable)

1. **Solver default = anti-Base (guarded), with control-beating ambition** — hints, questions, ingredient cards; full worked solution only after attempt threshold or explicit reveal with logged cost. Do **not** market “like Bastani’s GPT Tutor” as proof of learning gains.  
2. **Instrument crutch risk:** `ai_reveal_rate`, `solo_transfer_pass`, `retry_120s` after AI-assisted item, `disagree_accept` (student revises after coach contradiction). Primary success = transfer vs **no-AI / weak-AI** baselines, not thumbs-up.  
3. **Anti-sycophancy eval suite** in CI: student-wrong / student-right / student-anxious prompts; fail build if model affirms wrong math.  
4. **Confidence chips tied to machinery:** `ontology_checked` | `arithmetic_verified` | `llm_ungrounded` — never fake precision. Prefer bank-key / checker paths when available (Bastani’s real accuracy lever was keys, not vibes).  
5. **Ban:** “Your AI tutor that always agrees with you”; “guards make AI raise scores”; streak-as-learning; Bloom 2-sigma marketing for the LLM.  
6. **Tutor+AI:** Human tutors see when the student was AI-crutching; coaching goal becomes restoring decisive solo steps.  
7. **Fallibility UX (AIT-3) must co-measure crutch:** if banners raise `ai_reveal_rate` without raising `solo_transfer_pass`, ship is a fail even if “transparency” feels responsible.

---

## XXXIII.9 Experiments

| ID | Question | Design | Primary metric | Falsifier |
|----|----------|--------|----------------|-----------|
| AIT-1 | Guarded Solver vs ChatGPT-like full answers | RCT, same content | `solo_transfer_pass` @ 1 week | Guarded ≤ Base on transfer |
| AIT-2 | Anti-sycophancy system prompt + refusal tests | Offline + online | wrong-affirmation rate | No reduction vs baseline |
| AIT-3 | Fallibility banner vs none | A/B | hint quality seeking + transfer | Banner harms transfer without reducing crutch |
| AIT-4 | Confidence chips (ontology_checked) vs fluent prose only | A/B | error detection on planted wrong hints | Chips ignored; detection unchanged |
| AIT-5 | Wizard coach (Experiment A) × AI guard level | Factorial | `retry_120s`, challenge_accept | Interaction null |

**Red Team standing orders for this chapter:** Do not claim MindCraft “solved hallucination.” Do not claim tutoring is free because GPT is cheap. Do not treat thumbs-up on coach messages as learning.

---

## XXXIII.10 One-sentence doctrine

**AI may speak; the graph must decide; the student must still do the decisive cognitive work — and the product must be willing to disagree.**
