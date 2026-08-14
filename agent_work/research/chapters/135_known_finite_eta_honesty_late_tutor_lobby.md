# Part CXXXV — Known-Finite ETA Honesty in Late-Tutor Lobby Copy

**Chapter status:** Living evidence + lobby-copy / ops brief — Researcher tick 2026-08-13 (UTC hour 03; hour%6≠0; researcher count since synthesizer v1.17 = 1 → Researcher)  
**Primary question:** When a tutor is late (or running behind), what **wait-duration copy** must MindCraft show so the lobby is a *known, finite* wait — not “soon,” not optimistic underestimates, not apology theater, and not a student-facing shame feed — while the SAFE-ASYNCBRIEF Set card still runs?  
**Owners:** Product (session lobby / ETA surface) · HITL ops / scheduling · Brand · Parent trust · SAFE-ASYNCBRIEF / SAFE-MICROBRIEF / SAFE-EXPECTANCY / SAFE-LOADSHED · Red Team  
**Commercial job:** Ship **SAFE-KNOWNETA** densifying SAFE-ASYNCBRIEF × Maister uncertain-wait × Hui/Tse duration information × Munichor/Rafaeli progress-vs-apology: **honest finite ETAs (with refresh rules)** beat vague reassurance; never ETA Score™, never shame-the-tutor public board, never “only a few more minutes” cosplay.

**Builds on:** Parts CXXXII (SAFE-ASYNCBRIEF — rule 7 foreshadows this chapter), CXXIX (SAFE-MICROBRIEF), CXXIII (SAFE-LOADSHED), XLVI (SAFE-EXPECTANCY), LX (SAFE-REPAIR light), LIX (SAFE-WTP), CXXVII (SAFE-CRUNCHMSG). Seams: late flag, ETA field, lobby banner, async Set card countdown, tutor join event, parent “session started late” honesty.

---

## CXXXV.1 Why this chapter exists

SAFE-ASYNCBRIEF answers *what the student does while waiting* (capped Set card). It left underspecified the **clock story** above the card: how long until the human arrives, how that number is stated, and what happens when the estimate slips again.

Ops and marketplace competitors resolve late waits wrongly:

1. **Vague “soon” / “almost here”** — open-ended anticipation (Maister’s nervous waiting room).  
2. **Optimistic under-promise failure** — announce 2 minutes, deliver 12; honesty debt compounds (pilot “few more minutes”).  
3. **Apology loops without numbers** — “sorry for the wait” every 30s with no duration (Munichor/Rafaeli: apologies can *worsen* reactions).  
4. **Spinner with no ETA** — unoccupied *and* uncertain.  
5. **Student-facing tutor-shame** — “your tutor is late again” as social theater.  
6. **Fake precision** — countdown to the second when ops only know ±5 minutes.

MindCraft’s wedge: **known-finite when we can know; labeled uncertainty when we cannot; refresh without gaslighting; Set card always available.** Trust is a product feature — late minutes happen; lying about them is optional.

**FOUNDER BELIEF under audit:** Identity-safe tutoring cannot teach “own your mistakes” while the lobby gaslights the clock. Finite honesty is FEI-adjacent culture, not hotel niceness.

**Claims we refuse as doctrine:**
1. “Soon” / “any moment” as default late copy.  
2. Systematic optimistic ETAs (announce short, deliver long).  
3. Apology-only fillers without duration or progress.  
4. ETA Score™ / Wait Satisfaction Score™ / Lobby Minutes NS.  
5. Public or student-directed tutor-shame feeds.  
6. Exact-second countdown theater when ops grain is coarse.  
7. ACT / retention guarantees from “we manage waits scientifically.”

---

## CXXXV.2 Constructs

| Construct | Meaning | MindCraft analogue | Failure mode |
|-----------|---------|--------------------|--------------|
| **Known-finite wait** | Stated remaining duration with a bound the student can plan against | “About 8 minutes — card available” | Fake precision; silent slip |
| **Uncertain wait** | No usable bound; anticipation without settle | “Soon”; spinning dots | Anxiety; phone residue |
| **Duration information** | Explicit wait-length message | ETA banner | Underestimate trap |
| **Progress information** | Sense that service is advancing | “Tutor en route / joining” status | Fake progress bars |
| **Appointment syndrome** | Pre-slot wait tolerable; post-slot open-ended | Late after booked time | Ignore booked-time breach |
| **SAFE-KNOWNETA** | Honesty rules for lobby ETA copy | This chapter | ETA Score™ |

