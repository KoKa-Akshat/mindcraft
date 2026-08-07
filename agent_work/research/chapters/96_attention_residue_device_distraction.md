# Part XCVI — Attention Residue & Device Distraction in Practice

**Chapter status:** Living evidence + practice UX brief — Researcher tick 2026-08-07  
**Primary question:** How should MindCraft treat **attention residue** and **device/media distraction** during practice and tutoring so FEI attempts stay cognitively available — without Focus Score™ theater, phone-shame branding, or pretending “mobile-first” erases switching costs?  
**Owners:** Practice UX · Coach / session design · Parent honesty · Brand · Red Team  
**Commercial job:** Ship a **SAFE-ATTN** doctrine: protect working memory for the attempt; make task-switch tax inspectable; offer opt-in focus modes and tech breaks — never monetize multitasking heroics or sell distraction-free as guaranteed ACT points.

**Builds on:** Parts XXVI (CLT), XLI (DD × anxiety), XLVII (sleep/stress), LXIII (exam pressure), LXXXV (story-load), XCIII (retrieval failure modes), XCV (apprenticeship phases need available attention). Sibling surfaces: habit cues (XLIII) without streak-as-focus; privacy (LXIX) if we ever log “distraction” signals.

---

## XCVI.1 Why this chapter exists

Brand temptation: “Our app is so engaging students never look away.” Competitor temptation: “Practice anywhere — phone in hand, tabs open, notifications on.” Both ignore the load-bearing constraint: mathematical thinking is a limited-capacity resource, and unfinished or competing cognitions steal it.

Sophie Leroy’s *attention residue* names the leftover cognitions about Task A that persist after switching to Task B. Smartphones add a second tax: even *unused* phones can drain available capacity (Ward et al.). Media multitasking while studying is common and reliably associated with worse academic outcomes in reviews and meta-analyses — not because teens are morally weak, but because switching and divided attention interfere with encoding and control.

MindCraft already fights fake struggle theater (SAFE-RETRIEVE), lore load (SAFE-STORYLOAD), and monologue token tax (SAFE-EXPLAIN). The open question: do we **design for residue and device presence**, or ship notification “engagement” and call interrupted attempts grit?

**FOUNDER BELIEF under audit:** Fewer mid-attempt switches and lower phone salience will raise `solo_transfer_pass` and cut freeze/binge-peek vs notification-on defaults — without a Focus Score™.

**Claims we refuse as doctrine:**
1. Focus Score™ / Deep Work Score™ as North Star.  
2. Phone-shame or “kids these days” moralizing as pedagogy.  
3. “Mobile-first multitasking is fine for math” without residue accounting.  
4. Always-on push notifications as engagement science.  
5. Streak / DAU protection via interrupt-driven re-engagement during an attempt.  
6. Presence of phone ≡ proof of modern learning.  
7. Focus-mode ads that promise guaranteed ACT points or “cured distraction.”  
8. Covert keystroke/gaze distraction surveillance without SAFE-PRIVACY gates.

---

## XCVI.2 Constructs (keep mechanisms distinct)

| Construct | Research meaning | MindCraft analogue | Not the same as |
|-----------|------------------|--------------------|-----------------|
| **Attention residue** | Cognitions about prior Task A persist into Task B | Mid-mission chat ping; unfinished homework tab; tutor Slack | Mere time-on-app |
| **Task-switch cost** | Performance drop when changing task sets | Alt-tab mid-item; notification → return | Deliberate interleaving of *problem types* (Part XXXIX) |
| **Media multitasking** | Concurrent media streams / off-task tech while studying | Phone + practice; social tab + Solver | Dual coding *within* one math item (Part XCVII queue) |
| **Phone presence / brain drain** | Own phone nearby reduces available WMC/Gf even unused | Phone on desk during timed set | Using phone *as* the practice device intentionally |
| **SAFE-ATTN** | When/how to protect attempt windows | This chapter | Productivity-guru cosplay |

**Operational definition (HYPOTHESIS):** A mission is *SAFE-ATTN compliant* when (a) the product does not fire engagement pushes during an active attempt, (b) optional focus mode suppresses non-essential chrome and suggests phone-away for desk sessions, (c) tech-break / resume affordances exist so unfinished social cognitions can close cleanly (Leroy completion logic), (d) analytics separate `attempt_interrupted` from productive struggle modes (SAFE-RETRIEVE), (e) outcomes judged on transfer and construction — not Focus Score™ or minutes-without-switch vanity, and (f) any distraction telemetry is opt-in, non-biometric, and privacy-bound.

