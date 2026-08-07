# Part XCV — Cognitive Apprenticeship in Tutor Playbooks

**Chapter status:** Living evidence + HITL ops brief — Researcher tick 2026-08-07  
**Primary question:** How should MindCraft encode **cognitive apprenticeship** (modeling → coaching → scaffolding → fading + articulation/reflection/exploration) into tutor playbooks and coach UX — without guild cosplay, demo-only “teaching,” or never-fade permanent coaching?  
**Owners:** HITL ops · Tutor training · Coach / Solver product · Brand · Red Team  
**Commercial job:** Ship a **SAFE-APPRENTICE** doctrine: make expert *thinking* visible, then transfer responsibility on a fade schedule; prove with solo transfer and articulation quality — never Master Score™, modeling-as-lecture, or “we’re an apprenticeship” costume ads.

**Builds on:** Parts XXVI (CLT / tutoring calibration), LI (deliberate practice spine), LII (CoP careful transfer), LIV (AAR), LXVIII (HITL), LXXI (tutor grain), LXXXIV (talk-ratio), LXXXVIII–XCI (fade / help / hint), XCII–XCIV (explain / retrieve / PF). Sibling: SAFE-FADE owns *Solver example stage*; this chapter owns the **full method stack + sociology of the session** for human tutors and the AI coach that must not impersonate a guild.

---

## XCV.1 Why this chapter exists

Brand temptation: “Learn like an apprentice under a master.” Competitor temptation: “Watch the AI solve it, then mimic.” Both fail the Collins test.

Cognitive apprenticeship was proposed because school often *hides* thinking: students see answers, not the control decisions, heuristics, and belief checks experts use. Collins, Brown, and Newman’s fix is not medieval cosplay — it is a design for making cognition visible, supporting performance, then withdrawing support so the learner owns the craft.

MindCraft already fades worked examples (SAFE-FADE), prices peeks (SAFE-HINT), and measures construction (SAFE-TALK). The open commercial question is whether tutor **playbooks** and coach **phase labels** implement the *whole* method stack — or whether we slap “apprenticeship” on explain-first sessions and call it science.

**FOUNDER BELIEF under audit:** Sessions briefed as model→coach→fade with forced student articulation will beat explain-pour + “got it?” on `solo_transfer_pass` and transfer without raising talk-% vanity.

**Claims we refuse as doctrine:**
1. Guild / master / “journeyman math” costume as pedagogy proof.  
2. Modeling ≡ lecture or AI monologue without student attempt.  
3. Scaffolding without fading (permanent coach dependency).  
4. Talk-ratio alone ≡ cognitive apprenticeship (SAFE-TALK already killed airtime dogma).  
5. Apprenticeship Score™ / “hours under master” North Stars.  
6. Discord / community ≡ apprenticeship (SAFE-CoP boundary).  
7. Reciprocal-teaching costume without turn-taking dialogue fidelity.  
8. “Cognitive apprenticeship” marketing without inspectable method phases in the session log.

---

## XCV.2 Constructs (keep methods distinct)

| Construct | Research meaning | MindCraft analogue | Not the same as |
|-----------|------------------|--------------------|-----------------|
| **Modeling** | Expert externalizes thinking while performing | Think-aloud on one item; coach “watch my control moves” card | Dumping a full solution without process talk |
| **Coaching** | Observe learner; hints, feedback, reminders, new tasks in situ | Tutor prompts mid-attempt; soft→hard peeks | Pre-scripted lecture |
| **Scaffolding** | Temporary support controlling hard elements so learner can succeed on rest | Completion problems; Map-briefed hints; Wood functions | Permanent answer key |
| **Fading** | Gradual removal of support toward independence | SAFE-FADE E0→E3; less tutor airtime | Abrupt “you’re on your own” shame |
| **Articulation** | Learner states knowledge/reasoning | SE prompts; postmortem why (SAFE-ANNOT cousin) | “Got it?” yes/no |
| **Reflection** | Compare own process to expert/peer | AAR light; film-clip of *their* attempt | Generic tip flood |
| **Exploration** | Learner sets goals / invents problems | Challenge accept; optional PF generate phase | Unguided forever |
| **SAFE-APPRENTICE** | When/how to run the stack in HITL + coach | This chapter | Guild branding |

**Operational definition (HYPOTHESIS):** A session is *SAFE-APPRENTICE compliant* when (a) at least one short modeling segment makes *control/heuristic* moves audible (not only algebra steps), (b) the majority of problem time is student performance under coaching, (c) scaffolds are logged and *fade within the session or across the mission*, (d) the student articulates a principle or misconception before bottom-out reveal, (e) reflection compares *their* attempt to a canonical path (not a tip dump), (f) outcomes judged on solo transfer + articulation quality, not modeling minutes or master praise, and (g) AI coach phases use the same labels — monologue without attempt fails the gate.

