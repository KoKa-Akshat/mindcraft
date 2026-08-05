# Part XL — Self-Explanation Prompts: Chi/Renkl → Coach UX

**Chapter status:** Living evidence brief — Researcher tick 2026-07-29  
**Primary question:** When do prompts that force the student to *generate* an explanation improve math learning — and what must MindCraft’s coach / cards / Solver refuse to do with “explain yourself” UX?  
**Owners:** Learning Science · Product (coach, ingredient cards, Solver) · Growth / Positioning · Red Team  
**Commercial job:** Turn “we explain everything” and “AI tutor talks at you” into a **defensible generation claim**: students build transferable understanding by explaining *why steps work* (and why common wrong moves fail) — without selling open-ended “justify your guess” as science, and without confusing fluent AI explanation *to* the student with self-explanation *by* the student.

---

## XL.1 Why this chapter exists

Part XXVI (CLT / worked examples / fading) already puts examples and completion problems in the acquisition path. Part XXIX / XXXIX demand retrieval and strategy *selection*. Part XXXIII warns that fluent AI explanations can create overtrust. Experiment A (wizard coach) and soft-wrong already assume that *after* an error, something productive happens.

This chapter densifies the **prompt layer**: what the product asks the student to *produce* — principle for a step, why a misconception is wrong, anticipation of the next operator — vs what it merely *shows*.

**FOUNDER BELIEF under audit:** Identity as a mathematical thinker requires evidence that the student can *account for* a move, not only select A/B/C/D. Passive delivery without generation is Layer-1 scarcity relief, not identity transformation.

**Claim we refuse as doctrine:** “Any explain box after a wrong answer is self-explanation science.” Untargeted prompts, explain-your-wrong-guess-without-feedback, and AI monologues are different mechanisms — some help, some hurt, some are theater.

---

## XL.2 Constructs (product language)

| Construct | Plain definition | Product surface | Failure mode |
|-----------|------------------|-----------------|--------------|
| **Self-explanation** | Learner generates inferences beyond the given text/example *for themselves* | Prompted coach turns; card reflection; step-principle pick | Empty “why?” with no scaffold; AI does the explaining for them |
| **Instructional explanation** | Expert/AI/tutor explains *to* the learner | Solver narration; worked example text | Can reduce germane effort if overused (expertise / passivity) |
| **Worked-example study** | Study full solution before / instead of cold solving | Ingredient cards; fade path | Without SE prompts → shallow copy (Chi “poor” pattern) |
| **Principle / glossary citation** | Name the rule that justifies a step | Aleven-style menu; ingredient id pick | Menu-click without comprehension if too shallow |
| **Misconception contrast** | Explain why a common wrong path fails | Soft-wrong + “why not B”; bank distractors | Asking only “defend your wrong answer” before feedback |

**Operational definition for MindCraft (HYPOTHESIS):** A self-explanation prompt is load-bearing only if (1) the to-be-explained content is tagged **correct or known-incorrect**, (2) the response format scaffolds principle / operator–goal / misconception contrast (not free essay only), and (3) success is measured by **transfer / delayed mix**, not by longer time-on-task or chat length.

---

## XL.3 Classic effect: spontaneous quality, then elicitation

**FACT (good vs poor example study):** Chi, Bassok, Lewis, Reimann & Glaser (1989, *Cognitive Science*, doi:10.1207/s15516709cog1302_1) — talk-aloud while studying mechanics worked examples. “Good” students generated many explanations that refined conditions for actions and linked steps to principles; “poor” students under-explained, monitored poorly, and relied heavily on examples at solve time. Self-explanation quality predicted understanding and example-independence.

**FACT (elicitation works):** Chi, de Leeuw, Chiu & LaVancher (1994, *Cognitive Science*, doi:10.1016/0364-0213(94)90016-7) — eighth-graders prompted to self-explain after each line of a circulatory-system text outperformed controls who reread; high explainers built more accurate mental models. Prompts can *create* the behavior that spontaneous good students show.

**FACT (quality ≠ mere time):** Renkl (1997, *Cognitive Science*, doi:10.1016/S0364-0213(99)80017-2) — probability worked examples; time-on-task controlled. Learning gains still predicted by qualitative SE features: **principle-based** explanations, **operator–goal** explication, **anticipative** reasoning. Two effective profiles: anticipative reasoners and principle-based explainers.

**Product translation:** Coach UX should elicit *those* moves — “What rule licenses this step?” / “What is this step trying to achieve?” / “What happens next?” — not “Write anything about your feelings about math” and not “Hear the AI explain for 90 seconds.”

---

## XL.4 Scaffolded prompts + fading (coach design spine)

**FACT (fading + principle prompts):** Atkinson, Renkl & Merrill (2003, *Journal of Educational Psychology*, doi:10.1037/0022-0663.95.4.774) — successively fading worked-out steps helps near transfer vs example–problem pairs, but far transfer is unreliable from fading alone. Combining fading with prompts to identify the **underlying principle** for each worked step produced medium-to-large effects on **near and far transfer without extra time on task**.

