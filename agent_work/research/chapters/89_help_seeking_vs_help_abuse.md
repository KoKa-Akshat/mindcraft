# Part LXXXIX — Help-Seeking vs Help Abuse

**Chapter status:** Living evidence + Solver/Practice/HITL brief — Researcher tick 2026-08-06  
**Primary question:** When should MindCraft treat help use as adaptive self-regulation versus executive help abuse (or help avoidance), and what product/copy rules follow without turning “unlimited hints” or “never help” into the brand?  
**Owners:** Product (Solver / Practice / coach) · Engine (hint ladder / telemetry) · HITL tutors · Brand · Red Team  
**Commercial job:** Ship a **SAFE-HELP** doctrine: instrumental help that graduates into solo transfer; detect and discourage executive binge / bottom-out racing; invite help when avoidance is the failure; prove with deliberate help metrics + `solo_transfer_pass`, not hint satisfaction NPS.

**Builds on:** Parts XXVI (fading), XL (SAFE-SE), XLV (SAFE-RESILIENCE), LI (SAFE-DP), LVIII (SAFE-EXPOSE), LXXIX (SAFE-FBTIME), LXXXIV (SAFE-TALK), LXXXVIII (SAFE-FADE). Product seams: `hint_binge`, `ai_reveal_rate`, `help_recruit_then_solo`, fade ladder E0–E3, Solver reveal gates. Next sibling: id 91 hint economy (cost of peek).

---

## LXXXIX.1 Why this chapter exists

SAFE-FADE answered *what* guidance looks like as expertise grows. This chapter answers *when students ask for it* — and when that ask is learning versus gaming.

**FOUNDER BELIEF under audit:** A product that makes help *always cheap and bottom-out-complete* trains Maya to recruit the answer, not the join. A product that shames all help trains avoidance and freeze. MindCraft’s identity claim requires **instrumental** help-seeking (help to understand the next step) and refuses **executive** help-seeking (help to finish without thinking) as success theater.

**Claims we refuse as doctrine:**
1. Unlimited hints / always-open bottom-out as learning North Star.  
2. Hint volume or help NPS as proof of pedagogy quality.  
3. Help avoidance as grit (struggle theater that bans support).  
4. Metacognitive nag alone as guaranteed domain gains (Help Tutor caution).  
5. Gaming detectors as shame dashboards for parents.  
6. “AI always knows when you need help” black-box contingent brand.  
7. Help Score™ / Talk-to-hint ratio vanity NS.  
8. Permanent tutor dependency sold as “supportive.”

---

## LXXXIX.2 Constructs

| Construct | Research meaning | MindCraft analogue | Failure mode |
|-----------|------------------|--------------------|--------------|
| **Instrumental help** | Help aimed at learning how to proceed | Principle hint / completion blank / SE gate | Rare without design |
| **Executive help** | Help aimed at getting the answer done | Bottom-out dump / ChatGPT paste | Common default |
| **Help abuse** | Maladaptive overuse (e.g. hint racing) | Rapid reveal chain; `hint_binge` | Fake fluency |
| **Help avoidance** | Under-use when help would help | Stuck loops; refuse coach | Freeze / shame |
| **Try-step abuse** | Hasty guessing without sense-making | Spam submit / click farm | Gaming |
| **Contingent help** | Scaffold level tracks need | Fade down/up from evidence | Fixed forever chrome |
| **SAFE-HELP** | Instrumental + contingent + solo proof | This chapter | Hint vending |

**Operational definition (HYPOTHESIS):** A help path is *SAFE-HELP complete* when it (a) distinguishes instrumental vs executive use in telemetry, (b) makes bottom-out / full reveal costly in *effort or stage* (not humiliation), (c) invites help after repeated miss without pouring the answer first, (d) co-primary proves with `help_recruit_then_solo` and `solo_transfer_pass`, and (e) never markets unlimited answer-complete help as identity transformation.

---

## LXXXIX.3 Instrumental vs executive — the commercial fork

**FACT (classroom help typology):** Classic help-seeking research distinguishes help that supports learning how to solve from help that merely completes the task — often labeled instrumental vs executive (Nelson-Le Gall, 1981; Karabenick & Knapp, 1991; summarized in Roll, Aleven, McLaren & Koedinger, 2011, *Learning and Instruction*, 21(2), 267–280, doi:10.1016/j.learninstruc.2010.07.004).

