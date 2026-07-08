# PIPELINE_MCQ_SPEC — Free-Response → Triple-Verified MCQ Generation

Handover document for implementation agents (Cursor / Codex / Copilot).
Read `WORLD_VISION.md` first — every question this pipeline emits is shown to
a student inside a story world. Quality is the product.

## Why this exists

The OpenStax cache (`ml/data/openstax/exercises.json`, 84,923 exercises,
542MB) contains ~6,900 math items, but only ~64 are natively-keyed MCQs.
~6,000 are **free-response with no published answer key**. This pipeline turns
them into 4-choice MCQs the bank can serve — with three independent LLM
solves guarding the answer key, because the prior generation run
(`ml/generation/`) measured a **~30% bad-key rate** from a single LLM pass.
A wrong key doesn't just annoy a student; it corrupts the mastery graph
(`/record-outcomes` treats the key as ground truth). Triple-verify is the
firewall.

## Architecture (3 classes + orchestrator)

All in `ml/scripts/pipeline/mcq_generator.py`, built on `base.LLMClient`
(provider-agnostic: groq / openai / anthropic via `LLM_PROVIDER`).

```
free-response stem
      │
      ▼
MathSolver.solve(stem)                    1 LLM call
      │  step-by-step prompt, must end "FINAL ANSWER: X"
      │  parses the last FINAL ANSWER line; confidence 0.9/0.4/0.0
      ▼
TripleVerify.verify(stem, answer)         up to N (default 3) LLM calls
      │  N INDEPENDENT re-solves — the proposed answer is never shown
      │  to verifiers (no anchoring). Different personas per pass:
      │  careful student / strict teacher / different-method mathematician.
      │  Verified iff ≥2/3 of passes reproduce the answer
      │  (answers_match: exact-Fraction numeric compare with 0.5% relative
      │  tolerance, unit/format normalization, else string compare).
      │  Early-exits once the verdict is mathematically decided.
      ▼
DistractorGenerator.generate(stem, answer) 1-2 LLM calls
      │  Exactly 3 wrong answers FORCED through the student-error taxonomy:
      │    sign_error | arithmetic | wrong_formula | unit_confusion
      │  Each must be a plausible result of actually making that mistake on
      │  THIS problem; validated distinct from the key and each other;
      │  one retry, then deterministic numeric-perturbation fallback.
      ▼
MCQFromFreeResponse (orchestrator)
      │  deterministic shuffle (seeded by exercise uid) → correctIndex
      │  StoryWrapper.wrap() → storyContext + protagonist-voiced
      │    explanation + 3 hints                     1 LLM call
      │  hash cache write → Question dict
      ▼
run_pipeline (base.py) — diagram filter, LaTeX normalization, dedupe,
QuestionValidator, report → {"_meta", "questions": [...]} JSON
```

Budget: ~5–6 LLM calls per emitted question (fewer for dropped ones —
verify early-exits, failures are cached).

## The storyContext field (the Jarvis hook)

Every generated question carries a new optional field:

```jsonc
{
  "id": "openstax_mcq_28960_14",       // openstax_mcq_{uid, @ → _}
  "conceptId": "descriptive_statistics",
  "level": 2,
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correctIndex": 2,
  "explanation": "...protagonist voice...",
  "hints": ["...", "...", "..."],
  "examTag": "ACT",                     // only if concept is ACT-tested
  "format": "word_problem",
  "storyContext": "Florence sets down her pen. The ward ledger holds one more week of cases — and the pattern inside it decides tomorrow's staffing."
}
```

`storyContext` is 1–2 sentences of scene-setting in the concept's story world
(protagonist + setting from `app/src/data/questionContextFrames.json`, flavor
from `app/src/data/conceptStories.json`). The UI renders it as the scene stamp
above the stem. It never reveals the answer or the method.

This is the seed of the Jarvis loop (WORLD_VISION §2): the scratchpad knows
*whose* problem the student is solving, so feedback can be narrative —
"Bravo!" / "Good way to look at this, but here's where the bearing drifted" —
instead of a red X. The protagonist-voiced `explanation` (written by the same
`StoryWrapper.wrap()` call) is that feedback's raw material.

`story_wrapper.py` rules:
- LLM path (`--story-wrap`): one call returns `{storyContext, explanation,
  hints}` — validated (≤320 chars, no worksheet verbs, no answer leak; an
  explanation that never names the verified answer is discarded).
- Fallback (no LLM / rejected output): `frame.questionBridge` verbatim.
  **A question never enters the bank without a storyContext** in conversion
  mode — the fallback is always attached.
- Cache: `ml/data/.story_context_cache.json`, keyed sha1(conceptId||stem).

## How to run

Test run (structural, no API spend):

```bash
cd "/Users/akoirala/Desktop/Business Ideas/mindcraft-site"
python3 ml/scripts/pipeline/ingest.py --source openstax \
  --convert-free-response --verify-count 3 --story-wrap \
  --limit 10 --dry-run --no-llm
```