---

## XCVI.3 Attention residue — unfinished cognitions steal the next task

**FACT:** Leroy (2009, *Organizational Behavior and Human Decision Processes, 109*(2), 168–181, doi:10.1016/j.obhdp.2009.04.002) — defines *attention residue* as the persistence of cognitive activity about Task A after one has stopped working on Task A and is performing Task B. Two experiments show people struggle to fully transition attention away from unfinished prior work; subsequent Task B performance suffers. Finishing Task A before switching helps, but is not always enough: time pressure while finishing the prior task aids disengagement and contributes to higher subsequent performance. The mechanism is not “lazy switching” folklore — it is residual cognitions occupying capacity needed for the next task.

**Applied (HYPOTHESIS):** Mid-attempt notifications, coach chat bubbles, and “come back!” streaks create *unfinished social/app tasks* that leave residue on the math item. Product should prefer **close-the-loop** patterns: finish or park the interrupt (snooze with explicit resume) before demanding germane load on the problem.

**Kill:** Interrupt-driven engagement during active attempts as “habit science.”  
**Survive:** Protect attempt windows; allow clean completion/park of interrupts.

---

## XCVI.4 Device distraction & media multitasking — field pattern, not vibes

**FACT:** Rosen, Carrier, & Cheever (2013, *Computers in Human Behavior, 29*(3), 948–958, doi:10.1016/j.chb.2012.12.001) — observed 263 middle-school, high-school, and university students studying 15 minutes at home. Participants averaged **less than six minutes** on task before switching, most often to technological distractions (social media, texting) or task-switching preference. Students who accessed Facebook had lower GPAs than those who avoided it; higher use of study strategies predicted more on-task behavior. Authors discuss short “technology breaks” and metacognitive strategies about when interruptions hurt — not total abstinence theater.

**FACT:** May & Elder (2018, *International Journal of Educational Technology in Higher Education, 15*, 13, doi:10.1186/s41239-018-0096-z) — literature review: media multitasking interferes with attention and working memory and is associated with worse GPA, test performance, recall, reading comprehension, note-taking, self-regulation, and efficiency, in class and while studying. Students often **misjudge** how much multitasking will cost them. Self-regulation support is a promising intervention direction.

**FACT:** Kates, Wu, & Coryn (2018, *Computers & Education, 127*, 107–112, doi:10.1016/j.compedu.2018.08.012) — meta-analysis of mobile phone use (non-educational-improvement use) and academic outcomes over 2008–2017: overall average effect *r* = −0.162 (95% CI −0.196 to −0.128) — a **small negative** association, not a cartoon catastrophe and not zero. Effect sizes vary by design and construct; do not market “phones destroy learning” as a 2-sigma claim.

**Applied (HYPOTHESIS):** MindCraft should treat off-task media as a **moderated tax** on FEI attempts: design for fewer switches and better metacognition, instrument interruption, and avoid both denial (“multitask freely”) and moral panic (“ban phones or fail”).

**Kill:** Phone-apocalypse marketing; “multitasking digital natives” as free pass.  
**Survive:** Small-to-medium evidenced tax; self-regulation affordances; tech breaks.

---

## XCVI.5 Mere presence — the phone can tax you without a tap

**FACT:** Ward, Duke, Gneezy, & Bos (2017, *Journal of the Association for Consumer Research, 2*(2), 140–154, doi:10.1086/691462) — “brain drain” hypothesis: mere presence of one’s own smartphone can occupy limited-capacity cognitive resources. Across experiments, available working memory capacity and fluid intelligence measures were worse when the phone was more salient (e.g., desk vs other room), even when participants were not using the phone and did not report thinking about it. Costs were highest for those highest in smartphone dependence.

**Applied (FOUNDER BELIEF → testable):** For desk/laptop practice and tutor sessions, default copy can invite “phone in another room / face-down out of reach” as a *capacity* tip — framed as working-memory hygiene, not character judgment. On phone-as-device sessions, the tradeoff flips: the practice surface *is* the phone — then minimize *competing* apps/notifications rather than pretending presence-drain vanishes.

