# Part LVII — Chess Annotation & Metacognition: Postmortem UX Without Grandmaster Cosplay

**Chapter status:** Living evidence brief — Researcher tick 2026-08-01 (UTC hour 03; hour%6≠0; 7 researcher entries since synthesizer v1.7 → Researcher)  
**Primary question:** What transferable design does chess *annotation / postmortem* offer for MindCraft’s after-attempt metacognition — student-generated explanation of critical positions, error classification into next drills, analysis of wins as well as losses — without grandmaster cosplay, engine-eval floods, or rating-as-identity?  
**Owners:** Product (Practice debrief / Solver review / Notes) · Coach UX · ML soft-wrong → drill loop · Brand & copy · Red Team  
**Commercial job:** Ship a **SAFE-ANNOT** stack — annotate before reveal, self-explain critical moves, classify → next drill, analyze successes not only failures — while killing “think like a GM,” engine dump ≡ coaching, and games-played/rating as learning proof.

---

## LVII.1 Why this chapter exists

Parts LIV–LVI borrowed *session close* (SAFE-AAR), *review media* (SAFE-FILM), and *ladder architecture* (SAFE-MUSIC) from adjacent high-performance domains. Chess is the classic cognitive-science laboratory for **move choice under uncertainty** and for **post-game annotation** as deliberate learning — the closest analogue to MindCraft’s “attempt → review → next weak bridge” loop.

Competitors already fake the chess metaphor poorly: ChatGPT tutors monologue the “best line”; puzzle apps spam tactics without annotation; Duo/Khan celebrate streaks and accuracy without a student-authored postmortem. MindCraft’s soft-wrong science (SAFE-MISCON), hide-correctness diagnostic (SAFE-CALIB), and coach self-explanation doctrine (Part XL / SAFE-SE) need a **postmortem UX law** that is evidence-shaped, not chess-club branding.

**FOUNDER BELIEF under audit:** Mathematical identity grows when learners *annotate their own critical attempts* — name what they saw, why they chose, what principle failed — then convert that into one next drill, not when an engine or LLM floods them with better answers.

**Claims we refuse as doctrine:**
1. Grandmaster / “think like a master” branding as efficacy or belonging.  
2. Engine evaluation bars / tip floods labeled as “annotation.”  
3. Games played, rating, streaks, or puzzle counts as North Star mastery.  
4. Loss-only shame review (never annotate wins / successful strategies).  
5. Novice JOLs / vague “how well did you understand?” without forced restudy of critical moves.  
6. AI postmortem as automatically closing skill gaps (self-selection wound).

---

## LVII.2 Constructs (product language)

| Construct | Chess meaning | MindCraft analogue | Failure mode if misused |
|-----------|---------------|--------------------|-------------------------|
| **Critical position** | Branch point where evaluation swings | Soft-wrong item; bridge fail; timed blunder | Annotating every move → exhaustion |
| **Annotation / postmortem** | Written/verbal account of thought at critical nodes | Student-first debrief after attempt/session | Engine dump before student speech |
| **Candidate moves** | Alternatives considered before choice | Alternative strategies / formats considered | Fake multiple-choice theater |
| **Self-explanation** | Why this move / principle applies | Chi/Renkl-style why-prompts (Part XL) | “Explain” that restates the tip |
| **Engine / AI feedback** | Stockfish-style eval after human thought | Coach card / model solution *after* annotate | Reveal-first collapses generation |
| **Template / chunk** | Pattern recognition structures in LTM | Ingredient / archetype recognition | “Memorize more patterns” vanity |
| **SAFE-ANNOT** | Postmortem doctrine that survives cosplay / flood / rating kills | See LVII.9 | Chess branding; eval bars as pedagogy |

**Operational definition (HYPOTHESIS):** A MindCraft review counts as *SAFE-ANNOT* when (a) the learner generates explanation of **1–3 critical attempts before** correctness/model reveal, (b) annotation names a **principle or misconception family** (not vibes), (c) the loop ends in a **linked next drill** (motif → ingredient set), (d) wins/successes are eligible for annotation (not only failures), (e) engine/LLM text never substitutes for student generation, (f) branding borrows the *method*, not grandmaster mythology.

---

## LVII.3 de Groot — verbal protocols are the annotation prototype

**FACT:** Adriaan de Groot’s classic work (*Het denken van den Schaker*, 1946; English *Thought and Choice in Chess*, 1965/1978, Mouton / Amsterdam University Press lineage) collected **thinking-aloud protocols** from players of varying strength (including masters and world champions) who were asked to choose a move in unfamiliar tournament positions *as if in a real game*, verbalizing plans, calculations, and considerations. The object was the **choice-of-move problem**, not whole-game biography.

