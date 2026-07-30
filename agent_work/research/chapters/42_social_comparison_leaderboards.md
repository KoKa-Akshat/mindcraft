# Part XLII — Social Comparison & Leaderboards: When Ranks Help vs Hurt Novices

**Chapter status:** Living evidence brief — Researcher tick 2026-07-30 (UTC hour 3)  
**Primary question:** When do social-comparison surfaces (especially leaderboards) motivate learning versus threaten identity, and what should MindCraft default for Maya — the anxious / novice / identity-fragile segment?  
**Owners:** Motivation · Affect / Anxiety · Product (Practice / Community UX) · Growth / Positioning · Red Team  
**Commercial job:** Kill “ranks = engagement” as a North Star; harden the I.4 TARGET rule (default-ban appearance UX) into a shippable comparison policy competitors can be audited against.

---

## XLII.1 Why this chapter exists

Part XXXVIII (goal orientation) already bans **appearance** goal structures and streak-as-North-Star. Part XXIV / XLI show social-evaluative threat taxes working memory and can turn desirable difficulty into threat. Competitive products (Duolingo-like ranks, classroom Top-N boards, public classroom streaks) still sell comparison as “motivation.”

**FOUNDER BELIEF under audit:** Identity transformation needs competence evidence — not a public ladder that tells bottom-half Maya she is behind *people* rather than behind a *skill criterion*.

**Claim we refuse as doctrine:** “Leaderboards motivate learners” (full stop) — and its twin “if we anonymize, any infinite rank is fine.”

---

## XLII.2 Constructs (product language)

| Construct | Plain definition | Product signal | Failure mode if misused |
|-----------|------------------|----------------|-------------------------|
| **Social comparison** | Evaluating self via others’ standing (Festinger) | Any peer rank, percentile, “class average,” public tutor callout | Turns mastery climate into appearance climate |
| **Upward / downward / lateral** | Compare to better / worse / similar others | Top-N board; “you beat 80%”; neighbor band | Extreme upward gap → give-up; downward → complacent ego boost without learning |
| **Absolute vs relative board** | All players ranked vs local neighbors / Top-N only | Infinite classroom board vs “near you” strip | Absolute + real names = max face threat for low ranks |
| **Criterion / mastery feedback** | Progress vs a task standard, not vs peers | Path progress, concept mastery bars, personal bests | Still can be gamed if criterion ≠ transfer |
| **Normative / appearance feedback** | Standing vs others; looking smart/fast | Public leaderboard, streak leagues | Identity threat; WM load; exit after first public miss |

**Operational definition (HYPOTHESIS):** A MindCraft comparison surface is *safe* only when (a) the default is **self/criterion**, (b) peer comparison is **opt-in**, (c) comparison targets are **attainable** (local band, not unreachable Top-1), (d) metrics ranked are **effort/process-compatible** with mastery climate (not speed-only or streak-only), and (e) low standing is never **publicly named** for the anxiety / novice segment.

---

## XLII.3 Festinger → competition: the comparison engine

**FACT (origin):** Festinger (1954, *Human Relations*, “A Theory of Social Comparison Processes”) — when objective standards are ambiguous, people evaluate abilities/opinions by comparing with others; ability comparison carries a unidirectional drive upward (improve toward better standards).

**FACT (selection + reaction meta):** Gerber, Wheeler & Suls (2018, *Psychological Bulletin*, doi:10.1037/bul0000127) — across 60+ years: when choosing up vs down, strong preference for **upward** comparison under no threat; **contrast** (self-evaluation moves *away* from the target) dominates reactions — ability estimates and affect often decline after upward contact. People often choose upward comparisons *even though* the typical reaction is self-deflating contrast.

