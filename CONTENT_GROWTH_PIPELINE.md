# Content growth pipeline — generated lessons → graph → mastery, without corrupting mastery

Answers the standing question: as Jesse generates more lessons (Study Session)
and the content-engine model finishes training, how does the concept graph
keep growing, and how does that stay honest with the personalization step
(the deterministic Beta-Binomial mastery engine, `ml/mindcraft_graph/engine/`)?

**The one-line answer: growth only ever adds valid inputs to the mastery
engine's EXISTING contract — it never gets a second, looser way in.** Nothing
below changes what mastery reads. It changes how much reaches it.

## Goal
1. A student can ask Jesse to teach anything, and if the concept doesn't
   exist in the ontology yet, it gets minted — namespaced, DAG-validated,
   live — without a redeploy.
2. Real practice on generated content moves mastery exactly the way practice
   on the fixed 42-concept ontology already does. No new mastery math.
3. Exposure to generated content that ISN'T graded (viewed a chapter,
   revisited one) is recorded somewhere real, but never leaks into mastery
   as if it were graded evidence.
4. Dan McCreary's xAPI/LRS material and MindCraft's own Layer 4 target
   schema get reconciled instead of living as two unreferenced systems that
   independently arrived at the same idea (event → rollup → mastery).

## Why this was harder than "just add an endpoint"
Read before assuming any of this is negotiable — each constraint below is a
real thing found in the live code, not a hypothetical:

- `SessionEvent.event_type` (`mindcraft_graph/models/events.py`) is a
  **closed** `Literal["session","flashcard","worksheet","problem_set","assessment"]`,
  and `outcome` is a **required**, bounded `[-1, 1]` graded signal.
  `engine/features.py:compute_concept_profiles` sums `total_outcome` /
  `total_effort` / `event_count` for **every** `SessionEvent` it sees,
  regardless of type — only `"assessment"` gets special-cased, and only for
  `practice_event_count`, not for whether it counts toward outcome at all.
  **There is no value of `outcome` that safely means "ungraded exposure."**
  Even `0.0` would dilute real graded-practice evidence with content a
  student merely looked at. This is why engagement (view/revisit) events do
  **not** become `SessionEvent`s. Ever.
- `data/dynamic_graphs/*.json` (`loaders/dynamic_concept_loader.py`) already
  supports exactly this kind of growth — it's how the 4 book graphs (Euclid,
  Adam Smith, Darwin, Marcus Aurelius) merged into the live 185-concept
  ontology in PR #49. It re-validates namespacing (`subject::concept`) and
  DAG-ness itself, independent of whatever produced the file. **The gap
  wasn't the mechanism — it was that nothing ever wrote a new file into that
  directory at runtime, and the directory was only ever scanned once, at
  process startup.**
- `mindcraft_graph/models/learning_world.py:LearningEvent` already has almost
  exactly the shape an engagement event needs — **open** `event_type: str`,
  **nullable** `outcome: float | None`, a `metadata: dict` extension point —
  plus a working Firestore sink (`save_learning_event` → `learning_events`
  collection) that's simply never been called from live `serve.py`. CLAUDE.md
  flags the file this lives in as "co-founder's agentic layer... dead code,
  excluded from live serve.py" — that's true of `SubjectGraph`/the units-based
  world model around it, but `LearningEvent` itself is a clean, already-built,
  already-tested-shape event log sitting unused. Reviving it here is
  reconciling two of MindCraft's own dormant pieces, not building a third.

## What's built tonight (Lane Engine — `ml/**`, mine, separate commit)

| Piece | File | What it does |
|---|---|---|
| **Tagger** | `mindcraft_graph/loaders/lesson_tagger.py` | Pure, deterministic (no LLM) — turns `(topic, ordered chapter titles)` into a `dynamic_concept_loader`-shaped dict. Slugs the topic → `subject_id`, one concept per chapter (`{subject}::{chapter_slug}`), v1 prerequisite model is a straight chain (chapter N depends on N-1) — matches how Study Session already presents chapters, explicitly NOT semantic prerequisite inference. |
| **Reload** | `serve.py` `_rebuild_dynamic_ontology_and_index` + `POST /admin/reload-graphs` | Re-scans `data/dynamic_graphs/`, rebuilds ontology + embeddings + PCA + classification index into **local** values, then atomically swaps them into the module globals under a lock. Same rebuild a redeploy already runs when a book graph is added — this just makes it callable mid-process. Service-key only. |
| **Ingest** | `serve.py` `POST /ingest-lesson-graph` | Tag → write to a `.tmp` file → re-validate through the real loader (`load_dynamic_concept_graph`, the same DAG/namespace check the startup scan uses) → atomic rename → reload. One call for the client to make right after generating a lesson. A bad graph never reaches the directory the next restart would also read. Service-key only. |
| **Engagement log** | `serve.py` `POST /record-engagement` | Writes a `LearningEvent` (student_id, subject_id, concept_id, event_type, metadata) via the revived `save_learning_event`. Does not touch `ontology`, `interactions`, or anything `compute_concept_profiles` reads. |

