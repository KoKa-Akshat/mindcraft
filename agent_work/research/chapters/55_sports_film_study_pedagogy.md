# Part LV — Sports Film-Study Pedagogy: Error Clips → Coach Cards

**Chapter status:** Living evidence brief — Researcher tick 2026-07-31 (UTC hour 21; hour%6≠0; 5 researcher entries since synthesizer v1.7 → Researcher)  
**Primary question:** What transferable design does sports film-study / video-based feedback (VBF) offer for MindCraft practice review — turning attempt traces into sparse, student-controlled “clips” and coach cards — without sports-cosplay branding, feedback floods, or highlight-reel shame?  
**Owners:** Product (Solver / Notes / coach cards) · Tutor ops · Coach UX · Brand & copy · Red Team  
**Commercial job:** Ship a **SAFE-FILM** stack — objective attempt clips + less-is-more cueing + learner-timed review + self∪model pairing — while killing “we’re like a sports academy” marketing, monologue film rooms, and flood-of-tips as pedagogy.

---

## LV.1 Why this chapter exists

Part LIV (SAFE-AAR) established the *cycle*: brief → attempt with traces → structured close. Sports film study is the **media layer** of that cycle — high-performance domains do not rely on memory alone; they rewatch selected moments, cue attention, and commit the next play. MindCraft already logs the analogue of game film: attempt lists, soft-wrong codes (`mis_` IDs), timing, format tags, outcomes JSON. Competitors either never replay process (answer-key chat), replay only correctness (Khan-style), or flood the learner with AI commentary that no one remembers a week later.

**FOUNDER BELIEF under audit:** Identity as a mathematical thinker grows when the learner can *see their own decision frames* on a specific attempt — not when a brand dresses practice as a locker room. Film-study transfer is about **selective objective media + facilitation**, not jersey cosplay.

**Claims we refuse as doctrine:**
1. Sports-academy / “elite athlete” branding as belonging or efficacy technology.  
2. Coach monologue over 30 tips per “film room” (recall collapses).  
3. Highlight-reel of only successes *or* only failures as identity theater.  
4. Treating declarative recall of tips as if it were transfer to next-attempt performance.  
5. Equating any video UI with film-study pedagogy.

---

## LV.2 Constructs (product language)

| Construct | Plain definition | Product signal | Failure mode if misused |
|-----------|------------------|----------------|-------------------------|
| **Film study / VBF** | Structured review of performance via recorded moments + guided attention | Replay attempt; soft-wrong clip; coach card on *that* step | Passive highlight reel; shame montage |
| **Performance analysis (PA)** | Evaluate/describe performance with media (Pearson et al.) | Graph outcomes + process codes as “tape” | Stats without learner agency |
| **Self-observation** | Learner watches *own* prior attempt | “Replay your steps” before AI wrap | Narcissistic doom-scroll of errors |
| **Skilled / expert model** | Observation of a competent demonstration | Worked example / correct pathway card paired to same archetype | Model-only → “I can’t do that” gap |
| **Self-modeling / feedforward** | Edited view of self succeeding at a near-future challenge (Dowrick) | Show student’s own prior *successful* transfer on related edge | Fake montages that invent competence |
| **Attentional cueing** | Direct gaze/attention to the decision that mattered | Coach card highlights inequality sign flip / bridge gap | Cue everything = cue nothing |
| **Self-controlled feedback** | Learner chooses *when* to request video/KP review | “Review this attempt?” on demand vs forced after every item | Autonomy theater with no cue quality |
| **SAFE-FILM** | Film-study doctrine that survives sports cosplay / flood / shame kills | See LV.8 | Academy branding; tip dumps |

**Operational definition (HYPOTHESIS):** A MindCraft review counts as *SAFE-FILM* when (a) the clip is an **objective attempt trace** (not vibes), (b) ≤3 attentional cues / coaching points are attached, (c) the learner can request or skip replay (self-control), (d) when a miss is shown, a **paired skilled model or student’s own prior success** on a related edge is available (self∪model), (e) the output is a next-attempt commitment (SAFE-AAR improve-how), (f) no public shame reel, no sports-cosplay belonging tax.

---

## LV.3 Applied models of observation — who / what / when / how