**Boundary:** Ward et al. are lab cognitive-capacity tasks, not ACT RCTs. Do not claim “phone in bag = +N ACT points.”

**Kill:** Guaranteed-score focus kits; shaming dependent users in parent dashboards.  
**Survive:** Optional salience reduction; honesty that unused phones can still cost capacity.

---

## XCVI.6 Cognitive control — heavy multitaskers are not automatically better switchers

**FACT:** Ophir, Nass, & Wagner (2009, *Proceedings of the National Academy of Sciences, 106*(37), 15583–15587, doi:10.1073/pnas.0903620106) — heavy media multitaskers (vs light) showed greater susceptibility to interference from irrelevant environmental stimuli and memory representations, and *worse* performance on a task-switching test — consistent with a breadth-biased control style that filters poorly. Association, not proven causation from multitasking volume alone; still kills the folk claim “kids who multitask all day are better at switching for homework.”

**Bridge to SAFE-RETRIEVE / SAFE-EXPLAIN:** Blanking and monologue wraps already burn WM. Residue + media interference compound those failure modes. Do not label notification-induced stalls as productive struggle.

**Kill:** Multitasking-as-talent brand.  
**Survive:** Filter-friendly session design; one primary cognitive thread during attempts.

---

## XCVI.7 Product surface — SAFE-ATTN claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Practice attempt | No marketing/streak pushes mid-item; visible “attempt in progress” lock | DAU pings during problem |
| Focus mode (opt-in) | Suppress non-essential chrome; suggest phone-away for desk; timed tech break | Focus Score™; forced lockout shame |
| Interrupt handling | Snooze/park with resume; log `attempt_interrupted` | Silent tab-switch ignored in analytics |
| Tutor sessions | Brief “devices down for attempt windows”; tech break between items | Phone-confiscation cosplay; emotion-AI attention cops |
| Parent copy | “Deep attempts need quiet WM — here’s an optional focus tip” | Shame ranks for “phone addiction”; Anxiety Score™ |
| Marketing | Capacity honesty; self-regulation aids | “Never distracted again” / guaranteed points |
| Analytics | Interrupt rate, resume latency, solo transfer | Focus Score™ / minutes-on-task NS alone |
| Privacy | No covert gaze/mic distraction scoring | Empathy-camera attention (SAFE-PRIVACY ban) |

**Competitive foil:** Duo = streak/notification engagement that may interrupt encoding. ChatGPT = infinite tab switching without attempt protection. Khan = video + phone parallel common. MindCraft = **attempt windows protected for construction**, with optional focus hygiene — still FEI, not productivity-guru SKU.

---

## XCVI.8 Doctrine — SAFE-ATTN (provisional)

1. **Residue is real** — unfinished cognitions tax Task B (Leroy); close or park interrupts before demanding the join.  
2. **Media multitasking costs learning on average** — reviews/meta show negative academic associations (May & Elder; Kates et al.); size is often small-to-moderate, not apocalyptic.  
3. **Presence can drain** — unused phones may reduce available capacity (Ward et al.); offer desk hygiene tips without shame.  
4. **Heavy multitasking ≠ better switching** — Ophir et al. association cuts against “digital native switcher” ads.  
5. **Protect FEI attempt windows** — no engagement pushes mid-item; separate interrupt telemetry from productive struggle.  
6. **Tech breaks > total war** — Rosen et al. style short breaks + metacognition beat abstinence theater.  
7. **No Focus Score™ NS** — prove with solo transfer / construction, not vanity focus minutes.  
8. **Privacy bound** — no biometric attention policing; opt-in only for any distraction signals.

**Confidence:** High that Leroy (2009) establishes attention residue as a measured Task A→B performance mechanism in experiments. High that Ward et al. (2017) show mere phone presence can reduce available WMC/Gf in lab tasks. High that May & Elder (2018) and Kates et al. (2018) document negative media-multitasking / phone-use associations with academic outcomes at review/meta grain. High that Rosen et al. (2013) observe frequent short on-task bouts and tech-driven switches in naturalistic studying. Medium that Ophir et al. (2009) generalize to MindCraft HS cohorts — association study, replication debates exist in the broader MMI literature; use as anti-folk-claim, not as trait diagnosis. Medium that product focus-mode + push suppression will move FEI metrics — run ATTN-* before Focus brand campaigns.

