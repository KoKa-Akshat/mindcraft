# BUILD — Licence remediation + commercially-clean external sourcing

**Status:** ready to implement. **Written 2026-08-17.**
**Prompted by:** the Eedi CC BY-NC finding (`NEXT_SESSION.md` §1) and a
follow-on audit that found a **second, independent NC contamination** in the
shipped bank.

**Lane: Engine.** Owned paths:
```
data/SOURCES.md                              NEW — the provenance ledger
ml/scripts/pipeline/sources/openstax.py      fix the book allowlist + false licence claim
ml/scripts/pipeline/license_gate.py          NEW — refuses non-commercial sources
ml/generation/rules/**                       D3: mint neutral misconception ids
ml/data/external/learning_commons/**         NEW — CC BY 4.0 alignment data
```
**Product-lane touchpoint (separate commit):** `app/src/data/openstaxMCQ.json`,
`app/src/data/openstaxQuestions.json`, `app/src/data/eediQuestions.json`,
`app/src/lib/questionBank.ts` — quarantining shipped rows changes the client
bundle. Do not fold that into an Engine commit.

---

## 0. What the audit found

### 0.1 OpenStax licensing is **edition-based**, and the split runs opposite to expectation

Verified against OpenStax's own CMS API
(`openstax.org/apps/cms/api/v2/pages/?type=books.Book&slug=<slug>&fields=license_name`),
per book, 2026-08-17:

| Book | 1st edition | 2nd edition (`-2e`) |
|---|---|---|
| College Algebra | **CC BY** | CC BY-NC-SA |
| Precalculus | **CC BY** | CC BY-NC-SA |
| Algebra and Trigonometry | **CC BY** | CC BY-NC-SA |
| Elementary Algebra | **CC BY** | CC BY-NC-SA |
| Intermediate Algebra | **CC BY** | CC BY-NC-SA |
| Prealgebra | **CC BY** | CC BY-NC-SA |
| Contemporary Mathematics | CC BY-NC-SA *(no 1e)* | — |
| Calculus Vol. 1–3 | CC BY-NC-SA | — |
| Introductory Statistics / Statistics / Intro Business Statistics | **CC BY** | — |

**The rule: OpenStax relicensed newer editions to NC-SA; the 1st editions
remain CC BY.** This is the same edition-dependent pattern CLAUDE.md already
records for Illustrative Mathematics ("1st ed. BY 4.0, v.360 BY-NC"). "OpenStax"
is never a blanket-safe answer — **the slug plus the edition is the licence**.

*Correction to the working assumption:* the 2e editions of College Algebra /
Precalculus / Algebra & Trig are **not** the usable ones — they are NC-SA.
Building ingestion around `osbooks-college-algebra-bundle` would import
NC content. The usable range is the **1st editions**, and it is *wider* than
expected: it reaches down through Prealgebra and Elementary Algebra, i.e. the
K-12/ACT-prep range, not just college-algebra-and-up.

### 0.2 A second live NC contamination in the shipped bank

`app/src/data/openstaxMCQ.json` (221 rows) resolved row-by-row against the
OpenStax Exercises API by exercise uid:

```
209  contemporary-mathematics         CC BY-NC-SA   <-- 94.6% of the file
  4  intermediate-algebra (1e)        CC BY          clean
  2  elementary-algebra (1e)          CC BY          clean
  2  introductory-statistics          CC BY          clean
  1  introductory-business-statistics CC BY          clean
  1  statistics                       CC BY          clean
  2  unresolved
```

`app/src/data/openstaxQuestions.json` (37 rows) carries **no source-book tag**
and hash ids (`openstax_8fa1d96b`) — provenance is **unrecoverable** from the
committed artifact, and the raw cache (`ml/data/openstax/`) is gitignored and
absent. Given the adapter pulls NC books indiscriminately, treat all 37 as
presumed-contaminated until re-derived.

