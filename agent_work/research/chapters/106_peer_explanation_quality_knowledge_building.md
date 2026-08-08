# Part CVI — Peer Explanation Quality (Knowledge-Building vs Telling)

**Chapter status:** Living evidence + Practice teach-back / HITL QA / generative explain — Researcher tick 2026-08-08 (UTC hour 18 ≡ Red Team slot, but ch106 never written → prefer Researcher per rotation; researcher count since synthesizer v1.13 = 6 → Researcher)  
**Primary question:** When MindCraft asks a student (or near-peer tutor) to **explain**, what makes that explanation *learning-producing* vs a fluent restatement that feels like teaching but builds little?  
**Owners:** Product (Practice teach-back / Notes / Solver) · Tutor playbooks / HITL QA · Brand · Red Team  
**Commercial job:** Ship **SAFE-PEERX** densifying SAFE-GENERATE / SAFE-EXPLAIN / SAFE-HELP / SAFE-TUTORGRAIN / SAFE-APPRENTICE: knowledge-building explanation acts with rubrics and transfer checks — never Peer Explanation Score™, teach-for-XP, Discord-chat≡tutoring, or AI monologue≡peer teaching.

**Builds on:** Parts XL (SE prompts), LXXI (tutor grain), LXXXIV (talk ratio), LXXXVIII–XCI (fade/help/hint), XCII (SAFE-EXPLAIN), CII (SAFE-GENERATE teach-back), XCV (SAFE-APPRENTICE articulation). Product seams: generative teach-back prompts, tutor QA codes, soft→hard help, solo gate after explain.

---

## CVI.1 Why this chapter exists

“Explain it to a friend,” “teach-back,” and peer tutoring are beloved growth slogans. Competitors ship Discord study rooms, AI “tutor mode,” and XP for explanations. The peer-tutoring literature is clear and awkward for marketers: **tutors often default to knowledge-telling** (summarize / recite / dump steps), and that bias caps the famous “tutor learning” benefit. MindCraft’s risk is shipping teach-back theater that measures words spoken, not knowledge built — then selling it as identity transformation.

**FOUNDER BELIEF under audit:** Explanation can revise identity *when* it forces monitoring, integration, and repair — not when it rehearses a script the coach already said.

**Claims we refuse as doctrine:**
1. Peer Explanation Score™ / Teach Minutes / word-count as learning NS.  
2. Teach-for-XP / explanation streaks as growth.  
3. Knowledge-telling monologue ≡ tutoring quality (student or AI).  
4. Discord / forum peer chat ≡ knowledge-building community.  
5. AI dump-as-teach-back or “explain like I’m 5” fluency ≡ peer teaching.  
6. Unlimited explain-to-unlock without solo transfer gate.  
7. Peer tutoring branding as Bloom-2σ or ACT-point guarantee.  
8. Length / thoroughness of peer talk as quality (conflicts SAFE-EXPLAIN).

---

## CVI.2 Constructs (keep telling vs building distinct)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Knowledge-telling** | Summarize / paraphrase source with little monitoring or elaboration | Restate steps; AI wrap verbatim; “say the formula” | Fluency illusion; tutor learning underwhelms |
| **Knowledge-building (reflective)** | Self-monitor, integrate prior+new, elaborate, repair gaps while explaining / answering | Teach-back with why/how + misconception contrast; inferential Q | Over-prompt load; empty metacog slogans |
| **Constructive use of help** | Receiver applies elaborated help to solve, not just hears it | After hint/explain: attempt on *this* item before next | Passive listening; help abuse |
| **Explanation quality (tutor→tutee)** | Conceptual + procedural adequacy; strategy variety | HITL QA rubric; near-peer brief | Warm dump; “got it?” theater |
| **SAFE-PEERX** | Rubric-gated explain acts that force building, then solo proof | This chapter | Peer-chat / XP explain SKU |

**Operational definition (HYPOTHESIS):** A Practice/HITL path is *SAFE-PEERX compliant* when (a) explain prompts require at least one building move (why this step, what would go wrong, how this joins a prior concept), (b) telling-only responses are incomplete for unlock, (c) after explain, a solo or format-hop attempt is required (`solo_transfer_pass` / transfer check), (d) HITL QA codes building vs telling (not talk-% alone), (e) AI never substitutes its monologue for the student’s explanation act, and (f) marketing never equates peer rooms or teach-XP with FEI identity.

---

## CVI.3 Tutor learning is real — and usually underwhelming without building

