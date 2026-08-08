# Part LXXI — Compatible Tech Adjacency: World Build, Displays, Government Demand

**Chapter status:** Living strategy brief — Founder-commissioned 2026-08-03  
**Primary question:** Which new models, devices, and public programs are *compatible* with MindCraft’s FEI / living-record / college-tutor stack — and which are shiny distractions that would become a different company?  
**Owners:** Founder Philosopher · Horizon / Worlds · Product · Partnerships · Red Team  
**Commercial job:** Keep Horizon 2–3 (math as a world) technically plausible without abandoning the ACT Twin Cities wedge; name government demand honestly; give founders a clear “you do this / agents do that” split.

**Related:** `WORLD_VISION.md` Horizons 2–3 · Part XXVII markets · Part XXXV session audits · Part XXXIII AI trust · ontology / question bank as spine.

---

## LXXI.1 Why this chapter exists

Founder prompt (2026-08-03): explore technologies that could help MindCraft *build worlds* from math content (e.g. Microsoft TRELLIS for 3D assets; agents that read questions + hints and assemble scenes), adjacent display vessels (e-ink / calm screens), and government initiatives (e.g. UK post-NTP / Oak-scale curriculum infrastructure) that may need diagnosis + human tutoring infrastructure soon.

**FOUNDER BELIEF under audit:** Compatible tech should compress the cost of *world skin* and *distribution vessels* while the scarce product stays diagnosis, identity-safe struggle, and tutor accountability.

**Claim we refuse as doctrine:** “New 3D model dropped → pivot the company to be a world engine.” That is a different startup. MindCraft’s load-bearing product is the **memory between student and tutor** on a 42-concept spine — with ACT as the beachhead.

---

## LXXI.2 Compatibility test (pass/fail before any spike)

A technology is **compatible** only if it clears all of these:

| Gate | Pass condition | Fail = distraction |
|------|----------------|--------------------|
| **C1 Spine** | Consumes or emits canonical `conceptId` / misconception / question IDs | Orphan asset farms with no ontology join |
| **C2 FEI** | Does not replace soft-wrong → attempt → transfer with “watch cool 3D” | Engagement theater without `solo_transfer_pass` |
| **C3 Human** | Makes the college tutor *more* effective (brief, scene, homework vessel) | “AI teacher replaces tutor” positioning |
| **C4 Claim ladder** | Marketing stays L0–L1 until measured | “Immersive learning raises scores” without evidence |
| **C5 Wedge** | Can ship value to ACT / Twin Cities families *without* waiting for the tech | Roadmap hostage to GPU pipelines or DfE RFPs |
| **C6 Privacy** | Student affect / work data stays governed | Telemetry that cannot be explained to a parent |

**Red Team standing kill:** Any deck slide that leads with Trellis / e-ink / “UK government needs us” before map → tutor. Tech is appendix; mechanism is headline.

---

## LXXI.3 Cluster A — Generative 3D & world-build agents

### A1. Microsoft TRELLIS / TRELLIS.2 (asset generation)

**FACT:** Microsoft Research’s TRELLIS family generates 3D assets from image/text conditions via structured latents (SLAT); TRELLIS.2 (image-to-3D, ~4B params, O-Voxel) targets production-ready meshes with PBR materials; open weights / MIT-licensed repos exist (`microsoft/TRELLIS`, `microsoft/TRELLIS.2`; project page microsoft.github.io/TRELLIS; Azure Foundry Labs listing).

**HYPOTHESIS (MindCraft use):** TRELLIS-class tools can turn *story stills / concept art* into GLB/mesh props for Jesse-world / concept rooms — compressing artist hours for Horizon 2 skins — **if** an upstream agent selects prompts from sealed fact packs (story + concept + question tags), not freeform vibe art.

**Compatible pipeline (HYPOTHESIS):**

```
Question + conceptId + story beat + hint family
        → World-Build Agent (constrained)
        → prompt pack + 2D stills (existing art or T2I)
        → TRELLIS / TRELLIS.2 → GLB props
        → World assembler places props on ontology-locked scene graph
        → Student vessel (web / Roblox bridge later) still runs FEI on proven questions
```

**What the World-Build Agent must be trained / constrained to do:**
1. Read bank questions + misconception tags + soft-wrong hint ladders (no invented keys).  
2. Emit a **scene brief**: setting, props, what the math *does* in the world, forbidden chrome (confetti, shame UI).  
3. Prefer reuse of existing `conceptStories` / Manjushree-class assets before minting new 3D.  
4. Never invent pedagogy; only dress the spine.

