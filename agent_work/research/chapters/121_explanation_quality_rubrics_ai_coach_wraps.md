# Part CXXI — Explanation Quality Rubrics for AI Coach Wraps

**Chapter status:** Living evidence + coach QA brief — Researcher tick 2026-08-11 (UTC hour 00 ≡ Red Team slot, but ch121 never written → prefer Researcher per rotation; researcher count since synthesizer v1.15 = 4 → Researcher)  
**Primary question:** How should MindCraft *gate* AI coach / Solver wraps so “quality” means **principle-short, pedagogically actionable, keyed-correct guidance** — not fluency, thoroughness, or a vanity Explanation Score™?  
**Owners:** Product (coach / Solver) · Engine (prompt budgets + verify) · HITL QA · Trust & Safety · Brand · Red Team  
**Commercial job:** Ship **SAFE-EXPLAINQA** densifying SAFE-EXPLAIN × SAFE-GENQ × SAFE-REPAIR: **rubric gates before wrap ships**; hard-fail on math/key error; ban monologue fluency as pedagogy proof.

**Builds on:** Parts XCII (SAFE-EXPLAIN), LXXII (SAFE-GENQ), XL (SAFE-SE), LX (SAFE-REPAIR), XCI (SAFE-HINT), LXXXVIII (SAFE-FADE), XXXIII (AI trust). Product seams: coach card length, SE-before-wrap, generation verify, hallucination repair escalate.

---

## CXXI.1 Why this chapter exists

SAFE-EXPLAIN already kills longer≡better and monologue≡SE. SAFE-GENQ already kills unverified keys in the bank. What remains commercially underspecified is the **ship gate for generated coach language**: which rubric dimensions must pass before a wrap reaches Maya, and which “AI quality” metrics are brand poison.

Default AI-tutor UX optimizes for fluent completeness and helpful tone. Default LLM-as-judge stacks optimize for agreement with another LLM. Default parent anxiety asks for “more explanation.” MindCraft’s identity claim needs the opposite default: **a short, correct, adaptive wrap that preserves construction — or a hard withhold / escalate.**

**FOUNDER BELIEF under audit:** A small, inspectable **principle-short QA rubric** (content correctness + learner fit + non-reveal + actionability + length) beats both (a) unmeasured fluent dumps and (b) a composite Explanation Score™ product surface.

**Claims we refuse as doctrine:**
1. Fluency / human-likeness / “sounds like a tutor” ≡ pedagogical quality.  
2. Thumbs-up / satisfaction / “thoroughness” as wrap North Stars.  
3. Explanation Score™ / Rubric Score™ / Quality Minutes as student or parent NS.  
4. LLM-as-judge alone as production authority without human audit sample.  
5. Longer wrap ≡ higher rubric quality (SAFE-EXPLAIN collision).  
6. Reveal-answer / full solution essay as default “guidance.”  
7. Soft-pass on arithmetic/key errors because the prose “explained the idea.”  
8. Auto-QA of wraps replacing bank key verify (SAFE-GENQ collision).  
9. ACT guarantees from “rubric-scored AI coach” packaging.

---

## CXXI.2 Constructs (rubric ≠ score product)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Instructional explanation** | Provided why/principle/operator text | Coach wrap; soft-hint text | Essay replacing SE |
| **Explanation quality criteria** | Content, learner fit, design, language, structure | Principle-short gate checklist | Composite vanity score |
| **Pedagogical ability dims** | Mistake ID/location, guidance, actionability, reveal, tone… | Coach QA dimensions | Tone-only polish |
| **Hard fail** | Content/key error blocks ship | GENQ-style verify on wrap math | Soft “mostly helpful” |
| **Principle-short** | Minimal critical-feature length | SAFE-EXPLAIN default | Thoroughness theater |
| **SAFE-EXPLAINQA** | Rubric gates for AI wraps | This chapter | Fluency costume |

**Operational definition (HYPOTHESIS):** A MindCraft coach wrap is *SAFE-EXPLAINQA shippable* when it (a) is **keyed-correct** on any math/claim it asserts (hard fail otherwise), (b) marks the **critical feature / join** without default full-answer reveal, (c) is **actionable** (student knows the next attempt move), (d) fits fade/expertise grain (shortens as E rises), (e) preserves required SE when policy demands it, (f) strips seductive fluff, and (g) is proven by `solo_transfer_pass` / near transfer — never by Explanation Score™ dwell or thumbs-up on thoroughness.