---

## XCV.3 The framework — methods that make thinking visible

**FACT:** Collins, Brown, & Newman (1989, in L. B. Resnick, Ed., *Knowing, learning, and instruction: Essays in honor of Robert Glaser*, pp. 453–494, Erlbaum) — propose *cognitive apprenticeship* to teach the crafts of reading, writing, and mathematics by adapting traditional apprenticeship (observation, coaching, practice / modeling, coaching, fading) so that otherwise invisible cognitive and metacognitive processes become observable. Core methods: modeling, coaching, scaffolding (with fading), articulation, reflection, exploration. Content types include domain knowledge, heuristic strategies, control strategies, and learning strategies. Sequencing principles include global before local skills, increasing complexity and diversity.

**FACT:** Collins, Brown, & Holum (1991, *American Educator*, Winter) — practitioner restatement: traditional apprenticeship’s four aspects are modeling, scaffolding, fading, and coaching; cognitive apprenticeship extends these to school subjects and adds articulation, reflection, and exploration so students generalize and take autonomy. Emphasizes that in schooling, thinking is often invisible to both student and teacher — the design problem is visibility + transfer of responsibility.

**FACT:** Brown, Collins, & Duguid (1989, *Educational Researcher, 18*(1), 32–42, doi:10.3102/0013189X018001032) — argue knowledge is situated in activity, context, and culture; propose cognitive apprenticeship as an alternative to didactic methods that treat concepts as context-free. Cite Schoenfeld’s math problem-solving teaching and other classroom designs as exemplars of entering a *culture of practice* (tool use under authentic activity) rather than memorizing inert procedures.

**Applied (HYPOTHESIS):** MindCraft tutor briefs must name **phase** (`model` | `coach` | `scaffold` | `fade` | `articulate` | `reflect` | `explore`) in the session checklist — not “be Socratic” as a vibe. Product coach UI should show the same phase chip so AI and human share a fidelity language (SAFE-HITL / SAFE-TALK).

**Kill:** “Apprenticeship” as brand adjective with no phase log.  
**Survive:** Inspectable method stack; thinking made audible; responsibility transferred.

---

## XCV.4 Math exemplar — Schoenfeld’s problem-solving teaching

**FACT:** Schoenfeld (1985, *Mathematical Problem Solving*, Academic Press) — framework for expert/novice math problem solving across resources, heuristics, control, and belief systems; documents teaching methods that make control and heuristic selection explicit rather than treating “problem solving” as extra practice items.

**FACT (as cited in the CA literature):** Collins et al. (1989/1991) and Brown et al. (1989) treat Schoenfeld’s college problem-solving teaching as a cognitive-apprenticeship exemplar: modeling heuristic selection and control on live problems, coaching students as they attempt, scaffolding/fading support, and pushing reflection on process — aimed at entering mathematical *practice*, not only accumulating procedures.

**Applied (FOUNDER BELIEF → testable):** Tutor playbooks for ACT-adjacent sessions should script **one** short model of *control talk* (“I’m stuck — I’ll try a simpler case / check units / draw the join”) before coaching the student’s attempt. Modeling only algebra steps without control talk fails Schoenfeld’s point and becomes SAFE-EXPLAIN monologue risk.

**Kill:** Heuristic tip card flood without student control practice.  
**Survive:** Audible control moves + student ownership of the next attempt.

---

## XCV.5 Scaffolding is a function set — not a permanent crutch

**FACT:** Wood, Bruner, & Ross (1976, *Journal of Child Psychology and Psychiatry, 17*(2), 89–100, doi:10.1111/j.1469-7610.1976.tb00381.x) — characterize tutoring as a *scaffolding* process: the tutor controls elements beyond the learner’s capacity so the learner can complete what is within reach. Functions include recruitment, reduction of degrees of freedom, direction maintenance, marking critical features, frustration control, and demonstration.

**FACT:** Palincsar & Brown (1984, *Cognition and Instruction, 1*(2), 117–175, doi:10.1207/s1532690xci0102_1) — reciprocal teaching: tutor and students take turns leading dialogue (summarize, question, clarify, predict); adult models then fades leadership; improves comprehension and transfer relative to typical classroom practice in reported studies. Collins et al. treat this as a canonical CA method stack for reading — turn-taking + fade of expert lead.