**FACT (review):** Roscoe & Chi (2007, *Review of Educational Research, 77*(4), 534–574, doi:10.3102/0034654307309920) — peer tutors can benefit academically from tutoring, but gains are often modest; explaining and questioning are hypothesized to help via **reflective knowledge-building** (self-monitoring, integrating new and prior knowledge, elaborating/constructing knowledge); across studies, peer tutors show a pervasive **knowledge-telling bias**, focusing on delivering knowledge rather than developing it, so the true potential for tutor learning is rarely achieved.

**Applied (HYPOTHESIS):** Shipping “peer teach” or “explain to unlock” without a building prompt is likely to recreate the bias Roscoe & Chi document — MindCraft would pay UX cost for theater.

**Kill:** “Peer tutoring = automatic deeper learning” splash.  
**Survive:** Explicit knowledge-building scaffolds inside explain acts.

---

## CVI.4 What elicits building: inferential questions beat summary prompts

**FACT (empirical):** Roscoe & Chi (2008, *Instructional Science, 36*(4), 321–350, doi:10.1007/s11251-007-9034-5) — untrained peer tutors learned most when instructional activity included reflective knowledge-building (monitor understanding, generate inferences to repair misunderstandings, elaborate on source material); tutors still showed a knowledge-telling bias (summaries with little elaboration); building was more often elicited by **tutee interaction**, especially when tutee questions contained an inference or required an inferential answer — those questions pulled elaborative, metacognitive tutor responses.

**Applied (HYPOTHESIS):** Teach-back UX should simulate a good tutee: ask for an inference (“why not divide both sides here?” / “what changes if the diagram flips?”) rather than “summarize the solution.” Densifies SAFE-GENERATE teach-back and SAFE-EXPLAIN (short principle + student construction).

**Kill:** “Explain the steps” as the only teach-back template.  
**Survive:** Inferential prompts that force repair and elaboration.

---

## CVI.5 Receiving help is not learning — constructive activity is

**FACT:** Webb, Troper, & Fall (1995, *Journal of Educational Psychology, 87*(3), 406–423, doi:10.1037/0022-0663.87.3.406) — in collaborative small groups, **constructive activity** (actively using received explanations to solve / explain) predicts learning beyond merely being told; help that is not applied to the problem at hand underperforms.

**FACT (helping continuum / math groups):** Webb (2002 / TIP line; see also Webb 1991 JRME review, *Journal for Research in Mathematics Education, 22*(5), 366–389, doi:10.5951/jresematheduc.22.5.0366) — level of elaboration of help given and received, and responsiveness to need, matter; answer-only help is weak; labeled conceptual/numerical explanations plus opportunity to apply them matter for posttest success.

**Applied (HYPOTHESIS):** After any peer/AI/tutor explanation in MindCraft, the next beat is **student construction on this item** (or a near transfer), not a green check for having heard the speech. Densifies SAFE-HELP / SAFE-HINT / SAFE-HWHELP (instrumental help → solo proof).

**Kill:** Listen-complete / watch-explain unlock without attempt.  
**Survive:** Explain → immediate apply → then delayed mix.

---

## CVI.6 Tutor ability grain: explanation quality is not evenly distributed

**FACT:** Fuchs, Fuchs, Karns, Hamlett, Dutka, & Katzaroff (1996, *American Educational Research Journal, 33*(3), 631–664, doi:10.3102/00028312033003631) — after training and sustained peer-tutoring practice, **high-achieving** peer tutors produced higher-rated conceptual, procedural, and overall explanations, used more explanatory strategies, scored higher on conceptual orientation, and produced better tutee performance than medium-achieving tutors tutoring the same classmate with a math learning disability.

**Applied (HYPOTHESIS):** Near-peer / community explain features need **content readiness + rubric**, not vibes. Densifies SAFE-TUTORGRAIN (hire/ops bar) and SAFE-HITL (QA on explanation quality). Do not assume any peer room raises FEI.

**Kill:** Open Discord “everyone teach everyone” as pedagogy.  
**Survive:** Matched explain tasks + QA codes; expert tutors for fragile joins.

---

## CVI.7 Actually explaining beats mere expectancy for durable learning

**FACT:** Fiorella & Mayer (2013, *Contemporary Educational Psychology, 38*(4), 281–288, doi:10.1016/j.cedpsych.2013.06.001) — preparing to teach can help immediate comprehension vs studying for a test, but **actually teaching** (generating the explanation) is critical for longer-term retention; expectancy alone is weaker after delay.

