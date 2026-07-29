# Marketing Agent — Build Spec

**Status:** approved for implementation
**Architect:** Opus (this file) · **Implementation:** Cursor / Codex
**Date:** 2026-07-28

Generates Instagram post candidates — captions *and* rendered image slides —
from MindCraft's own data, gated against `BRAND_BOOK.md`, delivered to a human
review queue. **Nothing posts automatically.** The agent produces an
upload-ready bundle; a human decides what ships.

---

## 0. Lane ownership

New third tree. Neither Engine nor Product owns it; it consumes from both.

| Path | Owner | Notes |
|---|---|---|
| `marketing/**` | Blake (new lane) | pipeline, gates, templates, review page |
| `marketing/sources/*.json` | **human-authored only** | research + testimonials — see §4 |
| `ml/data/**` | Engine (read-only here) | misconceptions, ontology |
| `app/src/data/**` | Product (read-only here) | themedStems, conceptStories, questions |
| `img/story-*.jpg` | Product (read-only here) | existing story artwork |

The marketing agent **never writes** outside `marketing/`. It reads Engine and
Product trees; it does not modify them. Register the LLM call contract in
`AGENT_RULEBOOK.md` when the writer step lands.

---

## 1. Pipeline

```
1. HARVEST     (deterministic) → candidate facts + evidence pointers
2. RANK        (deterministic) → score, then apply MIX constraints → shortlist
3. ANGLE       (LLM)           → pillar, audience, hook
4. WRITE       (LLM)           → caption, per-slide copy, alt text
5. RENDER      (deterministic) → HTML template + brand tokens → PNG set
6. GATE        (deterministic) → vocab lint (caption + slide copy)
                                 + composition lint (renders)
                                 + personality rubric (LLM judge)
7. QUEUE       (human)         → review page → decisions.json → export bundle
```

Mirrors the engine's own split: **deterministic owns structure, LLM owns
language, deterministic gates the result.** The LLM never chooses *what* to say
— only how to say a fact the pipeline already selected.

Each step writes its artifact to `marketing/run/{date}/` so any stage is
re-runnable in isolation.

---

## 2. The authorship line (HARD RULE)

Three categories of content must **never** be model-generated. They enter the
pipeline from validated sources and the LLM may only select and format them.

| Content | LLM role | Why |
|---|---|---|
| Puzzle math + answers | **select only** | hallucinated arithmetic ships a wrong answer publicly |
| Research citations | **select only** | fabricated DOIs are the #1 LLM failure mode |
| Testimonial quotes | **select only** | fabricating testimonials is an FTC problem, not a style problem |
| Captions, hooks, framing, verdicts, origin walks | author freely | language is the LLM's job |

Enforcement: post objects carry `authorship: "selected" | "authored"` per field.
The gate **hard-blocks** any post where a `selected` field's text does not
appear verbatim in its cited source file. Not a prompt instruction — a check.

---

## 3. Content pillars

| Pillar | Source | Authorship | Audience |
|---|---|---|---|
| `the_miss` | `ml/data/eedi_misconceptions.json` | authored | student |
| `quick_win` | `app/src/data/themedStems.generated.json` | selected | student |
| `katha` | `app/src/data/conceptStories.json` + `img/story-*.jpg` | selected | student |
| `research` | `marketing/sources/research.json` | selected | parent / tutor |
| `data_insight` | ontology + aggregates | authored | parent |
| `testimonial` | `marketing/sources/testimonials.json` | selected | parent |
| `the_verdict` | `BRAND_BOOK.md` §2 | authored | student / parent |
| `the_origin` | pathfinder prereq chains | authored | student / parent |
| `jordan` | `BRAND_BOOK.md` §6 | authored | tutor |

### Pillar notes

**`the_miss`** — a trap. Post a real question, withhold the answer, reveal on
slide 4 with the named misconception and its frequency. Rank candidates by
`occurrence_count`.

**`quick_win`** — solvable. `themedStems.generated.json` is already
numeric-preservation validated at bake time (math-mutating stems were dropped),
so the math is trustworthy. Key format is
`{conceptId}__{storyId}__{questionId}`; join to the question bank for the
answer. **Copy says "quick" or "short," never "easy"** (§11).

