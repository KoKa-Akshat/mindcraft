# Part LX — Trust After AI Hallucination

**Chapter status:** Living evidence + repair-protocol brief — Researcher tick 2026-08-01  
**Primary question:** After MindCraft’s AI is *caught* being fluently wrong (or quietly wrong and later exposed), how do we repair *calibrated* trust — and when must we escalate to a human — without apology theater, never-wrong marketing, or post-error abandonment?  
**Owners:** AI / Product (Solver · coach) · Learning Science · Human Factors · Parent trust · Red Team  
**Commercial job:** Ship a **SAFE-REPAIR** doctrine that turns inevitable model errors into a *positioning asset* (honest plateau + human accountability) rather than a churn event or a “AI that never fails” lie.

---

## LX.1 Why this chapter exists

Part XXXIII owned *prevention and calibration*: pedagogy wrap, anti-sycophancy, Bastani unguarded-harm FACT, Lee & See appropriate reliance. Part L (SAFE-CALIB) owned *student* confidence after misses. What the Constitution still lacked is the **post-violation playbook**: what the product does in the *minutes after* a hallucination is detected — by checker, by student flag, by tutor review, or by exam-collapse discovery.

**FOUNDER BELIEF under audit:** Families and students will tolerate imperfect AI *if* the system (a) admits competence failure fast, (b) shows a concrete repair path tied to the Map/ontology, and (c) escalates to a human when stakes or repeated failure demand it — and will *punish* products that either hide errors or drown users in soft apologies without correction.

**Claims we refuse as doctrine:**
1. “Our AI doesn’t hallucinate” as marketing (false category; Bastani notes GPT Base hallucinations as mechanism risk).  
2. Rote “Sorry!” as trust repair.  
3. Empathy-only recovery that never corrects the math.  
4. Permanent undertrust (“never trust the coach”) as the safety story.  
5. Unlimited human escalation as the default UX (destroys unit economics and tutors).  
6. Student thumbs-up / “was this helpful?” as proof the repair worked.

---

## LX.2 Constructs (product language)

| Construct | Research meaning | MindCraft analogue | Failure mode if misused |
|-----------|------------------|--------------------|-------------------------|
| **Hallucination / fluent wrongness** | Confident false content | Wrong hint, invented step, affirming wrong setup | Treat only wild fabrications; ignore soft arithmetic slips |
| **Trust violation** | Event that breaks reliance calibration | Caught wrong coach move; silent wrong→exam miss | Every minor UI glitch as “trust crisis” |
| **Competence vs integrity failure** | Ability miss vs values/honesty miss (Kim et al.) | Bad algebra vs hiding known wrongness | Apologize for everything the same way |
| **Trust repair** | Actions that restore *appropriate* reliance | Admit → correct → verify → optional escalate | Maximize liking, not calibration |
| **Misuse / disuse** | Over-reliance / under-reliance (Parasuraman & Riley) | Copying Solver; abandoning coach after one miss | Chase either extreme as “engagement” |
| **Escalation** | Hand-off to human when AI insufficient | Tutor queue / session brief with error packet | Escalate everything or nothing |
| **SAFE-REPAIR** | Surviving post-error doctrine | See LX.10 | Apology cosplay; never-wrong brand |

**Operational definition (HYPOTHESIS):** A MindCraft post-error flow counts as *SAFE-REPAIR* when (a) the system **detects or accepts** the error signal, (b) labels it as a **competence** miss (not student shame), (c) issues an **explanatory** repair with a **deterministic correction path** (bank key / checker / Map ingredient), (d) invites a **solo re-attempt** before full solution dump, (e) offers **escalation** only under explicit triggers, and (f) measures repair by **re-engagement + verified next attempt**, not apology NPS.

---

## LX.3 Prior art already in the Constitution (do not re-litigate)

**FACT (high-school math field RCT):** Bastani, Bastani, Sungu, Ge, Kabakcı & Mariman (2025, *PNAS*, doi:10.1073/pnas.2422633122) — unguarded GPT access inflated practice then **harmed** solo exam (~−17% vs never-AI); guarded “GPT Tutor” largely neutralized harm but did **not** show positive learning vs control; Base hallucinations and crutch copying are named mechanisms. Perception ≠ learning.

