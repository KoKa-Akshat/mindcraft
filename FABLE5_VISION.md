# FABLE5_VISION.md — Product & Design Spec for Cursor

**Scope:** frontend only (`app/**` — Product lane). No `ml/**`, `webhook/**`, or
Firestore-rules changes are required by anything in this document. All Firestore
writes here are to fields the client is already allowed to write on its own
`users/{uid}` doc — EXCEPT the tutor-focus write in Area 4, which a tutor makes
to a *student's* doc (see the note there).

**Deploy:** push to `main`; CI auto-deploys Firebase Hosting. Never run
`firebase deploy` locally.

---

## Design tokens

Add these once as CSS custom properties (either in `app/src/index.css` `:root`,
or duplicated at the top of each touched `.module.css` — module files cannot
share `:root`, so prefer `index.css`):

```css
:root {
  --bg-dark:     #08120e;
  --bg-warm:     #f4f2ec;
  --bg-card:     #ffffff;
  --ink:         #1a1a1a;
  --ink-dim:     rgba(26, 26, 26, 0.5);
  --accent:      #c4f547;   /* MindCraft lime green */
  --accent-dim:  rgba(196, 245, 71, 0.12);
  --success:     #22c55e;
  --danger:      #ef4444;
  --amber:       #f59e0b;
  --radius-card: 16px;
  --shadow-card: 0 2px 24px rgba(0, 0, 0, 0.08);
}
```

Concept-cluster colors (used for chips in Area 1 and rows in Area 2):

```css
:root {
  --cluster-algebra:   #4f8a8b;
  --cluster-geometry:  #c96a7e;
  --cluster-functions: #7d6fa8;
  --cluster-data:      #c9963f;
}
```

Cluster assignment helper (put in `app/src/lib/conceptClusters.ts`, new file):

```ts
export type ConceptCluster = 'algebra' | 'geometry' | 'functions' | 'data';

const GEOMETRY = new Set(['lines_angles','triangles_congruence','circles_geometry',
  'area_volume','right_triangle_geometry','trigonometry_basics',
  'geometric_transformations','coordinate_geometry','conic_sections','vectors']);
const FUNCTIONS = new Set(['functions_basics','exponential_functions',
  'logarithmic_functions','sequences_series','quadratic_equations',
  'polynomials','polynomial_operations','representation_translation']);
const DATA = new Set(['descriptive_statistics','basic_probability',
  'probability_distributions','inferential_statistics','data_interpretation',
  'combinatorics']);

export function conceptCluster(conceptId: string): ConceptCluster {
  if (GEOMETRY.has(conceptId)) return 'geometry';
  if (FUNCTIONS.has(conceptId)) return 'functions';
  if (DATA.has(conceptId)) return 'data';
  return 'algebra'; // default: everything equation/number-flavored
}
```

---

## Area 1 — Practice Session Question Card: Premium Redesign

**Files:** `app/src/pages/Practice.tsx` (session render branch, `pPhase ===
'session'`, around line 1783) + `app/src/pages/Practice.module.css`.

Goal: the in-session question card should read as a premium tutoring product —
white paper card, calm spacing, lime accent only on interaction.

### CSS (add to `Practice.module.css`)