**Operational definition (HYPOTHESIS):** A late/early lobby is *SAFE-KNOWNETA complete* when (a) if ops can estimate remaining delay, the UI shows a **finite band** (e.g. “about 5–10 minutes”) not “soon,” (b) if ops cannot estimate, copy **labels uncertainty** (“we don’t have a precise arrival yet”) and offers the async Set card + optional reschedule, (c) ETA updates **never shorten without evidence** and never repeat “almost” after a miss without a new finite band, (d) apology text is **optional and secondary** to duration/progress, (e) no student-facing shame attribution, and (f) success instruments are `eta_honesty_ok` (stated band vs actual join within policy) × `asyncbrief_complete` × time-to-first-FEI / abandonment — never Wait Minutes as learning NS.

---

## CXXXV.3 Uncertain waits feel longer than known, finite waits

**FACT:** Maister (1985, “The Psychology of Waiting Lines,” in Czepiel, Solomon, & Surprenant, *The Service Encounter*, Lexington Books) — among core propositions: **uncertain waits are longer than known, finite waits**; the deepest wait anxiety is *how long*; telling a patient “thirty minutes” produces initial annoyance then acceptance, while “soon” produces nervous anticipation; the pilot who keeps saying “only a few more minutes” adds insult when the wait continues — customers are not only delayed but **not dealt with honestly**; the **appointment syndrome** makes post-appointment delays feel especially unbounded even when short.

**Applied (HYPOTHESIS):** Tutor-late after a booked slot is appointment syndrome. Spinner + “your tutor will be with you shortly” is Maister’s bad waiting room. A finite band (“about 8 minutes”) lets Maya settle into the Set card. Repeating “just a couple more minutes” after the first miss is the pilot insult — commercially toxic for a brand that sells trust and Map honesty.

**Kill:** “Soon” default; repeated “few more minutes” after missed ETA.  
**Survive:** Finite band when estimable; honesty > optimism.  
**Wound:** Service-feel ≠ `solo_transfer_pass` — KNOWNETA-* must not claim ACT points from ETA UX.

---

## CXXXV.4 Uncertainty itself accumulates psychological cost

**FACT:** Osuna (1985, *Journal of Mathematical Psychology, 29*(1), 82–105, doi:10.1016/0022-2496(85)90020-3) — models the **psychological cost of waiting** as accumulated stress; stress intensity rises with time already spent *and* remaining-duration uncertainty; announcing service timing can reduce expected accumulated stress relative to opaque waits (model implications widely used in later queue psych).

**Applied (HYPOTHESIS):** Even before anger at “who is late,” unlabeled lobby time taxes affect. Finite ETA + completable Set card attacks both Osuna channels (waste *and* uncertainty) without inventing Calm Score™.

**Kill:** Opaque spinner as “neutral.”  
**Survive:** Announce a usable bound when possible.  
**Wound:** Formal stress integral ≠ teen tutoring field — use as mechanism, not formula in marketing.

---

## CXXXV.5 Duration information beats empty reassurance — especially mid-length waits

**FACT:** Hui & Tse (1996, *Journal of Marketing, 60*(2), 81–90, doi:10.1177/002224299606000206) — experimental study of **waiting-duration information** vs **queuing information** across short / intermediate / long waits; acceptability of the wait and affective response mediate effects on service evaluation more than perceived duration alone; **neither information type helps much in short waits**; **duration information has greater impact than queuing information in intermediate waits** and relatively less in very long waits.