**`katha`** — story only. Never mentions the product, never explains the math,
ends at the threshold of the problem (§10). Four illustrations already exist in
`img/`; more needed to scale this pillar.

**`research`** — lands as a claim about the reader, not a literature summary.
*"You lose most of a lesson within a day. That's not a memory problem, it's a
scheduling problem."* Citation in the caption tail, never the hook. Doubles as
anti-positioning: "why we don't do streaks" is a research post and the §12
Duolingo argument in one artifact.

**`data_insight`** — aggregate patterns, not single questions. The only pillar
where a chart is the right visual; charts use brand tokens on Deep Field with
tabular numerals (§9). Privacy floor in §9 of this doc binds hardest here.

**`testimonial`** — see §4. Tutor testimonials are the near-term unlock (adults,
no consent minefield, supply-side recruiting). Select for click-language over
grade-language: the brand sells the click, not the grade.

---

## 4. Human-authored source files

These two files are the pipeline's only human-write inputs. The agent reads;
it never writes.

### `marketing/sources/research.json`
```json
{
  "id": "roediger_2006_testing_effect",
  "claim": "Retrieval practice produces stronger retention than restudying.",
  "verbatim_quote": "...",
  "citation": "Roediger & Karpicke (2006), Psychological Science 17(3)",
  "doi": "10.1111/j.1467-9280.2006.01693.x",
  "url": "https://...",
  "verified_by": "blake",
  "verified_at": "2026-07-28"
}
```
No entry ships without `doi` (or `url`) **and** `verified_by`. The writer may
paraphrase `claim` into brand voice; it may not invent `citation`, `doi`, or
`verbatim_quote`.

### `marketing/sources/testimonials.json`
```json
{
  "id": "t_014",
  "quote": "...",
  "attribution": "Jordan M., tutor",
  "subject_type": "tutor" | "student" | "parent",
  "is_minor": false,
  "consent_on_file": true,
  "consent_scope": "social_media",
  "anonymize": true,
  "collected_by": "blake",
  "collected_at": "2026-07-20"
}
```
Hard blocks: `consent_on_file !== true`, or `is_minor === true` without
`consent_scope: "social_media"` from a parent/guardian. Default `anonymize:
true` — first name and role at most. Never a school name, never a face without
separate written consent, never a full name for a minor.

---

## 5. Post object schema

```jsonc
{
  "id": "2026-07-28-003",
  "pillar": "the_miss",
  "audience": "student",
  "caption": "...",
  "hook": "...",                  // first line, pre-truncation
  "hashtags": ["..."],            // first comment, max 8
  "slides": [
    { "n": 1, "template": "question_card", "copy": {...}, "alt": "...",
      "png": "run/2026-07-28/003/slide-1.png" }
  ],
  "evidence": {
    "source_file": "ml/data/eedi_misconceptions.json",
    "source_id": "mis_order_of_operations__confuses_order_operations_believes_addition",
    "stat": "5 tagged questions, 3 examples on file"
  },
  "authorship": { "caption": "authored", "slides[0].copy.question": "selected" },
  "rank": { "evidence": 5, "days_since_concept_posted": 90, "calendar_hook": null },
  "gate": { "vocab": "pass", "composition": "pass", "personality": {...} },
  "status": "ready" | "needs_edit" | "blocked" | "held"
}
```

---

## 6. Rendering

**Toolchain:** Playwright headless Chromium screenshot of an HTML template.
Not Satori — KaTeX is required, the question bank stores LaTeX
(`\\[3 \\times 2+4-5\\]`).

**Output ratios:** 4:5 feed (1080×1350) required; 9:16 story (1080×1920)
optional per pillar. No 1:1.

**Unit is a slide sequence, not an image** — but slides are scarce. Most
pillars are single-slide; only `the_miss` and `quick_win` earn a carousel.

| Pillar | Default slides | Max |
|---|---|---|
| `the_miss` | 3 (question / wrong path / reveal) | 4 |
| `quick_win` | 2 (story-framed question / reveal) | 2 |
| `katha` | 1 | 2 |
| `the_origin` | 1 (chain diagram) | 2 |
| `research` | 1 | 2 |
| `the_verdict`, `data_insight`, `testimonial`, `jordan` | 1 | 1 |