```css
/* ---- Premium question card ---- */
.qCard {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 32px 28px;
  max-width: 640px;
  margin: 0 auto;
  position: relative;
  overflow: hidden; /* clips the progress strip's corners */
}

.qText {
  font-size: 18px;
  font-weight: 500;
  line-height: 1.65;
  color: var(--ink);
  margin: 16px 0 24px;
}

/* Concept chip — colored per cluster via a modifier class */
.qChip {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-variant: small-caps;
  color: #fff;
}
.qChipAlgebra   { background: var(--cluster-algebra); }
.qChipGeometry  { background: var(--cluster-geometry); }
.qChipFunctions { background: var(--cluster-functions); }
.qChipData      { background: var(--cluster-data); }

/* Answer choices */
.qChoices {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qChoice {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 16px;
  border-radius: 12px;
  background: #f5f4f0;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  font-size: 16px;
  color: var(--ink);
  transition: border-color 120ms ease, background 120ms ease;
  width: 100%;
}
.qChoice:hover  { background: #efede7; }
.qChoiceSelected { border-color: var(--accent); background: var(--accent-dim); }
.qChoiceCorrect  { border-color: var(--success); }
.qChoiceWrong    { border-color: var(--danger); }

/* Letter badge A/B/C/D */
.qLetter {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
}

/* Progress strip at the card's bottom edge */
.qProgressTrack {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 4px;
  background: rgba(0, 0, 0, 0.05);
}
.qProgressFill {
  height: 100%;
  background: var(--accent);
  transition: width 300ms ease;
}

/* Mobile */
@media (max-width: 480px) {
  .qCard {
    max-width: none;
    border-radius: 0;
    box-shadow: none;
    padding: 20px;
  }
  .qText { font-size: 16px; }
}
```

### JSX (card wrapper — adapt into the existing `pPhase === 'session'` branch)

Keep all existing answer/submit handlers and state; this only re-skins the
markup. `q` is the current question, `qIndex` the current index, `questions`
the session array, `selected`/`revealed` whatever the existing selection and
reveal state variables are (match names to what's already in the file — do not
invent parallel state):

```tsx
import s from './Practice.module.css';
import { conceptCluster } from '../lib/conceptClusters';

const clusterClass = {
  algebra: s.qChipAlgebra,
  geometry: s.qChipGeometry,
  functions: s.qChipFunctions,
  data: s.qChipData,
}[conceptCluster(q.conceptId)];

<div className={s.qCard}>
  <span className={`${s.qChip} ${clusterClass}`}>{conceptLabel(q.conceptId)}</span>
  <p className={s.qText}>{q.question}</p>

  <div className={s.qChoices}>
    {q.choices.map((choice, i) => {
      const letter = String.fromCharCode(65 + i); // A/B/C/D
      const cls = [
        s.qChoice,
        selected === i && s.qChoiceSelected,
        revealed && i === q.correctIndex && s.qChoiceCorrect,
        revealed && selected === i && i !== q.correctIndex && s.qChoiceWrong,
      ].filter(Boolean).join(' ');
      return (
        <button key={i} className={cls} onClick={() => onSelect(i)}>
          <span className={s.qLetter}>{letter}</span>
          <span>{choice}</span>
        </button>
      );
    })}
  </div>

  <div className={s.qProgressTrack}>
    <div
      className={s.qProgressFill}
      style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
    />
  </div>
</div>
```

**Constraints:**
- Diagnostic hide-correctness mode (contract C4) still applies: when the session
  is a diagnostic, do NOT apply `qChoiceCorrect`/`qChoiceWrong` — only
  `qChoiceSelected`. Gate the reveal classes on the existing
  non-diagnostic/reveal flag.
- Question text may contain LaTeX (Eedi bank) — keep whatever renderer currently
  wraps `q.question`; only the wrapper classes change.

---

## Area 2 — Dashboard Personalization

**Files:** `app/src/pages/Dashboard.tsx` + `app/src/pages/Dashboard.module.css`.

**Problem:** the right panel lists the same ~29 ACT concepts identically for
every student. Replace with a personalized "Your weakest topics" list.

### Behavior

1. **Data source:** the `/recommend` response already fetched on the Dashboard
   (state that also feeds PawHub). Use `recommendations[]`; each item carries a
   concept id and mastery. Sort by `1 - mastery` descending (weakest first) and
   take the **top 6**.
2. **Row layout** (one per topic):
   - Concept display name (left).
   - Mastery bar: `4px` high, full row width beneath the name. Fill color:
     `var(--danger)` if mastery < 0.3, `var(--amber)` if 0.3–0.7,
     `var(--success)` if > 0.7. Fill width = `mastery * 100%`.
   - Mastery percent as text, right-aligned, `12px`, `var(--ink-dim)` (e.g. "42%").