**Applied (HYPOTHESIS):** ChatGPT-style Solver and “unlimited hints” ads optimize for *executive* completion feeling. Parent WTP for “my kid got unstuck” must be re-aimed at *instrumental* unstuck — named next grain + student-generated step — or MindCraft collapses into homework completion SaaS.

**Kill:** Help ≡ finish the worksheet.  
**Survive:** Help ≡ recruit a scaffold that still requires Maya’s next move (ties SAFE-FADE / SAFE-SE).

---

## LXXXIX.4 Help abuse is frequent — and often anti-learning

**FACT (early Cognitive Tutor logs):** Aleven & Koedinger (2000/2001; reviewed in Aleven, McLaren, Roll & Koedinger, 2016, *IJAIED*, 26(1), 205–223, doi:10.1007/s40593-015-0089-1) — students often raced hint levels to the bottom-out answer (many pre-bottom levels viewed <1s) and under-asked after errors; on-demand help frequency correlated negatively with learning gains (selection + misuse both plausible).

**FACT (model taxonomy):** Aleven, McLaren, Roll & Koedinger (2006, *IJAIED*; also Aleven et al., 2004, ITS) — executable model with Help Abuse, Help Avoidance, and Try-Step Abuse; early offline eval classified a large share of actions as unproductive (Aleven et al., 2004 ~72% under a strict model — model-dependent, not a marketing statistic).

**FACT (gaming):** Baker and colleagues treat rapid help abuse / exploiting tutor regularities as primary “gaming the system,” associated with reduced learning (Baker, Corbett & Koedinger line; Roll et al., 2011; Aleven et al., 2016).

**Applied (FOUNDER BELIEF → testable):** MindCraft’s existing `hint_binge` (≥3 hints without independent solve) and `ai_reveal_rate` are the right *family* of detectors — but must not become parent shame ranks (SAFE-PDASH). Use them for coach fade, tutor QA, and product gates.

**Kill:** Hint clicks as engagement success.  
**Survive:** Deliberate hint reading time + fewer levels when help is taken (Help Tutor behavioral signature).

---

## LXXXIX.5 Help avoidance is the other failure — not grit

**FACT:** The same Aleven/Roll line documents frequent help avoidance — students who need help most often seek it least or seek it poorly (Aleven et al., 2003 overview; Wood & Wood, 1999; Nelson-Le Gall et al., 1990 on poorer self-assessment among lower prior-knowledge students — cited throughout the Help Tutor program).

**FACT (contingent tutoring):** Wood & Wood (1999, *Computers & Education*, 33(2–3), 153–169) — contingent tutoring adjusts help level with success/failure; process measures of help-seeking relate to prior knowledge and outcomes; help seeking is part of constructing a workable zone of support, not a character flaw.

**Applied (HYPOTHESIS):** After repeated soft-wrong / pour risk, MindCraft should *offer* instrumental help (completion blank, principle card) — not celebrate silent freeze as resilience. SAFE-RESILIENCE already recruits support; SAFE-HELP specifies the *kind*.

**Kill:** “Real math kids never ask for hints.”  
**Survive:** Help invite after struggle; still require attempt grain before bottom-out.

---

## LXXXIX.6 Metacognitive feedback improves help skill — not always domain gain

**FACT (Help Tutor studies):** Roll et al. (2006 ITS; 2011, *Learning and Instruction*, 21(2), 267–280, doi:10.1016/j.learninstruc.2010.07.004) — metacognitive feedback made help use more deliberate (more time per level; fewer levels), sometimes persisting after feedback ended — **but domain learning gains did not reliably improve** (Aleven et al., 2016: “help helps, but only so much”).

**FACT (theoretical update):** Aleven et al. (2016) — principle-based hints help when students sense-make; bottom-out can act like a worked example *if* self-explained (Shih, Koedinger & Scheines, 2008); otherwise executive racing yields thin learning.

**Commercial implication:** Do not sell “we tutor metacognition so scores rise.” Sell **instrumental help + SE/fade gates + solo proof**. Metacognitive nags are support tools, not the FEI product.

**Kill:** Help-Tutor cosplay as ACT-point engine.  
**Survive:** Deliberate-help UX + SAFE-SE on hints + FADE ladder; HELP-* before metacognition brand campaigns.

---

## LXXXIX.7 Contingent scaffolding — system share of the load