**SPECULATION:** Within 2–4 years, per-concept “room packs” become cheap enough that Horizon 3 personalization (music kid / space kid) is mostly prompt+assembly, not hand-modeled worlds.

**Risks:** GPU cost; style inconsistency; latency; “pretty world, wrong math”; Roblox/Unity pipeline glue; licensing if you leave MIT models for closed APIs.

### A2. Adjacent model classes (examples, not exhaustive)

Treat these as a **watchlist**, same C1–C6 gates:

| Class | Example direction | MindCraft fit if… |
|-------|-------------------|-------------------|
| Image→3D / text→3D | TRELLIS, Hunyuan3D-class, etc. | Props for story rooms; not live tutoring |
| Scene / layout LLMs | Agents that place props on a graph | Ontology-locked scene graphs only |
| Speech / avatar | Realtime tutors avatars | Optional skin; human tutor remains accountable |
| NeRF / Gaussian splat viewers | Lightweight web viewers | Desktop/demo vessels, not phone ACT first |
| Existing MindCraft 3D | `worlds/world2/` seed | Prefer extend-over-replace |

**FOUNDER BELIEF:** The scarce IP is the **briefing agent + ontology join**, not the 3D generator. Generators commoditize; sealed fact packs and FEI do not.

---

## LXXI.4 Cluster B — Calm / paper-like display vessels

### B1. Why display adjacency matters

**HYPOTHESIS:** For threatened math learners, high-refresh RGB tablets can increase evaluative threat and distraction (notifications, glare, “app” frame). Paper-like or low-stimulation vessels may support longer reading of story chapters + worked examples *if* they do not block FEI measurement or tutor handoff.

**FACT (category):** E-ink / electrophoretic displays are commercially mature for reading (Amazon Kindle line, reMarkable, Onyx Boox, etc.). Color e-paper and faster refresh variants exist but remain tradeoffs vs LCD/OLED for animation-heavy 3D.

**Compatible uses (HYPOTHESIS):**
- Story chapter + journal / scratch (Field Journal aesthetic) on e-ink or e-ink-like tablets  
- Parent weekly digest print/PDF designed for paper or e-ink  
- Exam-week “quiet mode” practice without game chrome  

**Incompatible / premature:**
- Leading the product with “requires e-ink hardware”  
- Real-time 3D world as the *only* vessel (kills C5 wedge)  
- Inkjet / experimental print-electronics as a dependency for Demo Night or MN launch  

**Note on “inkjet screens”:** Founder interest is directionally about *calm, paper-adjacent, low-dopamine vessels*. Treat specific inkjet/e-paper R&D as **SPECULATION / watchlist** until a named product ships with school/parent distribution. Do not cite vapor hardware in marketing.

**Product rule:** World vision is **multi-vessel**. Web app + college tutor is Horizon 1. E-ink / 3D / Roblox are skins on the same living record (WORLD_VISION modularity).

---

## LXXI.5 Cluster C — Government & public infrastructure demand

### C1. United Kingdom

**FACT:** The UK **National Tutoring Programme (NTP)** ran as a multi-year DfE-backed tutoring recovery effort through 2023/24; evaluations (NFER / DfE publications) reflect on school-led tutoring, pupil-premium targeting, and post-programme sustainability — i.e. schools are expected to continue tutoring with thinner central subsidy.

**FACT:** **Oak National Academy** is an arm’s-length DfE-sponsored public body providing free, optional, adaptable digital curriculum resources (including maths sequences aligned to national curriculum / NCETM-related materials); expanding classroom curriculum assets is an active state strategy, with further national curriculum reform horizon (schools preparing toward late-decade curriculum changes per Oak public messaging).

**HYPOTHESIS (MindCraft angle):** UK public infrastructure will keep needing (a) curriculum content (Oak-class), (b) **targeted tutoring ops**, and (c) **diagnostic honesty** about who is stuck where. MindCraft’s wedge is closer to (b)+(c) than to becoming a national curriculum publisher. A compatible pitch is: *living diagnosis + college/peer tutor brief + transfer checks that survive when the chat ends* — exportable to GCSE/KS3 vocab via ontology aliases, not a rewrite of Oak.

**SPECULATION:** Post-NTP funding cliffs create buyer pain (“we still need tutoring quality without detective hours”). That is a partnership / pilot surface, not an “asap UK exclusive” claim for US Demo Night.

### C2. Broader public demand patterns (not UK-only)

