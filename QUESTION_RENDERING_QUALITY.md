# Question rendering & data quality — bug set (found 2026-08-05)

Found by clicking through `linear_equations` and `fractions_decimals` in the live
practice UI. All five screenshots are real, currently-shipping content — none of
this is the generation pipeline (that's paused, only 2 stub questions synced).
This is the existing static/actMaster/Eedi bank rendering live, today.

Separate from, and **higher priority than**, the 30% generated-question bad-key
rate (`ml/generation` — see `CLAUDE.md` "NEXT (BLOCKER)"), because that pipeline
isn't live yet and these bugs are.

## Bug 1 — blank equations in the ACT master bank
**Owning lane: whoever owns `actMasterQuestionBank.generated.json`'s source
pipeline** (file lives under `app/src/data/`, Product lane by path, but content
comes from ACT PDF annotation — confirm who re-runs that ingestion before
assigning).

`app/src/data/actMasterQuestionBank.generated.json` has at least 3 questions
where the equation was dropped during annotation, leaving a literal blank:
- line 2047: `"question": "If , what is the value of a ?"`
- line 2197: `"question": "If , with a > 0, b > 0, and c > 0, what is the value of a in terms of b and c ?"`
- line 3401: `"question": "If , what is the value of a – b ?"`

(`grep -c '"question": "If ,'` → 3 confirmed; likely other blank-substitution
patterns beyond this exact prefix — worth a broader sweep, e.g. any stem
matching `/^(If|When|Given) ,/` or a stem with two adjacent spaces where a LaTeX
image should have been transcribed.)

**Root cause**: source ACT questions had the equation embedded as an image;
transcription/annotation skipped it instead of flagging for manual re-entry.
**Fix**: sweep the file for the pattern, hand-fix or drop+re-annotate each hit.
Add a bank-load-time or CI assertion that rejects any question whose stem
matches `/,\s*(what|with|when)/i` right after a dangling comma — cheap guardrail
against this recurring.

## Bug 2 — GraphBox shows an unrelated graph on non-graph questions
**Owning lane: Product (`app/**`)** — `app/src/components/GraphBox.tsx`

Screenshots: `linear_equations` Q7 ("what is the value of a?") and Q8 ("what is
the equation of the y axis?") — neither needs a graph, both show a static
`y = x^2+5x+6` parabola that has nothing to do with either question.

This is a **known, partially-fixed bug** — the component's own doc comment
(`GraphBox.tsx:12-18`) describes it: a `points` prop was added so questions with
real extracted figure data plot those instead of the generic default. That fix
only fires when `plottablePoints` extraction succeeds. For a plain algebra
question with **no figure at all**, `GraphBox` still mounts `defaultOpen` with
`x^2+5x+6` pre-filled (`GraphBox.tsx:173,240`) — because it's designed as an
always-available scratch tool, not a "here's the graph for this problem" panel.
The bug isn't the fallback expression, it's that nothing gates whether the panel
should even be showing (or showing expanded, with content) for a question that
isn't graph-relevant.

**Fix direction**: gate `defaultOpen` (and ideally suppress the panel/collapse it
with no pre-filled curve) unless `format === 'coordinate_graph'` or points were
successfully extracted. If it's meant to stay as a general scratch tool
available on every question, it needs a different label/framing than a bare
"GRAPH" header with a curve already drawn — that reads as "this is the graph of
your problem," which is false on 2 of 2 sampled non-graph questions.

## Bug 3a — alt-text diagram pattern not recognized → raw text fallback
**Owning lane: Product (`app/**`)** — `app/src/lib/altDiagram.ts` (parser),
rendered by `app/src/components/AltDiagramCallout.tsx:557-562` (fallback)

Screenshot: `fractions_decimals` Q1 shows literal text "Picture: A number line
between 0 and 1 split into 5 parts with a red arrow pointing to the marker
representing the value 0.6" instead of an actual number line.

There's already a real SVG renderer for exactly this case —
`DashLineFigure`/`InequalityRayFigure` in `AltDiagramCallout.tsx` handle
number-line diagrams — so the system is *supposed* to draw this. `parseAltDiagram`
just didn't recognize this specific phrasing and fell through to the last-resort
branch (the plain-text "Picture: …" box), which is explicitly documented as
reading "like a bug report" (`AltDiagramCallout.tsx:1-8`) — i.e. the authors
already know this fallback is bad UX, it's meant to be rare, not the common case.

**Fix direction**: pull a sample of Eedi alt-text strings that are currently
falling to the text fallback (instrument or grep `eediQuestions.json` alt-text
against `parseAltDiagram`'s recognized patterns) and extend the dashline/number-
line pattern matching to cover this phrasing family. Given CLAUDE.md notes 42
number-line-format questions were recovered via alt-text, worth checking what
fraction of those 42 render as real SVGs vs. this text fallback.

## Bug 3b — recognized diagram, but dimensions extract as 0
**Owning lane: Product (`app/**`)** — `app/src/lib/altDiagram.ts`
(`ShapeDimensionDiagram` extraction) → rendered by `ShapeDimensionFigure`
(`AltDiagramCallout.tsx:100-168`)

Screenshot: `fractions_decimals` Q6, "area of this rectangle," choices are
0.64/1.12/0.064/0.56 m² — the answer implies real side lengths (e.g. 0.8 × 0.8)
— but the rendered rectangle labels both sides "0". This *is* the shapedimension
path (matches the label layout exactly: one value at bottom-center, one at
mid-right, per `ShapeDimensionFigure`'s rectangle branch, `AltDiagramCallout.tsx:117-121`)
so the pattern matched, but whatever regex in `altDiagram.ts` pulls `base`/
`height` out of the Eedi alt-text failed to capture the actual numbers for this
question and defaulted to `0`.

**Fix direction**: find this alt-text string in `eediQuestions.json`, run it
through `parseAltDiagram` locally, see what the base/height extraction actually
captures. A rendered "0 × 0" is worse than the Bug-3a text fallback — it looks
like a real, wrong answer, not an unrendered diagram. Consider: if extraction
yields 0/undefined, fall back to `ShapeDimensionFigure`'s unlabeled/generic mode
(or Bug-3a's text box) rather than rendering a numerically wrong figure.

## Bug 4 — mangled cloze/arithmetic stem
**Owning lane: Engine (`ml/**`, Eedi ingestion)** — likely
`ml/scripts/ingest_eedi.py` text cleanup, or a downstream stem transform in `app/**`

Screenshot: `fractions_decimals` Q4 stem reads "4.72 — 3.1 What should replace
the star?" — missing the operator/equals sign and the ★ glyph itself; reads as
two sentences mashed together rather than "4.72 − 3.1 = ★. What should replace
the star?" or similar. Needs the raw Eedi source row to confirm whether this is
an ingestion-time strip (equals sign or star glyph dropped) or a render-time
issue; flag for whoever owns Eedi ingestion to check a batch of similarly-
patterned cloze questions for the same defect.

---

## Priority / sequencing
1. **Bug 1** (blank stems) — worst failure mode, a student literally can't
   answer the question. Cheap grep-and-fix + a load-time guardrail.
2. **Bug 3b** (0×0 rectangle) — a wrong-looking-right figure is worse than a
   missing one; either fix extraction or suppress to a safer fallback.
3. **Bug 2** (unrelated graph) — misleading but not blocking; gate visibility.
4. **Bug 3a** (text fallback) — real infra already exists, this is pattern-
   coverage work, do in a batch once you're in `altDiagram.ts` for Bug 3b.
5. **Bug 4** — needs the raw source row first to know which lane owns the fix.

## Relationship to other in-flight work
- **Does not block, and isn't fixed by, the story reskin** (`agent_work/story-scenes/RESKIN_PROMPT.md`,
  `themedStems.generated.json`). Reskinning rewrites question *prose* to sit in
  the story world — it doesn't touch figures/graphs/diagrams. Wrapping "4.72 —
  3.1 What should replace the star?" or a 0×0 rectangle in story language still
  ships a broken question. Recommend: fix Bugs 1–3 before or alongside reskin
  rollout on `fractions_decimals`/`linear_equations`, since reskin will surface
  more of these on every concept it touches.
- **Is** part of why the experience "just feels like answering questions" — a
  broken/unrelated figure is a bigger tell than an un-storified stem. Worth
  fixing before investing further reskin effort on concepts where these figure
  bugs are common (fractions_decimals, anything Eedi-sourced with diagrams).
