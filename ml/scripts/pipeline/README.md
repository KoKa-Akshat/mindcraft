# MindCraft Question-Bank Ingestion Pipeline (v2)

Generalized, multi-source ingestion for the practice question bank. This is
the production successor to the single-source proof of concept
`ml/scripts/ingest_eedi.py` (which stays untouched and still owns the Eedi
path — the CLI delegates to it).

## Architecture

```
                        ml/scripts/pipeline/ingest.py  (unified CLI)
                                      │
          ┌───────────────┬───────────┼──────────────┬───────────────┐
          ▼               ▼           ▼              ▼               ▼
   sources/openstax  sources/amc  sources/khan   ingest_eedi.py   story_generator
   (Exercises API)   (AoPS wiki)  (Perseus API)  (delegated,      (conceptStories +
          │               │           │           unmodified)      contextFrames)
          └───────────────┴─────┬─────┘
                                ▼
                     base.run_pipeline()  — the shared loop
        ┌────────────────────────────────────────────────────────┐
        │ fetch → parse_item → R1 concept map (static → alias →  │
        │ LLM) → R2 diagram filter (+alt-text recovery) → R3     │
        │ structure → R4 LaTeX normalize → dedupe → format tag → │
        │ LLM annotate (explanation+hints, cached) → validate →  │
        │ write {"_meta", "questions"} JSON + report             │
        └────────────────────────────────────────────────────────┘
                                │
                                ▼
              app/src/data/{source}Questions.json
              ml/data/pipeline_reports/{source}_report.json
```

Shared infrastructure lives in `base.py`:

| Class | Job |
|---|---|
| `DiagramFilter` | Diagram-deixis regex (verbatim from `ingest_eedi.py`) + `![alt]()` alt-text recovery |
| `LaTeXNormalizer` | `LATEX_SUBS` flattening table (verbatim), residual-LaTeX detection, `$...$` → `\(...\)` |
| `LLMClient` | Provider-agnostic completions (`LLM_PROVIDER` = groq \| openai \| anthropic \| none), 1 call/s, backoff on 429 |
| `LLMAnnotator` | explanation + 3 hints per question; SHA-keyed disk cache `ml/data/.explain_cache.json` |
| `ConceptMapper` | Canonical IDs loaded from the live Layer-1 ontology, alias table, LLM concept mapping (cache `ml/data/.concept_map_cache.json`) |
| `QuestionValidator` | Structural checks against the `questionBank.Question` contract (C5) |
| `PipelineReport` | Per-run stats: accepted / rejects-by-reason / concept + level distribution / LLM usage |

## Running each source

All commands run from the repo root.

```bash
# OpenStax (Exercises API, paginated; caches to ml/data/openstax/exercises.json)
python3 ml/scripts/pipeline/ingest.py --source openstax --out app/src/data/openstaxQuestions.json

# AMC via the AoPS MediaWiki API (AMC 8 2015–2023 + AMC 10A/B 2018–2023)
python3 ml/scripts/pipeline/ingest.py --source amc --years 2015-2023 --out app/src/data/amcQuestions.json

# Khan Academy (best-effort; see caveat in sources/khan.py)
python3 ml/scripts/pipeline/ingest.py --source khan --topic algebra --out app/src/data/khanQuestions.json

# Eedi (delegates to ml/scripts/ingest_eedi.py — unchanged behavior/output)
python3 ml/scripts/pipeline/ingest.py --source eedi --train data/eedi/train.csv --out app/src/data/eediQuestions.json

# Everything (openstax + amc + khan) into app/src/data/{source}Questions.json
python3 ml/scripts/pipeline/ingest.py --all --out-dir app/src/data/

# Fast validation of an adapter without network-side LLM cost or file writes
python3 ml/scripts/pipeline/ingest.py --source openstax --dry-run --limit 20 --no-llm

# Regenerate concept stories (question-aware; see below)
python3 ml/scripts/pipeline/ingest.py --stories
```

Useful flags: `--dry-run` (no writes), `--no-llm` (template explanations, no
API calls), `--limit N`, `--concepts linear_equations,area_volume`.

### Output format

Each source writes an envelope (new in v2 — `eediQuestions.json` keeps the
bare-array shape that `questionBank.ts` already imports):