A carousel must earn its slides. If slide 2 doesn't change what the reader
understands, it's a single-image post.

**Brand tokens** (from §9, hardcode as CSS custom properties):
`--deep-field: #080e14` · `--chalk: #f5f5f5` · `--click: #c4f547` ·
`--stakes: #c1121f` · `--depth: #1d3a8a`

**Template families:** `question_card`, `reveal_card`, `quote_card`,
`chain_diagram`, `graph_render`, `katha_page`, `stat_card`.

`graph_render` captures the existing knowledge-graph surface in `app/` against
a synthetic or anonymized student — the highest-differentiation visual you own
and the cheapest to produce, since it already ships.

**WYSIWYA:** the review page embeds the final PNGs. What a human approves is
byte-identical to what posts. Never render a separate preview.

---

## 7. Gate A — vocabulary linter

From `BRAND_BOOK.md` §11. **Severity matters** — a linter that cries wolf gets
disabled, so context-dependent terms warn rather than block.

### HARD (block, no override)
`quiz` · `wrong` · `incorrect` · `try again` · `drill` · `deficiency` ·
`deficit` · `aha moment` · `lightbulb moment` · `gamified` · `smart` / `dumb`
as identity · `falling behind`

### SOFT (warn, cite rule, human decides)
`user` · `content` · `easy` · `reward` · `complete` / `finish` (of a concept) ·
`app` / `platform` (student-facing) · `homework` (student-facing copy; the
Homework Help *feature name* is exempt) · `instructor` / `coach` / `mentor` ·
`placement test` / `diagnostic test`

### Structural (HARD)
- Exclamation marks — none
- Emoji — none in caption body or slide copy (see §11, Defaults)
- Sentence case; Title Case headlines fail
- Unqualified `can't` — §11 calls `yet` the single most important word

Every failure reports the rule **and its reason** verbatim from §11, so a human
can tell whether the caption is wrong or the gate is miscalibrated.

**Runs on caption AND slide copy.** Text baked into an image is what people
actually read — this is the easiest rule to forget and the most likely place
for `quiz` to reappear.

---

## 8. Gate B — composition linter

From `BRAND_BOOK.md` §9. Runs on rendered PNGs.

### HARD
- Red marking a student's answer or standing in for "you failed" — §9 calls
  this banned outright, "the single fastest way to reinstall the verdict"
- Any white or light background — Deep Field is non-negotiable
- Lime on red, or either on white

### FAIL (fixable)
- More than one lime element competing on a slide — *"if lime appears
  everywhere, the click means nothing"*
- Body-text contrast below 4.5:1
- Text outside the safe area or clipped by Instagram's grid crop

### Checklist (human-verified for any non-template asset)
Banned imagery per §9: stock photography, mascots, chat bubbles, trophies /
stars / badges, clip-art math, rounded or handwriting or comic fonts,
chalkboard textures.

---

## 9. Gate C — personality rubric

LLM judge against `BRAND_BOOK.md` §7. A post must score **≥3 of 5**:
cinematic · electric · certain · human · unflinching.

The judge must **cite the line that earns each adjective**, and name the
failing line for each miss. Few-shot it with §14's application examples — those
are ground truth. A bare score is not acceptable output; the citation is the
whole value.

---

## 10. Mix scheduler

Deterministic, applied at RANK. Keeps the LLM out of strategy.

**The budget is slides, not posts. 10 slides per batch, hard cap.** Render
cost, review fatigue, and posting cadence all scale with slides. The scheduler
spends a 10-slide budget: a 3-slide `the_miss` costs 3, a quote card costs 1.
A typical batch is therefore **6–8 posts** — e.g. one 3-slide miss, one 2-slide
quick win, and five single-slide posts.

If the budget can't fit the next-ranked candidate, take the next one that fits
rather than truncating a carousel.

- **Trap : win ratio** — `the_miss` to `quick_win` starts at **1:2**, tunable.
  A feed of only traps makes people feel stupid, which reinstalls the exact
  verdict the product exists to remove.