**FACT (novice verification failure):** Li, Song, Sundaram & Karahalios (L@S 2025, doi:10.1145/3698205.3729550) — most learners failed to detect chatbot factual errors; undetected errors harmed outcomes and self-efficacy.

**FACT (appropriate reliance):** Lee & See (2004, *Human Factors*, doi:10.1518/hfes.46.1.50_30392) — design for calibration, resolution, specificity; misuse and disuse are both failures.

**FACT (use/misuse/disuse):** Parasuraman & Riley (1997, *Human Factors*) — operators over-rely, under-rely, or abuse automation; trust is a primary mediator.

**FACT (trust layers):** Hoff & Bashir (2015, *Human Factors*, doi:10.1177/0018720814547570) — dispositional, situational, and learned trust; post-error recovery is largely a **learned-trust** problem.

**Product implication:** Prevention (PWC / ontology / checkers) remains primary. This chapter owns what happens when prevention fails in the wild — which it will.

---

## LX.4 Trust repair is a designed capability, not a tone setting

**FACT (HMI agenda):** de Visser, Pak & Shaw (2018, *Ergonomics*, doi:10.1080/00140139.2018.1457701; “From ‘automation’ to ‘autonomy’”) — as systems become more autonomous, **trust repair** after violations becomes a first-class design requirement; competence vs integrity framing and context/risk matter; human–human repair findings transfer only partially.

**FACT (human–human baseline):** Kim, Ferrin, Cooper & Dirks (2004, *Journal of Applied Psychology*, doi:10.1037/0021-9010.89.1.104) — apology repairs **competence** violations better than denial; for **integrity** violations, denial of culpability can outperform apology (when evidence supports innocence). Follow-on attribution work (Kim, Dirks, Cooper & Ferrin, 2006, *OBHDP*, doi:10.1016/j.obhdp.2005.07.002) shows internal vs external blame interacts with violation type.

**HYPOTHESIS for MindCraft math errors:** Nearly all Solver/coach hallucinations are **competence** failures. Correct response class = **apology + ownership + concrete fix**, not “the curriculum is wrong” externalization, and not integrity-theater (“we would never…”). If the product *knew* the key and still affirmed the student’s wrong answer (sycophancy), treat that as closer to **integrity** — repair requires admitting the agreement failure, not only the math slip.

**Wound (field realism):** Liu, Du, Ma, Zhang & Yan (2024, *IEEE Trans. Human-Machine Systems*, doi:10.1109/THMS.2024.3434680) — after automated-driving failure in a test-track study (N=257), verbal apology+explanation+promise **did not restore damaged trust**; human-voice repair only partially mitigated other attitudes, mainly among less experienced drivers. **Transfer wound:** ADS safety failure ≠ wrong algebra hint — but the kill candidate survives: **do not assume apology scripts restore trust scores**.

**Kill:** Apology copy as the repair KPI. Survive: behavioral re-calibration after a verified correct path.

---

## LX.5 What users prefer after LLM mistakes (preference ≠ recovery)

**FACT (preregistered preference study):** Zhang et al. (2025/26; *CHI* / ACM, doi:10.1145/3793679; arXiv:2507.02745) — N=162 Prolific; pairwise preferences among **rote**, **explanatory**, and **empathic** apologies after bias, fabrication (hallucination), and factual-error scenarios. **Explanatory** apologies generally preferred; **empathic** preferred in bias contexts; for hallucinations, users saw seriousness but showed **no clear apology-type preference** — uncertainty, not a settled recipe.

**FACT (critical review):** Harland et al. (2025, *Artificial Intelligence Review*, doi:10.1007/s10462-025-11305-8) — AI apology literature (2020–2023 synthesis) stresses that apology is only one element; identification, explanation, and **system behavior change** are required for meaningful repair. Purely discursive apology without corrective action is ethically and practically thin.

**HYPOTHESIS:** For Maya after a wrong coach step, the winning stack is **explanatory ownership + Map-linked correction + destaked re-attempt**, not empathic padding (“that must feel frustrating”) alone. Empathy may reduce shame (Part XXIV) but does not restore calibration.