```json
{
  "_meta": {"source": "openstax", "ingested_at": "...", "total": 123, "pipeline_version": "2.0"},
  "questions": [ { ...Question } ]
}
```

To wire a new file into the app, import it in `app/src/lib/questionBank.ts`
and spread `.questions` into the merged pool (coordinate with the Product
lane — `questionBank.ts` is a shared seam file).

**AMC choice count**: AMC items keep all 5 native choices (A–E), so
`correctIndex` may be 0–4 there. `choices: string[]` in the TS interface has
no length constraint; the shared validator learns the allowance from
`AMCAdapter.ALLOWED_CHOICE_COUNTS = {4, 5}`.

## LLM annotation cache

`LLMAnnotator` generates `explanation` + `hints[3]` per accepted question.

- Cache file: `ml/data/.explain_cache.json`
- Key: `sha1(f"{question}||{','.join(choices)}||{correct_idx}")` — a re-run
  over the same corpus makes **zero** LLM calls.
- Provider selection: `LLM_PROVIDER` env var (`groq` / `openai` / `anthropic`
  / `none`). Keys: `GROQ_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
  The CLI auto-loads `ml/.env.local`. Model overrides: `GROQ_MODEL`,
  `OPENAI_MODEL`, `ANTHROPIC_MODEL` (anthropic defaults to `claude-opus-4-8`;
  set `ANTHROPIC_MODEL=claude-haiku-4-5` for cheaper bulk runs).
- Missing provider/key ⇒ graceful no-LLM mode: template explanations/hints
  are used, and the run reports `used_llm=false` items normally.
- Safety check: an LLM explanation that names a *wrong* choice without ever
  naming the correct one is discarded (template fallback used) — prevents a
  hallucinated key from leaking into the bank.
- Rate limiting: minimum 1 call/second, exponential backoff (3 attempts)
  on 429s.

## Concept bridge mapping

Three layers, tried in order per item (stage R1):

1. **Static source map** — each adapter ships a taxonomy table
   (`OPENSTAX_TAG_MAP`, `AMC_TOPIC_MAP`, `KHAN_TAG_MAP`) mapping source tags
   → `(concept_id, default_level)`.
2. **Alias resolution** — `ConceptMapper.resolve()` maps legacy / near-miss
   IDs (e.g. `polynomial_operations` → `polynomials`, `percent_ratio` →
   `ratios_proportions`) onto the canonical ontology slugs. The canonical set
   is loaded from the live Layer-1 ontology file
   (`ml/data/5_level_ontology/01_..._with_combinations.json`) — the same file
   `serve.py` loads — never a hard-coded list. The alias table mirrors
   `questionBank.ts BANK_ALIASES`.
3. **LLM mapping** — untagged items (all of AMC) go to
   `ConceptMapper.llm_map(source_concept, question_text)`, which shows the
   model the 42 canonical IDs and demands exactly one or `NONE`. Results are
   cached in `ml/data/.concept_map_cache.json`; `NONE` ⇒ reject
   (`R1_concept_unmapped`) rather than guess.

`examTag: 'ACT'` is applied automatically (for adapters that opt in via
`_act_if_tested`) when the resolved concept is in the ontology's
`act_relevance.tested` set.

## Quality thresholds & rejection reasons

Every reject is counted in the run report
(`ml/data/pipeline_reports/{source}_report.json`):

| Code | Meaning |
|---|---|
| `R0_parse_failed` | Adapter couldn't extract stem/choices/key (includes AMC figure-only problems) |
| `R1_concept_unmapped` | No static tag match and LLM said NONE (or LLM off) |
| `R1_concept_filter` | Excluded by `--concepts` |
| `R2_diagram_no_alt` | Has `![image]` with alt text < 30 chars — unresolvable visual |
| `R2_diagram_ambiguous` | Deictic visual language survives alt recovery ("the shaded region", `\includegraphics`) |
| `R2_diagram_dependent` | References a figure and no alt text exists at all |
| `R3_choice_count` | Not 4 choices (4 or 5 for AMC) |
| `R3_bad_key` | `correctIndex` missing / out of range |
| `R3_too_short` | Stem < 15 chars |
| `R4_latex_residual` | Untranslatable LaTeX commands survive normalization |
| `R4_duplicate_correct` | Correct answer text duplicates another choice (ambiguous key) |
| `R5_duplicate_question` | Same normalized stem already ingested this run |
| `R6_*` | Final schema validation failure (should be ~0; earlier stages catch these) |

Alt-text recovery (the technique that recovered 465 Eedi questions): a
markdown image whose alt text is ≥ 30 chars is rewritten to
`(Diagram: <alt>)`, making the item text-solvable and format-taggable
(`diagram` / `coordinate_graph` / `number_line`).

## Adding a new source

1. Create `ml/scripts/pipeline/sources/<name>.py`.
2. Subclass `SourceAdapter` and implement:
   - `name()` — the id prefix (`<name>_<sha1[:8]>`).
   - `fetch(**kwargs)` — return raw dicts. Convention: cache to
     `ml/data/<name>/...json` and fall back to that cache offline.
   - `parse_item(raw)` — return a partial Question
     (`question, choices, correctIndex, conceptId, level`, optionally
     `examTag/format/misconception_*`) or `None` to reject. Set
     `conceptId=None` + `_source_concept="<raw topic label>"` to request LLM
     concept mapping; set `_act_if_tested=True` to auto-tag ACT items.
   - `concept_map()` — the static taxonomy table (may be `{}`).
   - Override `ALLOWED_CHOICE_COUNTS` only if the source genuinely deviates
     from 4 choices.
3. Register it in `ingest.py` (`SOURCES` + `build_adapter`).
4. Validate: `python3 ml/scripts/pipeline/ingest.py --source <name> --dry-run --limit 20 --no-llm`.

Everything else — concept mapping, diagram filtering, LaTeX, IDs, dedupe,
annotation, validation, reporting, output writing — is shared.

## Concept stories (`--stories`)

`story_generator.py` upgrades `app/src/data/conceptStories.json` +
`questionContextFrames.json` to be **question-aware**: it samples 3 real bank
questions per concept, puts them in the generation prompt, and requires the
story world (protagonist / settingLine / questionBridge) to be compatible
with them — no more 1585 bookkeepers wrapping calculator questions.

Only stories that are missing, too short, AI-voiced, or era-conflicting with
their questions are regenerated (`--force-stories` overrides). Generated JSON
is validated (all four keys present, 100–300 word story, no AI-voice markers,
no historic-setting × modern-question conflict) before anything is written;
failures keep the existing story. `ingredientStories` and
`diceFrame`/`spinnerFrame` are always preserved.

## Extending to non-MCQ formats (future)

The pipeline is MCQ-shaped because `questionBank.Question` is
(`choices` + `correctIndex`). To support free response later:

1. Extend the TS `Question` interface with a discriminant, e.g.
   `kind: 'mcq' | 'free_response'` and `answerSpec` (exact value / numeric
   tolerance / expression equivalence) — coordinate on the C5 seam.
2. Add `kind` awareness in `QuestionValidator` (skip choice checks for
   free response; validate `answerSpec` instead).
3. Adapters return `kind: 'free_response'` items from `parse_item()` —
   OpenStax and Khan both carry free-response items that are currently
   skipped in parsing (`return None`), so the fetch layer already sees them.
4. Grading needs a server-side check (`ml/serve.py`) for expression
   equivalence — client-side string compare is not sufficient. Keep the
   deterministic/generative split: deterministic checker owns correctness,
   LLM only renders feedback language.

## What lives where

```
ml/scripts/pipeline/
├── __init__.py
├── base.py               # shared infrastructure (this is most of the pipeline)
├── ingest.py              # unified CLI
├── story_generator.py     # question-aware concept stories
├── README.md
└── sources/
    ├── __init__.py
    ├── openstax.py         # OpenStax Exercises API
    ├── amc.py              # AoPS MediaWiki (AMC 8 / 10A / 10B)
    └── khan.py             # Khan Academy Perseus (best-effort)

ml/data/
├── .explain_cache.json         # LLM annotation cache (SHA-keyed)
├── .concept_map_cache.json     # LLM concept-mapping cache
├── openstax/exercises.json     # raw fetch cache
├── amc/problems.json           # raw fetch cache
├── khan/exercises.json         # raw fetch cache
└── pipeline_reports/{source}_report.json
```
