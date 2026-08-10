# Part CXIX — Classroom Orchestration of Map During Live Tutoring

**Chapter status:** Living evidence + HITL session pedagogy — Researcher tick 2026-08-10 (UTC hour 18 ≡ Red Team slot, but ch119 never written → prefer Researcher per rotation; researcher count since synthesizer v1.15 = 2)  
**Primary question:** When should MindCraft tutors open the Knowledge Map **during** a live session — versus before the first explain, after an attempt grain, or only in debrief — so Map diagnosis densifies formative cycles without map-shock, dual-screen multitasking tax, or “always-on dashboard” cosplay?  
**Owners:** HITL ops / tutor playbooks · Product (Map / session chrome) · Brand · Analytics (FEI / talk / FA instrumentation) · Red Team  
**Commercial job:** Ship **SAFE-MAPORCH** densifying SAFE-HITL × SAFE-FA × SAFE-ATTN × SAFE-BRIDGE × SAFE-ONTOLOGY: **brief → attempt → grain-slice Map → adjust → solo proof** — never continuous student-facing Map theater, mid-attempt full-graph dumps, or Map Minutes as a North Star.

**Builds on:** Parts LXVIII (SAFE-HITL), CXI (SAFE-FA), XCVI (SAFE-ATTN), LXXX (SAFE-BRIDGE), LXVII (SAFE-ONTOLOGY), LIV (SAFE-AAR), LXXXIV (SAFE-TALK), XCV (SAFE-APPRENTICE), CXVII (SAFE-FADEX). Product seams: Map brief, bridge-gap CTA, tutor session structure, soft-wrong, FEI North Stars.

---

## CXIX.1 Why this chapter exists

SAFE-HITL already requires Map-briefed tutors and bans humans-skip-Map. SAFE-FA already requires evidence→adjust cycles. The remaining commercial hazard is **orchestration timing**: when the tutor (or product) opens Map *while Maya is mid-problem*, the graph can become (a) a second screen that taxes working memory, (b) a full-ontology dump that induces map-shock, or (c) a vanity “we use the Map every minute” KPI that substitutes display time for contingent support.

Competitors resolve this wrongly: ITS dashboards always-on behind the student; “knowledge graph” demos that wander the whole ontology mid-explanation; tutors who never open Map and pour procedure; tutors who open Map as a shared spectacle instead of a diagnostic slice.

**FOUNDER BELIEF under audit:** Map is a **diagnosis instrument for contingent teaching**, not a classroom wallpaper and not a replacement for an attempt. Opening it at the wrong moment is worse than leaving it closed until the grain is ready.

**Claims we refuse as doctrine:**
1. Always-on student-facing Map during every live minute.  
2. Mid-attempt full-graph dump / ontology tour as pedagogy.  
3. Map Minutes / Map Score™ as tutor or learning North Star.  
4. Humans-skip-Map (already killed; restated).  
5. Map-open ≡ formative cycle closed (display ≠ Sadler gap-close).  
6. Dual-screen Map+problem as default high-load UX.  
7. Bridge-count wander ≡ bridge teaching.  
8. ACT guarantees from “Map-powered tutoring” packaging.

---

## CXIX.2 Constructs (open Map ≠ close the gap)

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Map brief** | Pre-session / pre-explain diagnosis glance | Tutor opens Map before first pour | Skip Map; pour first |
| **Grain-slice Map** | Focused subgraph (concept/ingredient/bridge/FormatId) | Highlighted next join, not full ontology | Map-shock tour |
| **Mid-attempt open** | Student-facing Map while working memory holds the item | Dual chrome during solve | Multitask tax |
| **Contingent diagnosis** | Diagnose understanding → check → adaptive support → check learning | van de Pol scaffolding steps | Support without diagnose |
| **SAFE-MAPORCH** | When/how Map enters live tutoring | This chapter | Always-on dashboard |