**Total NC exposure in the shipped commercial bundle:**
```
Eedi                          1,508 rows   CC BY-NC 4.0
OpenStax contemporary-maths     209 rows   CC BY-NC-SA
OpenStax unresolved              37 rows   unknown, presumed NC
                              ─────────
                              1,754 rows of ~1,979
```

### 0.3 The adapter actively causes this

`ml/scripts/pipeline/sources/openstax.py:8` states, in its module docstring:

> *"Exercises are CC-BY licensed items from OpenStax textbooks."*

That is false, and `MATH_BOOK_TOKENS` (`:56`) mixes CC BY and NC-SA books
indiscriminately — `prealgebra-2e`, `elementary-algebra`, `intermediate-algebra`,
`calculus-volume-1/2/3`, `stax-cmath`, `college-algebra-2e` all sit in one
frozenset. **Re-running the pipeline today pulls more NC content**, so this must
be fixed before any re-ingest, not after.

### 0.4 Learning Commons is confirmed clean — with a documented upstream chain

From `github.com/learning-commons-org/knowledge-graph/LICENSE.md`, verbatim:

> Knowledge Graph code is licensed under MIT. Knowledge Graph is provided by
> Learning Commons under the CC BY 4.0 license. Learning Commons received state
> standards and written permission under CC BY 4.0 from 1EdTech; learning
> components under CC BY 4.0 from Achievement Network; and learning progressions
> under CC0 from Student Achievement Partners.

This is the **only** source in the survey that documents its own upstream
permission chain. Adopt it.

**Access reality check** (README, verified): REST API and MCP server are
**private-beta only**. The publicly available path is **Local JSONL download** —
graph-native JSONL exports. Plan for the JSONL path; treat API/MCP as
unavailable unless beta access is granted.

### 0.5 The clean OpenStax pool is bigger than the dependency it would replace

Exercise counts via `exercises.openstax.org/api/exercises?q=tag:"book-slug:<slug>"`:

```
CC BY (usable)                          NC-SA (excluded)
  precalculus                 579         contemporary-mathematics  2,936
  algebra-and-trigonometry    353         calculus-volume-1..3          —
  elementary-algebra          278         all *-2e editions             —
  introductory-statistics     220
  intro-business-statistics   182
  college-algebra             171
  intermediate-algebra        118
  statistics                  114
  prealgebra                   97
  ─────────────────────────────
  TOTAL                     2,112
```

**2,112 commercially-clean exercises spanning prealgebra → precalculus** — more
than the 1,508 Eedi rows at risk, and we already have a working adapter for this
exact API. This is the single highest-leverage remediation available.

---

## 1. S0 — the licence gate (do this first; everything else depends on it)

**`data/SOURCES.md`** — the provenance ledger whose absence caused both
incidents. One row per ingested source, required before any new ingest:

```
| source | dataset/book + edition | licence | licence_url | commercial? | retrieved | notes |
```
Seed it with: Eedi (CC BY-NC 4.0, NO), each OpenStax book actually used
(per-slug, per-edition), Learning Commons (CC BY 4.0, YES), McCreary ontology
(verbal grant, scope undocumented), Khan (`khanQuestions.json`, 0 rows — record
before it gains any), storyCells, actMaster.

**`ml/scripts/pipeline/license_gate.py`** — a hard gate, not a lint:

```python
COMMERCIAL_OK = {"CC-BY-4.0", "CC-BY-3.0", "CC0-1.0", "MIT", "public-domain"}
BLOCKED       = {"CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "CC-BY-NC-ND-4.0", ...}

def assert_commercially_usable(source_id: str, licence: str) -> None:
    """Raise if licence is not on the allowlist. Unknown == blocked."""
```
Every adapter calls it per item, keyed on the item's **resolved** source (for
OpenStax, the `book-slug:` tag — not the API as a whole). **Unknown licence must
block, not warn.** Both incidents came from a permissive default.

---

## 2. S1 — fix the OpenStax adapter