**FACT (competition model):** Garcia, Tor & Schiff (2013, *Perspectives on Psychological Science*, doi:10.1177/1745691613504114) — social comparison is a major source of competitive attitudes/behavior; situational amplifiers include **proximity to a standard** (near #1 vs far away) and **N** (few vs many competitors). Ranking UIs are engineered comparison machines.

**Product translation:** Shipping a leaderboard is not a neutral “engagement widget.” It is a deliberate injection of comparison → contrast risk → competitive framing. For Maya, that often means **appearance climate** (XXXVIII), not mastery.

---

## XLII.4 Leaderboards can move behavior — under narrow conditions

**FACT (HE experiment):** Landers & Landers (2014, *Simulation & Gaming*, doi:10.1177/1046878114563662) — random assignment to a course wiki **leaderboard** (not tied to grades) increased project interactions (~+29.6) vs control; time-on-task mediated academic performance. Supports: leaderboards *can* raise engagement via goal/conflict attributes **in that setting**.

**Caveats (FACT / scope):** Undergraduate / course project; not math-anxious high-school Maya; not public infinite classroom shame; achievement metric was interaction volume, not durable transfer. Landers’ theory of gamified learning (2014, doi:10.1177/1046878114563660) treats game attributes as mediators/moderators of *instructional* quality — gamification does not replace pedagogy.

**FACT (HE systematic review):** Li, Liang, Fryer & Shum (2024, *Journal of Computer Assisted Learning*, doi:10.1111/jcal.13077) — 20 articles / 22 studies / 29 interventions (2014–2023), **all higher education**; ~half ≤1 hour. Leaderboards *can* benefit motivation/engagement/performance, but **effects hinge on design**. Authors recommend (among others): absolute boards for motivation *with* anonymity especially for low ranks; mix performance + engagement criteria; caution that HE short-duration findings do **not** generalize cleanly to K–12.

**HYPOTHESIS:** Landers-style gains are most likely when learners already have task competence + low identity threat + voluntary/low-stakes ranking. MindCraft’s default user is the opposite segment on day one.

---

## XLII.5 Math-specific: anxiety × infinite ranks

**FACT (primary maths game, large N):** Almo, Rocha, Brennan & Dondio (2024, *International Journal of Serious Games*, doi:10.17083/ijsg.v11i4.794) — N=1,389 Irish primary students, 6-week *Seven Spells* programme with an **infinite leaderboard**. Leaderboard enjoyment predicted by rank position **and** maths anxiety: **maths-anxious players disliked the leaderboard more than non-anxious peers even after controlling for position**. Preference for playing against others also predicted enjoyment. Small correlation between liking the board and liking the game.

**Implication (HYPOTHESIS):** For anxious learners, public infinite rank is not a free engagement boost — it is a trait-moderated threat surface. “They’re low because they’re bad at the game” does not exhaust the mechanism; anxiety predicts dislike **net of rank**.

**FACT (negative feedback climate):** Fong, Patall, Vasquez & Stautberg (2019, *Educational Psychology Review*, doi:10.1007/s10648-018-9446-6) — meta-analysis (78 studies): negative feedback reduces intrinsic motivation vs positive feedback; harm lessens when feedback includes instructional how-to-improve detail and uses **criterion-based** standards (vs purely normative). Public low rank is often pure normative negative feedback without instructional content.

**Bridge to XLI / XXIV:** Social-evaluative threat (public miss, public bottom third) is exactly the stakes Hinze & Rapp warn can disrupt retrieval benefits — and Ashcraft-style WM load. Infinite boards amplify that climate at scale.

---

## XLII.6 Resolution doctrine — SAFE-COMPARE

**FOUNDER BELIEF / HYPOTHESIS — SAFE-COMPARE stack (ties TARGET / SAFE-DD / FEI):**

1. **Default = criterion, not peers.** Show progress vs path / mastery / personal best. Peers off by default.  
2. **Opt-in competition only.** Never force infinite boards onto gap-scan novices or high-anxiety segment.  
3. **If peers: local + attainable.** Prefer neighbor bands / similar-ability cohorts over Top-1 theater (Garcia proximity + Gerber contrast).  
4. **Anonymize low standing.** No named public bottom ranks (Li et al. Rec. 2; Bai et al. cited therein).  
5. **Rank what mastery climate allows.** Prefer process-compatible signals (retries completed, transfer attempts, concepts unlocked) over speed leagues / streak leagues. Never rank “hint-free seconds” as identity.  
6. **Instructional wrap on any relative miss.** If relative feedback ships, attach *how to improve next* (Fong moderators) — not only “you’re #47.”  
7. **Measure the right win.** `retry_120s`, `challenge_accept` (mastery-coded), `transfer_pass` / `solo_transfer_pass` — not `leaderboard_views` or rank delta as learning.

**Kill the false dichotomy:** “Competition is toxic” vs “competition is always motivating.” Competition can raise time-on-task for some prepared learners (Landers). For Maya default, **unbuffered infinite peer rank is appearance UX** — banned until SC experiments say otherwise.

---

## XLII.7 Competitive / marketing implications

| Competitor pattern | Comparison mechanism | MindCraft wedge |
|--------------------|----------------------|-----------------|
| **Duolingo-like leagues / ranks** | Normative weekly standing; streak adjacent | Mastery path progress; ban streak/rank as learning proof |
| **Classroom Top-N boards** | Extreme upward targets; face threat | Criterion bars; optional local bands |
| **Khan / practice dashboards** | Often self-paced; weaker public rank | Keep self/criterion; don’t “gamify catch-up” with shame ranks |
| **Brilliant prestige signals** | Ability-appearance among peers | Sell *solo transfer* and *challenge-seeking why*, not percentile flex |
| **ChatGPT tutor alone** | No peer board — but social comparison still via school/parents | Own the *safe* comparison story: progress vs yesterday’s self |

### Marketing language that survives

- **Allowed:** “Progress against *your* path — not a public ladder.”  
- **Allowed:** “Competition is optional; mastery climate is the default.”  
- **Allowed (parent):** “We don’t put anxious kids on a named scoreboard to ‘motivate’ them.”  
- **Banned:** “Leaderboards keep students hooked” as a learning claim.  
- **Banned:** Rank / league / streak as North Star or as proof of identity change.  
- **Banned:** Bloom 2-sigma; absolute tutoring-is-free; empty mindset posters.

### Feature claim ladder (Part XXXIV hygiene)

| Feature | Claim max without SC data |
|---------|---------------------------|
| Criterion progress / personal bests default | L1 mastery-climate alignment (XXXVIII) |
| Opt-in anonymized local band | L1 SAFE-COMPARE intent |
| “Our leaderboard raises ACT / identity for anxious Maya” | L0 until SC-1/SC-2 |
| Forced infinite named classroom board | L0 — appearance UX; likely harm for HMA |

---

## XLII.8 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| SC-1 | Criterion-only progress vs infinite named leaderboard (same practice items) | 2-arm; stratify high vs low math-anxiety | `retry_120s`; exit after public miss; 7d `transfer_pass` | Infinite board wins transfer **and** retry in HMA → default-ban wounded |
| SC-2 | Opt-in local anonymized band vs forced absolute board | 2–3 arm | Enjoyment; state anxiety; return D+1; challenge_accept motive codes | Forced absolute ≥ opt-in local on retention without anxiety cost → anonymity/opt-in overstated |
| SC-3 | Rank process metrics (retries, mix attempts) vs rank speed/streak | 2-arm within volunteers | Strategy-class errors; `transfer_pass` vs session speed | Speed rank equals process rank on transfer → metric choice moot |
| SC-4 | Criterion negative feedback + how-to-improve vs rank-only “you’re #N” | 2-arm (Fong-inspired) | Intrinsic motivation proxy; retry | Rank-only ≥ instructional criterion → Fong moderator fails in product |
| SC-QUAL | 10 Maya interviews: “When did seeing others’ scores help vs freeze you?” | Appendix B | coded comparison threat moments | Nobody distinguishes → copy invisible |

**Pre-reg (XXXIV):** SC-* identify **comparison surface × anxiety → return/transfer**. They do **not** identify that “healthy competition builds character” from one league season.

**Densifies:** XXXVIII appearance ban; I.4 TARGET “leaderboard kill for Maya default”; XXIV social-evaluative threat hypothesis.

---

## XLII.9 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| People use others to evaluate abilities when standards are ambiguous | FACT (Festinger, 1954) | High |
| Upward comparison often preferred; contrast often dominates self-eval/affect | FACT (Gerber et al., 2018) | High |
| Ranking contexts amplify competitive social comparison | FACT (Garcia et al., 2013) | High |
| Leaderboards can increase time-on-task / mediate performance in some HE settings | FACT (Landers & Landers, 2014) | High (scope-limited) |
| Leaderboard effects in education are design-dependent; HE evidence ≠ K–12 | FACT (Li et al., 2024) | High |
| Maths-anxious players dislike infinite boards more, net of rank | FACT (Almo et al., 2024) | High |
| Normative negative feedback tends to hurt intrinsic motivation vs positive; criterion + how-to softens | FACT (Fong et al., 2019) | High |
| SAFE-COMPARE default (criterion, opt-in, local, anonymize low, process metrics) is right for MindCraft | FOUNDER BELIEF / HYPOTHESIS | Medium–High |
| “Leaderboards motivate everyone / raise learning for Maya” | SPECULATION / false as universal | Low (against) |

---

## XLII.10 What this chapter kills

1. **Kill:** Universal “leaderboards motivate students” as product doctrine or marketing. (Design- and trait-dependent; HE ≠ Maya.)  
2. **Kill:** Infinite named public ranks as default engagement for novices / high math-anxiety. (Almo et al.; TARGET / appearance.)  
3. **Kill:** Rank delta / league standing / streak leagues as North Star or as proof of identity transformation.  
4. **Wound:** Absolute-board motivation gains from HE reviews as license for K–12 public boards — survives only as *design hypothesis*, not as Maya default.  
5. **Survive (constrained):** Opt-in, anonymized, attainable, criterion-wrapped comparison for learners who already seek competition — never as the onboarding spine.

**Doctrine until data:** Ship **SAFE-COMPARE**: criterion default → peer opt-in → local/attainable → anonymize low standing → rank mastery-compatible process → instructional wrap → measure transfer/retry, not rank views. Market “progress without public ladders.” Never sell ranks as belonging.