| Signal | Compatible MindCraft offer | Wrong offer |
|--------|----------------------------|-------------|
| Learning-loss / catch-up tutoring | Gap map + human tutor brief | Another content library |
| Teacher workload / AI in schools | School↔college AI dialogue; tutor+tool | Unsupervised chatbot classroom |
| Exam gatekeeping (ACT, GCSE, etc.) | Beachhead exam wedge + transfer | Score guarantees |
| EdTech procurement | Pilot with measured FEI metrics | Feature matrix theater |

**Red Team:** Government sales cycles are slow, political, and often want coverage metrics MindCraft should not fake. Do not stall Twin Cities parent revenue waiting for DfE.

---

## LXXI.6 What MindCraft owns vs rents

| Own (moat candidates) | Rent / integrate |
|----------------------|------------------|
| 42-concept ontology + bridges + misconceptions | TRELLIS / other 3D gens |
| Question bank + story frames + FEI metrics | Cloud GPUs for asset bake |
| Tutor brief + living record | Device OEMs (e-ink tablets) |
| Brand / Maya honesty | Oak-like curriculum as *optional* import |
| World-Build Agent constraints + eval harness | Generic LLM APIs as bookends |

---

## LXXI.7 Experiments & spikes (lab → product)

| ID | Spike | Success signal | Kill signal |
|----|-------|----------------|-------------|
| **TECH-1** | One concept: question→scene brief→2D still→TRELLIS GLB→static viewer beside practice | Artist hours ↓; FEI unchanged | Pretty asset, transfer ↓ or pipeline >1 eng-week/concept |
| **TECH-2** | World-Build Agent v0 on 5 ACT concepts; human grade briefs | ≥4/5 briefs usable without pedagogy invention | Agent invents keys / shame UI |
| **TECH-3** | Field Journal / chapter reading on one e-ink or “calm mode” CSS vessel | Session length/affect proxy improves exploratory | Requires hardware purchase to use core product |
| **GOV-1** | One-pager: MindCraft vs Oak/NTP-shaped need (UK) + US state tutoring RFPs watchlist | Clear “we are not a curriculum publisher” sentence | Pitch drifts to national content play |
| **GOV-2** | Macalester / MN school↔college AI dialogue (already in Demo Night ask) | 1 school + 1 college conversation scheduled | Slideware only |

---

## LXXI.8 Founder actions (what *you* do on your side)

Agents can write chapters and spike code. Only founders can unlock these:

### This month (non-negotiable beachhead)
1. **Do not let this chapter change Demo Night / Twin Cities ACT messaging.** Mechanism first; tech in appendix if asked.  
2. **Run the 10 parent + 10 Maya interviews** already queued in `NEXT_LAB.md` — tech adjacency is worthless without buyer language.  
3. **Pick one concept** (e.g. linear equations or Manjushree quadratic) as the TECH-1 guinea pig; assign Blake or a contractor a 3-day spike budget, not an open-ended “build the metaverse.”  
4. **Decide ownership:** Who owns World-Build Agent constraints — Product (Blake) vs Worlds — written in one paragraph in Slack/`CODEX_BRIEF`.

### Partnerships / government (parallel, not blocking)
5. **UK:** Read Oak’s public maths positioning + NTP evaluation summary; draft a 1-page “compatible, not competing” note (diagnosis + tutor ops). Do **not** cold-email DfE until you have US pilot proof.  
6. **MN / Macalester:** Advance the school↔college AI dialogue ask from Demo Night (teachers + SciQ). That *is* a government-adjacent surface you can touch this quarter.  
7. **Microsoft / Azure:** Optional — try TRELLIS via Foundry Labs / open weights for TECH-1 only; no partnership narrative until you have a GLB in a real lesson loop.

### Explicit non-goals (your job to enforce)
8. No e-ink hardware dependency in pricing or onboarding.  
9. No “UK government needs us asap” in public US marketing.  
10. No replacing college tutors with avatars in the next 12 months.

---

## LXXI.9 One-line doctrine

**Rent the generators. Own the spine, the brief, and the human handoff. Multi-vessel worlds; single living record. Government is a slow second customer after parents can feel the session.**

---

## LXXI.10 Citation seeds (expand on later ticks)

- Microsoft TRELLIS project: https://microsoft.github.io/TRELLIS/ ; GitHub `microsoft/TRELLIS`, `microsoft/TRELLIS.2`  
- Azure Foundry Labs TRELLIS listing (image-to-3D)  
- UK DfE / NFER: National Tutoring Programme evaluation & reflections; NTP Year 3 impact evaluation (gov.uk assets)  
- Oak National Academy (gov.uk organisation page; thenational.academy maths curriculum support)  
- Internal: `WORLD_VISION.md`; Parts XXVII, XXXIII, XXXV; Manjushree / `worlds/world2/` as existing seed
