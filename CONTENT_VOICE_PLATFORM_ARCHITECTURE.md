# Content + sims + voice: end-to-end scope, real findings, proposed design

Status: **design doc, not built.** Spans `webhook/**` and
`ios-prototype/**` in this repo plus `mindcraft-content-engine` (a
separate repo). Touches Engine lane and real ongoing spend — Blake needs
eyes on the content-pipeline sections before building; the voice-hosting
section is lower-risk and could move faster.

Three real questions were asked together: (1) Vercel Pro vs. Fly.io for
Jesse's voice at multi-user scale, (2) is sim generation actually working
and pulling from the database properly, (3) why does an assembled chapter
"make no sense" reading it. All three got traced against real code in both
repos rather than answered from memory. Findings below, then the proposed
architecture.

---

## 1. Jesse voice hosting: Fly.io, but not a single machine

`JESSE_VOICE_TTS_SPEC.md` already covers the root cause (Kokoro runs
in-process inside a Vercel serverless function, so it cold-starts) and
recommends moving it to an always-on host. That recommendation was scoped
around *one* user's warmth, not concurrency. Scaling question, answered
properly:

**A single small always-on machine does not solve "multiple users at
once."** Kokoro's inference is CPU-bound ONNX work — one machine serving
several simultaneous live calls would queue requests behind each other,
and the second and third students on a call at the same moment would see
exactly the delay this whole effort exists to remove. "Warm" and
"concurrent-safe" are two different properties; the single-machine plan
only bought the first one.

**The right shape is Fly.io with a minimum warm pool, not one box:**
- `min_machines_running: 1` (or 2) keeps at least that many instances
  loaded and warm at all times — no cold start, ever, for baseline traffic.
- Fly's autoscaling adds machines under real concurrent load and scales
  back down when it passes, so a burst of simultaneous calls doesn't queue
  behind a single CPU.
- Same `kokoro-js` code, same `/api/tts` contract the iOS client already
  speaks to — this is a hosting change, not a rewrite.

**Why not Vercel Pro:** already covered in the TTS spec — Pro's 1-minute
cron floor doesn't guarantee a cron ping and a real request land on the
same warm container under Vercel's own autoscaling, so it's a statistical
nudge at $20/mo, not a guarantee, and it does nothing for concurrent-call
handling either way.

**Real scale to design against right now, not a hypothetical:** the pitch
deck's own market slide describes the actual current rollout, one campus
(Macalester, ~2,100 undergrads), expanding to the Twin Cities cluster next.
That means realistic peak concurrency today is probably single digits, not
hundreds. A Fly.io setup with `min=1-2, max=4-5` machines is very likely
enough for the current stage, cheap (each shared-cpu-1x machine is a few
dollars a month, so a small pool is still well under Vercel Pro's flat
$20/mo), and the machine count is a config number, not a redesign, when
usage actually grows past that. This matches the same "measure the real
number, don't build for a guess" discipline already in the pitch deck's
market slide — apply it here too.

**Open item before building:** real warm-Kokoro per-request generation
time hasn't been measured (only confirmed cold, twice, live: 12.5s and
7.9s). That number, once it exists, decides if this is actually the whole
fix or if the OpenAI/Deepgram fallback table in the TTS spec becomes
necessary regardless of hosting.

---

## 2. Sim generation: real, working, correctly pulling from the database — verified in code

