# Part L — Confidence Calibration: Over/Underconfidence, Hide-Correctness, and Honest Self-Knowledge

**Chapter status:** Living evidence brief — Researcher tick 2026-07-31 (UTC hour 06 ≡ Red Team slot, but ch50 never written → prefer Researcher per rotation; 0 researcher entries since synthesizer v1.7)  
**Primary question:** How should MindCraft treat student *confidence* — as a vibe to inflate, a score to gamify, or a *calibrated signal* that drives feedback, graph updates, and identity-safe diagnostics?  
**Owners:** Product (Diagnostic C4 / soft-wrong / confidence UX) · Engine (evidence_update_policy / confidence tiers) · Marketing claim ladder · Red Team  
**Commercial job:** Ship a **SAFE-CALIB** stack — elicit confidence → classify miss type → destake → recalibrate without inflation theater → tier feedback → measure `confidence_miss_tier` — kill “raise confidence” as North Star and “how sure?” without routing.

---

## L.1 Why this chapter exists

The research question of this Constitution is how humans become *confident mathematical thinkers*. That phrase is dangerous if “confident” means louder, happier, or more certain. The commercial and scientific load-bearing meaning is **calibrated competence**: knowing when you know, knowing when you do not, and updating both skill and self-appraisal under informative misses.

Parts XXV (self-efficacy), XXX (attribution), XXXIII (AI overtrust), XLIX (SAFE-MISCON / hypercorrection), and the v1.7 metric `confidence_miss_tier` already point here. What was missing was a chapter that (a) defines calibration rigorously, (b) separates over- from underconfidence product responses, (c) ties C4 hide-correctness to metacognitive hygiene, and (d) refuses confidence theater as marketing.

**FOUNDER BELIEF under audit:** Identity as a mathematical thinker includes *honest self-knowledge* — not perpetual certainty, and not chronic self-doubt dressed as humility.

**Claims we refuse as doctrine:**
1. Raise confidence = improve learning (always).  
2. Confidence meters / “Belief Score™” as identity North Stars.  
3. Asking “how sure?” without changing feedback, routing, or graph updates.  
4. Hide-correctness = never teaching answers.  
5. Dunning–Kruger as a meme that justifies shaming low performers.  
6. Instant correctness reveal as the only path to calibration.

---

## L.2 Constructs (product language)

| Construct | Plain definition | Product signal | Failure mode if misused |
|-----------|------------------|----------------|-------------------------|
| **Calibration** | Match between stated confidence and empirical accuracy across items | Confidence × correctness curves; bias & absolute accuracy indices | One-item “I feel sure” = calibrated |
| **Overconfidence** | Confidence systematically exceeds accuracy | High-conf wrongs; skipped review; false mastery | Shame the student; ignore hypercorrection opportunity |
| **Underconfidence** | Accuracy exceeds confidence | Correct + low conf; stuck on secure content | Force “believe harder” posters; skip challenge progression |
| **Confidence of response** | Certainty that *this* answer is correct (item-level) | 0–10 or low/med/high next to answer | Global “math confidence” survey only |
| **Hide-correctness (C4)** | Record outcome; defer or withhold key reveal in diagnostic | Gap-scan / FEI probes | Never-teach-answers slogan; corrupt key theater |
| **SAFE-CALIB** | Calibration doctrine that survives evidence | See L.8 | Confidence gamification; inflation theater |

**Operational definition (HYPOTHESIS):** MindCraft treats calibration as a *session and graph* property when (a) item-level confidence is elicited on diagnostic and soft-wrong paths, (b) high-conf misses trigger attended corrective / springboard sequences, (c) low-conf corrects unlock challenge progression rather than endless drill, (d) mastery updates weight miss type (guess ≠ confident misconception), and (e) marketing claims stay at L0–L1 until CAL experiments report.

---

## L.3 Calibration science — what “well calibrated” means

**FACT (definition):** Lichtenstein & Fischhoff (1977, *Organizational Behavior and Human Performance*, 20, 159–183; classic line) and Fischhoff, Slovic & Lichtenstein (1977, *Journal of Experimental Psychology: Human Perception and Performance*, 3(4), 552–564, doi:10.1037/0096-1523.3.4.552) — a judge is well calibrated if, over the long run, for propositions assigned probability *p*, the proportion true ≈ *p*. Extreme certainty is routinely *inappropriate*: people are wrong too often when they feel certain.

**FACT (bias pattern):** Across general-knowledge and many educational tasks, the dominant bias is **overconfidence**, especially when accuracy is near chance; as accuracy rises, overconfidence often shrinks and underconfidence can appear at high accuracy (Lichtenstein & Fischhoff, 1977 summary pattern; replicated in educational monitoring work).