**FACT (Cognitive Tutor classroom):** Aleven & Koedinger (2002, *Cognitive Science*, doi:10.1016/S0364-0213(02)00061-7) — geometry Cognitive Tutor; students who explained steps by citing geometric rules (glossary) learned with greater understanding and better transfer than problem-solving-only peers. Interpretation: better-integrated declarative knowledge, less shallow procedural knowledge. Scales in classroom software — not only lab talk-alouds.

**HYPOTHESIS for MindCraft:** Ingredient `card_templates` + bridge cards are the worked-example substrate; coach prompts should (a) attach principle/ingredient labels to faded steps, (b) require a brief generation or structured pick *before* revealing the next full AI paragraph, (c) fade prompts as mastery rises (expertise reversal risk if we nag forever).

**Tie to SAFE-CRAFT (XXVI):** Micro-attempt / completion blank inside an example *plus* a principle prompt beats cold multi-step solve *or* passive read-only cards.

---

## XL.5 Math meta-analysis: what we may claim (and must not)

**FACT (math SE meta-analysis):** Rittle-Johnson, Loehr & Durkin (2017, *ZDM*, doi:10.1007/s11858-017-0834-z) — prompted self-explanation in mathematics: small-to-moderate immediate gains — procedural knowledge ES ≈ .28, conceptual ES ≈ .33, procedural transfer ES ≈ .46. Effects **stronger when high-quality explanations are scaffolded** (training or structured responses). Time-on-task control did **not** erase the benefit (moderator). **Caveats they stress:** evidence for reliable classroom (esp. primary/secondary non-ITS) effects and for **retention over delay** is much thinner; delayed procedural/conceptual effects often weak/null while delayed transfer ES ≈ .32 in the subset that measured it; substantial heterogeneity (some null/negative studies).

**Instructional recommendations from that paper (treat as design doctrine, not slogans):**
1. Scaffold high-quality explanations (structure or train).  
2. Design prompts so they do **not** steal attention from other critical content.  
3. Prompt learners to explain **correct** information.  
4. Prompt why **common misconceptions** are incorrect.

**Kill:** Marketing “self-explanation always raises grades” / absolute classroom-retention claims from lab immediate ES alone. Claim ladder: L1 “structured why-this-step prompts aim at transfer”; L2+ only after SE-* experiments with delayed mixed `transfer_pass`.

---

## XL.6 Constraints: when prompts backfire

**FACT (constraint review):** Rittle-Johnson & Loehr (2017, *Psychonomic Bulletin & Review*, doi:10.3758/s13423-016-1079-5) — four constraints: (1) SE favors principle-guided domains and transfer, can hurt detail/exception learning; (2) explaining **one’s own** (often wrong) ideas can entrench them — better to explain known-correct / known-incorrect content; (3) prompts focus attention — mis-aimed prompts tax the wrong content; (4) alternatives (instructional explanation, retrieval, unfamiliar problems) can match or beat SE in some conditions.

**HYPOTHESIS for soft-wrong:** Order matters. After a wrong MC choice: (A) brief correct-principle or contrastive “why B fails” prompt with scaffold → help; (B) “Explain why you picked C” *before* any correctness signal → risk of justifying the misconception (constraint 2). Prefer: soft-wrong frame → show contrastive target → generate/select why the foil fails → then optional deeper AI wrap (XXXIII: calibration > fluency).

**Contradiction to hold:** Open generation is the romantic “thinker” move; structured glossary/ingredient picks (Aleven) often deliver the measurable classroom gain. MindCraft should not shame structured picks as “not real thinking” — they are the scalable SE scaffold.

---

## XL.7 Competitive / product audit (explanation lens)

| Surface | Typical explanation pattern | MindCraft stance |
|---------|----------------------------|------------------|
| **Khan / video** | Instructional explanation; optional reflection | Do not clone lecture-first as identity product |
| **Duo** | Rare deep SE; habit + bits | Habit ≠ principle generation |
| **Brilliant** | Puzzle insight; light justify | Insight ≠ scaffolded SE curriculum |
| **ChatGPT Solver** | High-fluency instructional explanation | **Not** self-explanation; overtrust risk (XXXIII) |
| **Cognitive Tutor lineage** | Step + rule citation | Closest evidence-backed software pattern |
| **MindCraft today** | Cards + Solver + coach drafts | Need **student generation gates** before AI walls of text; wire misconception bank into contrastive prompts |

**FOUNDER BELIEF:** Solver that answers *for* Maya without a generation gate competes on Layer-1 (answers get cheap) and loses the identity thesis. Coach that forces a principle pick / misconception contrast competes on Layer 2–6.

---

## XL.8 Commercial implications (copy, product, growth)

### Marketing language that survives