Test run (real LLM, eyeball the output):

```bash
LLM_PROVIDER=groq GROQ_API_KEY=... \
python3 ml/scripts/pipeline/ingest.py --source openstax \
  --convert-free-response --verify-count 3 --story-wrap \
  --limit 50 --out /tmp/mcq_test.json
```

(Any provider in `base.LLMClient` works: `LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-haiku-4-5` was used for the initial quality pass since
`ml/.env.local` currently carries an Anthropic key, no Groq key.)

Production run (the full ~6,000-candidate corpus):

```bash
python3 ml/scripts/pipeline/ingest.py --source openstax \
  --convert-free-response --verify-count 3 --story-wrap \
  --out app/src/data/openstaxQuestions.json
```

Keys are auto-loaded from `ml/.env.local` (`load_env_local()` in ingest.py).
At the 1 call/sec throttle expect **8–12 hours** for the full corpus —
interrupt at will; it resumes from cache.

CLI flags (ingest.py):

| Flag | Meaning |
|------|---------|
| `--convert-free-response` | Enable the MCQ-generation pathway (openstax only) |
| `--verify-count N` | Independent verify solves (default 3, min 2) |
| `--story-wrap` | LLM storyContext + voiced explanation (else questionBridge fallback) |
| `--limit N` | Process at most N *candidates* (already filtered to free-response math) |
| `--concepts a,b` | Concept filter — in convert mode it applies BEFORE the solve chain, so targeted runs spend zero LLM calls on other concepts |
| `--dry-run` | Print stats, write nothing |
| `--no-llm` | Template answers/distractors — structural testing only, never cached |

## Caches (resumability)

| File | Keyed by | Holds |
|------|----------|-------|
| `ml/data/.mcq_gen_cache.json` | `{uid}:{sha1(stem)[:12]}` | solved answer + steps + distractors + agreement, **and failures** (`verify_failed`, `no_answer`, …) so re-runs never re-spend on a decided item |
| `ml/data/.story_context_cache.json` | `sha1(conceptId\|\|stem)` | storyContext + explanation + hints |
| `ml/data/pipeline_reports/openstax_mcq_skips.json` | — | per-run skip report: `{uid, reason, detail}` for every dropped item |
| `ml/data/pipeline_reports/openstax_report.json` | — | standard PipelineReport |

Caches flush every 20 writes and on exit (including Ctrl-C — ingest.py calls
`adapter.finalize()` in a `finally`). `--no-llm` results are never cached.

## Filtering (what gets dropped before any LLM call)

In `OpenStaxAdapter._parse_free_response` (cheap gates first, so credits are
never spent on doomed items): non-math books, `<img` in the stem,
stems < 25 chars, Spanish editions, diagram-deictic language
(`base.DiagramFilter`), residual LaTeX, references to other exercises/parts
("in Your Turn 10", "the previous exercise", "the file 'InState'"), and
unmapped concept tags. Measured on the statistics-heavy head of the corpus:
~45% of candidates survive these gates; algebra/precalc books gate higher.

Then the LLM gates: low-confidence solve / answer too long to be a choice
(`no_answer`), <2/3 verify agreement (`verify_failed`), unbuildable
distractors (`distractor_failed`).

## Expected output

From ~6,000 free-response math candidates: **~4,000–4,500 questions** at the
observed 65–70% end-to-end pass rate with 3-verify (structural gates plus
verify attrition). Every reject is accounted for in the skip report — spot-
check `verify_failed` entries periodically; if a systematic pattern appears
(e.g. multi-part stems), add a structural gate rather than loosening verify.

## Wiring the output into the bank

Same pattern as the existing sources — `app/src/lib/questionBank.ts` already
imports `openstaxQuestions.json`:

```ts
import openstaxQuestionsData from '../data/openstaxQuestions.json'
```

The pipeline writes the `{"_meta", "questions"}` envelope that loader already
unwraps. To ship: run production, verify the report, commit the JSON, push
(CI deploys). Frontend follow-ups (Product lane):
1. Add `storyContext?: string` to the `Question` interface in
   `questionBank.ts` (data is forward-compatible — extra JSON field until then).
2. Render `storyContext` as the scene stamp above the stem in the practice
   session view (see DASHBOARD_NOTEBOOK_SPEC.md paper system).
3. Jarvis feedback: on submit, feed `storyContext` + `explanation`
   (protagonist-voiced) into the scratchpad response instead of the generic
   correct/incorrect copy.

## Invariants (do not weaken)

1. **Never ship an unverified key.** 2/3 agreement minimum. If verify pass
   rates look "too low", fix stems/gates, not the threshold.
2. **Distractors follow the taxonomy.** Random wrong numbers are worthless
   pedagogically — the error types are what let misconception diagnosis work.
3. **storyContext on every question**, fallback included.
4. **Explanations speak as the protagonist**, not as a solutions manual.
5. **Never block on one question.** All conversion failures are caught,
   logged to the skip report, and the run continues.
6. **`--no-llm` output never enters a cache or the bank.**