---

## CXXI.3 Why instructional explanations often fail — design before dump

**FACT (framework):** Wittwer & Renkl (2008, *Educational Psychologist, 43*(1), 49–64, doi:10.1080/00461520701756420) — instructional explanations frequently fail to promote learning; effectiveness depends on generation *and* use conditions (fit to prior knowledge, timing, whether learners actually process them), not on the mere presence of an explanation.

**FACT (meta):** Wittwer & Renkl (2010, *Educational Psychology Review, 22*, 393–409, doi:10.1007/s10648-010-9136-5) — instructional explanations added to worked examples yield a **small** overall effect (*d* ≈ 0.16); stronger for conceptual knowledge than transfer; **no advantage** when controls are prompted to self-explain.

**FACT (SE crowding):** Schworm & Renkl (2006, *Computers & Education, 46*, 426–445, doi:10.1016/j.compedu.2004.08.011) — instructional explanations can **reduce** self-explanation activity; objective learning favored SE prompts alone, while learners *perceived* instructional explanations as more helpful — a satisfaction≠learning trap.

**Applied (HYPOTHESIS):** Coach QA must score **use conditions** (does this wrap enable the next construction?) not “completeness.” A wrap that crowds out SE fails even if fluent.

**Kill:** Thoroughness / perceived helpfulness as ship criteria.  
**Survive:** Principle-short + SE-preserving gates; expand only on miss/demand.

---

## CXXI.4 Content-first quality criteria — correctness is not optional

**FACT (video/explanation rating instrument):** Ring & Brahm (2023, *Technology, Knowledge and Learning*, doi:10.1007/s10758-022-09635-5) — theory-driven rating framework with **twelve criteria in five categories**: content, learner orientation, representation/design, language, process structure; content includes technical correctness and completeness of the core statement.

**FACT (science explanation-video framework):** Kulgemeyer (2018/2020 line; framework informed by instructional-explanation criteria, *Research in Science Education* / follow-ons) — adaptation to prior knowledge, minimal coherent explanation (avoid digressions), structure, and relevance tools; videos adhering more strongly to the framework produced higher **declarative** post-test knowledge in an empirical test (*d* ≈ 0.42 in reported comparisons) with weaker/null conceptual differences — quality criteria are not magic transfer guarantees.

**Applied (HYPOTHESIS):** MindCraft’s production rubric should **hard-fail** on content correctness (wrong algebra, wrong key, invented theorem) before scoring tone or coherence. Soft-passing a fluent wrong wrap poisons Map events the way unverified GENQ keys do.

**Kill:** “Mostly correct / helpful vibe” soft-pass on math errors.  
**Survive:** Correctness hard gate + learner-orientation (prior-knowledge / fade fit) as second tier.

**Wound:** Classroom/video instruments are not MindCraft RCTs — EXPLAINQA-* must calibrate thresholds on coach cards specifically.

---

## CXXI.5 Pedagogical ability taxonomy for LLM tutors — guidance ≠ answer dump

**FACT (unified AI-tutor eval):** Maurya, Srivatsa, Petukhova, & Kochmar (2025, *NAACL*, doi:10.18653/v1/2025.naacl-long.57) — eight pedagogical dimensions for LLM tutor responses in math mistake-remediation contexts: mistake identification, mistake location, revealing the answer, providing guidance, actionability, coherence, tutor tone, human-likeness; release MRBench with human gold labels across LLM and human tutors.

**Applied (FOUNDER BELIEF → testable):** For MindCraft coach wraps, elevate **mistake location + correct guidance + actionability + non-default reveal** as ship dimensions. Demote **human-likeness / tone** to secondary polish — never primary quality. A wrap that reveals the answer by default fails SAFE-HINT / SAFE-FADE even if “encouraging.”

**Kill:** Human-likeness or warmth as the marketing proof of coach quality.  
**Survive:** Non-reveal + actionable next-step as default pass criteria.

**Wound:** MRBench is dialogue remediation, not identical to MindCraft’s card wrap — map dimensions carefully; do not cargo-cult all eight into a student-facing score.

---

## CXXI.6 Guardrails beat base fluency — learning ≠ practice-with-AI score

**FACT (field experiment):** Bastani, Bastani, Sungu, Ge, Kabakcı, & Mariman (2024/2025; SSRN abstract 4895486; PNAS-line results) — ~1,000 high-school math students; GPT Base improved practice performance but **harmed** unassisted exam performance (~17% worse vs control); GPT Tutor with pedagogical safeguards largely mitigated the harm; students often used Base as a solution crutch and did not perceive the learning loss.