**FACT:** Contingent / adaptive hint level (Wood & Wood, 1999; Luckin & du Boulay, 1999 — cited in Roll et al., 2011) reduces opportunities for some maladaptive patterns by matching help grain to estimated need — a design cousin of Cognitive Tutor delays between rapid hint requests.

**Applied (HYPOTHESIS):** MindCraft should prefer **contingent stage** (SAFE-FADE E0–E3 driven by struggle/solo evidence) over unlimited student-chosen bottom-out. Student agency remains: they can request the next instrumental grain; the system refuses instant executive completion on learn rail without attempt.

**SPECULATION:** Fully automatic “AI chooses every hint” without inspectable why will read as surveillance pedagogy to parents and as black-box to tutors — prefer named stage + reason chip (ties SAFE-ADAPT inspectability pattern).

**Kill:** Unlimited student-controlled answer dump as personalization.  
**Survive:** Contingent ladder + requestable next grain + visible stage.

---

## LXXXIX.8 Product surface — SAFE-HELP claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Solver learn rail | Instrumental first; bottom-out behind attempt/SE | Instant full answer |
| Practice hints | Levelled hints; binge gate; fade-up after solos | Hint spam = progress |
| After 2–3 misses | Offer help / completion; don’t shame ask | Silent freeze as virtue |
| Tutor HITL | Prompt recruit of student why before pour | Tutor as answer key |
| Parent view | Aggregate deliberate-help / solo — not hint shame | Live hint-stalk dashboard |
| Marketing | “Help that teaches the next step” | “Unlimited hints / never stuck” |
| Prove / exam rail | Minimal executive help; KR timing (SAFE-FBTIME) | Learn-rail binge under stakes |

**Competitive foil:** ChatGPT wins executive completion. Struggle-only apps win avoidance theater. Duo-like products win engagement loops. MindCraft differentiates on **instrumental, contingent help that still demands Maya’s construction** — then disappears into solo transfer.

---

## LXXXIX.9 Doctrine — SAFE-HELP (provisional)

1. **Instrumental > executive** — help must leave a student-generated step; bottom-out is a last grain, not the brand.  
2. **Abuse and avoidance are both failures** — binge racing and freeze both fail FEI; design for both detectors.  
3. **Contingent stage, not unlimited menu** — help level tracks evidence (SAFE-FADE); student requests next grain, not full dump by default.  
4. **Sense-making gate** — hints without SE/attempt are incomplete (SAFE-SE × Aleven 2016).  
5. **Metacognition is not score magic** — deliberate-help skill can improve without domain gains; co-primary stays transfer/solo.  
6. **Dignity telemetry** — `hint_binge` / reveal rate for product + tutor QA; never parent shame ranks.  
7. **Copy:** “Ask for the next step — not the finished answer.” Never “unlimited hints so you’re never stuck.”  
8. **Tie rails** — learn rail allows instrumental ladders; prove rail stays near solo (SAFE-EXAM / SAFE-DURABLE).

**Confidence:** High that executive hint racing/gaming is common and often anti-learning (Aleven/Koedinger; Baker; Aleven et al., 2016). High that instrumental vs executive is the commercial fork (Nelson-Le Gall / Karabenick via Roll et al., 2011). High that contingent tutoring beats free bottom-out as design prior (Wood & Wood, 1999). High that Help Tutor–style feedback can change help behavior without guaranteed domain gains (Roll et al., 2011; Aleven et al., 2016) — medium that SE+fade closes that gap (HELP-*). Medium parent CBC preference for instrumental copy (HELP-5). High that unlimited-hints brand ≈ ChatGPT completion.

---

## LXXXIX.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| HELP-1 | Contingent instrumental ladder vs unlimited bottom-out Solver | A/B within concept | `solo_transfer_pass`; `hint_binge`; near transfer |
| HELP-2 | SE-required before next hint level vs free drill-down | A/B | Deliberate hint time; transfer; binge |
| HELP-3 | Help-invite after 2 misses vs no invite (avoidance arm) | A/B | Help recruit; eventual solo; anxiety item |
| HELP-4 | Metacognitive binge message vs silent gate vs neither | A/B/C | Help behavior; domain transfer (expect possible null on domain) |
| HELP-5 | Parent CBC: “next-step help” vs “unlimited hints” vs “we never show answers” | CBC | WTP; trust (SAFE-WTP) |
| HELP-QUAL | 10 Maya: when does a hint feel like a tool vs a theft of the win? | Qual | Instrumental/executive codebook |