**Applied (HYPOTHESIS):** MindCraft late delays often sit in the *intermediate* band (roughly several–fifteen minutes) where **duration copy matters most**. Queue-position (“you are #2”) is weak analogue for 1:1 booked tutoring — prefer duration bands. For very long delays, duration info alone is insufficient: offer reschedule / LOADSHED path, not prettier ETA.

**Kill:** Skip ETA because “the Set card is enough.”  
**Survive:** Duration band for intermediate late; escalate options when long.  
**Wound:** Lab wait minutes ≠ school schedule chaos — calibrate bands on ops data (KNOWNETA-1).

---

## CXXXV.6 Feedback on delay magnitude shapes attitudes — not only clock time

**FACT:** Larson (1987, *Operations Research, 35*(6), 895–905, doi:10.1287/opre.35.6.895) — speculative but highly cited OR forum: attitudes toward queues depend on more than delay length; **feedback regarding the likely magnitude of the delay** and queue environment influence customer attitudes and, often, market share; social justice (FIFO fairness) also matters; average wait is an incomplete performance metric because experience can be nonlinear in delay.

**Applied (HYPOTHESIS):** Marketplace tutoring that hides delay magnitude while selling “reliable sessions” burns share even if median lateness is modest. Fairness copy must not become student-vs-tutor blame; ops-facing FIFO / caseload justice stays internal (SAFE-LOADSHED / BURNWARN). Student UI gets **magnitude feedback**, not courtroom.

**Kill:** Average-lateness dashboards as the only ops truth while student sees “soon.”  
**Survive:** Student-facing magnitude feedback + internal fairness ops.  
**Wound:** Larson is forum-speculative — treat as design prior, confirm with KNOWNETA-*.

---

## CXXXV.7 Progress information beats apology fillers

**FACT:** Munichor & Rafaeli (2007, *Journal of Applied Psychology, 92*(2), 511–521, doi:10.1037/0021-9010.92.2.511) — telephone waits: Study 1 (real calls, *N* = 123) — **queue-location information** yielded lowest abandonment and most positive evaluations vs music; Study 2 (*N* = 83 simulated) — **sense of progress** mediated filler effects more than perceived waiting time; **apologies** as fillers can harm by re-salienting the wait without progress.

**Applied (HYPOTHESIS):** Lobby apology spam (“Sorry you’re waiting!”) without ETA/progress is Munichor-bad. Prefer: status that implies progress (“Tutor confirmed — about 6 minutes”) plus Set card. Do not replace duration with endless sorry. Do not invent fake progress bars that stall.

**Kill:** Apology-primary late UX.  
**Survive:** Progress + duration; apology optional, once, factual.  
**Wound:** Call-center queue ≠ video tutor join — map “progress” to real join states (en route / reconnecting / joined), not decorative %.

---

## CXXXV.8 Affective mediation: anger and uncertainty, not minutes alone

**FACT:** Taylor (1994, *Journal of Marketing, 58*(2), 56–69, doi:10.1177/002224299405800205) — delayed airline passengers: delays affect service evaluations **mediated by negative affect** (anger, uncertainty); perceived provider **control** and **filled time** influence evaluations indirectly via those affects.

**Applied (HYPOTHESIS):** Late-tutor lobby must manage (1) uncertainty (KNOWNETA finite band), (2) filled time (ASYNCBRIEF), (3) control attribution carefully — “ops delay / connection” not “Maya wasn’t ready” and not student-aimed tutor-shame. Parent crunch copy stays on SAFE-CRUNCHMSG honesty rails.

**Kill:** Shame attribution; empty fill without duration.  
**Survive:** Uncertainty↓ + session-related fill + non-character blame.  
**Wound:** Airline delay ≠ ACT tutoring — mechanism transfer only.

---

## CXXXV.9 Product rules (SAFE-KNOWNETA)

1. **Finite when estimable** — Show a band (“about *N* minutes” or “*N*–*M* minutes”), never “soon / any moment / almost.”  
2. **Label ignorance** — If no estimate, say so; offer Set card + reschedule / message tutor — do not fake a number.  
3. **No optimistic default** — Prefer slightly conservative bands; under-promise/over-deliver on *arrival*, not on learning claims.  
4. **Refresh without gaslight** — On slip: new finite band + timestamped update; ban repeating “just 2 more minutes” after miss.  
5. **Apology secondary** — At most one factual apology; duration/progress primary (Munichor).  
6. **Coarse grain honesty** — If ops only know ±5 min, do not ship second-precision countdown theater.  
7. **Pair with ASYNCBRIEF** — ETA banner never replaces the Set card; card countdown is independent of tutor ETA.  
8. **No student shame feed** — Late is ops fact; no “your tutor failed you” public board; tutor coaching stays HITL-private.  
9. **Long-wait escalate** — Beyond policy threshold (ops-set; test ~15–20 min), offer reschedule / LOADSHED path, not endless ETA theater.  
10. **Copy:** “About 8 minutes — while you wait, finish your Set card.” Never “science-backed wait management raises ACT.”

**Confidence:** High — Maister finite-vs-uncertain + Hui/Tse duration info + Munichor progress>apology + Taylor affect mediation as design priors. Medium — exact band widths, refresh SLAs, long-wait threshold (KNOWNETA-*). High — soon/apology-only/shame-feed/ETA Score™ as commercially toxic under FEI + trust brand.

---

## CXXXV.10 Experiments

| ID | Question | Design | Primary |
|----|----------|--------|---------|
| KNOWNETA-1 | Finite band ETA vs “soon” under equal actual delay | Lobby A/B | abandonment; `asyncbrief_complete`; affect items; time-to-first-FEI |
| KNOWNETA-2 | Conservative band vs optimistic under-estimate that slips | Ops A/B | trust items; rebook intent; `eta_honesty_ok` |
| KNOWNETA-3 | Duration+progress vs apology-primary filler | Copy A/B | evaluation; abandonment; Set completion |
| KNOWNETA-4 | Labeled uncertainty + reschedule offer vs fake ETA when unknown | Ops A/B | trust; complaint; return rate |
| KNOWNETA-5 | Parent CBC: “honest late + Set card” vs “always on time” brand claim | CBC | WTP; trust (SAFE-WTP / CRUNCHMSG) |
| KNOWNETA-QUAL | 10 Mayas + 10 parents: did ETA copy feel honest or shame/anxiety? | Qual | KNOWNETA codebook |

**Falsifier:** Finite ETA equals “soon” on FEI and trust → keep honesty for brand ethics; investigate whether delays were too short (Hui short-wait null).  
**Falsifier:** Optimistic ETA wins short-term satisfaction then tanks rebook → prefer conservative bands.  
**Falsifier:** ETA honesty raises anxiety without Set uptake → tighten ERRCLIMATE / shorten banner; do not return to “soon.”  
**Pre-register:** KNOWNETA-* before “we manage waits scientifically / zero-late brand / +ACT from lobby UX” ads.  
**Family note:** Densifies ASYNCBRIEF / MICROBRIEF / EXPECTANCY / LOADSHED / CRUNCHMSG; do not invent Wait Minutes learning OKRs. ASYNCBRIEF-5 parent CBC may share instruments with KNOWNETA-5 — do not double-count.

---

## CXXXV.11 So what for MindCraft commercially

- **Copy:** “About 8 minutes — while you wait, name the edge and your if-then plan.”  
- **Product:** Lobby ETA band + refresh rules + labeled uncertainty state; paired ASYNCBRIEF; long-wait escalate.  
- **Ops:** Instrument `eta_honesty_ok` (band vs join); ban optimistic default; coach tutors privately, not via student shame UI.  
- **Positioning:** Against marketplace “soon” lobbies and apology muzak; high-reliability craft includes clock honesty.  
- **Metric:** `eta_honesty_ok`, abandonment, `asyncbrief_complete`, rebook/trust — demote ETA Score™ / Lobby Minutes NS.  
- **Kill list:** Soon-default; optimistic slip loops; apology-primary; shame feed; fake-precision countdown; ACT guarantees from wait UX.  
- **Growth / vision:** Trust packet can show late minutes are disclosed like Map holes — the company that won’t lie about a graph won’t lie about eight minutes either.

---

## References (verified)

- Hui, M. K., & Tse, D. K. (1996). What to tell consumers in waits of different lengths: An integrative model of service evaluation. *Journal of Marketing, 60*(2), 81–90. https://doi.org/10.1177/002224299606000206  
- Larson, R. C. (1987). OR Forum—Perspectives on queues: Social justice and the psychology of queueing. *Operations Research, 35*(6), 895–905. https://doi.org/10.1287/opre.35.6.895  
- Maister, D. H. (1985). The psychology of waiting lines. In J. A. Czepiel, M. R. Solomon, & C. F. Surprenant (Eds.), *The service encounter* (pp. 113–123). Lexington Books.  
- Munichor, N., & Rafaeli, A. (2007). Numbers or apologies? Customer reactions to telephone waiting time fillers. *Journal of Applied Psychology, 92*(2), 511–521. https://doi.org/10.1037/0021-9010.92.2.511  
- Osuna, E. E. (1985). The psychological cost of waiting. *Journal of Mathematical Psychology, 29*(1), 82–105. https://doi.org/10.1016/0022-2496(85)90020-3  
- Taylor, S. (1994). Waiting for service: The relationship between delays and evaluations of service. *Journal of Marketing, 58*(2), 56–69. https://doi.org/10.1177/002224299405800205  