1. **Delete the false claim** at `openstax.py:8`. Replace with the per-book,
   per-edition table from §0.1 and a pointer to `data/SOURCES.md`.
2. **Split `MATH_BOOK_TOKENS`** into `CC_BY_BOOK_TOKENS` (the nine 1st-edition
   slugs in §0.5) and `EXCLUDED_NC_BOOK_TOKENS` (everything else, listed
   explicitly with its licence as an inline comment so the exclusion is
   self-documenting).
3. `parse_item()` gates on `CC_BY_BOOK_TOKENS` and calls `assert_commercially_usable`.
   An item tagged with **both** a clean and an NC book (the docstring at `:264`
   already notes dual-tagging happens) must be **rejected** — conservative
   default, because the NC terms attach regardless of the co-tag.
4. Emit `source_book_slug` + `licence` onto every produced row. The current
   output's lack of this is why 37 rows are now unrecoverable.

**Acceptance:** re-running the adapter produces zero rows whose resolved
`book-slug` is not in `CC_BY_BOOK_TOKENS`; every row carries `source_book_slug`
and `licence`.

---

## 3. S2 — quarantine the contaminated shipped rows (Product-lane commit)

Reversible and mechanical. **Do not delete the data files** — they stay in the
repo; the change is what ships.

- `openstaxMCQ.json`: drop the 209 `contemporary-mathematics` rows and the 2
  unresolved. Keep the 10 verified CC BY rows.
- `openstaxQuestions.json`: quarantine all 37 (unrecoverable provenance);
  re-derive from the fixed adapter rather than trying to rescue them.
- `eediQuestions.json`: gate behind the §1 decision in `NEXT_SESSION.md`
  (pull / accept / flag). **This build does not decide that** — it is the
  outstanding human call, pending the Eedi email.

Mechanism: prefer a build-time filter in `questionBank.ts` keyed on a
`licence` field, over deleting rows — keeps the corpus intact for research use
(NC permits that) while stopping commercial distribution. That distinction is
the whole point of NC and the codebase should represent it explicitly.

**Acceptance:** the built client bundle contains zero rows whose `licence` is
not commercially usable; `npm run build` succeeds; question counts per concept
are re-reported (this **will** reduce coverage — say by how much, per concept,
rather than hiding it).

---

## 4. S3 — D3: mint neutral misconception ids (the dependency you asked to remove)

Per D3 in [`INGREDIENT_FIRST_GENERATION_BUILD.md`](INGREDIENT_FIRST_GENERATION_BUILD.md),
option (a). The pilot's generated items currently carry four Eedi-derived
`misconception_id`s (eedi 481/245/1190/1417), reintroducing exactly the
dependency generation exists to remove.

1. In `ml/generation/rules/basic_equations.py`, replace all four
   `misconception_id` values with minted `mis_rule_*` ids matching each
   `rule_id`. Same in `ml/data/misconception_rules/basic_equations.json`.
2. Add `ml/data/misconception_rules/eedi_crosswalk.json` — a **non-shipped**
   sidecar mapping `mis_rule_* → eedi misconception id`, so diagnostic
   continuity with the existing bank survives without the generated artifact
   carrying a derived id. Gitignore it if the Eedi call goes against us.