**FACT:** Ste-Marie, Law, Rymal, Jenny, Hall & McCullagh (2012, *International Review of Sport and Exercise Psychology*, 5(2), 145–176, doi:10.1080/1750984X.2012.665076) advance an **Applied Model for the Use of Observation (AMUO)**: practitioners should assess observer and task characteristics, then vary **who** is observed, **what** is observed (and instructional features), **when** observation occurs, and **how** information is delivered — not treat “show video” as a single intervention.

**FACT:** Ste-Marie et al. (2020, *Research Quarterly for Exercise and Sport*, doi:10.1080/02701367.2019.1693489) revisit AMUO across 2011–2018 applied-task articles; observation remains effective across a wider task base, but **guidelines still require intentional Who/What/When/How design** — effectiveness is not automatic from “video exists.”

**HYPOTHESIS for MindCraft:** Map AMUO onto practice:
- **Who:** self (attempt replay) ± skilled model (worked pathway for same archetype) ± peer only when SAFE-COMPARE allows.  
- **What:** the decision frame that produced the soft-wrong — not the whole worksheet.  
- **When:** after attempt, before next isomorphic item; optional delayed Notes deepen (aligns SAFE-AAR hot-wash + later deepen).  
- **How:** sparse cueing + student-first naming (facilitation), not AI monologue.

**Kill:** “We added a replay button” as film-study. Survive: designed observation with AMUO knobs.

---

## LV.4 Video feedback as performance analysis — learning ≠ tip retention

**FACT:** Pearson, Webb, Milligan & Dicks (2023/2025 print, *International Review of Sport and Exercise Psychology*, 18(1), 417–439, doi:10.1080/1750984X.2023.2235700) — integrative review of video feedback as a facet of PA (16 studies from 5,838 screened; OSF registration noted). Delivery mode (coach-led classroom vs self-led), environment, and **scheduling** shape learning; scheduling often aids **declarative knowledge retention** more clearly than transfer to on-field performance. Collaborative coach–athlete practices may enhance engagement. Authors call for better frameworks and experimental variety — PA is common; *learning-optimized* PA is under-specified.

**Wound (transfer):** Elite sport PA classrooms ≠ Maya’s 12-minute practice session. Treat Pearson et al. as a warning against equating “we reviewed the tape” with “performance transferred.”

**Commercial implication:** MindCraft must instrument **next-attempt behavior** (`retry_120s`, method-change codes, `solo_transfer_pass`) — not tip-quiz scores after coach cards.

---

## LV.5 Feedback floods kill recall — less is more

**FACT:** Mason, Farrow & Hattie (2020, *International Journal of Sports Science & Coaching*; doi:10.1177/1747954120951080) — exploratory study of one-to-one post-match video feedback in an AFL club (6 coach–player dyads). Coaches delivered on the order of **~30 feedback messages** per meeting. One week later, players recalled about **50% of summarised themes** but only about **6% of fine-grained feedback idea units**. Authors encourage a **“less is more”** approach.

**HYPOTHESIS:** AI tutors and “helpful” coach UIs recreate the AFL flood at machine speed — worse for anxious novices (SAFE-DD × anxiety; CLT). Cap coach-card points per clip at **1–3**. Prefer one bridge/misconception handle over a laundry list.

**Product translation:** Soft-wrong → single primary `mis_` / ingredient cue → one advocacy–inquiry prompt (Rudolph/SAFE-AAR) → one next-attempt tweak. Kill “here are eight tips from your film.”

---

## LV.6 Self-controlled video feedback — autonomy of *when*, not absence of coaching

**FACT:** van der Meer, van den Hoven, van der Kamp & Savelsbergh (2024, *Research Quarterly for Exercise and Sport*, 95(2), 537–545, doi:10.1080/02701367.2023.2275801; online 2023) — intermediate tennis players; self-controlled video feedback (request) vs yoked externally controlled schedule; coach provided video with attentional cueing and transitional tactical statements. Self-controlled group showed **larger tactical performance gains** vs pretest at posttest and **one-week retention**. Self-efficacy did not differ by group; gains were not predicted by self-efficacy / self-regulative questionnaire scores in this sample.

**FACT (supporting line):** Aiken, Fairbrother & Post (2012, *Frontiers in Psychology*, 3:338, doi:10.3389/fpsyg.2012.00338) — self-controlled video feedback benefits basketball set-shot learning relative to yoked schedules (motor-learning line often cited in later VBF work).