Verified without booting the live model stack (the 18-hour LoRA run is
actively using MPS on this machine — same reason `infer.py` earlier tonight
never ran real generation; loading a second model into MPS memory mid-run
risks the exact OS-kill/fragmentation failure `train.py` already documents
on this hardware):
- `python3 -m py_compile serve.py` — clean.
- `lesson_tagger.tag_lesson_to_graph(...)` round-tripped through the real
  `dynamic_concept_loader._build_ontology` (the actual DAG + namespace
  validator, not a mock) — 4 chapters in, 4 concepts + 3 chain edges out,
  loader accepted it.

**Not yet done, still needed before this is live:** a full `uvicorn` boot
test of the three new endpoints against a running server, once it's safe to
load the sentence-transformer model on this machine again (training done, or
a second machine). Do that before wiring the client to call them for real.

## iOS wiring — done (2026-08-19, commit `90b81ac2`)
Study Session now makes real calls, not zero:

1. **After a lesson generates** (both `.generated` branches in
   `JesseCallSession.swift`) → fire-and-forget `POST /api/ingest-lesson-graph`
   (new webhook proxy, since the ml endpoint is service-key-only and the app
   holds no such key) → tags the lesson into the live ontology. This is what
   makes "yes, it keeps growing" actually true.
2. **When a chapter tab is viewed** (`StudySessionView.swift`, `.task(id: activeTab)`)
   → `POST /record-engagement` straight to the ml service, real Firebase
   token, same auth shape `OutcomeClient` already uses. Scoped to
   `.generated` lessons only — see below.
3. **The practice question → `/record-outcomes`) is NOT wired.** Checked
   `StudentAIKeyStore.LessonOutline`/the generation prompt directly:
   `question: String?` is free text with no `choices`/`correctIndex` — there
   is no honest binary score to send. Wiring this needs its own scoped
   design (most likely: generate answer choices at outline time, add a
   pick-an-answer UI to `StudySessionView`), not a one-line network call.
   Left undone rather than faked.

`LessonSlug` (new, `LessonGraphTagging.swift`) mirrors `lesson_tagger.py`'s
`slugify()` client-side so chapter → `concept_id` stays correct without a
round trip through the ingest call's response (which would race a student
switching tabs before it returns). Caught a real bug before it shipped: an
early version used `CharacterSet.lowercaseLetters` (Unicode-aware — keeps
"é") where Python's regex is ASCII-only (`[a-z0-9]+`, strips "é") — found by
running the real Python slugify on "Café Culture" and diffing the output,
not by inspection. Fixed to match exactly, char-by-char port.

`.archive`-sourced lessons deliberately do NOT fire `/record-engagement` —
their real concept_ids, if any exist in the live ontology at all, come from
`BookGraphLoader`/`ArchiveRagClient`, a path this doc hasn't investigated;
guessing a slug for them would log engagement against an id the server
never minted. Named as an open question, not silently assumed away.

Full project build verified: `xcodebuild build` against the booted iPad
simulator — `BUILD SUCCEEDED`. (Registering the new Swift file in
`project.pbxproj` via the `xcodeproj` gem was the one step that failed on
the first pass — `LessonGraphTagging.swift` existed on disk but wasn't in
the target yet; same file-registration step this session already
documented once for `StudySessionView.swift`.)

All three are Product-lane, `X-Service-Key`-authenticated calls the app
already knows how to make (same pattern as `ArchiveRagClient`).

## Reconciling Dan's material, Layer 4, and what's live — who wins
Three things describe "how a learning event should be structured" and none of
them currently reference each other. Resolved:

| System | Status | Role here |
|---|---|---|
| **`SessionEvent` + Beta-Binomial mastery** (`engine/`) | Live, deterministic, tuned to this product (asymmetric strength scoring, temporal decay, bridge detection) | **Stays the only path to mastery.** Not replaced, not extended, not touched by anything in this doc. |
| **Layer 4 target schema** (`04_student_learning_state_schema_v1_6.json`) | Designed, not wired into the live engine | The schema's own separation of `student_event_schema` (raw events) from `student_state_schema` (computed mastery) is exactly the boundary this pipeline enforces in practice (`LearningEvent` vs `SessionEvent`) — this doc is a concrete, partial implementation of that separation, using models that already exist in code, not a new parallel system. |
| **Dan's xAPI / LRS material** (`xapi-course`, `learning-record-store`) | Published, unused anywhere in MindCraft | Not adopted as infrastructure — MindCraft's Beta-Binomial engine is more specific to this product than generic BKT would be, and rebuilding on xAPI's actor/verb/object shape would mean throwing away working, tuned code for a generic one. Used instead as **vocabulary discipline**: `LearningEvent`'s fields (student_id≈actor, event_type≈verb, concept_id≈object, outcome≈result, metadata≈context) already map cleanly onto it. Dan's material doesn't cover graph-growth-from-new-content specifically (checked directly — it isn't there), so the tagging/reload design above is original, not sourced from his books. |

## Grounding in the literature (checked directly, 2026-08-18, not assumed)
The `SessionEvent`/`LearningEvent` split wasn't just a codebase constraint
(closed `Literal`, required bounded `outcome`) — it turns out to be exactly
what the intelligent-tutoring-systems literature independently converged on,
under a different name, going back to the same lineage MindCraft's own
Beta-Binomial engine descends from:

- **Corbett & Anderson (1994/1995), "Knowledge Tracing: Modeling the
  Acquisition of Procedural Knowledge,"** *User Modeling and User-Adapted
  Interaction* 4:253–278 — the foundational BKT paper. In its own and every
  standard formulation since, an "opportunity" that updates the model IS a
  scored attempt (right/wrong) on a step. There is no concept of an ungraded
  "opportunity" in classic BKT at all — confirming the codebase finding
  (`compute_concept_profiles` has no safe value for "ungraded exposure")
  isn't a gap in MindCraft's math, it's consistent with how the field
  defines evidence in the first place.
- **Chi, Koedinger, Gordon, Jordan & VanLehn (2011), "Instructional Factors
  Analysis: A Cognitive Model for Multiple Instructional Interventions,"**
  *Proc. 4th International Conference on Educational Data Mining*, 61–70 —
  read directly (not just abstracted), and the single most on-point source
  found. Their tutoring system logs two kinds of steps: **"elicit"** (the
  system asks the student, gets a graded right/wrong response) and
  **"tell"** (the system just tells the student directly — "instructional
  interventions without immediate direct observations on student's
  performance"). Their own words on why this needs separate handling: *"KT
  model is designed mainly for student-driven ITSs in that its parameters
  are directly learned from the sequences of student's performance (right
  or wrong)... When there are multiple instructional interventions and some
  of them do not generate direct observations, it is not very clear how to
  incorporate these interventions directly into conventional KT models."*
  Their fix (equation 3): tells get their **own separate count** (`T_ik`,
  prior tells) with their **own separate learned coefficient** (`ν_k`),
  structurally distinct from the success/failure counts (`S_ik`/`F_ik`) a
  graded attempt produces. This is formally the same shape as
  `SessionEvent` (elicit, graded, feeds mastery) vs `LearningEvent` (tell,
  ungraded, doesn't) — arrived at independently, then found to match.
- **Baker, Corbett, Roll & Koedinger (2008), "Developing a Generalizable
  Detector of When Students Game the System,"** *UMUAI* 18:287–314, and
  **Beck (2005), "Disengagement Tracing"** — the complementary finding:
  when a response isn't a sincere attempt (fast-guessing, gaming, or by
  extension here, no attempt at all), *counting it as ordinary practice
  evidence measurably biases the mastery estimate*. This is the direct
  argument for why `outcome=0.0` on a "just viewed it" event would have been
  a real mistake, not a harmless default — it isn't neutral, it's wrong
  evidence.
- **ADL's own xAPI verb registry** draws the identical line at the
  vocabulary level: `experienced` (exposure, no result) is a distinct
  canonical verb from `answered`/`passed`/`failed` (which carry a `result`
  object) — the same split `LearningEvent.event_type` (open, exposure) vs
  `SessionEvent`+`OutcomeItem` (graded) encodes.

**One honest, not-yet-acted-on finding from IFA worth naming rather than
sitting on:** their result isn't just "keep tells out of mastery" — it's
that tells, tracked separately, had a *real, measurable, positive*
coefficient (`ν_k`) on predicted performance. MindCraft's current
`LearningEvent` log is a strict subset of that: it records exposure but
feeds it into **nothing** — mastery treats a viewed-and-never-graded
chapter identically to a chapter never generated at all. A faithful
IFA-style next step would be a small, explicitly SEPARATE, low-weight
"prior exposure count" term in `engine/edge_weights.py`'s Beta-Binomial
update — its own field, its own tiny prior, easy to ablate — never blended
into the same `alpha`/`beta` graded evidence updates. This is a genuine
enhancement, not a gap in tonight's design, but it changes the actual
mastery math (`engine/edge_weights.py`), which is squarely the
personalization step this whole doc has been careful not to touch
unilaterally — it needs Blake, not a solo commit, before it happens.

## Integrity boundary (the actual answer to "does this stay true to the personalization step")
- Mastery's only inputs, before and after this doc: `/record-outcomes`
  (`OutcomeItem`) and `/seed-assessment`. Unchanged.
- Growth adds two things upstream of that boundary: (a) more valid
  `concept_id`s a real graded question can target, and (b) a provenance log
  of what content reached a student that mastery never reads. It does not
  add a third way to move a mastery number.

## Status
- ✅ Tagger, reload endpoint, ingest endpoint, engagement endpoint — built.
- ✅ iOS wiring — ingest-on-generate, engagement-on-chapter-view. Full
  project build green.
- ✅ **Deployed to production and verified live, 2026-08-19.** `git-lfs`
  wasn't installed on this machine — the Space's git backend now requires it
  for the `deploy_hf.sh` push step; installed via Homebrew, then the push
  went through clean (`472fce9`). Confirmed via the Space's own runtime API,
  not assumed: build completed (`RUNNING_BUILDING` → `RUNNING_APP_STARTING`
  → `RUNNING`, ~2.5 min), `/health` showed `conceptCount: 185` (the full
  PR #49 ontology, live). Then ran a REAL end-to-end test through the actual
  client path (webhook → ml, not a direct ml call) — `POST
  /api/ingest-lesson-graph` with a 2-chapter fake lesson came back
  `totalConcepts: 187` with `conceptIds` matching byte-for-byte what the
  iOS `LessonSlug` port independently computes for the same input, proving
  the tag → validate → write → reload → serve loop and the client/server
  slug agreement both work for real, not just in isolated unit checks.
- ✅ **Found and fixed a real, pre-existing production bug while verifying
  this**, unrelated to tonight's feature work: the webhook's `ML_URL` env
  var (114 days old) still pointed at the old Cloud Run service, which has
  been billing-dormant since the July HF Spaces migration — meaning
  **JARVIS's `get_student_profile`/`get_recommendations` tool calls and the
  `/process-summary` session pipeline (`generate-summary.ts`) had likely
  been silently failing in production for over a month**, swallowed by
  their own try/catches into generic "not available" messages rather than
  visible errors. Fixed by correcting `ML_URL` to the live HF Space URL and
  triggering a redeploy (Vercel bakes env vars into a deployment at build
  time — changing the value alone doesn't reach already-built functions).
  Confirmed fixed via the same end-to-end test above, which only started
  passing once this was corrected.
- ⚠️ **Confirmed, not hypothetical: the Space has no persistent disk**
  (`api.space_info(...).runtime.storage` → `None`, free `cpu-basic` tier).
  Anything `/ingest-lesson-graph` writes to `data/dynamic_graphs/` at
  runtime lives only in that container's ephemeral filesystem — it will
  vanish on the Space's next sleep/wake cycle (idle ~48h) or next redeploy,
  unlike the four git-committed book graphs. The `zzz_test_ingest_verification`
  concepts from the test above will self-clean the same way — left alone on
  purpose rather than forcing an extra deploy cycle just to remove two
  obviously-fake test concepts. **Real open problem for later, not solved
  here:** student-generated lesson graphs need to survive a restart to be
  worth anything long-term. Options, unevaluated: pay for a small persistent
  disk on the Space; have `/ingest-lesson-graph` also commit the file back
  to the Space's own git repo (adds write-credential-in-the-running-service
  risk, and a rebuild per lesson); move dynamic graph storage to Firestore
  and have the reload path read from there instead of local disk. Needs its
  own design pass, not a rushed fix tonight.
- ❌ Practice-question grading → `/record-outcomes` — needs answer choices
  to exist first; not started, scoped above.