**Falsifier:** Unlimited bottom-out wins delayed solo transfer *and* 26w identity equally → still ban as *brand* vs ChatGPT; segregate rare emergency reveal from marketing.  
**Falsifier:** Aggressive binge gates raise avoidance and drop retention with no solo gain → soften gate; keep instrumental-first doctrine.  
**Falsifier:** Metacognitive messages alone raise ACT-relevant transfer → allow limited HELP-Tutor-style copy; still co-primary solo, not Help Score™.

**Pre-register:** HELP-* before any “unlimited hints / never stuck / AI knows exactly when to help” campaign (SAFE-LABMETA). Sibling id 91 (hint economy) owns peek-cost pricing experiments — do not duplicate as HELP-$.

---

## LXXXIX.11 So what for MindCraft commercially

- **Copy:** “Ask for the next step — not the finished answer.” Lead with instrumental help + solo proof.  
- **Product:** Contingent hint/fade ladder; SE/attempt before bottom-out; help-invite on avoidance; binge gates without shame UX.  
- **Positioning:** Against ChatGPT executive completion and struggle-theater grit; for self-regulated help that graduates into independence.  
- **Metric:** `hint_binge`, `ai_reveal_rate`, `help_recruit_then_solo`, deliberate hint time, co-primary `solo_transfer_pass` — demote hint count / help NPS as success.  
- **Kill list:** Unlimited-hints hero; help NPS NS; avoidance-as-grit; Help Score™; parent hint-stalk; metacognition≡ACT points.  
- **Growth:** Parent decks sell *earned independence of help*; tutors QA to instrumental prompts (SAFE-HITL × SAFE-TALK).  
- **Vision:** Thirty-year identity company teaches Maya *when and how* to recruit support — then to need less of it — not a hint vending machine or a silence cult.

---

## References (verified)

- Aleven, V., & Koedinger, K. R. (2000/2001). Investigations into help seeking and learning with a Cognitive Tutor (and related early EDM reports). PACT / CMU technical line; synthesized in Aleven et al. (2016).  
- Aleven, V., McLaren, B., Roll, I., & Koedinger, K. (2004). Toward tutoring help seeking: Applying cognitive modeling to meta-cognitive skills. In *ITS 2004* (pp. 227–239). Springer.  
- Aleven, V., McLaren, B., Roll, I., & Koedinger, K. (2006). Toward meta-cognitive tutoring: A model of help seeking with a Cognitive Tutor. *International Journal of Artificial Intelligence in Education*.  
- Aleven, V., McLaren, B. M., Roll, I., & Koedinger, K. R. (2016). Help helps, but only so much: Research on help seeking with intelligent tutoring systems. *International Journal of Artificial Intelligence in Education, 26*(1), 205–223. https://doi.org/10.1007/s40593-015-0089-1  
- Baker, R. S., Corbett, A. T., Koedinger, K. R., & Roll, I. (2005/2008). Detecting / adapting to when students game an intelligent tutoring system (gaming-the-system line; help abuse as gaming category).  
- Karabenick, S. A., & Knapp, J. R. (1991). Relationship of academic help seeking to the use of learning strategies and other instrumental achievement behavior. *Journal of Educational Psychology* (instrumental vs executive framing in help-seeking literature).  
- Nelson-Le Gall, S. (1981). Help-seeking: An understudied problem-solving skill in children. *Developmental Review*.  
- Roll, I., Aleven, V., McLaren, B. M., Ryu, E., Baker, R. S. J. d., & Koedinger, K. R. (2006). The Help Tutor: Does metacognitive feedback improve students’ help-seeking actions? In *ITS 2006*.  
- Roll, I., Aleven, V., McLaren, B. M., & Koedinger, K. R. (2011). Improving students’ help-seeking skills using metacognitive feedback in an intelligent tutoring system. *Learning and Instruction, 21*(2), 267–280. https://doi.org/10.1016/j.learninstruc.2010.07.004  
- Shih, B., Koedinger, K. R., & Scheines, R. (2008). A response time model for bottom-out hints as worked examples (EDM / Cognitive Tutor analyses; cited in Aleven et al., 2016).  
- Wood, H., & Wood, D. (1999). Help seeking, learning and contingent tutoring. *Computers & Education, 33*(2–3), 153–169.  
