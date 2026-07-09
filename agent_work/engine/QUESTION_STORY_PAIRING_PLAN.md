# QUESTION_STORY_PAIRING — Engine Lane (Fable 5 → Codex)

**Status:** Ready to implement  
**Lane:** Engine (`ml/**`, `ml/data/folk_tales/**`)  
**Priority:** High — Product already built the matching consumer; Engine needs the supply

---

## Context: what Product already built (do NOT redo)

| File | Does |
|------|------|
| `app/src/data/mathSkinTop.json` | 32 vetted folk tales, tagged with concept_affinity_scores |
| `app/src/lib/storyMatch.ts` | Deterministic tale↔question scorer (concept + keywords + math themes) |
| `app/src/lib/storySelection.ts` | `enrichQuestionsWithStories()` → matched tale → story-module payload |
| `webhook/api/story-module.ts` v5 | Per-question Groq skinning; math never changes |
| `app/src/lib/adaptiveDiagnostic.ts` | Reshuffles probes; `ensureStorySkins()` |

Product's `matchFolkTale(q, ctx)` scores a question against the tale bank at runtime.
Engine needs the symmetric supply layer: a large vetted tale bank + pre-computed question signals.

---

## Shared tag vocabulary (MUST match Product exactly)

| Field | Folk tale side | Question side |
|-------|---------------|---------------|
| Concept link | `concept_affinity_scores: Record<string, number>` | `conceptId` + ontology alias |
| Themes | `math_theme_tags`, `themes`, `keywords` | `keywords`, `math_signals`, `math_theme_tags` |
| Quality | `math_skin_score`, `quality_score` | `story_skin_score` |
| Student ctx | `goals`, `tutor_focus` (passed at match time) | same ctx |

Canonical concept IDs: `ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`

**math_theme_tags enum** (shared, do not invent new tags):
`ratio`, `proportion`, `pattern`, `growth`, `geometry`, `measurement`, `probability`,
`sequence`, `balance`, `transformation`, `symmetry`, `counting`, `area`, `number_theory`

---

## Job 1: `ml/scripts/build_folk_catalog.py`

Build ~4,000 stub records from public-domain tale catalogs.

**Sources** (all public domain / CC0):
- Project Gutenberg folklore collections: search `https://www.gutenberg.org/ebooks/search/?query=folk+tales&sort_order=downloads`
  Focus: Aesop, Panchatantra, African folktales, Norse myths, Anansi stories, Jataka tales,
  Arabian Nights, Grimm, Andersen, Native American legends, Japanese folk tales
- SACRED TEXTS (sacred-texts.com) — public domain mythology / folk narrative
- D.L. Ashliman's Folklore & Mythology Electronic Texts (pitt.edu) — ~2,000 tales catalogued

**What each stub contains** (minimal; enrichment fills the rest):
```json
{
  "id": "anansi_spider_wisdom",
  "title": "Anansi and the Wisdom Pot",
  "culture": "Akan / Ashanti",
  "region": "West Africa",
  "source_url": "...",
  "synopsis": "...",
  "characters": [{"name": "Anansi", "role": "trickster spider"}],
  "setting": "West African forest",
  "math_theme_tags": [],
  "concept_affinity_scores": {},
  "math_skin_score": null,
  "enriched": false
}
```

Output: `ml/data/folk_tales/folk_catalog.json` (~4,000 stubs)

CLI:
```bash
python3 ml/scripts/build_folk_catalog.py --target 4000
python3 ml/scripts/build_folk_catalog.py --dry-run   # count sources, no writes
```

**Important**: Do not scrape — build from known public-domain index pages and gutenberg API.
Use `urllib.request` (stdlib only). No `requests` package.

---

## Job 2: `ml/scripts/folk_tale_collector.py`

Vet, tag, and enrich catalog stubs via Groq → `ml/data/folk_tales/folk_tale_bank.json`

**Per tale, Groq produces:**
- `math_theme_tags: string[]` — from shared enum above
- `concept_affinity_scores: Record<conceptId, float>` — 42 concept IDs, scores 0–1
  (only include non-zero scores; omit concepts with < 0.1 affinity)
- `math_skin_score: float` — 0–1, how naturally this tale can wrap a math problem
  (high = concrete quantities, clear stakes, countable objects)
- `quality_score: float` — narrative richness for student engagement
- `katha_voice_sample: string` — ≤80 char opening in warm narrative voice
- `keywords: string[]` — 5–10 nouns/verbs extracted from the tale

**Groq system prompt approach:**
```
You are a curriculum designer tagging folk tales for math problem skinning.
For the tale provided, output JSON with exactly these fields:
{math_theme_tags, concept_affinity_scores, math_skin_score, quality_score,
katha_voice_sample, keywords}
Use ONLY these math_theme_tags: [ratio, proportion, pattern, growth, geometry,
measurement, probability, sequence, balance, transformation, symmetry, counting,
area, number_theory]
concept_affinity_scores keys must be valid ontology concept IDs from this list:
[fractions_decimals, ratios_proportions, linear_equations, quadratic_equations,
geometric_transformations, area_volume, probability, sequences_series, ...]
Only include concept_affinity_scores for concepts with score > 0.1.
Return only JSON, no prose.
```