**FACT (measurement plurality):** Lingel, Lenhart & Schneider (2019, *ZDM*, metacognitive monitoring in mathematics — ERIC EJ1222655) — absolute accuracy, relative accuracy (e.g. Gamma), and diagnostic sensitivity/specificity are *not interchangeable*. Method choices change conclusions. Seventh-graders showed **pervasive overconfidence**; retrospective judgments and some scale formats improved monitoring precision vs prospective.

**Product translation:** MindCraft should log item-level confidence + correctness and report **bias** (over/under) and **discrimination** (does higher confidence predict correctness?) separately. Do not ship a single “Calibration %” vanity metric parents can misunderstand.

**Kill:** One glamorous calibration number as growth KPI. Survive: `confidence_miss_tier` + bias curves for product learning, not for public leaderboards (SAFE-COMPARE).

---

## L.4 Overconfidence, underconfidence, and the dual commercial problem

**FACT (school math overconfidence):** García, Rodríguez, González-Castro, González-Pienda & Torrance (2016, *Metacognition and Learning*; ERIC EJ1105998) — elementary students solving math problems were poorly calibrated and tended toward **overconfidence**; inaccurate calibrators differed in reported metacognitive process use.

**FACT (ability × miscalibration):** Kruger & Dunning (1999, *Journal of Personality and Social Psychology*, 77(6), 1121–1134, doi:10.1037/0022-3514.77.6.1121) — bottom-quartile performers on humor/grammar/logic tasks grossly overestimated ability; incompetence can impair the metacognitive skill needed to recognize incompetence. Improving skill can improve self-appraisal.

**Wound (popular DK):** The meme version (“stupid people are always overconfident”) overclaims, ignores regression-to-the-mean critiques, and invites product cruelty. Use as **FACT** about *metacognitive dual burden in low skill*, not as a brand insult toward Maya.

**FACT (underconfidence is also costly):** Foster’s CA program (Foster, 2016, *Educational Studies in Mathematics*, 91(2), 271–288, doi:10.1007/s10649-015-9660-9; Foster, 2016, *Mathematics Teaching*, 251, 11–13; Centre for Mathematical Cognition summary) — underconfidence can reduce satisfaction, block progression to harder material, and trap students in repetitive secure practice; overconfidence can embed uncorrected errors and complacency. Pedagogical aim is **appropriate** confidence, not maximal confidence.

**HYPOTHESIS for MindCraft:** Overconfident Maya needs destaked confrontation + springboard (SAFE-MISCON + hypercorrection). Underconfident Maya needs earned-win evidence and challenge unlocks (FEI), not pep talks. One “confidence booster” feature cannot serve both.

**Kill:** “We build confidence” as undifferentiated slogan. Survive: “confidence that matches skill” / “know what you know.”

---

## L.5 Confidence assessment in classrooms — promise and null on attainment

**FACT (CA mechanism):** Confidence assessment asks students to rate certainty alongside each answer; scoring that rewards correct high-confidence and penalizes incorrect high-confidence (and also punishes under-reporting when correct) incentivizes *truthful* ratings (Foster, 2016; Gardner-Medwin line in HE). Aim includes discouraging guess-and-hope.

**FACT (student acceptability):** Foster (2016 ESM) — secondary students can make usable confidence judgments on procedures; generally positive about CA in short trials.

**FACT (null on summative attainment — load-bearing contradiction):** Foster (2021/2022, *International Journal of Science and Mathematics Education*, 20, 1411–1429, doi:10.1007/s10763-021-10207-9) — quasi-experimental CA across four secondary schools (N = 475), meta-analytic Cohen’s *d* ≈ −0.02 [95% CI −0.22, 0.19], Bayes factor favoring null on attainment gains vs controls. Conclusion: incorporating CA into low-stakes formative assessments does **not** appear detrimental — and also does **not** show a clear positive attainment effect from CA alone.

**Commercial implication (critical):** Shipping a “how sure?” widget is cheap and marketable. Evidence says **CA alone is not an attainment engine**. MindCraft’s wedge is not novelty CA — it is CA **wired** to soft-wrong routing, misconception maps, confidence-tiered feedback, and graph policy. Competitors can copy a confidence slider; they rarely ship the spine.

**HYPOTHESIS:** MindCraft CA improves *process metrics* (retry, misconception route hit, delayed isomorphic correction after high-conf miss) before it moves ACT scores. Claim ladder: process L1 first; attainment L2+ only after CAL + MIS experiments.