**Applied (HYPOTHESIS):** Rubric gates that block answer-dumps and force principle-short guidance are not UX niceties — they are the product form of Bastani-style safeguards. Shipping fluent Base-like wraps because they raise “session success” is commercially suicidal for an identity company.

**Kill:** Assisted practice accuracy / wrap satisfaction as coach quality proof.  
**Survive:** Unassisted / solo-transfer primary; guardrailed wrap secondary.

---

## CXXI.7 Automated scoring is a tool — not a North Star product

**FACT (math SE auto-score):** Nakamoto, Flanagan, Yamauchi, Dai, Takami, & Ogata (2023, *Computers, 12*(11), 217, doi:10.3390/computers12110217) — automated scoring of math self-explanation quality using coherence / clarity / relevance rubrics (adapted from prior Nakamoto work); human raters reached substantial agreement (quadratic weighted κ ≈ 0.75); LLM-augmented training data helped up to a point, then saturated.

**Applied (HYPOTHESIS):** MindCraft may use **rubric-structured auto-checks** (and LLM judges) as *internal* pre-filters for coach wraps — always with (a) deterministic math/key checks first, (b) human audit sampling, (c) no student/parent Explanation Score™ surface. Auto-score of *student* SE is a different product question (SAFE-SE / SAFE-PEERX); this chapter’s primary object is **AI wrap QA**.

**Kill:** Rubric Score™ / Quality Minutes as NS; LLM-judge-as-sole-authority.  
**Survive:** Inspectable checklist + hard fails + audit cadence.

---

## CXXI.8 Product surface — SAFE-EXPLAINQA claim contract

| Gate | Pass look | Hard fail | Banned substitute |
|------|-----------|-----------|-------------------|
| Content / key | Asserted math matches verify | Wrong key / invented rule | “Conceptually helpful” soft-pass |
| Principle-short | 1–3 sentence critical feature / join | Monologue essay default | Thoroughness Score™ |
| Non-reveal | Hint/principle grain; answer not dumped | Full solution as first wrap | “Never stuck” hero |
| Actionability | Clear next attempt move | Vague pep / lore | Tone-only polish |
| SE-preserve | SE before wrap when policy on | Wrap replaces required SE | AI monologue labeled SE |
| Fade fit | Shorter as expertise rises | Fixed long wrap all levels | Expertise-blind dump |
| Metrics | `solo_transfer_pass`; repair escalate rate; audit fail rate | Explanation Score™ / thumbs-up thoroughness | Fluency / human-likeness NS |

**Competitive foil:** ChatGPT Base = fluent dump. “AI explained everything” = satisfaction theater. MindCraft = **gated principle-short coach**.

---

## CXXI.9 Doctrine — SAFE-EXPLAINQA (provisional)

1. **Rubric before ship** — no ungated LLM wrap into Practice/Solver coach surfaces.  
2. **Correctness hard-fail** — math/key errors block ship (SAFE-GENQ parity for language that asserts facts).  
3. **Principle-short default** — SAFE-EXPLAIN length law is a *gate*, not a style tip.  
4. **Non-reveal + actionable** — Maurya dims as production constraints; human-likeness demoted.  
5. **SE before wrap** — instructional text must not crowd construction (Wittwer/Renkl; Schworm/Renkl).  
6. **Guardrails > Base fluency** — Bastani lesson: assisted gains ≠ learning.  
7. **No Explanation Score™ / Rubric Score™ NS** — internal QA only; FEI co-primaries prove.  
8. **Human audit sample** — LLM-as-judge never sole authority (SAFE-HITL / SAFE-LABMETA).  
9. **Copy:** “Our coach is short, checked, and leaves you the thinking.” Never “unlimited thorough AI explanations.”

**Confidence:** High — Wittwer/Renkl failure modes + small meta; Schworm SE crowding; Bastani guardrails; Maurya taxonomy existence. Medium — exact pass thresholds and auto-judge agreement on MindCraft cards (needs EXPLAINQA-*). High — fluency/thoroughness/Explanation Score™ as commercially toxic under this stack.

---