Traced `webhook/lib/handlers/generate-sim.ts` directly. This is live,
deployed (`https://joinmindcraft-mindcraft-content-engine.hf.space`,
confirmed via the file's own header: "verified with two real end-to-end
generations, both gate-passed," dated 2026-08-19), and genuinely well
architected:

- **Library-first, real reuse.** A topic already gate-passed for another
  student returns instantly from Firestore (`generated_sims` collection),
  no regeneration, no cost. This *is* "collecting sims from the database"
  — confirmed, not assumed.
- **Real budget discipline.** A platform-wide monthly dollar cap is
  checked before a per-student daily cap, and both are checked before any
  paid generation call fires — a request that's going to be refused never
  burns one of a student's limited attempts.
- **Async job pattern, not a blocking call.** Generation is 15-60+s per
  attempt (real LLM + render + gate work), so the client starts a job and
  polls it — the right shape for something this slow, not a bug.
- **Gate-passed-only persistence.** Nothing enters the reusable library
  unless it cleared the full pipeline (fit check → generate → render →
  structural rubric → visual/pedagogical gate) — matches exactly what the
  other agent's report described for the coordinated prose+sim pipeline.

**This part of the system is not the problem.** The "instructions being
passed properly" question checks out.

---

## 3. Why an assembled chapter "makes no sense" — the real, specific cause

Traced `mindcraft-content-engine/src/mindcraft_content_engine/book_assembler.py`
and the real output it's already produced in `data/assembled_books/`.

Opened `circuits.md` directly. First line of real output:

> **Coverage: 2 of 300 concepts in this subject's graph have gated prose.**

Two sections exist: "Splitting the Current: How Parallel Circuits Work"
and "The Current Divider." Both carry, in the book's own honest front
matter, this line:

> *also assumes (not yet in this book): Current, Resistance, Ohm's Law.*

That's the entire explanation. The book opens on parallel circuits while
explicitly telling the reader it's assuming Ohm's Law, current, and
resistance, none of which exist in the document yet. `book_assembler.py`
is doing exactly what it's designed to do here: it's honest about the gap
(the "assumes missing" mechanism is deliberate, documented, and working
correctly) rather than hiding it. The book isn't broken. It's *accurate
about being 2 sections deep into a 300-concept subject* — which reads as
nonsensical because a human reader has no way to know that from inside
the chapter itself, only from the coverage line at the very top.

**Root cause, one level deeper: how generation picked those two concepts.**
Checked `scripts/generate_concept_prose.py`. The runs that have actually
happened so far used `--broad-sample` mode — deliberately one concept
per subject, alternating foundational/advanced picks, across 15 different
subjects. That's the right mode for what it was built for: measuring gate
pass-rate broadly across a representative sample of the whole corpus. It
is **not** the mode for producing one subject's complete, readable book.
The hardcoded `CONCEPT_SPECS` list (a handful of hand-picked test concepts
across circuits/biology/Adam Smith) confirms this further — it's a
development/testing harness, not a production "finish a subject" runner.

**The missing piece, concretely:** there is currently no mode that takes
one subject's full concept graph, computes topological (dependency-first)
order, and generates every concept in that order until the subject is
done. `book_assembler.py` already has exactly the function needed for
this — `topological_order()` — it's just never been used to *drive*
generation, only to *lay out* whatever happened to already pass. Building
that connection (topological order → generation loop, à la
`generate_concept_prose.py`'s existing `generate()`/`run_gate()` per
concept, just iterated over one subject's DAG in dependency order instead
of `CONCEPT_SPECS`) is what turns "sample yield measurement" into "produce
one subject that reads coherently start to finish." This is squarely
Engine-lane, content-generation-pipeline work — Blake's call on
prioritization and whether the LLM cost of finishing a full 300-concept
subject pencils out yet.

---

## 4. A second, separate gap: assembled books aren't reaching the app yet

Checked `ios-prototype/MindCraftNotes/MindCraftNotes/Models/BookGraphLoader.swift`.
It loads `mindcraft-content-engine`'s concept **graph** (structure,
dependencies, taxonomy — used for browsing/navigation), not the assembled
**prose** that `book_assembler.py` produces in `data/assembled_books/*.md`.
Grepped the whole live repo for any reference to `assembled_books`: none,
outside this doc. So even a subject that *did* have full, coherent,
topologically-complete coverage has no delivery path into the app yet —
the gated chapters exist as local Markdown files, not as something a
student's iPad can open.

Live sim generation (section 2 above) already has this exact delivery
path solved (webhook → HF Space → Firestore library → app). Assembled
prose books don't have their equivalent yet. That's the second real
structural gap, separate from the generation-order problem in section 3.

---

## 5. Proposed end-to-end shape

Putting the three pieces together, in the order they'd need to happen:

1. **(Engine, Blake)** Build the topological-order full-subject generation
   runner described in §3. Pick one real subject (circuits is already the
   furthest along and has a working coordinated prose+sim pair) and run it
   to completion, dependency-first, so "Ohm's Law" exists before "Parallel
   Circuits" needs it.
2. **(Engine, Blake)** Add a delivery path for assembled books, same shape
   as `generate-sim.ts` already proved out: a webhook endpoint that serves
   an assembled subject's sections (or syncs `assembled_books/*.md` into
   Firestore/a static host the app can fetch), so a completed subject
   actually reaches a student instead of sitting in a local `data/` folder.
3. **(Product, me)** Wire the iOS reading surface to consume that once it
   exists — likely extending `BookGraphLoader`'s sibling views rather than
   a new screen, since the graph-browsing UI is already real.
4. **(Engine + infra, Blake)** Move Kokoro off Vercel serverless onto a
   Fly.io pool per §1, so the voice half of a study session doesn't cold
   start while the content half is finally coherent.

None of steps 1, 2, or 4 are mine to build unilaterally, they're Engine
lane and real spend/generation-cost decisions. Step 3 is real Product work
I can pick up once 1-2 produce something to point at. Happy to write the
topological-runner script itself as a starting point for Blake to review
rather than just describing it, if that's useful, say the word.
