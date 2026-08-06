# Part XCII — Explanation Length vs Germane Load

**Chapter status:** Living evidence + coach/Solver length brief — Researcher tick 2026-08-06  
**Primary question:** When does a coach or Solver *explanation* create germane processing (schema-building attention to the join) versus a **token tax** — extraneous words that crowd working memory, suppress self-explanation, and cosplay as “thorough teaching”?  
**Owners:** Product (coach copy / Solver wrap) · Engine (prompt budgets) · HITL tutors · Brand · Red Team  
**Commercial job:** Ship a **SAFE-EXPLAIN** doctrine: short principle-first coach beats monologue; length follows expertise and element interactivity; student-generated why beats provided essay; prove with transfer/solo, not word count or “AI explained fully” satisfaction.

**Builds on:** Parts XXVI (CLT / fading), XL (SAFE-SE), LXXXV (SAFE-STORYLOAD), LXXXVIII (SAFE-FADE), LXXXIX (SAFE-HELP), XCI (SAFE-HINT). Sibling queue: id 93 retrieval failure modes. Product seams: coach card max length, soft-hint grain, SE-before-wrap, monologue-cap telemetry.

---

## XCII.1 Why this chapter exists

SAFE-HINT priced the *peek*. SAFE-FADE staged the *worked example*. SAFE-SE required the *student why*. This chapter prices the *words after the why* (and the words that replace it): how long may a coach speak before thoroughness becomes overload?

Default AI tutor UX optimizes for fluent completeness — multi-paragraph solutions that feel caring. Default parent anxiety asks for “more explanation.” Default LLM systems reward tokens. MindCraft’s identity claim needs the opposite default: **the shortest explanation that marks the critical feature and leaves room for construction**.

**FOUNDER BELIEF under audit:** Verbose AI wrap trains passive receipt. Principle-length coach + SE + fade stage trains transferable competence — if parents hear “clear, not endless,” and students still reach solo transfer.