**Contradiction / limit:** Some GenAI service-recovery work finds gratitude/appreciation or humorous styles can raise *willingness to forgive* in consumer settings (e.g. Systems 2024 mixed methods on language style × gratitude/apology — domain = service UX, not math learning). Treat forgive-intent as **engagement theater** unless paired with verified next-attempt success.

**Commercial implication:** Marketing may say “when we’re wrong, we show our work and hand you a human.” Product must actually do the second half.

---

## LX.6 Escalation to human — scarce, triggered, packetized

**FACT (hybrid classroom deployment):** Kazemitabaar et al. (2025, arXiv:2510.14457) — programming course N=82; 673 AI hints; students rated 146 (22%) unhelpful; of those, only **16 (11%)** escalated to instructors. Instructor replies on escalated cases were incorrect/insufficient ~half the time. Escalation is **underused** by students and **not automatically high-quality** for humans.

**FACT (transparency shifts strategy, not accuracy):** Nagashima, Hladký & Rief (arXiv:2606.03822; ECTEL 2026) — fallibility warning increased hint-seeking without changing identical ITS behavior or immediate performance (already in XXXIII).

**HYPOTHESIS — MindCraft escalation triggers (product contract):**
1. **Checker conflict:** model claim ≠ bank key / symbolic checker → auto-flag; do not wait for student detective work.  
2. **Repeat competence miss:** ≥2 verified wrong coach moves in one mission on same concept/ingredient → offer human.  
3. **Affect spike + stuck:** high self-reported threat / long idle after soft-wrong → soft escalate (tutor ping), not more AI monologue.  
4. **Integrity-class event:** sycophantic affirm of wrong answer against known key → mandatory human-visible audit packet.  
5. **Parent/exam stakes mode:** optional “human-reviewed session” SKU (ties SAFE-WTP human-minutes attribute) — not free infinite chat.

**Escalation packet (HYPOTHESIS):** Human receives: problem ID, student attempt trace, AI utterance, contradiction evidence, ontology IDs, student affect flag — not a blank “help?” thread. Aligns with SAFE-AAR / SAFE-ANNOT (trace before coach dump).

**Wound:** Human-in-the-loop is not magic (Kazemitabaar instructor error rate). Escalation must preserve **tutor attention hygiene** — packetized, not “AI failed, you debug the LLM live.”

**Press-adjacent note (SPECULATION until primary paper cited in-repo):** Hybrid AI-draft + human-approve tutoring reports (e.g. Eedi/LearnLM coverage in education press) suggest low hallucination rates *under* human gatekeeping — useful as competitive *direction*, not as MindCraft proof. Prefer primary methods papers before marketing “near-zero hallucinations.”

---

## LX.7 Identity stakes — why math trust violations cut deeper

**HYPOTHESIS:** For Maya, a fluent wrong coach move is not only a UX bug; it reactivates the identity narrative “even the helper confirms I’m lost” *or* the opposite overtrust “the AI said I’m right” (Parts XXV, XXX, L). Repair must separate:
- **System competence failure** (external, unstable, specific — Weiner-friendly)  
- **Student strategy miss** (controllable after correct feedback)  
Never: “you’re just not a math person” and never: “trust me completely next time.”

**FOUNDER BELIEF:** Soft-wrong already destakes *student* error. Post-hallucination UX must destake *AI* error without teaching helplessness toward tools (Lee & See disuse).

---

## LX.8 Competitive positioning

| Competitor move | Failure mode | MindCraft counter (HYPOTHESIS) |
|-----------------|--------------|--------------------------------|
| ChatGPT raw | Hallucinate + apologize vaguely + continue | Checker + Map correction + solo re-attempt |
| “AI tutor never wrong” ads | Integrity violation when caught | Honest fallibility + repair SLA |
| Unlimited chat, no human | Disuse after salient miss; or silent misuse | Triggered human minutes as paid scarce resource |
| Thumbs-up quality loop | Bastani/Bo: perception fails | `repair_reattempt_pass`, `escalation_resolve_48h` |

**Copy that survives Red Team:** “We catch wrong steps, show the fix, and bring a tutor when it matters.”  
**Copy that dies:** “Our AI never makes mistakes” / “Sorry you’re frustrated!” without a corrected path.

---

## LX.9 SAFE-REPAIR stack (surviving product rules)