**Applied (FOUNDER BELIEF → testable):** MindCraft teach-back must require the **produced explanation act** (typed/spoken student artifact), not a “prepare to teach later” checkbox or an AI that speaks for them. Densifies SAFE-GENERATE (student produces; coach does not substitute).

**Kill:** Expectancy theater / “you’re the tutor today” badge without explain artifact.  
**Survive:** Captured building explanation + delayed `transfer_pass`.

---

## CVI.8 Link to SE, AI monologue, and talk-ratio

**HYPOTHESIS (product seam):** Knowledge-building peer/self explain is the same family as Chi-style self-explanation (Part XL) and Fiorella/Mayer generative teach (Part CII) — the enemy is the same as SAFE-EXPLAIN’s kill list: long provided monologues that steal the generative move. Talk-ratio instrumentation (SAFE-TALK) without a **building vs telling code** will reward airtime, not cognition.

**Contradiction to watch:** Over-structured explain rubrics can balloon germane+extraneous load or create compliance scripts (students paste template sentences). Red Team: if building prompts raise quit or lower delayed transfer vs short SE, simplify the rubric; keep the ban on telling-as-quality.

**Kill:** Talk-% / Explanation Score™ / AI essay teach-back.  
**Survive:** Sparse building moves + solo proof + HITL sample codes.

---

## CVI.9 Competitive contrast (mechanism lens)

| Competitor pattern | Mechanism | MindCraft counter |
|--------------------|-----------|-------------------|
| Discord study room / peer dump | Social presence ≠ building | Rubriced teach-back + solo gate |
| Teach-for-XP / explain streaks | Engagement theater | No XP for telling; FEI metrics |
| AI “tutor mode” monologue | Knowledge-telling at scale | Student produces; AI asks inferential Qs |
| Unlimited homework explain dump | Executive help without construction | SAFE-HWHELP dual-rail + apply beat |
| “We have peer tutors” brand | Cosplay without grain/QA | Fuchs grain + Roscoe codes in ops |

**Positioning line (FOUNDER BELIEF → copy test):** “Don’t recite the steps — build the why, then prove it alone.”

---

## CVI.10 Confidence matrix

| Claim | Label | Confidence | Notes |
|-------|-------|------------|-------|
| Peer tutors often show knowledge-telling bias; building is rarer than slogans imply | FACT | High | Roscoe & Chi 2007 |
| Reflective knowledge-building in tutor activity associates with better tutor learning | FACT | High | Roscoe & Chi 2007/2008 |
| Inferential tutee questions elicit more elaborative/metacognitive tutor responses | FACT | High (lab) | Roscoe & Chi 2008 |
| Constructive use of received help predicts learning beyond hearing help | FACT | High | Webb et al. 1995; Webb reviews |
| Higher-achieving peer tutors produce higher-quality math explanations and better tutee outcomes | FACT | High (trained classroom dyads) | Fuchs et al. 1996 |
| Actually teaching beats teaching-expectancy alone for delayed retention | FACT | High (lab grain) | Fiorella & Mayer 2013 |
| MindCraft building-gated teach-back raises `solo_transfer_pass` vs telling-only | HYPOTHESIS | Medium | Needs PEERX-* |
| Peer Explanation Score™ / Discord≡building improves identity | SPECULATION (reject) | — | Kill |

---

## CVI.11 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| PEERX-1 | Building teach-back (why/how + misconception) vs telling-only (“restate steps”) unlock | 2-arm | delayed `transfer_pass`; building-code rate; quit |
| PEERX-2 | Inferential coach questions vs summary prompts during teach-back | 2-arm | elaboration/metacog codes; tutor-or-student learning proxy; `solo_transfer_pass` |
| PEERX-3 | Explain→immediate apply on same item vs explain→next item without apply | 2-arm | post-item accuracy; hint binge; HELP co-gate |
| PEERX-4 | HITL QA with building-vs-telling rubric vs talk-% / warmth-only QA | Ops A/B | FEI per tutor-minute; tutee transfer; dependency |
| PEERX-5 | Near-peer matched explain (content-ready) vs open peer room without rubric | 2-arm | explanation quality ratings; tutee outcomes; harm/quit |
| PEERX-QUAL | 10 Maya + 5 tutors: when did “explain it” feel fake vs clarifying; template compliance | Qual | codebook: telling / building / shame / load |