**Operational definition (HYPOTHESIS):** A live tutoring segment is *SAFE-MAPORCH complete* when (a) the tutor opens Map for a **brief** before the first explain (SAFE-HITL), (b) student-facing Map mid-session is a **grain-slice** tied to elicited evidence (not a full-graph wander), (c) Map is **not** the primary chrome during a high-load attempt (attempt-first; Map between attempts or tutor-private), (d) every Map open names a next instructional move that the student then takes (SAFE-FA / Sadler), and (e) success is measured by FEI + `fa_cycle_closed` / `map_brief_open` / `map_slice_adjust` — never Map Minutes.

---

## CXIX.3 Contingent scaffolding requires diagnose-before-support — Map is the diagnose tool

**FACT (scaffolding review):** van de Pol, Volman, & Beishuizen (2010, *Educational Psychology Review, 22*(3), 271–296, doi:10.1007/s10648-010-9127-6) — contingency, fading, and transfer of responsibility are the three key characteristics of scaffolding; descriptive work is abundant; effectiveness evidence is thinner but suggestive; measurement of dynamic contingency is the field’s hard problem. Contingent support presupposes **diagnosis of the learner’s current understanding** before the level of help is set.

**FACT (process spine, reuse):** Black & Wiliam formative assessment as process — elicit evidence, interpret, adjust next steps (SAFE-FA). Sadler (1989): feedback is formative only when the learner acts to close a gap.

**Applied (HYPOTHESIS):** Map mid-session is justified when it **improves diagnosis contingency** (tutor sees bridge gap / FormatId / ingredient and changes the next prompt). It is unjustified when it is opened as spectacle, reassurance, or “we have a graph” theater without a next attempt.

**Kill:** Map-open without next move; support-without-diagnose pour.  
**Survive:** Diagnose (Map slice or probe) → contingent prompt → student action.

**Wound:** van de Pol et al. review classroom scaffolding broadly — not MindCraft Map RCTs. MAPORCH-* must test open-timing in-product.

---

## CXIX.4 Map-shock — full graphs mid-session tax novices

**FACT (map-shock coinage):** Blankenship & Dansereau (2000, *Journal of Experimental Education, 68*(4), 293–308, doi:10.1080/00220970009600640) — coined **map shock** for the bewilderment of not knowing where to start or how to penetrate a complex node-link map; animation can help direct attention on ill-structured maps for macrostructure recall, but complexity itself is the hazard the term names.

**FACT (prior knowledge × structure):** Amadieu, van Gog, Paas, Tricot, & Mariné (2009, *Learning and Instruction, 19*(5), 376–386, doi:10.1016/j.learninstruc.2009.02.005) — low prior-knowledge learners report more **disorientation** and fare worse on conceptual knowledge from complex/networked concept-map structures than from simpler hierarchical ones; map structure interacts with prior knowledge for load and learning.

**Applied (HYPOTHESIS):** Opening MindCraft’s full ontology-ish Map to Maya mid-session recreates map-shock / disorientation — especially for low-exposure grains. Commercial default for **student-facing** mid-session Map = **grain-slice** (one bridge, one FormatId hop, one next route) with hierarchy/signaling, not a free wander of 42 concepts.

**Kill:** Full-graph mid-session dump; “explore the Map together” as default when stuck.  
**Survive:** Tutor-private full Map OK; student sees the named join.

---

## CXIX.5 Concurrent secondary displays hurt — especially under high load

**FACT (secondary-task timing):** Dönmez & Akbulut (2021, *Computers & Education, 161*, 104078, doi:10.1016/j.compedu.2020.104078; N=356) — concurrent secondary tasks (even relevant ones) reduced multimedia learning gains vs control; **relevant-sequential** secondary tasks did **not** differ significantly from control; irrelevant and concurrent conditions underperformed. Monotasking preferred; if a secondary task is needed, make it **relevant and sequential**.

**FACT (attention residue, reuse):** Leroy (2009) — unfinished Task A cognitions tax Task B (SAFE-ATTN). Mid-attempt Map open leaves the problem unfinished while the student processes a second complex representation.