1. **Detect** — prefer deterministic contradiction over student-reported vibes.  
2. **Classify** — competence vs integrity-class (sycophancy-against-key).  
3. **Own** — short explanatory apology; no blame-the-student; no vague empathy wall.  
4. **Correct** — show Map/ingredient + checked next step; ban full solution until re-attempt window unless escalate.  
5. **Re-attempt** — destaked item; measure success.  
6. **Calibrate UI** — temporarily lower coach confidence badge on that skill grain (SAFE-CALIB cousin).  
7. **Escalate** — only on triggers; send packet; SLA visible to parent/student.  
8. **Learn** — log to evaluation set; do not only “prompt harder.”  
9. **Anti-cosplay** — no therapy script, no airline-captain apology theater, no never-wrong brand.

---

## LX.10 Experiments (REPAIR family)

| ID | Contrast | Primary outcome | Falsifier |
|----|----------|-----------------|-----------|
| REPAIR-1 | Explanatory+correct path vs rote apology vs empathy-only after injected wrong hint | `repair_reattempt_pass` @10m; trust calibration item | Empathy-only wins reattempt → revisit stack |
| REPAIR-2 | Auto-detect+own vs silent correct-and-continue | next-mission return; overtrust score | Silent fix retains more misuse → keep detect |
| REPAIR-3 | Escalation offer after 1 vs 2 vs 3 verified AI misses | escalate rate; human resolve quality; cost/session | Instant escalate floods tutors without lift |
| REPAIR-4 | Packetized tutor handoff vs blank “talk to tutor” | time-to-correct; tutor CSAT; reattempt | Packet no better → packet UX fail |
| REPAIR-5 | Fallibility banner always-on vs post-error-only vs none | hint abuse; solo transfer | Always-on destroys use without calibration gain |
| REPAIR-6 | Parent-visible “AI miss + repair” FEI note vs hidden | parent trust / WTP message arm | Hidden wins retention → wound transparency thesis |
| REPAIR-QUAL | 10 Maya + 5 tutors: what “sorry” means after wrong hint | codebook → copy freeze | Founder apology ≠ user need |

**Pre-reg (XXXIV):** REPAIR-* identify **post-error calibration and escalation efficiency** — not “apology increases ACT scores” or “human tutors eliminate hallucinations.”

**Ties:** AIT-*, CAL-*, ANNOT-*, AAR-*, WTP human-minutes, EXP-O affect gates.

---

## LX.11 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| Unguarded generative help can harm solo math learning; hallucinations contribute | FACT | High |
| Novices often fail to detect fluent errors | FACT | High |
| Appropriate reliance (not max trust) is the right design target | FACT (HF) | High |
| Apology scripts alone restore post-failure trust | SPECULATION / often false | Low (against) — Liu et al. wound |
| Explanatory repairs preferred over rote for many LLM errors | FACT (preference) | Medium–High |
| Preference among apology types for *hallucination* is unsettled | FACT | High |
| Competence-framed ownership + corrective action is right class for math slips | HYPOTHESIS | Medium–High |
| Triggered, packetized human escalation beats unlimited chat *and* no-human | HYPOTHESIS | Medium |
| Parent-visible repair notes raise WTP for hybrid SKUs | HYPOTHESIS | Medium |
| “Never hallucinates” is a viable brand claim | SPECULATION / false | Low (against) |

---

## LX.12 What this chapter kills

1. **Kill:** “Our AI doesn’t / won’t hallucinate” marketing.  
2. **Kill:** Rote or empathy-only apology as the repair product.  
3. **Kill:** Silent overwrite of wrong AI output without student-visible ownership when detection exists.  
4. **Kill:** Thumbs-up / satisfaction as proof of trust repair.  
5. **Kill:** Infinite free human escalation as default.  
6. **Kill:** Permanent “never trust the AI” as brand (disuse).  
7. **Wound:** Importing ADS trust-repair nulls or consumer GenAI “forgiveness” as ACT learning proof.  
8. **Survive:** SAFE-REPAIR; competence ownership + checked correction + re-attempt; triggered packetized escalation; REPAIR-1…6 + QUAL.

**Doctrine until data:** After a hallucination, MindCraft sells **recoverable truth** — detect, own, correct, prove, escalate when scarce human attention is worth it — not warmth, not invincibility.
