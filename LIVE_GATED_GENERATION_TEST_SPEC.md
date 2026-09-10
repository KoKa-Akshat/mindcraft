# Live, Gated Generation — Closed Test Spec

Hand this to your iOS agent as a self-contained brief. Scope: a **closed
test cohort**, not a public launch — the real yield numbers below are why.

## What this actually is

A student asks for a topic. The real content-engine pipeline
(`mindcraft-content-engine`, separate private repo) runs it through fit-check
→ generate → render → structural rubric → visual/pedagogical gate. Nothing
is shown to the student until it clears the full gate. If it doesn't clear,
the student sees an honest "couldn't make a good one for that yet," not a
broken result.

**Why gated-before-showing, not raw generation**: tested tonight, real
numbers — a fine-tuned local model got 2 of 4 validation answers factually
wrong (one described "Parallel Connection" as wired in series). The gated
pipeline itself has a real, measured yield of 1/10 to 6/10 depending on
domain (narrative/qualitative concepts skip correctly rather than forcing a
bad sim; mechanism-based domains like circuits/chemistry generate far more
reliably). Design for that yield rate as the normal case, not an edge case.

## Real architecture decision — read before building

The content-engine's generation+gate pipeline is Python (`batch_generate.py`
+ `simulation_generator.py` + `microsim_rubric.py` + `visual_quality_gate.py`),
needs headless Chromium (Playwright) to render and screenshot each attempt,
and needs `ANTHROPIC_API_KEY`. **Don't port this to TypeScript inside the
webhook** — rendering + rubric + vision-gate logic is real, tested, and
porting it risks drift from the validated version for no real benefit.

**Recommended**: deploy it as its own service, the same shape as
`mindcraft-ml` already uses (Python service on Hugging Face Spaces — see
`CLAUDE.md`'s Deployment section for the live pattern: `ml/scripts/deploy_hf.sh`,
secrets on the Space, a stable URL the webhook calls into). The webhook's job
becomes: receive the student's request, call this service, wait for a
verdict, relay it. This is a genuinely new piece of infra, not a config
change — treat it that way in scoping.

## Backend endpoint

New webhook handler (`webhook/lib/handlers/generate-lesson.ts` or similar),
routed through `app-actions.ts` per the existing pattern (Hobby plan's
12-function cap is why this repo routes through one file, not one endpoint
per feature — read `webhook/lib/handlers/resume-agent.ts` for the real,
working shape of a handler in this codebase before writing a new one).

Request: student id (for the rate limit below), topic/concept text.
Response: either a verified result (title, description, the rendered
HTML/JS, which concept it matched) or an honest "no good result" with a
reason if available — never a partial/unverified result.

**Real latency**: generation + render + structural rubric + (only if that
passes) a real vision-model call is multiple sequential API round-trips —
realistically 15-60+ seconds per attempt, more if a retry happens. This is
not a sub-second interaction. Design the request as genuinely async
(a job that the client polls or gets pushed a result for), not a single
blocking HTTP call an iOS view sits and waits on.

## iOS UI

Reuse `jesseCall.isThinking` (real, existing, from your own recent commit
`7b537beb`) for the loading state — same pattern already validated for
Jesse's generation round-trips, don't invent a second loading-state
mechanism for this feature.

**Design explicitly for the low yield as the normal case, not a failure
state.** A real option: on a "no good result," automatically try one
adjacent angle on the same topic before telling the student it didn't work,
mirroring the reasoning shown in tonight's real skip messages (e.g. a topic
being "too broad an umbrella" is itself informative — could inform what to
retry with). Whatever the UX, don't present "couldn't generate a good one"
as an error/bug state — it's expected, roughly half to nine-tenths of
attempts depending on domain, per tonight's real numbers.

## Cost control — not yet designed, has to be before this ships

Each attempt costs real money regardless of whether it passes the gate
(failed/discarded attempts still spent the generation + rubric calls). At
the measured yield rates, getting one shown result can mean several billed
attempts. **This needs an actual per-student rate limit or budget cap
before any real student can trigger it** — not designed yet, don't skip
designing it just because the rest of the pipeline is real and tested.

## Storage and attribution

Gate-passed results should be stored (Firestore, matching the existing
pattern other content uses) so the same verified result can be reused for
a future student asking about the same concept, rather than regenerating
from scratch every time — real cost savings, and consistent with treating
gate-passed content as a growing, reusable library. Anything a student sees
that came from this pipeline needs clear "AI-generated" attribution — same
disclosure discipline as everywhere else in this app, not a new exception.

## Before this touches a real student — not optional

This crosses Engine (`webhook/**`, a new deployed service) and Product
(`ios-prototype/**`) lanes, introduces real ongoing API cost, and puts
AI-generated content in front of real students for the first time in this
app's history. **Loop Blake in before any of this ships**, same standing
rule as every other live-product change this session — this one especially,
given the cost and infra surface is bigger than a typical change.

## Explicitly out of scope for this spec

- Full public launch — this is a closed test cohort while real yield/cost
  data comes in, not a general release.
- Training on the results or on student engagement with them — a separate,
  already-deferred decision (see `ENGAGEMENT_TRAINING_SIGNAL_SPEC.md` in the
  `mindcraft-content-engine` repo, and the standing "wait for iOS to be
  stable, loop in Blake" agreement already on record). Don't fold that back
  in here without revisiting that decision explicitly.
