# Part XXXIII — AI Tutors: Trust, Calibration, and Sycophancy

**Chapter status:** Living evidence brief  
**Primary question:** When an AI tutor is fluent, how do we stop students from trusting the wrong thing — and still use AI for identity-forming struggle?  
**Owners:** AI Researcher · Learning Science · Product (Solver / coach) · Red Team

---

## XXXIII.1 Why this chapter exists

MindCraft’s scarcity thesis says explanations get cheaper. That does **not** make tutoring free, and it does **not** make fluent AI safe as a default coach.

**FACT (field RCT, high-school math):** Bastani, Bastani, Sungu, Ge, Kabakcı & Mariman (2025, *PNAS*; doi:10.1073/pnas.2422633122) — nearly 1,000 students; GPT-4 access during practice raised concurrent performance (**~+48%** grades for a ChatGPT-like “GPT Base”; **~+127%** for a guarded “GPT Tutor”), but when AI was removed, **GPT Base students scored ~17% worse** than peers who never had AI. GPT Tutor’s negative exam effect was **largely mitigated** (exam ≈ no-AI control) — authors report they **still do not observe a positive learning effect** of Tutor vs control. Unfettered generative help functioned as a **crutch**.

**FACT (mechanism detail — often elided):** Bastani’s “GPT Tutor” is **not** an ontology graph. It is a chat interface whose system prompt includes **teacher-authored solutions, common mistakes, and hint scripts** for each practice item (labor-intensive; hired teachers). That is why it “rarely makes mistakes.” Hint-not-answer instructions alone are only half the arm.

**Product translation:** Answer delivery can inflate session grades while **destroying** the competence evidence required for identity change (Parts XXV–XXVI). A Solver that dumps full solutions is anti-mission even if users love it. **Do not** treat Bastani Tutor as proof that MindCraft’s wrap already works — see Red Team disposition (XXXIII.7a).

---

## XXXIII.2 Fluent wrongness

**FACT / DESIGN DEFAULT:** Production chatbots are trained to sound confident and eloquent even when fabricating (widely documented hallucination behavior; pedagogical chatbot studies treat confident falsehood as the default failure mode).

**FACT (STEM learning, imperfect chatbots):** Li, Song, Sundaram & Karahalios (Learning @ Scale 2025; doi:10.1145/3698205.3729550) — in an open-ended online STEM setting, **most participants failed to detect factual chatbot errors** even with reading materials and web search available (author/press summaries: ~15% successful error reporting). Undetected errors harmed **learning outcomes and self-efficacy**. Participants who *did* detect errors were not harmed on post-test — detection skill is load-bearing.

**External-validity wound:** Sample is largely **adult / college STEM** learners in a quasi-experimental online environment — not Maya-type high-school identity struggle under stereotype threat. Directional risk transfers; effect sizes and detection rates must be re-measured in MindCraft’s population (do not paste L@S % into pitch decks).

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

**FACT (math ITS classroom experiment — scope-limited):** Nagashima, Hladký & Rief (arXiv:2606.03822; ECTEL 2026) — 252 seventh-graders; warning that a fox pedagogical agent (“Maddox”) *may make mistakes* increased **hint requests** vs a careful-reading control message, with **no significant immediate performance change**. Critical caveat: hints/feedback were **CTAT rule-based / hard-coded — no LLM, no actual errors**. This is a transparency *placebo* on a reliable tutor, not evidence that fallibility UX fixes generative hallucination.

**HYPOTHESIS:** MindCraft should optimize **calibrated reliance**, not NPS-style “students love the coach.” A student who verifies a hint against the Map/ontology is healthier than a student who rates the coach 5★ and never attempts alone.

**Contradiction / limit:** Excessive uncertainty theater (“I might be wrong…” on every turn) can raise cognitive load, reduce engagement, or teach learned helplessness toward tools. Nagashima shows behavior shift without mastery gain; Li et al. show detection skill matters more than vibes. Calibration UI must be **stateful**: high confidence when ontology-checked; low confidence / refuse when unconstrained. AIT-3 must not treat banner copy as sufficient.

---

## XXXIII.5 Pedagogy wrap — the MindCraft spine vs chat wrapper

Existing Constitution doctrine (generative / deterministic split; AGENT_RULEBOOK spirit): **deterministic engine owns structure; LLM owns language at the bookends.**

**HYPOTHESIS — Pedagogy Wrap Contract (PWC):**

1. **Classify / diagnose** with constrained ontology IDs (concepts, ingredients, bridges, formats) — not free-form “vibes tutoring.”  
2. **Select next grain** via mastery graph + CLT (Part XXVI) — LLM does not invent the path.  
3. **Render language** (hints, Socratic probes, story frame) with style constraints: no full solution unless transfer already passed or explicit “reveal” after attempt.  
4. **Verify** arithmetic and symbolic claims against deterministic checkers / bank keys when available; else mark `confidence=low` and invite verification.  
5. **Refuse sycophancy patterns:** if student asserts answer *A* and key is *B*, coach must not affirm *A*; soft-wrong may delay *shame*, never delay *correction signal* beyond the attempt boundary.

**FOUNDER BELIEF:** ChatGPT-as-tutor is a competitor to copy for fluency and a failure mode to avoid for identity. Bastani et al. shows **wrap design is load-bearing** — but their wrap ≠ MindCraft’s (teacher keys in prompt vs graph-decides / LLM-speaks). Closest large-scale *existence proof* that design choices dominate model brand; **not** a validation of PWC.