**Wound:** Meta-analytic debate exists on the strength of self-controlled feedback advantages (van der Meer et al. note McKay et al., 2022 vs Jimenez-Diaz et al., 2021). Do **not** market “science proves self-paced video raises ACT.” Treat as design prior: **learner-timed review + quality cueing** beats forced tip dumps *or* no review.

**HYPOTHESIS for MindCraft:** After a miss (or optional after a hard success), offer “Review this attempt?” rather than auto-playing a 90s AI lecture. Forced review every item → fatigue and controlling climate (SAFE-REWARD / SAFE-DD).

---

## LV.7 Self∪model pairing and feedforward — identity-safe media

**FACT (pairing):** Robertson, St. Germain & Ste-Marie (2018, *Journal of Motor Learning and Development*, 6(1), 18–34, doi:10.1123/jmld.2016-0027) — gymnasts learning two skills in a within-subject design: self-observation **paired with a skilled model** outperformed self-observation alone later in acquisition; error-identification **response sensitivity** was also higher for paired skills.

**FACT (self-modeling / feedforward):** Dowrick (1999, *Applied and Preventive Psychology*, 8(1), 23–39, doi:10.1016/S0962-1849(99)80009-2) reviews self-modeling; Dowrick (2012, *WIREs Cognitive Science*, 3(2), 215–230, doi:10.1002/wcs.1156) theorizes “learning from the future” via reconfigured component skills. Dowrick, Kim-Rupnow & Power (2006, *Journal of Special Education*, 39(4), 194–207, doi:10.1177/00224669060390040101) — video **feedforward** plus tutoring improved reading fluency; in 9/10 cases improvement rate was greatest during feedforward (small *N* — transfer carefully).

**HYPOTHESIS:** A miss clip should not stand alone. Pair with (1) a skilled worked pathway for the same archetype and/or (2) the student’s own prior success on a related edge. Feedforward spirit without fake editing: **show competence already owned, then the gap.**

**Kill:** Failure-only shame reels; success-only dopamine montages that hide productive misconceptions (SAFE-MISCON). Survive: paired clip design.

---

## LV.8 SAFE-FILM stack (product law)

1. **Clip = objective attempt media** — steps, codes, timing; not “how did it feel?” alone (extends Keiser objective-media finding via LIV).  
2. **Less is more** — ≤3 cues per clip; prefer one primary soft-wrong handle (Mason et al.).  
3. **AMUO design** — decide who/what/when/how before shipping replay UI (Ste-Marie 2012/2020).  
4. **Self-controlled timing** — learner can request review; default is offer, not force-flood (van der Meer et al.; Aiken et al.).  
5. **Self∪model pairing** — miss clip + skilled pathway and/or own prior success (Robertson/Ste-Marie line; Dowrick feedforward spirit).  
6. **Student names the frame first** — then advocacy–inquiry coach card (SAFE-AAR / Rudolph).  
7. **Transfer metric, not tip quiz** — instrument next attempt (Pearson wound).  
8. **Anti-cosplay** — borrow the *media pedagogy*, not locker-room brand (SAFE-RITUAL / SAFE-AAR).  
9. **No public error theater** — film study is private or tutor-dyad unless SAFE-COMPARE + consent (SAFE-CoP caution).  
10. **Claim ladder** — sport VBF evidence stays L1 domain evidence; MindCraft ACT/identity claims need FILM-* experiments.

---

## LV.9 Competitive audit — who runs film study?

ChatGPT-style tutors rarely replay *your* attempt structure and risk tip floods. Khan shows correctness with weak process pairing. Duo streak liturgy ≠ film study. Brilliant ahas rarely close a self∪model loop. Human “sports-style” tutoring inherits facilitator variance (Pearson). MindCraft already has attempt traces + soft-wrong + cards + Notes — **formalize SAFE-FILM**.

**Commercial implication:** Position as **reviewed decisions** — cue the one hinge, try the next play — never “train like the pros.” Parent copy: replay *how* they thought. Student copy: “pick a clip to review.”

---

## LV.10 Claim ladder