**FACT (structure):** de Groot described phases of chess thought commonly summarized as orientation → exploration → investigation → proof (see secondary summaries in the chess-programming / cognitive literature citing de Groot). Expertise showed up less as “search farther on every branch” in the original macrostructure story, and more as **better initial perception and selection of what to investigate**.

**Wound (citation hygiene):** Bilalić, McLeod & Gobet (2008, *Cognitive Science* line / “Sixty years of citing de Groot”) document that textbooks often **misreport** de Groot as “experts and novices search identically.” Later replications find additional search-structure differences. Product implication: do **not** market “masters don’t calculate more — they just see” as a slogan that excuses skipping hard work *or* as a claim that MindCraft’s annotation UI replicates grandmaster perception.

**Product implication:** Annotation UX = structured verbalization at critical nodes (what did you notice → candidates → why this choice → what would falsify it), not a vibes journal. Aligns SAFE-AAR question spine and Part XL self-explanation prompts.

---

## LVII.4 Chunks and templates — recognition scaffolds search (not “genius”)

**FACT:** Chase & Simon (1973) chunking theory — experts recall meaningful game positions far better than novices; advantage collapses on random boards — grounded expertise in **pattern memory**, not mystical IQ (classic result; see also Gobet & Simon extensions).

**FACT:** Gobet & Simon’s **template theory** (e.g. Gobet & Simon, 1996; Gobet, 1998 *Cognition* comparison of expert-memory theories) proposes that recurring chunks evolve into richer templates with slots — unifying low-level chunks with higher-level schematic knowledge. Gobet (2005) notes deliberate practice matters because unsupervised “just play” can acquire **irrelevant** chunks that fail to improve (or even hinder) performance.

**Commercial implication:** MindCraft “annotation” should cue **ingredient/archetype recognition** (“which pattern is this?”) before deep calculation monologues. Kill copy that says students must “think like Kasparov.” Survive: pattern labels tied to ontology IDs after student attempt.

**Kill:** Genius branding. Kill: unstructured blitz-volume as chunk building. Survive: deliberate attention to the patterns that matter (SAFE-DP).

---

## LVII.5 Self-explanation beats prediction-only for chess novices

**FACT:** de Bruin, Rikers & Schmidt (2007, *Contemporary Educational Psychology*, 32(2), 188–205, doi:10.1016/j.cedpsych.2006.01.001) — novices learning a King+Rook vs King endgame. Conditions: observe computer moves; predict next move; **predict + self-explain**. Self-explanation condition showed better principled understanding (predictions applying endgame principles) and more often checkmated in the test phase. Prediction alone did **not** beat observation.

**HYPOTHESIS for MindCraft:** Postmortem prompts must force **why/principle language**, not mere “what would you play next?” prediction clicks. This is the chess-domain replication of Chi/Renkl SE doctrine already in Part XL — use it to harden coach UX after attempts.

**Kill:** Silent engine scrubbing. Kill: “tap the best move” prediction theater without explanation. Survive: annotate-why before reveal.

---

## LVII.6 Novice metacognition is fragile — JOLs can fail; forced restudy helps

**FACT:** de Bruin, Rikers & Schmidt (2005, *Applied Cognitive Psychology*, 19(2), 167–181, doi:10.1002/acp.1109) — novice chess endgame learning with judgments of learning (JOLs) and move selection for restudy. Forced selection of moves for restudy improved learning vs free selection (even controlling for number restudied). Providing JOLs showed better *self-regulatory behavior* on some measures but **no or negative** performance benefit vs no-JOL — authors argue JOLs may place high ineffective load on novice working memory.

**FACT:** de Bruin, Rikers & Schmidt (2007, *European Journal of Cognitive Psychology* / related metacomprehension skill-acquisition paper, doi:10.1080/09541440701326204) — experienced chess players showed higher metacomprehension accuracy and self-regulation than novices when learning an endgame; novice absolute accuracy near zero. Expertise affects monitoring quality in skill domains.

**Product implication:** Do not ship bare confidence sliders as “metacognition” for Maya-novices (also SAFE-CALIB wound). Prefer **forced critical-move restudy** + principle annotation. Gate fancy monitoring UI by expertise / after scaffolding.

**Kill:** “Rate your understanding 1–5” as the whole postmortem. Survive: select 1–3 critical items → explain → restudy linked drill.

---

## LVII.7 Analyzing games beats mere volume — and wins matter