3. Regenerate: `cd ml && python -m generation.ingredient_first --per-template 16`.
4. **Record the semantic finding**: the pilot mapped
   `basic_equations__inverse_operations` to eedi 1190 ("subtracts instead of
   dividing") rather than the ontology's own
   `canonical_misconception_family` (eedi 481, "thinks the inverse of
   subtraction is multiplication"). 1190 describes the rule's actual behaviour;
   481 describes a different error. **This suggests the ontology's
   `canonical_misconception_family` for that ingredient is wrong** — file it as
   an ontology correction, don't silently discard it with the id.

**Acceptance:** `grep -r "mis_linear_equations__" ml/generation/` returns
nothing; regenerated `items.json` contains no `eedi`-derived id; 104 tests +
85/85 end2end still green; replay still byte-identical.

---

## 5. S4 — Learning Commons pull (feeds the Stage 2 ontology alignment)

Target `ml/data/external/learning_commons/`, with the §1 manifest.

- **Path: Local JSONL download** (public). REST API and MCP are private-beta —
  do not build against them. Applying for beta access is worthwhile but must not
  block this.
- Pull `LearningComponent` entities and their `supports` edges to
  `StandardsFrameworkItem` (Common Core + 15 additional state frameworks).
- This is **metadata for ontology alignment, not question content** — it feeds
  Guard A of the generation build (aligning the 179 ingredients so the KC set
  isn't self-defined), and per that build, **scaling generation past the
  `basic_equations` pilot is gated on it**.
- Attribution is required (CC BY 4.0): record the required attribution string in
  `data/SOURCES.md` and surface it wherever aligned data is displayed.

The alignment work itself (179 ingredients → components, human adjudication,
per-edge provenance) is the Stage 2 rewrite of
`ONTOLOGY_INGREDIENT_PRIMARY_BUILD.md` and stays a separate spec — this build
only lands the data.

---

## 6. S5 — OpenStax CC BY harvest (the replacement corpus)

After S1. Re-run the fixed adapter against the nine CC BY books (~2,112
exercises). Note these are largely **free-response**, not multiple-choice — which
suits the current direction: they become `ProblemTemplate` seed material and
stems for the ingredient-first generator, not drop-in bank rows.

Sequence deliberately: this is the corpus that could make the Eedi decision
cheap. If ~2,112 clean exercises cover the concepts Eedi covers, dropping Eedi
costs coverage we can rebuild rather than coverage we lose.

**Acceptance:** report per-concept coverage of the CC BY harvest against the
42-concept ontology, side by side with current Eedi coverage, so the Eedi
decision can be made on numbers.

---

## 7. S6 — NAEP: deferred, deliberately

No confirmed bulk API for **item content**. The NCES NAEP Data Service API
serves results/statistics (scores, subscales, demographics), not item text.
Released items live in the browser-based NAEP Questions Tool
(`nationsreportcard.gov/nqt`), a JS app with no documented public content API.

Two paths, neither cheap: scraping the tool's undocumented internal JSON
endpoints (bulk volume, but an unstable contract that can break without notice),
or the NAEP Sample Questions Booklets (PDFs — stable and explicitly public, but
low volume).

**Do NAEP last, and only if a gap remains after S4–S5.** There is a real chance
the 2,112 CC BY OpenStax exercises plus the generation pipeline close the gap
without touching an undocumented scraper. Revisit only with a measured gap in
hand.

---

## 8. Sequencing

1. **S0 licence gate + `data/SOURCES.md`** — blocks recurrence; cheap.
2. **S1 adapter fix** — stops the bleeding before any re-ingest.
3. **S3 (D3) mint neutral ids** — small, self-contained, already scoped.
4. **S4 Learning Commons** — unblocks Guard A, which gates generation scaling.
5. **S5 OpenStax CC BY harvest** — builds the replacement corpus.
6. **S2 quarantine** — once S5 shows what coverage actually remains, so the
   bundle change and the replacement land close together.
7. **S6 NAEP** — only against a measured gap.

S2 sits late deliberately: quarantining before a replacement exists maximises
the coverage hole. If the Eedi email returns a refusal, promote S2 immediately
regardless of S5's state.

---

## 9. Non-goals

- **No licence interpretation beyond the published terms.** Where a licence is
  unclear, it blocks. Escalate to a human; do not reason toward permission.
- **No re-ingest of Eedi.** Standing gotcha: it wipes `storyContext` on all
  1,508 rows and reverts two manually-cleaned `choices` arrays.
- **No ontology alignment work here** — S4 lands data only.
- **No NAEP scraper** until §7's condition is met.