- No two consecutive posts from the same pillar.
- Weekly pillar quotas (configurable in `marketing/config/mix.json`).
- Audience rotation — student content earns reach, parent content converts.
- Concept cooldown: don't repost the same `conceptId` within 60 days.
- Calendar hooks — real ACT/SAT dates and the school calendar promote a
  candidate's rank. **Real deadlines only**; §8 bans manufactured urgency.

---

## 11. Review surface

**Delivery and decision capture are separate problems.** Email delivers; it
cannot capture a decision, and Gmail clips at ~102KB and blocks images by
default. PDF does neither. HTML does both.

### v0 — local, zero infra (build this first)
`npm run marketing:review` → builds `marketing/review/{date}.html`, opens it.

Per-post card:
- rendered slides inline (the final PNGs)
- caption with a **copy button**
- scorecard (see below)
- Approve / Reject / Edit

Keyboard: `J`/`K` navigate · `A` approve · `X` reject · `E` flag for edit.
Decisions persist to localStorage; **Export** writes
`marketing/run/{date}/decisions.json`.

Rejects stay visible in a collapsed section with their failure reason — the
only feedback loop on gate calibration.

### v0.5 — Google Drive (BUILT)
Inspection should not wait on a git push, and run output does not belong in git
(§12). `npm run marketing:publish -- --date <date>` uploads the batch to a
shared Drive folder: a contact-sheet PDF plus one folder per post with slides
and a paste-ready caption.

- **Drive cannot run the interactive review page** — it won't serve the HTML as
  a live page, so the keyboard shortcuts and Export button don't survive. The
  batch therefore travels as a **contact-sheet PDF**, which Drive previews and
  accepts inline comments on. Comments are lightweight decision capture until
  v1 exists.
- Auth is a **service account** with `drive.file` scope and write access to one
  shared folder — `MARKETING_DRIVE_SERVICE_ACCOUNT` +
  `MARKETING_DRIVE_FOLDER_ID`. The pipeline needs its own credentials; this is
  not a personal Drive connector.
- **Blocked posts are never uploaded** (§13). Publishing is the moment content
  leaves the repo, so the privacy floor is enforced at the upload boundary, not
  only at build. `drive.json` records what was published and what was withheld.

### v1 — hosted, multi-reviewer
Same page, served from the existing Firebase Hosting app at an admin-gated
route (reuse the `Admin.tsx` role pattern). Decisions write to Firestore
instead of localStorage. Phone-native, supports a second reviewer.

Email then becomes what it should be: a nudge — "7 posts ready", three
thumbnails, a link. Not the review surface.

### Scorecard format

**Every score in the unit of the thing it measures.** No normalized composites
on the card; a composite may sort the queue but never displays. Scores are
diagnostic, not summative — a `4/5` that names the missing adjective and
points at the failing line is actionable in ten seconds; a bare `0.82` is not.

```
POST 003 · The Miss · student · 4 slides · READY

WHY THIS
  Evidence    misconception #1672 "believes addition comes before
              multiplication" — 5 tagged questions, 3 on file
  Reach       order_of_operations: 47 questions in bank
  Freshness   this concept last posted 90+ days ago
  Timing      no calendar hook

BRAND GATE  PASS
  vocab       clean
  structure   sentence case · no exclamations · no emoji
  image       1 lime element (slide 4) · contrast ok · text in safe area

PERSONALITY  4 of 5
  cinematic   ✓  "the same wrong place every time"
  electric    ✓  reveal lands in three words
  certain     ✓  declaratives throughout
  human       ✗  nothing here knows what 2am feels like
  unflinching ✓  names the error, never a person
```

Status vocabulary: `READY` · `NEEDS EDIT` · `BLOCKED` (hard gate) · `HELD`
(privacy or risk flag).

---

## 12. Export bundle

Approval must produce something directly uploadable — this step gets forgotten
and it's the one that makes the tool usable.

```
marketing/run/{date}/export/003/
  slide-1.png … slide-4.png     # 1080×1350
  caption.txt                    # paste-ready
  alt.txt                        # per slide
  hashtags.txt                   # first comment
```

