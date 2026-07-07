# Build plan: preserve LaTeX in Eedi ingestion (fix bare `p^2+4 p` questions)

Lane: **Engine** (`ml/scripts/ingest_eedi.py` + regenerated
`app/src/data/eediQuestions.json`), plus one tiny Product follow-up test.

## Problem
217 of 1,283 Eedi questions render with bare math notation, e.g.
“Factorise this expression, if possible: p^2+4 p”. Cause:
`ingest_eedi.py::translate_latex` strips `\(`/`\)` delimiters (line ~303)
and flattens LaTeX to plain text, leaving caret notation and spacing
artifacts (`4 p`, `5 h`). MathText correctly ignores undelimited text, so
these show raw. actMaster/static banks are clean — Eedi ingestion only.
Source data still present (`data/eedi/train.csv`) — fully re-runnable.

## Fix (ingestion, not renderer)
1. In `translate_latex`, stop flattening math to plain text. Where the
   source has `\( … \)` segments:
   - If the inner content is trivially plain (a bare number, a single word,
     no TeX commands / `^` / `_` / `\frac`), flatten to plain text as today.
   - Otherwise keep the inner LaTeX intact and re-emit it wrapped in
     `\( … \)` delimiters.
   **Use `\(...\)`, NOT `$...$`** — Eedi/actMaster prose contains currency
   dollars, and inserted `$` delimiters could mis-pair with them in
   MathText's scanner. `\(...\)` never occurs in prose and MathText already
   renders it.
   Normalizations that should still happen inside the math: keep KaTeX-safe
   commands as-is (`\frac`, `\sqrt`, `\times` all render); drop only the
   commands the old code dropped because KaTeX can't render them (check the
   existing translation table — anything it translated because it was
   *unrenderable* stays translated; anything it translated merely to make
   plain text keeps its TeX form).
2. Re-run: `python3 ml/scripts/ingest_eedi.py --no-llm` (keeps template
   explanations + the existing explain cache) → regenerates
   `app/src/data/eediQuestions.json`. Keep `misconception_id`/`label`
   emission unchanged.
3. Sanity gates before committing the regenerated JSON:
   - Kept-question count ≥ current 1,283 (this change must not reject more).
   - ≥ 200 of the 217 bare-notation questions now contain `\(…\)`.
   - Zero questions where a `\(` appears without a matching `\)`.
   - Spot-render: “Factorise this expression, if possible: \(p^{2}-99p\)”
     through MathText → KaTeX output.
4. Rerun `python3 ml/scripts/audit_act_ontology_question_bank.py`
   (question counts shouldn't change, but the coverage JSON hashes the
   bank — keep it in sync).

## Product follow-up (tiny)
Add one case to `app/src/components/MathText.test.ts` using a real
re-ingested Eedi string (the factorise question) asserting KaTeX renders it
and the surrounding prose stays prose.

## Stretch (separate commit, only if cheap)
The original ingestion rejected 320 rows as `R4_latex_fail` — LaTeX that
couldn't be flattened to plain text. Now that math passes through as
LaTeX, re-evaluate those rejects: any row whose LaTeX is KaTeX-renderable
can be recovered. Report the recovered count in the ingest report; don't
chase hard cases.

## Acceptance
- [ ] `p^2+4 p`-class questions render as proper math on Practice and the
      chapter reader.
- [ ] Currency questions still render as prose (MathText tests green).
- [ ] Question count ≥ 1,283; audit JSON regenerated.
