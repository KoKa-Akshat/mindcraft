# Question reskin prompt (v2)

Generation prompt for themed question stems. Output merges via
`app/scripts/mergeThemedReskins.mjs` into `app/src/data/themedStems.generated.json`.

## Why v2 exists

Measured failures in the v1 (`cursor-true-reskin-v1`) artifact, 1,713 stems:

| defect | rate | cause |
|---|---|---|
| **Glued** — scene sentence prepended to the original question verbatim | 757 / 1713 = 44% | nothing required the ask to be rewritten |
| **Concept-level wallpaper** — scene mentions none of the question's numbers | 79% of glued | prose generated from the concept theme alone, never bound to the instance |
| **Reuse** — same sentence across many questions | 757 stems from 238 sentences; `ratios_proportions` = 4 sentences / 67 questions | a concept-level scene is question-independent, so it pastes onto anything |

These are one root cause. **Prose written from the theme alone is by construction
reusable and carries no instance information.** The theme supplies the *world*;
the question supplies *what the numbers are*. v1 only ever did the first half.

The `trueReskinRejected: 0` stat did not catch any of this — it validates each
stem in isolation (numbers present, no banned markup), and a sentence pasted onto
its 17th question passes identically to its first.

## Input contract

Inject per batch:

- `concept_id`, `concept_name`
- `story` — the concept's origin narrative (`app/src/data/conceptStories.json`)
- `protagonist`, `setting_line` — from that concept's `contextFrame`
- `questions[]` — each `{ id, question, choices, correctIndex, format }`
- `used_openings[]` — **every opening clause already generated for this concept,
  across all prior batches.** Without this the model cannot avoid repeating itself.

Batch questions from ONE concept at a time. Keep batches ≤ 10 so `used_openings`
stays short enough to actually constrain generation.

## The prompt

````
You rewrite math practice questions so they happen inside a story world. The
student keeps solving the same mathematics; they read it as a scene.

THE WORLD (supplies setting, characters, stakes):
{story}

Protagonist: {protagonist}
Setting: {setting_line}

OPENINGS ALREADY USED FOR THIS CONCEPT — do not reuse or lightly reword any of
these. Each new stem must open on a different moment, object, or action:
{used_openings}

QUESTIONS (JSON):
{questions_json}

---

WHAT YOU ARE DOING

The world gives you the setting. The QUESTION gives you what the numbers mean.
Your stem must contain both. A scene that could sit in front of any question in
this concept has failed, no matter how well written.

  BAD  (concept-level wallpaper, works for any question, therefore worthless):
       "Ramanujan combines two ledger debts. Evaluate \\((-9)+(-4)=\\)."
  GOOD (binds the world to THIS question's quantities):
       "Ramanujan owes 9 rupees for apples and 4 for bananas. Written as debts,
        what is \\((-9)+(-4)=\\)?"

The second names what 9 and 4 ARE. That is the whole job. It also makes the
negative signs inevitable: a debt is why a number is negative, and combining two
debts is why they add.

RULES

1. GIVE EVERY NUMBER A REFERENT. Each numeric value in the question must appear
   in your prose as a specific thing in the world: 9 rupees of apples, a 25
   minute bell cycle, 60 packets in a crate. If a number appears only inside the
   maths expression and nowhere in your sentences, you have not done the task.

2. REFERENTS MUST BE HONEST. The operation must make sense on the things you
   named. "The least common multiple of 25 crates of tea, 16 chests of spices and
   40 boxes of textiles" is nonsense: an LCM over counts of unrelated goods means
   nothing. "Three port bells ring every 25, 16 and 40 minutes; when do they next
   ring together?" is the same numbers doing real work. If you cannot find an
   honest referent, set the scene around the character READING the expression
   (a ledger entry, an instrument dial) rather than inventing a false one.

3. NEVER CHANGE THE MATHEMATICS. Every numeric value, variable and unit survives
   exactly. Keep LaTeX (\\( \\), $ $, \\[ \\]) verbatim so the app renders it.
   Do not rewrite an expression into an equivalent form: \\((-9)+(-4)\\) must NOT
   become "-9 - 4". The operator, order and grouping are part of what is tested.

4. DO NOT PREPEND. The original question text must not survive as an intact block
   with a sentence bolted in front. Rewrite the ask so it belongs to the scene.
   The quantity asked for stays identical.

5. ASK FOR EXACTLY WHAT THE ORIGINAL ASKS. Never mention or hint at the answer
   choices; the app renders them unchanged.

6. LENGTH FOLLOWS THE WORK. Usually two or three sentences. Long enough to say
   what each quantity is and what is being asked; no sentence that only restates
   that the maths matters ("An accurate estimate avoids confusion", "The
   calculation is necessary to inform the shipper"). Cut those. A short question
   is not a licence to pad: it is an invitation to say what the numbers are.

7. STAND ALONE. Never reference another question or "the previous scene" —
   questions are served in any order.

8. VOICE. Warm, direct, concrete. Written for a student who has struggled with
   maths before. No cheerleading, no emoji. NEVER use an em dash anywhere; use a
   comma, colon or full stop.

9. DIAGRAM QUESTIONS. When the stem carries a "(Diagram: ...)" description, fold
   that description into the prose as something the character sees. Do not drop
   it: it is the only access the student has to the figure.

OUTPUT

Return ONLY a JSON object keyed by question id, no markdown fences, no commentary:

{"<questionId>": "<the rewritten stem>", ...}
````

## Output → merge

Write each batch to a file in a chunk directory, then:

```bash
node app/scripts/mergeThemedReskins.mjs /path/to/chunk-dir
```

The merger accepts `{ "<questionId>": "<stem>" }` keyed by question id, or an
object under `stems`/`items`, or an array of `{ key, stem }`. Keys are
`{conceptId}__{storyId}__{questionId}`; for concept-chapter stories
`storyId === conceptId`.

## Gates to add before the next run

`mergeThemedReskins.mjs` currently validates numbers-preserved, banned markup,
em dash and length — all per stem, in isolation. That is why every defect above
merged clean. Add:

1. **Instance binding** — reject if no number from the question appears in the
   prose outside the maths expression. Catches wallpaper directly.
2. **No verbatim original** — reject if the normalised original question appears
   as a substring. Catches gluing.
3. **No reuse** — reject if the opening clause already occurs in this concept.
   Mostly subsumed by (1), since a stem naming this question's quantities cannot
   paste onto another, but it fails differently and makes the drop report
   diagnostic.

Gate 1 pushes generation toward inventing referents, and a dishonest referent
(rule 2) passes every cheap check because the numbers are all present and
correct. **Sample-review the first batch by hand before scaling.**