**Claims we refuse as doctrine:**
1. Longer explanation ≡ better teaching / more learning.  
2. Token count, “full solution essay,” or Explanation Score™ as quality North Stars.  
3. Always-on monologue wrap that displaces self-explanation (Kill #8 / SAFE-SE).  
4. Same explanation length for novice and near-expert (expertise reversal ignore).  
5. Seductive lore / pep talk / franchise trivia inside the coach card (SAFE-STORYLOAD).  
6. “AI explained everything” as marketing proof of pedagogy.  
7. Unlimited free hard peeks *plus* essay dumps (SAFE-HINT × this chapter).  
8. Streaks/XP for reading long explanations.

---

## XCII.2 Constructs (keep load types honest)

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Intrinsic load** | Element interactivity of the math itself | Concept + bridge + FormatId difficulty | Soften the math instead of the wrap |
| **Extraneous load** | Processing that does not build the schema | Redundant essay, seductive asides, duplicate modalities | “Helpful” fluff |
| **Germane processing** | WM devoted to intrinsic structure (modern CLT: redistribute, not a third additive pile) | Naming the join; SE; marking critical features | Calling any effort “germane” |
| **Token tax** | Product term: words that consume WM without advancing schema | Multi-paragraph Solver dump | Fluency-as-care |
| **Instructional explanation** | Provided why/principle/operator text | Coach card; soft hint text | Essay replacing attempt |
| **Self-explanation (SE)** | Learner-generated why | SAFE-SE prompts | AI monologue labeled SE |
| **SAFE-EXPLAIN** | Length-contingent, principle-first, SE-preserving coach | This chapter | Monologue costume |

**Operational definition (HYPOTHESIS):** An explanation path is *SAFE-EXPLAIN complete* when it (a) defaults to principle / critical-feature length (≈1–3 sentences or one marked step), (b) expands only after miss, demand, or diagnosed high element interactivity, (c) never replaces a required SE with a provided essay, (d) shortens as fade stage / expertise rises, (e) strips seductive and redundant material, and (f) co-primaries prove with `solo_transfer_pass` / near transfer — not dwell-on-essay or thumbs-up on “thoroughness.”

---

## XCII.3 Germane load is not “more words”

**FACT (modern CLT):** Sweller, van Merriënboer & Paas (2019, *Educational Psychology Review*, 31, 261–292, doi:10.1007/s10648-019-09465-5) reconceptualize germane load: it is working-memory resources devoted to *dealing with intrinsic load*, not a third additive load that rises when you add “learning activities.” Reducing extraneous load frees capacity for intrinsic processing; germane is redistributive.

**FACT (element interactivity):** Sweller (2010, *Educational Psychology Review*, 22, 123–138, doi:10.1007/s10648-010-9128-5) — intrinsic load tracks element interactivity relative to expertise; instructional design should manage extraneous load and optimize germane *processing of* that intrinsic structure.

**Applied (HYPOTHESIS):** A 600-token coach monologue that re-derives every algebraic step the student already executed is mostly **extraneous** for a mid-fade learner — even if every sentence is “about math.” Germane would be: mark the failed join, name the FormatId shift, invite one SE. Length is not a virtue metric.

**Kill:** “We maximized germane load by adding more explanation.”  
**Survive:** Cut extraneous wrap so WM can work the intrinsic join.

---

## XCII.4 Provided explanations: small effects; SE often wins

**FACT (meta-analysis):** Wittwer & Renkl (2010, *Educational Psychology Review*, 22, 393–409, doi:10.1007/s10648-010-9136-5) — 21 studies / 28 comparisons of worked examples *with* vs *without* instructional explanations. Overall weighted mean effect **small** (*d* = 0.16). Benefits stronger for **conceptual knowledge** (*d* ≈ 0.36) than for transfer/problem-solving measures (often ns). When controls were **prompted to self-explain**, instructional explanations showed **no advantage** (subset *d* ≈ −0.01).

**FACT (withholding can beat providing):** Richey & Nokes-Malach (2013, *Learning and Instruction*, 25, 22–34, doi:10.1016/j.learninstruc.2012.11.006) — across three experiments, students who had stepwise instructional explanations *withheld* showed **greater conceptual learning** than students who received them; achievement goals predicted learning more under withholding (constructive effort was volitional).

**FACT (framework):** Wittwer & Renkl (2008, *Educational Psychologist*, 43(1), 49–64) — instructional explanations often fail when mistimed, misleveled, or unused; design must fit generation *and* use conditions — not assume “explain more.”

**Applied (FOUNDER BELIEF → testable):** MindCraft’s coach should prefer **SE prompts + short principle marks** over default essay wraps. Long provided explanations are a *last* grain (like hard hints), not the brand voice.

**Kill:** AI monologue ≡ instructional science; “we explain thoroughly” as FEI proof.  
**Survive:** Minimal instructional text that enables construction; expand only when SE stalls.

---

## XCII.5 Coherence, redundancy, and the token tax

**FACT (coherence):** Mayer’s coherence principle — people learn better when extraneous material is excluded (supported across many multimedia tests; median ES often large in Mayer handbook summaries). Seductive details (interesting but irrelevant words/images/sounds) hurt retention/transfer (Harp & Mayer line; Moreno & Mayer, 2000, *Journal of Educational Psychology*, 92, 117–125 on minimizing irrelevant sounds).

**FACT (redundancy):** Chandler & Sweller (1991) / Sweller line — presenting the same information in unnecessary duplicate forms increases extraneous load. Mayer restricted redundancy (narration + on-screen text with animation) similarly taxes capacity (Mayer, Heiser & Lonn / Moreno & Mayer series; median ES ~0.7 in “nine ways” summaries).

**Applied (HYPOTHESIS):** Solver surfaces that show (1) full worked steps, (2) a paragraph restating those steps, and (3) a chatty pep layer create **content redundancy + seductive fluff**. Prefer one representation at a time: sparse step marks *or* short principle — not both plus lore.

**Product prior:** Soft hint = principle sentence. Hard peek = one revealed step. Bottom-out = minimal completed blank — not a TED talk. Story wrap stays outside the coach card budget (SAFE-STORYLOAD).

**Kill:** Duplicate text+voice essays; “engaging” asides inside the critical coach moment.  
**Survive:** One clear signal; cut the rest.

---

## XCII.6 Expertise reversal: length must fade

**FACT:** Kalyuga, Ayres, Chandler & Sweller (2003, *Educational Psychologist*, 38(1), 23–31) — instructional supports that help novices can **hurt** relative experts (expertise reversal). Detailed guidance becomes redundant; experts waste WM reconciling external text with already-formed schemas.

**FACT (design implication):** Kalyuga (2007, *Educational Psychology Review*, 19, 509–539) — tailor and fade guidance as expertise rises; fixed high-guidance designs are not “always safer.”

**Applied (HYPOTHESIS):** Couple explanation *length* to SAFE-FADE stage and SAFE-HINT contingency:

| Stage / expertise | Default coach length | Expand when |
|-------------------|----------------------|-------------|
| E0 novice example study | Short principle + marked critical feature on the example | Student SE fails / high anxiety + miss |
| E1 completion | One cue for the blank | Second miss |
| E2 sparse | Principle only | Demand + dwell |
| E3 near solo / prove rail | Invite SE; near-zero provided essay | Rare emergency reveal |

**Kill:** Same multi-paragraph wrap for every student forever.  
**Survive:** Length fades with responsibility transfer.

---

## XCII.7 Assistance dilemma — not “more help”

**FACT:** Koedinger & Aleven (2007, *Educational Psychology Review*, 19, 239–264) — the **assistance dilemma**: how much information to provide vs withhold so that learners still do the constructive work that builds robust knowledge.

**Bridge to product:** SAFE-HELP / SAFE-HINT already reject unlimited executive dumps. SAFE-EXPLAIN rejects *verbose instrumental* dumps — explanations that look helpful, consume tokens, and still steal the generative work Richey & Nokes-Malach show matters for conceptual gain.

**SPECULATION:** LLM tutors systematically bias toward over-assistance because fluency and completeness are RLHF-shaped. Without an explicit length budget and SE gate, MindCraft will drift ChatGPT-ward even with “principle” system prompts.

---

## XCII.8 Product surface — SAFE-EXPLAIN claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Soft coach / soft hint | ≤ principle grain; mark join/FormatId | Multi-paragraph lecture |
| Soft-wrong path | SE before wrap; wrap ≤ short correction | Essay before student why |
| Solver learn rail | Length tied to fade stage | Always-full verbal restatement of steps |
| Prove / exam rail | Minimal KR; no lecture | Post-item monologue |
| Tutor HITL | Prompt > pour; pour stays short (SAFE-TALK) | Tutor as essay machine |
| Parent view | “Clear next step” copy — not word-count care | “AI explained for 10 minutes” proof |
| Marketing | “Short coaches that leave room to think” | “Unlimited thorough AI explanations” |
| Analytics | `coach_tokens`, `se_before_wrap`, wrap-expand rate | Explanation Score™ / tokens-as-quality |

**Competitive foil:** ChatGPT = costless long dump. Khan video = long lecture outside attempt loop. Duo = short but often shallow XP copy. MindCraft = **length-contingent principle coach** under FEI.

---

## XCII.9 Doctrine — SAFE-EXPLAIN (provisional)

1. **Short before long** — default principle / critical-feature length; expand only on evidence of need.  
2. **Germane ≠ more text** — free WM for intrinsic joins; do not advertise “added germane load.”  
3. **SE before wrap** — provided essay never replaces student why (SAFE-SE).  
4. **Length fades with expertise** — couple to fade×hint state (SAFE-FADE / SAFE-HINT).  
5. **Coherence > charm** — strip seductive and redundant coach material.  
6. **No token North Star** — ban Explanation Score™ / tokens-read / “thoroughness” thumbs as learning KPIs.  
7. **Assistance dilemma honesty** — withhold when construction is the learning act.  
8. **Proof** — `solo_transfer_pass` / conceptual items / lower wrap-expand binge — not essay dwell.

**Confidence:** High that modern CLT treats germane as processing of intrinsic structure, not additive word count (Sweller et al., 2019; Sweller, 2010). High that instructional explanations’ average gain is small and often loses to SE prompts (Wittwer & Renkl, 2010). High that withholding stepwise explanations can improve conceptual outcomes (Richey & Nokes-Malach, 2013). High that coherence/redundancy and expertise reversal caution against always-longer guidance (Mayer line; Kalyuga et al., 2003). Medium on exact token caps / sentence budgets — run EXPLAIN-*. High that LLM defaults drift verbose without hard budgets.

---

## XCII.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| EXPLAIN-1 | Principle-short coach vs multi-paragraph monologue (same facts) | A/B within concept | `solo_transfer_pass`; conceptual item; wrap dwell |
| EXPLAIN-2 | SE-before-wrap vs wrap-first essay | A/B | SE completeness; transfer; binge-expand |
| EXPLAIN-3 | Length coupled to fade stage vs fixed long wrap | A/B | Solo transfer; expertise×length interaction |
| EXPLAIN-4 | Soft-wrong: short mark vs long re-teach | A/B | Retry_120s; near transfer; anxiety self-report (secondary) |
| EXPLAIN-5 | Parent CBC: “clear short coach” vs “thorough AI essays” vs “we never explain” | CBC | WTP; trust (SAFE-WTP) |
| EXPLAIN-QUAL | 10 Maya: when does an explanation feel clarifying vs drowning? | Qual | Length phenomenology codebook |

**Falsifier:** Fixed long monologue wins delayed solo transfer *and* 26w identity equally → still ban as *brand* vs ChatGPT; allow expandable “Show more” off default.  
**Falsifier:** Ultra-short coach harms true novices on high-interactivity first exposure → keep E0 slightly richer marks; do not open with silence theater.  
**Falsifier:** Parents refuse short-coach CBC entirely → redesign copy (“clear next step”) before surrendering to essay brand.

**Pre-register:** EXPLAIN-* before any “unlimited thorough AI explanations / Explanation Score™ / longest tutor wins” campaign (SAFE-LABMETA). Do not duplicate HINT hard-peek arms — EXPLAIN owns *provided-text length*; HINT owns soft→hard specificity.

---

## XCII.11 So what for MindCraft commercially

- **Copy:** “Short coaches that leave room to think.” Never “the most thorough AI tutor.”  
- **Product:** Default principle grain; SE-before-wrap; length tied to fade×hint; hard token/sentence budgets on coach prompts.  
- **Positioning:** Against ChatGPT essay dumps and lecture-as-care; for *assistance-dilemma-honest* brevity that transfers.  
- **Metric:** `coach_tokens`, `se_before_wrap`, wrap-expand rate — demote tokens / thoroughness NPS / Explanation Score™.  
- **Kill list:** Longer≡better; monologue≡SE; token North Star; seductive coach fluff; fixed long wrap across expertise.  
- **Growth:** Parent decks sell clarity and independence, not word count; tutors QA pour length (SAFE-TALK).  
- **Vision:** Teach Maya to need *fewer* words from the coach — and to supply her own.

---

## References (verified)

- Chandler, P., & Sweller, J. (1991). Cognitive load theory and the format of instruction. *Cognition and Instruction, 8*(4), 293–332. (Redundancy / split-attention lineage.)  
- Kalyuga, S. (2007). Expertise reversal effect and its implications for learner-tailored instruction. *Educational Psychology Review, 19*, 509–539.  
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist, 38*(1), 23–31.  
- Koedinger, K. R., & Aleven, V. (2007). Exploring the assistance dilemma in experiments with Cognitive Tutors. *Educational Psychology Review, 19*, 239–264.  
- Moreno, R., & Mayer, R. E. (2000). A coherence effect in multimedia learning: The case for minimizing irrelevant sounds in the design of multimedia instructional messages. *Journal of Educational Psychology, 92*(1), 117–125.  
- Richey, J. E., & Nokes-Malach, T. J. (2013). How much is too much? Learning and motivation effects of adding instructional explanations to worked examples. *Learning and Instruction, 25*, 22–34. https://doi.org/10.1016/j.learninstruc.2012.11.006  
- Sweller, J. (2010). Element interactivity and intrinsic, extraneous, and germane cognitive load. *Educational Psychology Review, 22*(2), 123–138. https://doi.org/10.1007/s10648-010-9128-5  
- Sweller, J., van Merriënboer, J. J. G., & Paas, F. (2019). Cognitive architecture and instructional design: 20 years later. *Educational Psychology Review, 31*, 261–292. https://doi.org/10.1007/s10648-019-09465-5  
- Wittwer, J., & Renkl, A. (2008). Why instructional explanations often do not work: A framework for understanding the effectiveness of instructional explanations. *Educational Psychologist, 43*(1), 49–64.  
- Wittwer, J., & Renkl, A. (2010). How effective are instructional explanations in example-based learning? A meta-analytic review. *Educational Psychology Review, 22*, 393–409. https://doi.org/10.1007/s10648-010-9136-5  