**FACT (observational, large-N):** Yiannakoulias (2026, *Simulation & Gaming*, doi:10.1177/10468781261443352) — ~2M online blitz games / ~2.1k active Lichess players (1600–1800 band). Computer-assisted game analysis positively associated with rating improvement; **analyzing wins** showed a clearer association than analyzing losses in main models; total games played only weakly associated. Authors stress measurement noise (analysis flag is blunt; biases toward null) and exploratory observational status — not an RCT.

**HYPOTHESIS:** MindCraft should prompt annotation on **successful hard items** and efficient solutions (Dowrick-adjacent feedforward / SAFE-FILM success clips), not only on failures — “study your brilliancies” as well as soft-wrongs. Loss-only review risks ostrich/shame dynamics the paper discusses via adjacent feedback literature.

**Wound:** Associational evidence ≠ “annotation raises ACT.” Claim ladder stays L1 for chess rating deltas; MindCraft transfer needs ANNOT experiments.

**Kill:** “Play more puzzles” as improvement doctrine. Kill: failure-only shame reels. Survive: reflective analysis of critical successes and failures.

---

## LVII.8 AI / engine feedback — self-selection and fluency wounds

**FACT / high-relevance wound:** Riedl & Bogert (2024/2026 update, arXiv:2409.18660) — 5+ years, ~52k individuals on an online chess platform with optional AI game analysis. Motivated and higher-skilled players **self-select** into AI feedback and use it more productively; apparent learning gains can be an **illusion of AI effectiveness** once endogenous motivation is accounted for; AI access can **widen skill gaps**; centralized AI feedback can reduce intellectual diversity (supported via platform natural experiments in the paper).

**Aligns:** Part XXXIII AI trust/sycophancy — fluent eval bars are not pedagogy; overtrust risk. SAFE-FILM less-is-more; SAFE-AAR facilitation not lecture.

**Product implication:** Optional “engine” / model solution is a **second pass** after student annotation. Do not market auto-analysis as closing equity gaps. Instrument who seeks postmortem help (selection bias).

**Kill:** “AI reviews every game so everyone improves equally.” Kill: reveal-first Stockfish cosplay in Solver. Survive: human-first annotation → sparse model contrast → one drill.

---

## LVII.9 SAFE-ANNOT stack (product law)

1. **Student annotates first** — 1–3 critical attempts before correctness / coach / model reveal.  
2. **Prompt for principles** — why/candidates/what would change your mind (de Groot structure + de Bruin SE).  
3. **Forced restudy selection** for novices — don’t rely on raw JOLs (de Bruin 2005).  
4. **Classify → next drill** — motif/misconception → ingredient set (close the loop; not insight theater).  
5. **Annotate wins too** — successful strategies and hard-earned corrects (Yiannakoulias).  
6. **Sparse AI second pass** — contrast, don’t replace; watch self-selection (Riedl & Bogert).  
7. **Pattern labels after attempt** — chunks/templates as ontology tags, not genius myths (Chase/Simon; Gobet).  
8. **Anti-cosplay** — borrow postmortem method, not “grandmaster academy” brand (SAFE-RITUAL / SAFE-MUSIC pattern).  
9. **Stack** — SAFE-AAR close, SAFE-FILM clip, SAFE-MISCON soft-wrong, SAFE-SE prompts, SAFE-CALIB tiers.  
10. **Claim ladder** — chess evidence = L1 domain; MindCraft ACT/identity claims need ANNOT-* experiments.

---

## LVII.10 Competitive audit — who runs a real postmortem?

| Competitor | Annotation? | Student generation first? | Loop to next drill? | Failure mode |
|------------|-------------|---------------------------|---------------------|--------------|
| Khan | Hints/explanations | Often reveal/explain-first | Weak systematic soft-wrong→drill | Explanation flood |
| Duo | Minimal | No | Streak/XP loop | Quantity liturgy |
| Brilliant | Aha rationales | Partial | Weak exam transfer proof | Insight without postmortem habit |
| ChatGPT tutor | Fluent postmortem monologue | Usually model-first | Rare durable drill link | Sycophancy; fluent wrongness |
| Chess.com / Lichess | Engine analysis UX | Optional; often engine-first | Puzzle motifs if user closes loop | Eval bars; self-selection |
| Human tutor | Variable verbal postmortem | Often strong | Variable | Unscalable; shame risk |

**Commercial implication:** Position MindCraft as **annotate → classify → drill** — “replay the critical move in your own words, then train the hinge” — never “AI grandmaster reviews your session.” Parent copy: reflection quality and linked practice, not games played. Student copy: “name the mistake / name the win, then one next rep.”

---

## LVII.11 Claim ladder