- **Allowed:** “We don’t just show the steps — we ask you to say *why* the step works.”  
- **Allowed:** “Wrong answers become contrast: why that trap fails, not a shame spiral.”  
- **Allowed (parent):** “We train explaining the rule, not only picking the letter — that’s what transfers.”  
- **Banned:** “AI explains everything so tutoring is free.”  
- **Banned:** “Any chat box = self-explanation science.”  
- **Banned:** Absolute meta-analytic grade claims; 2-sigma; streak-as-understanding.  
- **Banned:** Forcing students to justify unchecked wrong guesses as the default pedagogy.

### Feature claim ladder (Part XXXIV hygiene)

| Feature | Claim max without SE-* data |
|---------|------------------------------|
| AI worked-example narration | L0 instructional help; **not** SE claim |
| Structured principle / ingredient pick on faded step | L1 SE scaffold (Aleven/Atkinson-aligned intent) |
| Contrastive “why this distractor fails” after soft-wrong | L1 misconception-SE intent |
| Open essay “explain your answer” every item | L0 until quality+affect validated; risk of load + avoidance |
| “SE raises ACT / identity” hero | L0 until SE-1/SE-2 delayed transfer |

### Growth / North Star hygiene

Chat turns, explanation word count, and Solver dwell time are **vanity** if uncoupled from `transfer_pass` and strategy-class errors. Prefer: rate of principle-consistent explanations (rubric or structured correct pick), misconception-contrast success, delayed mixed accuracy, `retry_120s` after contrastive miss — not tokens generated by the model.

---

## XL.9 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| SE-1 | Principle-prompt on faded card steps vs same cards with AI narration only | 2-arm; matched time budget | 48h near + far / mixed transfer; shallow-copy errors | Narration-only ≥ prompted on transfer **and** lower load/avoidance |
| SE-2 | Soft-wrong → contrastive “why foil fails” vs soft-wrong → explain-own-choice first | 2-arm | Misconception recurrence; `retry_120s`; delayed item isomorphic | Explain-own-first wins transfer → constraint-2 doctrine wounded |
| SE-3 | Structured ingredient/glossary pick vs open text SE vs no SE | 3-arm | Transfer; time; completion rate (Maya anxiety segment) | Open text wins transfer but kills return → ship structured default |
| SE-4 | Prompt every step vs adaptive fade of SE prompts with mastery | 2-arm | Transfer; prompt skip/nag irritation | Always-on prompts equal fade on transfer but raise churn → fade mandatory |
| SE-QUAL | 10 Maya interviews: “When did an explanation feel like *yours* vs the app talking?” | Appendix B | coded ownership / passivity moments | Nobody distinguishes → UX isn’t creating generation |

**Pre-reg (XXXIV):** SE-* identify **prompt regime → transfer / misconception recurrence**. They do **not** identify long-term identity from one session of explain boxes. Densifies Experiment A: coach content should be SE-constrained, not generic pep talk.

**Supersedes / densifies:** XXVI worked-example fading notes; Experiment D (explanation timing × anxiety) → prefer SE-2/SE-3 as operational pairs; XXXIII “pedagogy wrap” → wrap = student generation + calibration, not longer AI prose.

---

## XL.10 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| Higher-quality spontaneous SE while studying examples predicts better learning | FACT (Chi et al., 1989) | High |
| Prompting SE can improve understanding vs reread / no prompt | FACT (Chi et al., 1994; math meta) | High |
| Qualitative SE features predict gains beyond time-on-task | FACT (Renkl, 1997) | High |
| Fading + principle prompts aid near & far transfer without extra time | FACT (Atkinson et al., 2003) | High |
| Step explanation via rule citation helps Cognitive Tutor geometry transfer | FACT (Aleven & Koedinger, 2002) | High |
| Math prompted-SE immediate effects small–moderate; scaffold helps | FACT (Rittle-Johnson et al., 2017 ZDM) | High |
| Classroom + delayed retention evidence thinner than immediate lab/ITS | FACT (same meta) | High |
| Explaining own wrong ideas can entrench; prefer correct/incorrect targets | FACT (constraint review) | High |
| AI instructional explanation ≡ self-explanation benefit | SPECULATION / false | Low (against) |
| Default MindCraft path = faded examples + structured principle/misconception prompts before AI wrap | FOUNDER BELIEF / HYPOTHESIS | Medium–High |

---

## XL.11 What this chapter kills

1. **Kill:** Equating Solver/AI monologue with self-explanation pedagogy.  
2. **Kill:** “Explain why you chose that” *before* correctness/contrast as the default after every wrong answer.  
3. **Kill:** Absolute “SE always raises scores / always works in class / always sticks for months” marketing.  
4. **Wound:** Open-ended explain boxes as the only SE UX — survives as optional depth, not as the scalable default.  
5. **Survive (constrained):** Scaffolded prompts on **correct steps and known misconceptions**, paired with worked-example fading, measured by transfer — the coach spine for identity-relevant competence evidence.

**Doctrine until data:** Build and market **student-generated why** (structured first) on faded examples and contrastive wrongs. AI explains *after* or *around* that generation — never as a substitute for it. Fluency of the model is not mastery of the student.