## CXXI.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| EXPLAINQA-1 | Principle-short gated wrap vs ungated fluent monologue | A/B | `solo_transfer_pass`; SE rate; dwell |
| EXPLAINQA-2 | Correctness hard-fail + withhold vs soft-pass fluent-wrong | A/B | Map poison events; repair escalate; trust |
| EXPLAINQA-3 | Non-reveal actionable wrap vs answer-dump wrap | A/B | Peek rate; unassisted transfer (Bastani-style) |
| EXPLAINQA-4 | LLM-judge + human audit vs LLM-judge alone | Ops A/B | False-pass rate; audit catch; cost |
| EXPLAINQA-5 | Parent CBC: “checked short coach” vs “unlimited thorough AI” | CBC | WTP; trust (SAFE-WTP) |
| EXPLAINQA-QUAL | 10 students + 5 tutors: which wrap felt like teaching vs dumping? | Qual | EXPLAINQA codebook |

**Falsifier:** Ungated fluent monologues beat gated wraps on solo transfer without SE collapse → revise length gate; still ban Explanation Score™ NS.  
**Falsifier:** Soft-pass fluent-wrong improves short-term affect without Map poison → still hard-fail keys; segregate affect.  
**Falsifier:** LLM-judge alone matches human audit at production risk tolerance → still keep sample audit for SAFE-GENQ parity.  
**Pre-register:** EXPLAINQA-* before “science-backed AI explanations” ads (SAFE-LABMETA).  
**Family note:** EXPLAINQA-* densifies EXPLAIN-* / GENQ-*; do not collapse into thumbs-up OKRs.

---

## CXXI.11 So what for MindCraft commercially

- **Copy:** “Short, checked coach — you still do the thinking.” Lead with gated principle-short, not unlimited essays.  
- **Product:** Ship checklist on coach/Solver wraps: key-correct → principle-short → non-reveal → actionable → SE-preserve; withhold/escalate on hard fail (SAFE-REPAIR).  
- **Positioning:** Against ChatGPT Base dumps and “AI explained everything” brands; for guardrailed coach that protects solo transfer.  
- **Metric:** `solo_transfer_pass`, wrap hard-fail rate, audit false-pass rate, SE-before-wrap compliance — demote Explanation Score™ / thoroughness thumbs.  
- **Kill list:** Fluency≡quality; thumbs-up NS; Explanation Score™; reveal-default; soft-pass wrong math; ACT guarantees from rubric packaging.  
- **Growth:** Trust packets show *how* wraps are gated (correctness + pedagogy dims) — procurement asset vs black-box tutor LLM.  
- **Vision:** Thirty-year identity company treats AI explanation as a **verified micro-scaffold**, not a fluent substitute for becoming a mathematical thinker.

---

## References (verified)

- Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., & Mariman, R. (2024). Generative AI can harm learning. *The Wharton School Research Paper*. https://doi.org/10.2139/ssrn.4895486  
- Kulgemeyer, C. (2018). A framework of effective science explanation videos informed by criteria for instructional explanations. *Research in Science Education*. https://doi.org/10.1007/s11165-018-9787-7  
- Maurya, K. K., Srivatsa, K. V. A., Petukhova, K., & Kochmar, E. (2025). Unifying AI tutor evaluation: An evaluation taxonomy for pedagogical ability assessment of LLM-powered AI tutors. In *Proceedings of NAACL*. https://doi.org/10.18653/v1/2025.naacl-long.57  
- Nakamoto, R., Flanagan, B., Yamauchi, T., Dai, Y., Takami, K., & Ogata, H. (2023). Enhancing automated scoring of math self-explanation quality using LLM-generated datasets: A semi-supervised approach. *Computers, 12*(11), 217. https://doi.org/10.3390/computers12110217  
- Ring, M., & Brahm, T. (2023). A rating framework for the quality of video explanations. *Technology, Knowledge and Learning*. https://doi.org/10.1007/s10758-022-09635-5  
- Schworm, S., & Renkl, A. (2006). Computer-supported example-based learning: When instructional explanations reduce self-explanations. *Computers & Education, 46*, 426–445. https://doi.org/10.1016/j.compedu.2004.08.011  
- Wittwer, J., & Renkl, A. (2008). Why instructional explanations often do not work: A framework for understanding the effectiveness of instructional explanations. *Educational Psychologist, 43*(1), 49–64. https://doi.org/10.1080/00461520701756420  
- Wittwer, J., & Renkl, A. (2010). How effective are instructional explanations in example-based learning? A meta-analytic review. *Educational Psychology Review, 22*, 393–409. https://doi.org/10.1007/s10648-010-9136-5  