| Claim | Max ladder without new data |
|-------|------------------------------|
| de Groot: verbal protocols reveal structured move-choice thought | L1 (classic methods) |
| Chase/Simon + Gobet/Simon: expertise tied to chunks/templates, not mysticism | L1 |
| Self-explanation + prediction > prediction/observation for chess-novice principles | L1 (de Bruin et al., 2007 CEP) |
| Forced restudy selection helps novices; JOLs can fail/overload | L1 (de Bruin et al., 2005 ACP) |
| Metacomprehension accuracy rises with chess expertise in skill learning | L1 (de Bruin et al., 2007 EJCP) |
| Game analysis associated with rating gains; play volume weak; wins analysis salient | L1 observational (Yiannakoulias, 2026) |
| AI feedback gains partly selection; can widen gaps / reduce diversity | L1 observational + natural experiments (Riedl & Bogert) |
| SAFE-ANNOT improves MindCraft transfer / identity vs reveal-first UX | L1 product bet — needs ANNOT experiments |
| “Grandmaster methods” / engine dumps raise ACT undifferentiated | **Banned** |
| Rating / streak / games-played as mastery North Star | **Banned** |

---

## LVII.12 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| ANNOT-1 | Annotate-before-reveal vs reveal-first coach | 2-arm | `retry_120s`; principle-coded annotation quality; week-later transfer | Reveal-first ≥ annotate on transfer → annotation is friction |
| ANNOT-2 | SE-why prompts vs prediction-only taps | 2-arm | principled language rate; next-drill completion | Prediction ≥ SE on transfer → simplify |
| ANNOT-3 | Forced 2 critical restudies vs free JOL-only | 2-arm | restudy adherence; transfer | JOL-only ≥ forced on transfer *and* affect → revisit |
| ANNOT-4 | Annotate wins+losses vs losses-only | 2-arm | return rate; self-belief; strategy reuse | Losses-only ≥ mixed on learning without shame cost → still prefer mixed ethically |
| ANNOT-5 | AI second-pass on vs off after annotation | 2-arm | overtrust incidents; transfer; time-to-drill | AI-on hurts calibration or transfer → default off for novices |
| ANNOT-QUAL | 10 Maya: does “postmortem / annotate” language feel clarifying or chess-elitist? | interview | coded: clarifying / cosplay / shame | Chess words → plain “replay the hard step” |

**Pre-reg (XXXIV):** ANNOT-* identify **postmortem architecture** — not “chess training raises ACT” or grandmaster-identity myths.

---

## LVII.13 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| de Groot protocols established structured verbal move-choice analysis | FACT | High |
| Chunk/template accounts dominate expert chess memory explanations | FACT | High |
| de Bruin 2007: SE helps chess novices discover principles | FACT | High |
| de Bruin 2005: forced restudy > free; JOLs shaky for novices | FACT | High |
| Expertise improves metacomprehension in chess skill learning | FACT | Medium–High |
| Yiannakoulias: analysis↔rating; play volume weak (observational) | FACT (assoc.) | Medium |
| Riedl & Bogert: AI feedback self-selection / gap / diversity wounds | FACT (platform) | Medium–High |
| Chess postmortem transfers cleanly to anxious ACT teens’ identity | HYPOTHESIS / wounded | Low–Medium |
| SAFE-ANNOT is right default review metaphor for MindCraft | FOUNDER BELIEF / HYPOTHESIS | Medium |
| Grandmaster cosplay / engine-first dumps improve belonging or scores | SPECULATION / false as doctrine | Low (against) |

---

## LVII.14 What this chapter kills

1. **Kill:** Grandmaster / “think like a master” branding as efficacy or belonging.  
2. **Kill:** Engine-eval floods and LLM monologues labeled as annotation or coaching.  
3. **Kill:** Games played, rating, streaks, or puzzle counts as North Star mastery.  
4. **Kill:** Loss-only shame review; never studying successful critical decisions.  
5. **Kill:** Bare JOLs / confidence sliders as sufficient metacognition for novices.  
6. **Kill:** “AI analyzes every attempt so gaps close equally” (selection + diversity wound).  
7. **Wound:** Textbook oversimplification of de Groot search findings; don’t sloganize perception.  
8. **Survive:** SAFE-ANNOT; annotate-before-reveal; SE principles; forced critical restudy; classify→drill; annotate wins; sparse AI second pass; ANNOT-1…5.

**Doctrine until data:** Ship **SAFE-ANNOT** — student-generated postmortem on critical attempts, principle-tagged, linked to the next drill, stacked on SAFE-AAR / SAFE-FILM / SAFE-SE / SAFE-MISCON — and never sell chess mythology, engine bars, or volume metrics as the transformation engine.