**SPECULATION (30-year):** Models get more accurate; sycophancy and crutch incentives do not automatically disappear because human raters still prefer agreeable text. Pedagogy wrap remains a moat longer than raw model IQ.

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
3. **Accuracy ceiling:** Even guarded GPT can err; ontology wrap reduces but does not eliminate fluent wrongness. Bastani Tutor’s low error rate came from **keys in the prompt**, not vibes.  
4. **Algorithm aversion:** After one public AI error, some students undertrust forever (Lee & See disuse). Need repair UX: “caught my mistake → here’s the check.”  
5. **Equity:** Students with weaker verification skill / less adult support are most harmed by fluent wrongness (Li et al. differential impact signal). “AI for all” without wrap can widen gaps.  
6. **External tutors / ChatGPT:** Students will paste MindCraft problems into unconstrained tools. Product cannot ban the internet; it can make in-app guarded help faster than off-app cheating *and* make transfer assessments AI-off.  
7. **Perceived vs actual learning (Bastani):** GPT Base students did **not** perceive they learned less despite worse exams; GPT Tutor students **perceived** they learned more despite exam ≈ control. Self-report “AI helped me” is a **hostile** identity metric.

### XXXIII.7a Red Team disposition (2026-07-26)

| Target claim (as readable in v1 Researcher draft) | Verdict | Why |
|---------------------------------------------------|---------|-----|
| Bastani GPT Tutor ≈ MindCraft ontology / PWC | **KILLED** (category error) | Tutor = teacher solutions + mistake scripts **in the LLM prompt**; PWC = graph selects grain, LLM renders language, checkers verify. Different mechanism class. |
| Guardrails ⇒ learning *gain* vs no-AI | **KILLED** | Bastani: Tutor exam **≈ control**; harm neutralized, not outperformed. Success bar for Solver = beat no-AI / `solo_transfer_pass`, not “less bad than ChatGPT.” |
| Product slogan “Solver default = GPT Tutor” | **WOUNDED** → rename | Keep doctrine (hints, attempt gates); drop Bastani arm name as brand synonym. Use **guarded Solver**. |
| Li et al. rates apply unchanged to Maya HS | **WOUNDED** | Adult STEM online sample; transfer direction yes, paste percentages no. |
| Fallibility banner (Nagashima) calibrates generative trust | **WOUNDED** | CTAT hard-coded, zero LLM errors; more hints ≠ better learning. AIT-3 required. |
| Unguarded Base harms solo performance | **SURVIVES** | Bastani FACT, high confidence. |
| Sycophancy general in RLHF assistants | **SURVIVES** | Sharma et al. FACT; still not a math-specific RCT. |
| Default “AI always helps learning” | **KILLED** (prior Researcher tick) | Reaffirmed. |

**Standing order:** Never market “we’re Bastani’s GPT Tutor.” Cite Bastani for *crutch risk* and *design sensitivity*; cite AIT-1..5 for MindCraft claims.

**Confidence summary:**

| Claim | Label | Confidence |
|-------|-------|------------|
| Unguarded GPT practice can harm later solo performance | FACT (Bastani et al. 2025) | High |
| Bastani Tutor ≈ no-AI on unassisted exam (mitigation, not gain) | FACT | High |
| Sycophancy is widespread in RLHF assistants | FACT (Sharma et al.) | High |
| Novices miss chatbot factual errors often | FACT (Li et al. 2025) | High–Medium (adult STEM scope) |
| MindCraft ontology wrap beats ChatGPT on identity metrics | HYPOTHESIS | **Medium → Low–Medium** until AIT-1 |
| Bastani Tutor validates PWC | SPECULATION / false as stated | **Killed** |
| Fallibility UX alone fixes learning | SPECULATION / likely false | Low — behavior shifts ≠ mastery |

---

## XXXIII.8 Product implications (actionable)

1. **Solver default = guarded Solver, not ChatGPT-Base** — hints, questions, ingredient cards; full worked solution only after attempt threshold or explicit reveal with logged cost. Where bank keys exist, prefer **deterministic verify** over “hope the prompt remembered the answer” (Bastani’s labor model does not scale to MindCraft’s open practice set without checkers).  
2. **Instrument crutch risk:** `ai_reveal_rate`, `solo_transfer_pass`, `retry_120s` after AI-assisted item, `disagree_accept` (student revises after coach contradiction). **Do not** treat coach thumbs-up or “AI helped me” surveys as primary — Bastani perception mismatch.  
3. **Anti-sycophancy eval suite** in CI: student-wrong / student-right / student-anxious prompts; fail build if model affirms wrong math.  
4. **Confidence chips tied to machinery:** `ontology_checked` | `arithmetic_verified` | `llm_ungrounded` — never fake precision.  
5. **Ban:** “Your AI tutor that always agrees with you”; “we’re proven like Bastani’s GPT Tutor”; streak-as-learning; Bloom 2-sigma marketing for the LLM.  
6. **Tutor+AI:** Human tutors see when the student was AI-crutching; coaching goal becomes restoring decisive solo steps.  
7. **Success bar:** Guarded Solver must eventually **beat no-AI** on `solo_transfer_pass` / challenge-seeking — matching control is a floor against harm, not a product win.

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