Instagram Graph API auto-publishing is **out of scope for v1**. It requires a
Business account linked to a Facebook Page, and it is outward-facing enough to
need its own approval gate. Manual upload from the export bundle for now.

---

## 13. Privacy floor (HARD)

Applies to any post touching Firestore aggregates, primarily `data_insight`:

- Aggregate only. No per-student data, ever.
- k-anonymity **n ≥ 50** per reported cohort.
- No cohort small or specific enough to identify a school, class, or tutor.
- No student names, faces, handles, or verbatim free-text.
- Minors: see §4 testimonial rules.

Violations are `BLOCKED`, not `NEEDS EDIT`.

---

## 14. Defaults for open decisions

Stated so implementation isn't blocked. Overridable by Blake; change in
`marketing/config/` and update this section.

| Decision | Default |
|---|---|
| Emoji | none in caption body or slide copy |
| Hashtags | first comment only, max 8 |
| Accounts | one account, pillar-level audience tagging |
| Autonomy | review queue only, no auto-post |
| Privacy | n ≥ 50 |
| Aspect | 4:5 required, 9:16 optional |
| Cadence | weekly run, **10-slide budget** (~6–8 posts) |

---

## 15. Acceptance criteria

1. `npm run marketing:harvest` produces ≥30 candidate facts with evidence
   pointers resolving to real records on disk.
2. `npm run marketing:build` produces a full run: posts, PNGs, gate results.
3. A `selected` field whose text does not appear verbatim in its cited source
   **blocks** the post (§2). Prove with a deliberately mutated fixture.
4. A caption containing `quiz` blocks; a caption containing `user` warns.
5. A slide with two lime elements fails composition lint.
6. `npm run marketing:review` opens a page showing every post with its slides,
   copyable caption, and scorecard; `A`/`X` record decisions; Export writes
   `decisions.json`.
7. Approved posts produce an export bundle per §12.
8. End-to-end run on real repo data yields ≥5 `READY` posts across ≥3 pillars,
   within the 10-slide budget.
9. The scheduler never emits a batch exceeding 10 slides, and never truncates a
   carousel to fit.

---

## 16. Task split

**Lane: marketing (Blake) — implementable by Cursor/Codex in `marketing/` only.**

| # | Task | Depends on |
|---|---|---|
| M1 | Harvesters for `the_miss`, `quick_win`, `katha` (on-disk sources exist today) | — |
| M2 | Post object schema + run artifact layout | — |
| M3 | Vocab linter + rule table from §11, with severity | M2 |
| M4 | HTML slide templates + brand tokens + KaTeX | — |
| M5 | Playwright render → PNG at 4:5 | M4 |
| M6 | Composition linter | M5 |
| M7 | ANGLE + WRITE LLM steps; register in `AGENT_RULEBOOK.md` | M2, M3 |
| M8 | Personality judge (§7 rubric, must cite lines) | M7 |
| M9 | Mix scheduler | M2 |
| M10 | Review page v0 + decisions.json | M5, M8 |
| M11 | Export bundle | M10 |
| M12 | Harvesters for `the_origin`, `data_insight` (+ privacy floor) | M1 |
| M13 | Source-file schemas + validators for research / testimonials | M2 |
| M14 | Contact-sheet PDF + Drive publish (`marketing/src/drive.mjs`) | M5, M10 |

**Deferred:** hosted review page (v1), email nudge, Instagram Graph API
publishing, generative imagery for Katha scenes, additional story artwork.

**Run artifacts are gitignored** (`marketing/run/`, `marketing/review/`) — ~5MB
per weekly run, fully regenerable, and inspected in Drive rather than in git.

---

## 17. Non-goals

- No auto-posting.
- No generative (diffusion) imagery in v1. The brand is typography on a dark
  ground with one point of light — templates are on-brand by construction and
  will beat generated imagery, which drifts toward exactly the stock-photo look
  §9 bans.
- No scraping of individual social accounts or personal data.
- No engagement-farming mechanics. §12's anti-Duolingo position applies to our
  own marketing, not just the product.