**FACT (review grain):** Dennen (2004, “Cognitive apprenticeship in educational practice,” in *Handbook of Research on Educational Communications and Technology*) — synthesizes research on scaffolding, modeling, mentoring, and coaching as CA strategies; notes modeling/coaching/fading as predominant methods, with scaffolding as part of coaching; fading is gradual (hints become less frequent/detailed), not abrupt abandonment. Warns that implementations vary — label ≠ fidelity.

**Bridge to SAFE-FADE / SAFE-HINT / SAFE-HELP:** Worked-example fading and contingent peeks are *product instantiations* of scaffolding+fading. Cognitive apprenticeship adds the **sociology**: who leads the dialogue, when the expert models, when the learner must articulate. Reciprocal-style turn-taking on a hard item (student leads a “what do we know / what’s the join?” beat) is a HITL technique, not a Discord forum.

**Kill:** Permanent scaffold as kindness brand; reciprocal-teaching costume without turn-taking.  
**Survive:** Wood-function scaffolds with scheduled fade; student-led beats.

---

## XCV.6 Boundaries — situated culture ≠ lore franchise; CA ≠ discovery

**FACT / boundary (Brown et al., 1989):** Situated cognition argues for authentic activity and culture of practice — not that any immersive story world equals apprenticeship. SAFE-STORYLOAD already budgets narrative load; CA does not license lore walls as “culture.”

**Boundary with SAFE-PF:** Exploration in Collins’s sense can include learner-set goals; Kapur PF is a *specific* generate→consolidate design. Do not rename every explore beat as PF, and do not run invent-first when the playbook called for modeling first on thin priors.

**Boundary with Kirschner/Sweller/Clark (2006) critique (already in XCIV):** Cognitive apprenticeship is *not* minimal guidance forever. Modeling and scaffolding are strong guidance; fading withdraws them as competence grows. Branding “apprenticeship” while shipping unguided stew fails both CA and the guidance literature.

**Kill:** Lore≡culture-of-practice; CA as discovery cosplay; never-guide brand.  
**Survive:** Guided visibility → fade; authenticity = real problem work + audible thinking, not franchise trivia.

---

## XCV.7 Product surface — SAFE-APPRENTICE claim contract

| Surface | Required behavior | Banned substitute |
|---------|-------------------|-------------------|
| Tutor playbook | Phase checklist: model (short) → coach → fade; articulation required | “Be warm / Socratic” vibes only |
| Live session QA | Log `ca_phase`; sample for modeling-without-attempt / never-fade | Talk-% only QA |
| Coach / Solver | Phase chip aligned with fade×hint; SE before wrap | AI monologue labeled “modeling” |
| Map brief | Heuristic/control focus for the target join | Tip flood / lore dump |
| AAR / Notes | Reflection on *student* process vs canonical | Tip-of-the-day dump |
| Parent copy | “We show how experts think, then you take the wheel” | Master/guild / hours-under-tutor |
| Marketing | Method stack + solo proof | “Cognitive apprenticeship™” without phases |
| Analytics | Phase dwell, fade events, articulation rate, solo transfer | Apprenticeship Score™ / modeling-minutes NS |

**Competitive foil:** ChatGPT = fluent modeling without coaching/fade/articulation. Khan = content without audible control craft. Duo = practice without expert thinking made visible. MindCraft = **visible craft + transferred responsibility** under FEI.

---

## XCV.8 Doctrine — SAFE-APPRENTICE (provisional)

1. **Visibility first** — model *control/heuristic* moves, not only steps (Collins; Schoenfeld).  
2. **Performance under coaching** — most minutes = student attempt with in-situ support (coaching ≠ lecture).  
3. **Scaffold then fade** — Wood functions + SAFE-FADE/HINT; no permanent crutch.  
4. **Articulation required** — student-generated why before bottom-out (SAFE-EXPLAIN / SE).  
5. **Reflection on their work** — compare learner process to canonical (AAR/ANNOT light).  
6. **Exploration gated** — challenge/PF only when priors/affect allow (SAFE-PF / RETRIEVE).  
7. **No costume metrics** — ban Apprenticeship Score™, guild cosplay, modeling-minutes NS.  
8. **Shared language** — human tutor and AI coach use the same phase labels; fidelity > brand word.

**Confidence:** High that Collins et al. (1989/1991) define a method stack (model/coach/scaffold/fade + articulate/reflect/explore) aimed at making cognition visible. High that Brown et al. (1989) situate CA as an alternative to inert didactic knowledge. High that Schoenfeld (1985) supplies a math-relevant control/heuristic/belief frame used as a CA exemplar in that literature. High that Wood et al. (1976) and Palincsar & Brown (1984) specify scaffolding and reciprocal fade-of-leadership mechanisms. Medium that MindCraft HITL can hit phase fidelity at scale without over-scripting warmth away — run APPRENTICE-* with QA sampling. Medium that AI coach “modeling” can externalize control without becoming monologue — co-test with SAFE-EXPLAIN length caps.