**Applied (HYPOTHESIS):** Student-facing Map during an active attempt is a **concurrent secondary task**. Prefer: finish or park the attempt → open grain-slice Map → return to next attempt (relevant-sequential). Tutor may keep a private Map pane if the student’s primary chrome stays the problem.

**Kill:** Dual-screen Map+problem as default; Map push mid-keystroke.  
**Survive:** Between-attempt Map slices; tutor-private diagnosis pane.

---

## CXIX.6 Noticing and shaping — Map supports interpretation, not airtime

**FACT (teacher noticing):** van Es & Sherin (2002 onward; updated shaping account in van Es & Sherin, 2021, *ZDM – Mathematics Education*) — professional noticing includes attending to student mathematical thinking, interpreting it, and **shaping** interactions to elicit further evidence. Expertise shifts from classroom management narratives toward substance of student reasoning.

**Applied (HYPOTHESIS):** Map should **shape** the next elicit (which probe, which bridge ask) — not occupy talk ratio. SAFE-TALK prompt>pour still binds: Map glance that becomes a monologue tour fails noticing-as-shaping.

**Kill:** Map tour ≡ tutoring; Map Minutes NS.  
**Survive:** Brief Map → named prompt → student construction.

---

## CXIX.7 Product surface — SAFE-MAPORCH claim contract

| Moment | Required behavior | Banned substitute |
|--------|-------------------|-------------------|
| Session start | Map brief before first explain (SAFE-HITL) | Pour-first; skip Map |
| During attempt | Student chrome = problem; tutor-private Map OK | Student dual-screen full Map |
| After soft-wrong / stall | Grain-slice Map naming join/FormatId/bridge + one next move | Full ontology wander; “look at all red nodes” |
| Mid-session adjust | Evidence→Map slice→changed prompt/mission (SAFE-FA) | Map-open without action |
| Wrap / AAR | Map optional for named next route (SAFE-AAR) | End-of-hour Map tourism |
| Metrics | `map_brief_open`, `map_slice_adjust`, `fa_cycle_closed`, FEI co-gates | Map Minutes / Map Score™ |

**Competitive foil:** Always-on ITS dashboards = concurrent tax. ChatGPT tutors = no Map. Graph demos = map-shock tourism. MindCraft = **timed grain diagnosis that changes the next attempt**.

---

## CXIX.8 Doctrine — SAFE-MAPORCH (provisional)

1. **Brief before pour** — Map diagnosis precedes first explain (SAFE-HITL).  
2. **Attempt before student Map** — do not dual-screen full Map during high-load solves (Dönmez & Akbulut; Leroy).  
3. **Grain-slice, not ontology tour** — student-facing Map shows the named join (Blankenship map-shock; Amadieu disorientation).  
4. **Open to adjust** — Map justifies itself by changing the next prompt/mission (van de Pol contingency; SAFE-FA).  
5. **Tutor-private pane allowed** — diagnosis chrome for the tutor need not be student chrome.  
6. **Bridge/FormatId over red-node shame** — open for connection/format gaps (SAFE-BRIDGE / SAFE-FORMAT), not humiliation ranks.  
7. **No Map Minutes NS** — display time ≠ learning; FEI + cycle-closed metrics win.  
8. **Copy:** “Open Map to name the next join — then put it away for the attempt.” Never “live Map always on”; never ACT guarantees from Map airtime.

**Confidence:** High — contingency requires diagnosis (van de Pol); concurrent secondary tasks tax learning (Dönmez & Akbulut); complex maps disorient low-prior learners (Amadieu; Blankenship map-shock); residue taxes switches (Leroy). Medium — exact second thresholds and tutor-private vs shared slice UX (needs MAPORCH-*). High — Map Minutes / always-on / mid-attempt full-graph as NS are commercially toxic under this stack.

---