**--export-top flag**: after enrichment, copy the top 100 tales by math_skin_score
into `app/src/data/mathSkinTop.json` format (extending the existing 32).

CLI:
```bash
python3 ml/scripts/folk_tale_collector.py --batch 20    # enrich next 20 unenriched
python3 ml/scripts/folk_tale_collector.py --batch 100   # larger batch
python3 ml/scripts/folk_tale_collector.py --export-top  # sync top 100 to mathSkinTop.json
python3 ml/scripts/folk_tale_collector.py --dry-run     # show prompts, no LLM
```

Uses `ml/generation/llm_client.py` for all LLM calls. Cache enriched tales so re-runs skip already-done.

Output: `ml/data/folk_tales/folk_tale_bank.json`

---

## Job 3: `ml/scripts/enrich_question_signals.py`

Pre-compute keyword signals on all ~1,500 bank questions. Symmetric to `storyMatch.ts`'s
runtime extraction — store on disk so matching can rank before skinning.

**Per question record:**
```json
{
  "questionId": "eedi_180",
  "conceptId": "geometric_transformations",
  "format": "diagram",
  "keywords": ["reflect", "mirror", "symmetry", "triangle"],
  "math_signals": ["symmetry", "transformation"],
  "math_theme_tags": ["transformation", "symmetry", "geometry"],
  "story_skin_score": 0.72,
  "misconception_id": "mis_geometric_transformations__fails_reflect_across_mirror_line"
}
```

**Approach** (deterministic first, Groq only for story_skin_score):
1. `keywords`: Extract nouns/verbs from question stem using regex + stopword filter
   (same `STOPWORDS` list as `storyMatch.ts` — copy it from the frontend file)
2. `math_signals`: Match stem against the math_theme_tags enum (simple keyword scan)
3. `math_theme_tags`: Same as math_signals but include inferred tags from concept ontology
4. `story_skin_score`: Groq judges how skinnable (has concrete quantities, real-world stakes).
   Batch 50 at a time: "Rate 0–1 how easily this question's math context could be embedded
   in a story world. 1 = concrete objects/quantities with clear real-world stakes."

**Input**: Read from `app/src/data/eediQuestions.json` + `app/src/data/actMasterQuestionBank.generated.json`
  (the two large banks; storyCells.json is already handled)
**Output**: `ml/data/enriched/question_signals.json`

CLI:
```bash
python3 ml/scripts/enrich_question_signals.py --limit 100   # first 100 questions
python3 ml/scripts/enrich_question_signals.py               # all ~1,500
python3 ml/scripts/enrich_question_signals.py --dry-run     # count + show sample
```

**Verification**: spot check that a `ratios_proportions` question with "cup" and "mixture"
keywords scores > 0.38 against the Anansi or Kente weaver tales in `matchFolkTale()`.

---

## Job 4 (spec only, Product wires): `rankQuestionsForContext()` contract

Write the spec in code comments / a type file so Product can wire it into
`app/src/lib/questionMatch.ts`. Engine defines the scoring logic; Product calls it.

```ts
// app/src/lib/questionMatch.ts (Product writes the impl; Engine owns this spec)
function rankQuestionsForContext(
  questions: Question[],
  ctx: {
    matchedTale?: FolkTaleEntry
    goals?: string[]
    tutorFocusConcepts?: string[]
    format?: FormatId
    gapSeverity?: number
  }
): Question[]
// Score per question:
// 0.35 × concept_affinity_scores[q.conceptId] from matchedTale
// 0.25 × jaccard(q.keywords, tale.keywords + tale.themes)
// 0.20 × math_theme overlap count / max(len)
// 0.10 × format fit (table→ledger tale, diagram→spatial tale)
// 0.10 × engine gap severity or tutor focus boost
```

Write this spec as a comment block at the top of `ml/data/enriched/question_signals_schema.json`
so Product can read it when implementing `questionMatch.ts`.

---

## Implementation order

1. `build_folk_catalog.py` — no LLM, fast, seeds the bank
2. `folk_tale_collector.py --batch 20` — validate Groq output on 20 tales
3. `enrich_question_signals.py --limit 100` — validate keyword extraction
4. Spot check: ratio question + Kente weaver → score > 0.38 both directions
5. Scale: `folk_tale_collector.py --batch 500`, `enrich_question_signals.py` (all)
6. `folk_tale_collector.py --export-top` → extends mathSkinTop.json

---

## Do NOT do

- Do not overwrite `app/src/data/conceptStories.json` (ontology spine, separate)
- Do not let Groq change question math or generate new question keys (30% bad-key rate)
- Do not use LLM to pick tale OR question — deterministic scoring first, Groq only for skin text
- Do not block Product on 4,000 tales — 32 in mathSkinTop.json is enough for Product to ship

---

## Repo

Canonical repo: `~/Developer/mindcraft`  
Engine lane: `ml/**`, `ml/data/folk_tales/**`  
Run scripts from repo root: `python3 ml/scripts/build_folk_catalog.py`