---

## XCV.9 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| APPRENTICE-1 | Playbook with explicit model→coach→fade+articulate vs explain-pour control | A/B sessions | `solo_transfer_pass`; articulation rubric |
| APPRENTICE-2 | Short control-talk model vs steps-only model before same coaching | A/B | Near transfer; student control moves coded |
| APPRENTICE-3 | Within-session fade schedule vs constant high scaffold | A/B | Solo transfer; peek binge; dependency |
| APPRENTICE-4 | Reciprocal student-led beat (1 item) vs tutor-led whole session | A/B | Construction share; transfer |
| APPRENTICE-5 | Parent CBC: “show thinking then you take over” vs “master tutor explains” vs “AI always models” | CBC | WTP; trust (SAFE-WTP) |
| APPRENTICE-QUAL | 10 tutors + 10 Maya: phenomenology of phase checklist vs vibe coaching | Qual | Fidelity codebook; costume markers |

**Falsifier:** Explain-pour equals or beats model→coach→fade on solo transfer *and* articulation for our secondary cohort → keep CA language internal; do not market apprenticeship.  
**Falsifier:** Steps-only model equals control-talk model → demote control-talk chrome; still ban monologue-as-modeling.  
**Falsifier:** Parents prefer master-explains CBC and reject take-the-wheel → rewrite copy before surrendering to explain-first brand.

**Pre-register:** APPRENTICE-* before any “cognitive apprenticeship / guild / master tutor / Apprenticeship Score™” campaign (SAFE-LABMETA). Do not steal FADE-*/HINT-*/TALK-*/PF-* arms — those own example stage, peek pricing, construction telemetry, and invent-first sequencing; this family owns **playbook phase fidelity** across the stack.

---

## XCV.10 So what for MindCraft commercially

- **Copy:** “We make the thinking visible — then you take the wheel.” Never “study under a master” guild cosplay or “watch the AI solve everything.”  
- **Product:** `ca_phase` on session/coach events; playbook checklist; articulation gate before hard reveal; fade schedule linked to SAFE-FADE/HINT.  
- **Positioning:** Against ChatGPT monologue-as-tutor *and* content libraries without craft visibility; for inspectable apprenticeship *methods*, not costumes.  
- **Metric:** solo transfer + articulation quality + fade events — demote modeling-minutes / Apprenticeship Score™ / talk-% alone.  
- **Kill list:** Guild cosplay; modeling≡lecture; never-fade; talk-%≡CA; Apprenticeship Score™; Discord≡apprenticeship; reciprocal costume without turns; CA ads without phase logs.  
- **Growth:** Tutor ops hire/train on phase fidelity (feeds SAFE-HITL / WORKFORCE); parent decks sell take-the-wheel honesty.  
- **Vision:** Maya hears how a competent solver *manages* stuckness — then does it herself — so identity shifts from “I need someone to show me” to “I can run the craft.”

---

## References (verified)

- Brown, J. S., Collins, A., & Duguid, P. (1989). Situated cognition and the culture of learning. *Educational Researcher, 18*(1), 32–42. https://doi.org/10.3102/0013189X018001032  
- Collins, A., Brown, J. S., & Holum, A. (1991). Cognitive apprenticeship: Making thinking visible. *American Educator, 15*(3), 6–11, 38–46.  
- Collins, A., Brown, J. S., & Newman, S. E. (1989). Cognitive apprenticeship: Teaching the crafts of reading, writing, and mathematics. In L. B. Resnick (Ed.), *Knowing, learning, and instruction: Essays in honor of Robert Glaser* (pp. 453–494). Lawrence Erlbaum Associates.  
- Dennen, V. P. (2004). Cognitive apprenticeship in educational practice: Research on scaffolding, modeling, mentoring, and coaching as instructional strategies. In D. H. Jonassen (Ed.), *Handbook of research on educational communications and technology* (2nd ed., pp. 813–828). Lawrence Erlbaum Associates.  
- Palincsar, A. S., & Brown, A. L. (1984). Reciprocal teaching of comprehension-fostering and comprehension-monitoring activities. *Cognition and Instruction, 1*(2), 117–175. https://doi.org/10.1207/s1532690xci0102_1  
- Schoenfeld, A. H. (1985). *Mathematical problem solving*. Academic Press.  
- Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and Psychiatry, 17*(2), 89–100. https://doi.org/10.1111/j.1469-7610.1976.tb00381.x  