3. **Loading (`recLoading === true`):** render 6 placeholder rows with a
   skeleton shimmer (CSS below). No spinner.
4. **First load after diagnostic:** if the student just completed the gap scan
   (navigation state or a `justCompletedDiagnostic` flag — set it where the
   gap-scan flow routes back to `/dashboard`), show the text `Building your
   map...` with a pulsing dot for **3 seconds** (`setTimeout`), then reveal the
   list. Skip this on every subsequent load.
5. **"Last updated"** line under the section header: relative time of the last
   successful `/recommend` fetch (store `Date.now()` in state when the fetch
   resolves). Format: `Updated just now`, `Updated 2 min ago`, `Updated 1 hr
   ago`. A tiny local helper is fine — no date library.

### CSS (add to `Dashboard.module.css`)

```css
.topicRow { padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.06); }
.topicName { font-size: 14px; font-weight: 600; color: var(--ink); }
.topicPct { float: right; font-size: 12px; color: var(--ink-dim); }
.masteryTrack { height: 4px; border-radius: 2px; background: rgba(0,0,0,0.07); margin-top: 6px; }
.masteryFill { height: 100%; border-radius: 2px; }
.masteryLow  { background: var(--danger); }
.masteryMid  { background: var(--amber); }
.masteryHigh { background: var(--success); }

.updatedAt { font-size: 11px; color: var(--ink-dim); margin-top: 2px; }

/* Skeleton shimmer (shared with Area 3 — define once, e.g. index.css) */
.skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg,
    rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.11) 37%, rgba(0,0,0,0.06) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
@keyframes shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.skeletonRow { height: 34px; margin: 8px 0; }

/* Building-your-map pulse */
.pulseDot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); margin-right: 8px;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
```

**Constraint:** do not add a new `/recommend` call — reuse the existing fetch
and its `recLoading` state. If mastery isn't directly on `recommendations[]`
items in the current response shape, derive it from whatever mastery field the
Dashboard already receives (check the shape in `lib/mlApi.ts` before wiring).

---

## Area 3 — PawHub Command Center Upgrades

**Files:** `app/src/components/PawHub.tsx` + its CSS
(`PawHub.module.css` or wherever its styles live — follow the existing import).

Five upgrades, all additive:

1. **Weakness label inside the main Practice pad.** Below the word "Practice",
   render the current weakness concept's display name (the one
   `worstWeakness()` already selects) at `font-size: 10px`, `font-weight: 600`,
   `color: var(--ink-dim)` (or a light tint if the pad is dark), single line,
   `text-overflow: ellipsis`.

2. **Learn pad label.** Same treatment: learn-next concept name in 10px under
   the "Learn" label.

3. **Attention pulse on the main pad.** When a weakness exists and the user has
   not yet interacted (any click/tap anywhere on PawHub sets a
   `hasInteracted` ref to true):

   ```css
   .padPulse { animation: padPulse 3s ease-in-out infinite; }
   @keyframes padPulse {
     0%, 83%, 100% { transform: scale(1); }
     88%  { transform: scale(1.04); }
     94%  { transform: scale(1); }
   }
   ```

   (0.5s of visible movement inside each 3s cycle.) Remove the class once
   `hasInteracted` flips. Respect `prefers-reduced-motion`:

   ```css
   @media (prefers-reduced-motion: reduce) { .padPulse { animation: none; } }
   ```

4. **Progress ring around the weakness concept chip.** Inline SVG:

   ```tsx
   const R = 18;
   const C = 2 * Math.PI * R; // ≈ 113.1
   <svg width="44" height="44" viewBox="0 0 44 44">
     <circle cx="22" cy="22" r={R} fill="none"
             stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
     <circle cx="22" cy="22" r={R} fill="none"
             stroke="#c4f547" strokeWidth="3" strokeLinecap="round"
             strokeDasharray={`${mastery * C} ${C}`}
             transform="rotate(-90 22 22)" />
   </svg>
   ```

   `mastery` ∈ [0,1] for the weakness concept.