**Falsifier:** Telling-only ≥ building prompts on delayed transfer with equal quit → demote building rubrics; keep ban on Peer Explanation Score™ and Discord≡pedagogy.  
**Falsifier:** Inferential prompts raise quit without transfer gain → shorten to one building move (SAFE-EXPLAIN length discipline).  
**Falsifier:** Open peer room ≥ rubriced teach-back on FEI → still require solo gate; Fuchs/Roscoe still constrain marketing claims.

**Pre-register:** PEERX-* before peer-tutoring splash, teach-for-XP, or “AI peer teacher” campaigns. Densify GENERATE/EXPLAIN/HELP/TUTORGRAIN/APPRENTICE — do not fork a peer-religion SKU.

---

## CVI.12 So what for MindCraft commercially

- **Copy:** “Build the why — then prove it alone.” Never Peer Explanation Score™, teach-for-XP, or “our Discord is the tutoring.”  
- **Product:** Teach-back requires ≥1 knowledge-building move; inferential coach questions; explain→apply beat; AI asks, student speaks; HITL codes building vs telling.  
- **Positioning:** Against peer-chat theater and AI monologue-as-teaching; for explanation quality that earns transfer.  
- **Metric:** Building-code rate, post-explain apply success, delayed `transfer_pass` / `solo_transfer_pass` — demote Teach Minutes / word-count / talk-%.  
- **Kill list:** Peer Explanation Score™; teach-for-XP; telling≡quality; Discord≡building; AI dump teach-back; unlock-without-solo; peer-tutoring ACT guarantees.  
- **Growth / vision:** Explanation is a **construction channel** for identity evidence, not a social or fluency costume.

---

## CVI.13 Doctrine — SAFE-PEERX (provisional)

1. **Building over telling** — explain acts must force monitor/integrate/elaborate/repair, not recite (Roscoe & Chi).  
2. **Inferential prompts** — ask why/how/what-if; do not default to “summarize the steps.”  
3. **Apply after explain** — constructive use of help is the learning event (Webb).  
4. **Capture the act** — student produces the explanation; expectancy badges and AI substitutes do not count (Fiorella & Mayer).  
5. **Grain + QA** — near-peer explain needs readiness and building-vs-telling codes (Fuchs; densifies SAFE-TUTORGRAIN/HITL).  
6. **Length stays load-honest** — densifies SAFE-EXPLAIN; no word-count quality.  
7. **Solo proof closes the loop** — densifies SAFE-GENERATE / SAFE-HELP / SAFE-PROOF.  
8. **No Peer Explanation Score™ / teach-for-XP / Discord≡pedagogy / AI-monologue≡peer teaching / ACT-from-peer-tutor ads**.

**Confidence:** High that knowledge-telling bias is the default and that building moves + constructive application are the evidenced levers. Medium that SPA teach-back rubrics will raise delayed transfer without quit — instrument PEERX-* before peer-tutoring marketing. High confidence to kill Peer Explanation Score™, teach-for-XP, and Discord≡building regardless.

---

## References (verified)

- Fiorella, L., & Mayer, R. E. (2013). The relative benefits of learning by teaching and teaching expectancy. *Contemporary Educational Psychology, 38*(4), 281–288. https://doi.org/10.1016/j.cedpsych.2013.06.001  
- Fuchs, L. S., Fuchs, D., Karns, K., Hamlett, C. L., Dutka, S., & Katzaroff, M. (1996). The relation between student ability and the quality and effectiveness of explanations. *American Educational Research Journal, 33*(3), 631–664. https://doi.org/10.3102/00028312033003631  
- Roscoe, R. D., & Chi, M. T. H. (2007). Understanding tutor learning: Knowledge-building and knowledge-telling in peer tutors’ explanations and questions. *Review of Educational Research, 77*(4), 534–574. https://doi.org/10.3102/0034654307309920  
- Roscoe, R. D., & Chi, M. T. H. (2008). Tutor learning: The role of explaining and responding to questions. *Instructional Science, 36*(4), 321–350. https://doi.org/10.1007/s11251-007-9034-5  
- Webb, N. M. (1991). Task-related verbal interaction and mathematics learning in small groups. *Journal for Research in Mathematics Education, 22*(5), 366–389. https://doi.org/10.5951/jresematheduc.22.5.0366  
- Webb, N. M., Troper, J. D., & Fall, R. (1995). Constructive activity and learning in collaborative small groups. *Journal of Educational Psychology, 87*(3), 406–423. https://doi.org/10.1037/0022-0663.87.3.406  
