# Data sources — provenance and licence ledger

**Every ingested dataset gets a row here BEFORE it is ingested.** The absence of
this file is the direct cause of two NonCommercial contaminations reaching the
shipped commercial bundle (Eedi, ~1,508 rows; OpenStax Contemporary Mathematics,
209 rows). Neither was detectable from the repo afterwards.

**Rules**
1. **Unknown licence blocks.** Not "warn", not "assume permissive". Both
   incidents came from a permissive default.
2. **Verify per artifact and per edition.** A publisher is not a licence.
   OpenStax and Illustrative Mathematics both relicensed *between editions* of
   the same title, in opposite directions from what the series name suggests.
3. **Record the URL you actually checked**, not the one you assume exists.
4. Machine-enforced for OpenStax by `ml/tests/test_openstax_license_gate.py`.

Remediation plan: [`agent_work/engine/EXTERNAL_DATA_SOURCING_BUILD.md`](../agent_work/engine/EXTERNAL_DATA_SOURCING_BUILD.md).

---

## Question / content sources

| Source | Artifact | Licence | Commercial? | Verified | Notes |
|---|---|---|---|---|---|
| **Eedi** — Mining Misconceptions in Mathematics (Kaggle 2024) | `data/eedi/train.csv`, `ml/data/eedi_misconceptions.json`, `app/src/data/eediQuestions.json` (1,508 rows) | **CC BY-NC 4.0** | ❌ **NO** | 2026-08-17, competition Rules → "Data Access and Use", §A.1 | Authenticated + JS-rendered; not WebFetch-able. Written permission requested from Eedi — **pending**. Ingest is derivative (LaTeX rewriting, alt-text substitution, concept re-tagging). |
| **OpenStax** — 1st editions | via Exercises API, `book-slug:` in `CC_BY_BOOK_TOKENS` | **CC BY 4.0** | ✅ yes | 2026-08-17, CMS API per slug | 2,112 exercises across 9 books. Attribution required. Mostly free-response. |
| **OpenStax** — `-2e` editions, Contemporary Mathematics, Calculus | excluded at ingest | **CC BY-NC-SA 4.0** | ❌ **NO** | 2026-08-17, CMS API per slug | **209 rows already shipped** in `openstaxMCQ.json` — quarantine pending (spec S2). |
| **OpenStax** — unknown provenance | `app/src/data/openstaxQuestions.json` (37 rows) | **unknown** | ❌ **NO** | — | Hash ids, no source-book tag, raw cache gitignored. Provenance **unrecoverable**; re-derive rather than rescue. |
| **Learning Commons** — Knowledge Graph | `ml/data/external/learning_commons/` (pending) | **CC BY 4.0** (data), **MIT** (code) | ✅ yes | 2026-08-17, [`LICENSE.md`](https://github.com/learning-commons-org/knowledge-graph/blob/main/LICENSE.md) | Only source documenting its own upstream chain: standards from 1EdTech (written CC BY 4.0 permission), components from Achievement Network (CC BY 4.0), progressions from Student Achievement Partners (CC0). Attribution required. |
| **ACT master bank** | `app/src/data/actMasterQuestionBank.generated.json` (205 rows) | **unrecorded** | ⚠️ unverified | — | Human-annotated in-house? Confirm origin before relying on it as a clean transfer set. |
| `actQuestionsBank.json` (9 rows) | " | **unrecorded** | ⚠️ unverified | — | Same. |
| **Story Cells** | `app/src/data/storyCells.json` (12 rows) | **unrecorded** | ⚠️ unverified | — | Believed in-house narrative work; confirm. |
| **Khan** | `app/src/data/khanQuestions.json` (0 rows) | **unverified** | ❌ **NO** | — | Empty today. Khan content is typically CC BY-NC-SA — **verify before it gains a single row.** |
| **MindCraft generated** | `ml/data/generated/**` | in-house | ✅ yes | — | No upstream owner by construction. Regenerable from `(template_id, seed)`. |

## Ontology / structural sources

| Source | Artifact | Licence | Commercial? | Verified | Notes |
|---|---|---|---|---|---|
| **MindCraft ontology** | `ml/data/5_level_ontology/**` | in-house | ✅ yes | — | 42 concepts, 179 ingredients. |
| **McCreary ontology work** | (integrated) | **verbal grant** | ⚠️ **scope undocumented** | — | Non-exclusive verbal grant to Akshat. Legally valid but scope — which repos, commercial derivative rights, attribution — is unwritten. **Papering it is an open action.** |

## Reusable code (not data)

| Source | Licence | Notes |
|---|---|---|
| Eedi 1st-place solution | **MIT** | Usable as code. Does **not** sanitise NC-derived data or weights. |
| `labelbank` | **MIT** | Retrieve/rerank over closed label banks. |
| Learning Commons KG code | **MIT** | |

---

## Verification recipes

**OpenStax, per book:**
```
https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&slug=<slug>&fields=license_name
```
The Exercises API exposes **no** licence field on an exercise, so the only
licence signal is its `book-slug:` tag.

**Kaggle competitions:** log in → competition → **Rules → "Data Access and
Use."** Per-competition and authenticated; not fetchable programmatically.

**GitHub-hosted datasets:** read `LICENSE`/`LICENSE.md` in the repo directly —
the GitHub API's `license` field reports `NOASSERTION` for non-SPDX terms and
will silently mislead (it does for Learning Commons, which is properly licensed).