5. **Loading skeleton.** While `recLoading` is true, overlay the Practice and
   Learn pads with the shared `.skeleton` shimmer (Area 2) instead of showing
   stale/empty labels.

6. **"Tutor pick" badge** — see Area 4; render condition is
   `tutorFocusConcepts?.length > 0` on the student's user doc.

**Constraint:** PawHub's launch behavior (`launchMissionDirect()`, level from
`bridgePractice.getRecommendedLevel`) must not change. These are visual layers
on the existing pads.

---

## Area 4 — Tutor → Student Focus Areas

**Files:** `app/src/pages/TutorDashboard.tsx`, `app/src/pages/Practice.tsx`,
`app/src/components/PawHub.tsx`.

New field on the student's user doc: `tutorFocusConcepts: string[]` (canonical
ontology concept ids, max 3).

> **Firestore rules check (do first):** rules currently allow a user to write
> their *own* `users/{uid}` doc; a tutor writing a *student's* doc may be
> rejected. Verify against `firebase/firestore.rules`. If tutors can't write
> student docs, the write must go through an Admin-SDK webhook (like
> `link-child`) instead — coordinate before shipping; do NOT weaken rules from
> the client side. `tutorFocusConcepts` is not in the protected-field list
> (`role`, `childId`, `tutorId`, `classroomId`), so a narrow rules allowance
> for a linked tutor is the likely fix.

### 4a. TutorDashboard — "Set Focus" modal

Next to each student's concept list, add a **Set Focus** button. Clicking opens
a modal:

```tsx
// state
const [focusOpen, setFocusOpen] = useState(false);
const [selectedIds, setSelectedIds] = useState<string[]>(student.tutorFocusConcepts ?? []);

// toggle with max-3 cap
function toggleConcept(id: string) {
  setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(c => c !== id)
    : prev.length >= 3 ? prev
    : [...prev, id]);
}

// save
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase'; // match the existing firebase import path

async function saveFocus() {
  await updateDoc(doc(db, 'users', studentId), { tutorFocusConcepts: selectedIds });
  setFocusOpen(false);
}
```

Modal JSX structure:

```tsx
{focusOpen && (
  <div className={s.modalOverlay} onClick={() => setFocusOpen(false)}>
    <div className={s.modal} onClick={e => e.stopPropagation()}>
      <h3>Set focus for {student.name}</h3>
      <p className={s.modalHint}>Pick up to 3 concepts. {selectedIds.length}/3 selected.</p>
      <div className={s.conceptGrid}>
        {ALL_CONCEPTS.map(c => (
          <label key={c.id} className={s.conceptCheck}>
            <input
              type="checkbox"
              checked={selectedIds.includes(c.id)}
              disabled={!selectedIds.includes(c.id) && selectedIds.length >= 3}
              onChange={() => toggleConcept(c.id)}
            />
            {c.label}
          </label>
        ))}
      </div>
      <div className={s.modalActions}>
        <button onClick={() => setFocusOpen(false)}>Cancel</button>
        <button className={s.primaryBtn} onClick={saveFocus}>Save Focus</button>
      </div>
    </div>
  </div>
)}
```

`ALL_CONCEPTS` = the 42 ontology concepts. Source the id→label list from
wherever the app already maps concept ids to display names (e.g. the label
helper used by PawHub / Knowledge Graph) — do not hand-copy 42 strings.

Modal CSS: overlay `position: fixed; inset: 0; background: rgba(8,18,14,0.5)`;
panel `background: var(--bg-card); border-radius: var(--radius-card);
box-shadow: var(--shadow-card); max-width: 560px; max-height: 80vh;
overflow-y: auto; padding: 24px;`; `conceptGrid` =
`display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px;`.

### 4b. Practice.tsx — focus callout on mission start

On mission start (the phase before the first question renders), if the signed-in
student's doc has a non-empty `tutorFocusConcepts`, show a callout card:

```tsx
{tutorFocus.length > 0 && !focusDismissed && (
  <div className={s.focusCallout}>
    <span className={s.focusIcon} aria-hidden>★</span>
    <p>
      Your tutor wants you to focus on <strong>{conceptLabel(tutorFocus[0])}</strong>.
      Start here?
    </p>
    <div className={s.focusActions}>
      <button className={s.primaryBtn}
              onClick={() => startMissionForConcept(tutorFocus[0])}>Yes</button>
      <button className={s.ghostBtn}
              onClick={() => setFocusDismissed(true)}>Skip</button>
    </div>
  </div>
)}
```

- `tutorFocus` comes from the already-subscribed user doc (Practice reads
  `users/{uid}` for drafts/flags — piggyback on that read, no extra listener).
- "Yes" routes into the normal mission flow targeted at that concept
  (reuse the same launcher PawHub/`launchMissionDirect` uses, with level from
  `bridgePractice.getRecommendedLevel`).
- `focusDismissed` is session-local state (do NOT persist — the nudge should
  reappear next visit).
- Style: `background: var(--accent-dim); border: 1px solid var(--accent);
  border-radius: 12px; padding: 14px 16px;`.

### 4c. PawHub — "Tutor pick" badge

If `tutorFocusConcepts` exists and is non-empty on the student doc, render a
small badge on the Practice pad:

```css
.tutorPick {
  position: absolute; top: -6px; right: -6px;
  background: var(--success); color: #fff;
  font-size: 9px; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 3px 8px; border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
```

```tsx
{tutorFocus.length > 0 && <span className={s.tutorPick}>Tutor pick</span>}
```

---

## Area 5 — Concept Story Worlds (DONE — reference only)

`app/src/data/questionContextFrames.json` has been updated:

- Every `questionBridge` is now a **cognitive bridge** — it names the kind of
  thinking the concept requires, in the protagonist's voice, and works for ANY
  question about that concept (no more "the navigator hands you the numbers"
  colliding with non-nautical questions).
- Protagonists/settings are historically accurate and unchanged.
- 7 previously-missing concepts added: `coordinate_geometry` (Descartes),
  `absolute_value` (Argand), `integer_operations` (Brahmagupta),
  `polynomial_operations` (Cardano), `percent_ratio` (Pacioli),
  `data_interpretation` (John Snow), `combinatorics` (Pascal).
- Only `basic_probability` carries `diceFrame`/`spinnerFrame`; all others null.

**No code change needed** — ConceptChapterPage already reads this file.

---

## Implementation Order (impact / effort)

1. **Area 1 — Question Card Premium Redesign.** Highest visible impact; almost
   entirely self-contained CSS + one JSX reskin in one file.
2. **Area 2 — Dashboard Personalization.** Fixes the "everyone sees the same
   topics" complaint using data already fetched.
3. **Area 3 — PawHub upgrades.** Polish on the primary dashboard action;
   depends on the same `recLoading`/weakness state as Area 2.
4. **Area 4 — Tutor Focus Areas.** New feature; the write is one `updateDoc`,
   but it spans 3 files and needs the Firestore-rules check first.

---

## Quick wins (CSS-only, < 30 min each)

1. **Card shadow + radius sweep.** Apply `border-radius: var(--radius-card);
   box-shadow: var(--shadow-card);` to the existing Dashboard right-panel cards
   and Practice pre-session panels. Instant "premium paper" feel, zero JSX.
2. **Answer-choice hover/selected states** (`Practice.module.css`). Even before
   the full Area 1 reskin: `border: 2px solid transparent; border-radius: 12px;
   transition: border-color 120ms;` + `:hover { background: #efede7; }` +
   selected `border-color: var(--accent)`. Makes the current buttons feel
   responsive today.
3. **Skeleton shimmer class** (`index.css`). Add the `.skeleton` +
   `@keyframes shimmer` block from Area 2 globally and drop it on any panel that
   currently renders blank while `recLoading` is true. Perceived speed win with
   no logic changes.
