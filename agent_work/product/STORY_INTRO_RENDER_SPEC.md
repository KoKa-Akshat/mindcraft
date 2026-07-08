# STORY_INTRO_RENDER — Product Lane (Cursor)

**Status:** Ready to implement  
**Lane:** Product (`app/**`)  
**Estimated session:** 2–3 hours  
**Do NOT touch:** `ml/**`, `homework/**`, `webhook/**`

---

## What and why

Right now `storyContext` is a ≤120-char caption that sits above the question stem as a one-liner.
The user wants the story to feel like a real scene: a 3–4 sentence narrative that places the student
*inside* the problem world before the math appears.

The fix is a new **`storyIntro`** field (≤500 chars) on `Question`. If present, it renders as an
immersive story block above the storyContext caption. The question and choices stay identical —
only the pre-question narrative changes.

---

## Exact changes

### 1. Type: `app/src/lib/questionBank.ts`

Add to the `Question` interface (around line 26 where storyContext is defined):

```ts
storyIntro?: string      // 3–4 sentence narrative scene (≤500 chars). Optional.
```

No other changes to questionBank.ts.

---

### 2. Story-intro block CSS: `app/src/components/book/QuestionPage.module.css`

Add a new class for the narrative scene block. It should feel like italicised marginalia or a
literary epigraph — slightly inset, softer than the question stem:

```css
.storyIntroBlock {
  font-style: italic;
  font-size: 0.88rem;
  line-height: 1.65;
  color: var(--ink-katha, var(--text-2));
  margin: 0 0 1.1rem 0;
  padding: 0.75rem 1rem;
  border-left: 2px solid var(--accent-soft, rgba(196, 245, 71, 0.30));
  background: rgba(196, 245, 71, 0.04);
  border-radius: 0 6px 6px 0;
}
```

If `--ink-katha` doesn't exist in the token file, use `var(--text-2)` as fallback.

---

### 3. Render: wherever `storyContext` is currently rendered in the practice book layout

**Find the file** that renders storyContext above the question stem. Search for:
```
grep -rn "storyContext" app/src/
```

The file is likely `app/src/components/book/QuestionPage.tsx` or similar.

In that component, **add the storyIntro block directly above the storyContext line**:

```tsx
{question.storyIntro && (
  <p className={s.storyIntroBlock}>{question.storyIntro}</p>
)}
{question.storyContext && (
  <p className={s.storyContext}>{question.storyContext}</p>
)}
```

If `storyContext` is rendered inside a different element structure, match the surrounding pattern exactly — just prepend the storyIntro block immediately above whatever renders storyContext.

---

### 4. Pilot content: update a few story cells in `app/src/data/storyCells.json` (or wherever story cells are stored)

Search: `grep -rn "storyContext\|storyIntro" app/src/data/`

Find the Pythagorean theorem / right triangle story cells and add storyIntro. Use this as the
template for the tone:

**Example (right_triangle_geometry / Pythagorean theorem):**
```json
"storyIntro": "The Nile has receded, leaving a blank canvas of mud. Ahmes paces the field, knotted rope in hand — twelve equally-spaced knots, twelve equal lengths. He pins three knots at the ground, stretches the rope into a 3-4-5 triangle, and watches the corner snap perfectly square. The Pharaoh's granary is measured. Now: given the same triangle with sides a, b, and c, what formula describes a²?"
```

**Example (linear_equations):**
```json
"storyIntro": "Al-Khwarizmi sits in the House of Wisdom, Baghdad, 820 AD. A merchant owes him three dirhams more than twice what he earns in a week. Al-Khwarizmi writes the unknown — he calls it 'al-jabr', the restoration. The balance must be restored on both sides. What rule does he write?"
```

**Example (quadratic_equations):**
```json
"storyIntro": "A craftsman in 17th-century Japan is tiling a square garden. He knows the total area is 36 tiles and one side is 3 tiles longer than the other. He needs the exact dimensions. The answer is locked inside the area — a quadratic sits waiting to be solved."
```

Add storyIntro to as many story cells as you can write good content for. Focus on:
- Story cells already in `batch_ingredient_fable5.json` (13 cells)
- Any cells in `storyCells.json` for ACT-covered concepts

Tone rules (from BRAND_BOOK.md — read it):
- Warm, specific, never generic
- The math necessity must feel obvious from the scene
- No "can you help X solve Y?" — the student IS in the scene, not being asked to help
- ≤500 chars including spaces

---

### 5. Question type in `app/src/lib/questionBank.ts` — generated bank merger

`eediQuestions.json` and `actMasterQuestionBank.generated.json` do NOT have storyIntro.
That's fine — the field is optional. The render guard (`{question.storyIntro && ...}`) handles absence.

No changes to `getQuestions`, `eediQuestions.json`, or `actMasterQuestionBank.generated.json`.

---

## What done looks like

- `question.storyIntro` renders as an italic left-bordered scene block above storyContext
- Falls back gracefully to the old one-liner view when storyIntro is absent
- 5+ story cells have real storyIntro content following the tone rules
- No TypeScript errors, `npm run build` passes
- Commit message: "Add storyIntro field — immersive narrative scene block above question stem"

## Do not do

- Do not modify eediQuestions.json or actMasterQuestionBank.generated.json
- Do not add storyIntro to every Eedi question (too many, wrong tone source)  
- Do not change the storyContext field or its render
- Do not touch ml/, webhook/, or any non-app files