## CXIX.9 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| MAPORCH-1 | Grain-slice after soft-wrong vs full-graph mid-session open | A/B sessions | `map_slice_adjust`; retry_120s; load/disorientation rating |
| MAPORCH-2 | Tutor-private Map pane vs shared dual-screen during attempt | A/B | Solo transfer; talk pour_streak; student dual-task errors |
| MAPORCH-3 | Map brief+between-attempt only vs always-on student Map | A/B | FEI; `fa_cycle_closed`; Map Minutes (demote) |
| MAPORCH-4 | Bridge/FormatId slice CTA vs red-node gallery after stall | A/B | Join/format hop starts; shame affect; next-move fidelity |
| MAPORCH-5 | Parent/tutor CBC: timed grain Map vs always-on dashboard vs no-Map human | CBC | WTP; trust (SAFE-WTP) |
| MAPORCH-QUAL | 10 tutor sessions: when did Map help vs interrupt? | Qual | MAPORCH codebook |

**Falsifier:** Always-on student Map beats brief+slice on FEI without raising load → still ban Map Minutes as NS; segregate research.  
**Falsifier:** Full-graph mid-session outperforms grain-slice for novices → revise slice design; do not restore tourism as brand.  
**Falsifier:** Skipping Map entirely matches Map-briefed FEI → revise brief UX; do not resurrect humans-skip-Map as doctrine.  
**Pre-register:** MAPORCH-* before “always-on knowledge graph tutoring” ads (SAFE-LABMETA).  
**Family note:** MAPORCH-* densifies HITL-* / FA-*; do not collapse into `map_brief_open` alone or AfL badge pilots.

---

## CXIX.10 So what for MindCraft commercially

- **Copy:** “Open Map to name the next join — then put it away for the attempt.” Lead with timed diagnosis, not dashboard immersion.  
- **Product:** Session chrome = brief → attempt → grain-slice adjust → solo; tutor-private Map pane; no always-on student Map default.  
- **Positioning:** Against always-on ITS dashboards, ChatGPT no-diagnosis pour, and ontology-tourism demos; for contingent Map that changes the next move.  
- **Metric:** `map_brief_open`, `map_slice_adjust`, `fa_cycle_closed`, FEI co-gates — demote Map Minutes / Map Score™.  
- **Kill list:** Always-on student Map; mid-attempt full-graph; Map-open without action; Map Minutes NS; ACT guarantees from Map airtime.  
- **Growth:** Tutor playbooks teach *when* to open Map; sales decks show a 10-second grain slice, not a flying camera through the whole graph.  
- **Vision:** Thirty-year identity company treats the Map as a scalpel for joins — visible when it names the next attempt, invisible when Maya needs the problem alone.

---

## References (verified)

- Amadieu, F., van Gog, T., Paas, F., Tricot, A., & Mariné, C. (2009). Effects of prior knowledge and concept-map structure on disorientation, cognitive load, and learning. *Learning and Instruction, 19*(5), 376–386. https://doi.org/10.1016/j.learninstruc.2009.02.005  
- Blankenship, J., & Dansereau, D. F. (2000). The effect of animated node-link displays on information recall. *Journal of Experimental Education, 68*(4), 293–308. https://doi.org/10.1080/00220970009600640  
- Dönmez, O., & Akbulut, Y. (2021). Timing and relevance of secondary tasks impact multitasking performance. *Computers & Education, 161*, 104078. https://doi.org/10.1016/j.compedu.2020.104078  
- Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. *Organizational Behavior and Human Decision Processes, 109*(2), 168–181. https://doi.org/10.1016/j.obhdp.2009.04.002  
- van de Pol, J., Volman, M., & Beishuizen, J. (2010). Scaffolding in teacher–student interaction: A decade of research. *Educational Psychology Review, 22*(3), 271–296. https://doi.org/10.1007/s10648-010-9127-6  
- van Es, E. A., & Sherin, M. G. (2021). Expanding on prior conceptualizations of teacher noticing. *ZDM – Mathematics Education, 53*, 17–27. https://doi.org/10.1007/s11858-020-01211-4  