---

## XCVI.9 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| ATTN-1 | Mid-attempt push suppression vs default engagement pushes | A/B | `solo_transfer_pass`; interrupt rate; peek binge |
| ATTN-2 | Opt-in focus mode (chrome quiet + phone-away tip) vs control | A/B | Transfer; resume latency; self-report residue |
| ATTN-3 | Scheduled tech-break between items vs no break / vs mid-item free switch | A/B | On-task bout length; transfer |
| ATTN-4 | Desk session: phone other-room tip vs phone-on-desk (observational + randomized tip) | A/B / hybrid | Capacity proxies; FEI events |
| ATTN-5 | Parent CBC: “protect attempt windows” vs “streaks keep them coming back” vs “Focus Score™” | CBC | WTP; trust (SAFE-WTP) |
| ATTN-QUAL | 10 Maya: phenomenology of residue after chat/social interrupt during a hard item | Qual | Interrupt codebook; shame markers |

**Falsifier:** Push-on during attempts equals or beats push-off on solo transfer *and* retention for secondary cohort → keep ATTN internal; do not market focus windows.  
**Falsifier:** Focus mode harms anxious students (avoidance/shame) more than it helps transfer → demote forced focus; keep optional + anxiety-gated (XLI).  
**Falsifier:** Parents prefer streak-interrupt CBC and reject attempt-protection copy → rewrite GTM before surrendering to notification-growth brand.

**Pre-register:** ATTN-* before any “Focus Score™ / deep work / phone-free guaranteed gains / distraction-cured” campaign (SAFE-LABMETA). Do not steal RETRIEVE-*/HABIT-*/PRIV-* arms — those own struggle-mode taxonomy, cue design, and affect telemetry ethics; this family owns **attempt-window protection and device/residue hygiene**.

---

## XCVI.10 So what for MindCraft commercially

- **Copy:** “Hard math needs a clear head — we protect your attempt window.” Never “multitask like a pro” or “we’ll shame the phone out of you.”  
- **Product:** Mid-attempt push lock; opt-in focus mode; tech-break + resume; `attempt_interrupted` event distinct from freeze/TOT modes.  
- **Positioning:** Against notification-growth edtech *and* productivity-guru Focus Score™ SKUs; for capacity-honest practice that still ships FEI proof.  
- **Metric:** solo transfer + interrupt/resume quality — demote Focus Score™ / raw minutes-on-task / streak pings during items.  
- **Kill list:** Focus Score™ NS; phone-shame; multitasking-as-talent; mid-attempt DAU pushes; presence≡modern; guaranteed ACT from focus kits; covert attention surveillance.  
- **Growth:** Parent decks sell attempt hygiene as care, not control; tutor ops brief device norms between items.  
- **Vision:** Maya can finish a join without half her working memory still arguing with a group chat — so evidence of competence can land as identity, not as another interrupted almost.

---

## References (verified)

- Kates, A. W., Wu, H., & Coryn, C. L. S. (2018). The effects of mobile phone use on academic performance: A meta-analysis. *Computers & Education, 127*, 107–112. https://doi.org/10.1016/j.compedu.2018.08.012  
- Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. *Organizational Behavior and Human Decision Processes, 109*(2), 168–181. https://doi.org/10.1016/j.obhdp.2009.04.002  
- May, K. E., & Elder, A. D. (2018). Efficient, helpful, or distracting? A literature review of media multitasking in relation to academic performance. *International Journal of Educational Technology in Higher Education, 15*, 13. https://doi.org/10.1186/s41239-018-0096-z  
- Ophir, E., Nass, C., & Wagner, A. D. (2009). Cognitive control in media multitaskers. *Proceedings of the National Academy of Sciences, 106*(37), 15583–15587. https://doi.org/10.1073/pnas.0903620106  
- Rosen, L. D., Carrier, L. M., & Cheever, N. A. (2013). Facebook and texting made me do it: Media-induced task-switching while studying. *Computers in Human Behavior, 29*(3), 948–958. https://doi.org/10.1016/j.chb.2012.12.001  
- Ward, A. F., Duke, K., Gneezy, A., & Bos, M. W. (2017). Brain drain: The mere presence of one’s own smartphone reduces available cognitive capacity. *Journal of the Association for Consumer Research, 2*(2), 140–154. https://doi.org/10.1086/691462  