| Claim | Max ladder without new data |
|-------|------------------------------|
| Observation interventions should vary who/what/when/how (AMUO) | L1 (Ste-Marie et al., 2012; 2020) |
| VBF-as-PA often improves declarative retention more clearly than transfer; design/delivery matter | L1 (Pearson et al., 2023) |
| Dense coach tip floods → poor week-later fine-grained recall (~6%); less-is-more recommended | L1 exploratory (Mason, Farrow & Hattie, 2020) |
| Self-controlled video feedback can outperform yoked schedules on tactical learning (tennis) | L1 single study (van der Meer et al., 2024) |
| Self∪skilled-model pairing can beat self-observation alone (gymnastics) | L1 (Robertson, St. Germain & Ste-Marie, 2018) |
| Video feedforward can accelerate skill acquisition in some educational samples | L1 small-N (Dowrick et al., 2006); theory (Dowrick, 2012) |
| SAFE-FILM improves MindCraft `retry_120s` / method-change / `solo_transfer_pass` | L1 product bet — needs FILM experiments |
| “Sports academy methods raise ACT / identity” undifferentiated | **Banned** |
| Highlight-shame reels / tip floods as pedagogy | **Banned** |

---

## LV.11 Experiments spawned

| ID | Question | Design | Primary | Kill condition |
|----|----------|--------|---------|----------------|
| FILM-1 | ≤3-cue clip card vs uncapped AI tip flood after miss | 2-arm | tip recall @24h; `retry_120s`; method-change | Flood ≥ sparse on transfer → revisit cue quality only |
| FILM-2 | Self-controlled “Review?” vs forced replay every miss | 2-arm | completion; affect; next-item transfer | Forced ≥ choice on transfer *and* better affect → keep forced for novices only |
| FILM-3 | Miss-only clip vs miss+skilled model vs miss+own prior success | 3-arm | error ID; `solo_transfer_pass` | Miss-only ≥ paired → pairing theater |
| FILM-4 | AMUO-scripted coach card (who/what/when/how) vs generic praise/explain | 2-arm | SE quality; transfer | Generic ≥ AMUO → card content fail |
| FILM-5 | Film close + SAFE-AAR four questions vs film without AAR questions | 2-arm | improve-how specificity; week-later transfer | No-AAR ≥ AAR → film without close still ok; keep AAR optional |
| FILM-QUAL | 10 Maya: which clip UX felt useful vs shamey/sportsy? | interview | coded: useful / cosplay / flood / shame | “Athlete” language → kill that copy |

**Pre-reg (XXXIV):** FILM-* identify **review media architecture** — not “sports methods raise scores” or identity-from-athleticism myths.

---

## LV.12 Confidence table

| Claim | Label | Confidence |
|-------|-------|------------|
| Ste-Marie et al. AMUO who/what/when/how | FACT | High |
| Pearson et al. VBF-as-PA: delivery/scheduling; transfer caution | FACT | High |
| Mason et al.: ~30 tips; ~6% fine-grained week recall; less-is-more | FACT (exploratory, small *N*) | Medium–High |
| van der Meer et al.: self-controlled VBF > yoked on tennis tactics | FACT (single study) | Medium |
| Robertson, St. Germain & Ste-Marie: self∪model > self alone | FACT | Medium–High |
| Dowrick feedforward reading gains | FACT (small *N*) | Medium |
| Sport VBF transfers cleanly to ACT prep for anxious teens | HYPOTHESIS / wounded | Low–Medium |
| SAFE-FILM is right default review layer for MindCraft | FOUNDER BELIEF / HYPOTHESIS | Medium |
| Sports-cosplay branding improves belonging or scores | SPECULATION / false as doctrine | Low (against) |

---

## LV.13 What this chapter kills

1. **Kill:** Sports-academy / pro-athlete / locker-room branding as efficacy or belonging claim.  
2. **Kill:** Feedback floods (30 tips / uncapped AI wrap) labeled as film study.  
3. **Kill:** Equating tip recall or “we watched the replay” with transfer / exam readiness.  
4. **Kill:** Failure-only shame reels and success-only dopamine montages as identity engines.  
5. **Kill:** Replay UI without AMUO who/what/when/how design.  
6. **Wound:** Classroom PA and elite dyads under-transfer to short teen sessions; facilitator variance.  
7. **Survive:** SAFE-FILM; less-is-more clips; self-controlled review timing; self∪model pairing; feedforward spirit via own prior success; FILM-1…5; copy as **reviewed decisions** — not sports cosplay.

**Doctrine until data:** Ship **SAFE-FILM** — objective attempt clips, sparse cues, learner-timed review, paired models, transfer metrics — stacked on SAFE-AAR’s brief–debrief spine, and never sell athlete mythology or tip floods as the transformation engine.