**Kill:** Marketing “confidence assessment raises grades.” Survive: CA as diagnostic fuel + metacognitive prompt, non-inferior on attainment per Foster 2021, valuable when coupled to FEI/SAFE-MISCON.

---

## L.6 Hypercorrection, contradicting reasons, and feedback design

**FACT (hypercorrection):** Butterfield & Metcalfe (2001, *JEP:LMC*, 27(6), 1491–1494, doi:10.1037//0278-7393.27.6.1491) — high-confidence errors more often corrected after feedback than low-confidence errors.

**FACT (math diagnostics):** Foster, Woodhead, Barton & Clark-Wilson (*Educational Studies in Mathematics*, doi:10.1007/s10649-021-10084-7) — authentic online math diagnostic data show hypercorrection-consistent patterns; confidence assessment can prompt reflection.

**FACT (debiasing via contradicting reasons):** Koriat, Lichtenstein & Fischhoff (1980, *Journal of Experimental Psychology: Human Learning and Memory*, 6(2), 107–118) — listing reasons *against* the chosen answer improved appropriateness of confidence; supporting reasons alone did not. Confidence tracks strength of supporting evidence; people neglect disconfirming evidence unless prompted.

**Product translation:**
1. After high-conf miss → attended feedback + micro-conflict / “why might this be wrong?” (SE + Koriat) before fluent AI monologue (PWC / XXXIII).  
2. After low-conf miss → scaffold/hug first (SAFE-DD), then lighter confrontation.  
3. After low-conf correct → show competence evidence; invite slightly harder item (underconfidence unlock).  
4. C4 hide-correctness during gap-scan: elicit confidence + answer; **defer** key reveal so the session stays diagnostic, not answer-hunting — then use purposeful reveal in practice springboards (XLIX).

**Kill:** Uniform instant red/green for every miss. Survive: confidence-tiered reveal + contradicting-reason prompt (aligns MIS-3).

---

## L.7 Hide-correctness, AI trust, and graph integrity

**FOUNDER BELIEF:** C4 exists because revealing keys mid-diagnostic can spike threat, turn FEI into answer theater, and (if keys are wrong) poison trust. Recording outcomes without reveal preserves graph honesty for weakness ranking (C1).

**HYPOTHESIS:** Calibration *improves* when students later reconcile confidence with delayed feedback in a destaked springboard — not when every item is a public gotcha.

**Link to XXXIII:** Fluent AI tutors create **overtrust** (calibration failure toward the *system*). Student self-appraisal and AI-skepticism are sibling problems.

**Layer-4 alignment:** Confidence tiers operationalize `evidence_update_policy` — high-conf wrong → stronger misconception evidence; low-conf wrong → weaker / “uninformed” path.

**Kill:** Equal mastery deltas for all wrongs; “we never teach the answer.” Survive: purposeful reveal; confidence-weighted updates; AI wrap after student generation.

---

## L.8 SAFE-CALIB stack (ship rule)

1. **Elicit** — Item-level confidence on diagnostic and on soft-wrong / challenge items (not only global surveys).  
2. **Classify** — Correct/incorrect × low/med/high → miss classes (guess, slip, confident misconception, underconfident correct).  
3. **Destake** — Soft-wrong / mastery climate; never public-shame high-conf wrongs; no streak punishment for honest low confidence.  
4. **Recalibrate** — Show mismatch privately (“sure + wrong” or “unsure + right”) as information, not identity verdict.  
5. **Tier feedback** — Hypercorrection path for high-conf miss; hug-then-dose for low-conf miss; unlock challenge after underconfident correct.  
6. **Prompt against** — One contradicting reason / “where does this break?” before answer dump (Koriat).  
7. **Measure** — `confidence_miss_tier`, calibration bias Δ, high-conf miss correction @ delay, underconf→challenge_accept — not Belief Score™ or confidence streaks.

**Marketing language that survives:** “Know what you know,” “confidence that matches skill,” “wrong answers that teach,” “honest diagnostics.”  
**Marketing language that dies:** “We raise confidence,” “believe in yourself” as product, Confidence League ranks, “never say you’re wrong,” CA-raises-grades claims without data.

---

## L.9 Competitive wedge (brief)

Duo (binary + streaks), Khan (explain-first), Brilliant (scaffold dopamine), and ChatGPT tutors (fluent certainty → overtrust) all fail *calibration* differently. MindCraft’s L1-safe line: not louder confidence — **earned, calibrated** confidence that survives a format hop (solo transfer + confidence on unaided items + PWC).

---

## L.10 Claim ladder

| Claim | Max ladder without new data |
|-------|------------------------------|
| Item-level CA is usable with teens and non-inferior on attainment vs BAU | L1 (Foster 2016; 2021 null) |
| High-conf misses deserve different feedback than low-conf misses | L1 (hypercorrection literature) |
| Contradicting-reason prompts improve confidence appropriateness | L1 (Koriat et al., 1980) |
| C4 hide-correctness improves weakness ranking quality + affect vs reveal-as-you-go | L1 product bet (MIS-4 / CAL-4) |
| Confidence-tiered graph updates beat equal-wrong updates | L1 |
| CA alone raises summative math attainment | **Banned** pending contrary RCT (Foster 2021 against) |
| Calibrated confidence → identity as mathematical thinker | L3 — ban until transfer + identity instruments |

---

## L.11 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| CAL-1 | Confidence-tiered feedback vs uniform instant key | 2-arm | high-conf miss correction @ 48h; `retry_120s` | Uniform ≥ tiered → tiering unjustified |
| CAL-2 | Contradicting-reason prompt vs explain-correct-only after miss | 2-arm | calibration bias Δ; next isomorphic accuracy | Explain-only ≥ prompt → Koriat UX overstated for app |
| CAL-3 | Underconfident-correct → challenge unlock vs more secure drill | 2-arm | `challenge_accept`; later accuracy | Drill ≥ unlock on growth → underconf policy wrong |
| CAL-4 | Hide-correctness diagnostic vs reveal-as-you-go (shared with MIS-4) | 2-arm | completion; affect; `worstWeakness` stability | Reveal wins on weakness + affect → C4 overstated |
| CAL-5 | Confidence-weighted mastery updates vs equal-wrong updates | 2-arm offline / sim + online | prediction of next-session accuracy | Equal ≥ weighted → engine complexity unjustified |
| CAL-QUAL | 10 Maya interviews: meaning of “sure” / shame after high-conf miss | interview | coded: threat vs curiosity; wants reveal when? | Students refuse confidence UX → redesign elicit |

**Pre-reg (XXXIV):** CAL-* identify **confidence × feedback / update design**. They do **not** identify “raising confidence causes identity.”

**Densifies:** MIS-3/4; C4; Layer-4 evidence policy; XXV self-efficacy; XXXIII AI overtrust; metric `confidence_miss_tier`.

---

## L.12 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| Calibration = long-run match of confidence to accuracy (Fischhoff/Lichtenstein line) | FACT | High |
| Overconfidence is common; extreme certainty often unwarranted | FACT | High |
| School math students often poorly calibrated / overconfident (García et al.; Lingel et al.) | FACT | High |
| DK dual burden for low skill is real; meme uses are overstated | FACT / WOUND | Medium–High |
| CA usable + non-inferior attainment; not a proven attainment booster alone (Foster 2016; 2021) | FACT | High |
| Hypercorrection after high-conf errors (Butterfield & Metcalfe; Foster et al.) | FACT | High |
| Contradicting reasons improve confidence appropriateness (Koriat et al., 1980) | FACT | High |
| SAFE-CALIB is right default for MindCraft diagnostic / soft-wrong / graph | FOUNDER BELIEF / HYPOTHESIS | Medium–High |
| Raise-confidence marketing transforms identity | SPECULATION / false as doctrine | Low (against) |

---

## L.13 What this chapter kills

1. **Kill:** “Raise confidence” as undifferentiated North Star or brand promise. (Foster: appropriate confidence; under- and over- both hurt.)  
2. **Kill:** Confidence meters, Belief Score™, or confidence streaks as identity engines. (SAFE-COMPARE / SAFE-HABIT alignment.)  
3. **Kill:** “How sure?” UI without tiered feedback, routing, or update policy. (Foster 2021 null on CA-alone attainment.)  
4. **Kill:** CA / confidence assessment marketed as raising grades without new evidence.  
5. **Kill:** Equal graph updates for guess vs high-confidence misconception.  
6. **Kill:** Hide-correctness as “we never teach answers.”  
7. **Kill:** Dunning–Kruger shaming as brand voice.  
8. **Wound:** Classroom CA ≡ app CA; HE medical CA ≡ HS math. Survive as: elicit + truthful incentive design + wired spine, not worksheet cosplay.  
9. **Survive (constrained):** Item-level confidence; SAFE-CALIB stack; hypercorrection-aware feedback; underconfidence unlocks; CAL-1…5; coupling to SAFE-MISCON.

**Doctrine until data:** Ship **SAFE-CALIB**: treat confidence as a diagnostic signal for honest self-knowledge and differential pedagogy — never as a vibe to inflate, a league to rank, or a substitute for FEI evidence.
