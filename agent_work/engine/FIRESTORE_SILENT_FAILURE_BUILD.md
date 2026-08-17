# BUILD — Make the Firestore loaders fail loudly

**Status:** ready to implement. Small, self-contained, no data migration.
**Written 2026-08-16.** Highest risk-per-line item currently open in `ml/`.

**Lane: Engine.** Touches `ml/mindcraft_graph/firestore_adapter.py` and its
tests only. No Product-tree file, no data artifact, no API contract change.
Safe to run in parallel with any other build.

---

## Why this exists

`firestore_adapter.py` has 8 `except Exception:` handlers that return an empty
result. **7 of them log nothing.** Measured 2026-08-16:

```
SILENT  : 87   load_student_events              ← feeds the entire mastery graph
logs    : 224  load_attempt_observations        ← the only one fixed
SILENT  : 255  load_recent_attempt_observations
SILENT  : 310  load_format_events
SILENT  : 492  load_affective_state
SILENT  : 554  load_learning_events
SILENT  : 582  load_agent_skills
SILENT  : 620  load_memory_records
```

This exact shape has **already caused two multi-feature outages**, both of which
took a human investigation to find because nothing was logged:

1. A missing Firestore **ASC** composite index made `load_attempt_observations`
   return `[]` on every call. The entire validation harness silently reported
   *no data* rather than *a broken query*. That handler was subsequently given a
   `logger.exception` — the other seven were not.
2. The same pattern hid a second feature outage long enough that a handoff
   document recorded the bug as "fixed + verified" when it was half-fixed.

An empty list is a **legitimate result** here (a new student genuinely has no
events), which is precisely why the failure is invisible: callers cannot
distinguish "no data" from "query exploded". Nothing downstream can detect this
— it has to be caught at the boundary.

`load_student_events:87` is the most dangerous of the seven: every mastery
computation reads through it, and a silent `[]` presents as *a student who has
never practised* rather than as an error.

---

## What to do

For **each** of the 7 silent handlers:

1. Log with `logger.exception(...)` — not `logger.error` — so the traceback is
   captured. Follow the existing style at `:224`, which is the reference:
   ```python
   except Exception:
       logger.exception("Failed to load attempt observations for student %s", student_id)
       return []
   ```
   Include the identifying argument (`student_id`, or whatever the function keys
   on) in the message. A log line that does not say *which* student or *which*
   collection failed does not shorten the next investigation.
2. **Keep the `return []` fallback.** Do not convert these to raised exceptions.
   These loaders are called from request paths that must degrade rather than
   500, and changing that is a behaviour change well outside this build.
3. Do not broaden or narrow the `except Exception` clauses. Catching narrower
   exception types is a reasonable idea and is **explicitly out of scope** —
   it changes which failures are swallowed, which needs its own reasoning.

### Distinguish empty from failed

Add a module-level counter or a returned sentinel so a caller *can* tell the two
apart — but **only if it requires no signature change** to the 7 functions.
A simple, sufficient version: increment a module counter on each caught
exception and expose it via a `GET /health` field, so a spike is visible without
reading logs.

**DECISION — if distinguishing empty-from-failed cannot be done without changing
these functions' return types, do the logging only and stop.** Return-type
changes ripple into every caller and this build is not scoped for that. Bring it
back to the architect instead.

---

## Acceptance criteria

1. **All 8 handlers log.** Verify mechanically, not by eye:
   ```bash
   python3 -c "
   lines=open('ml/mindcraft_graph/firestore_adapter.py').read().split('\n')
   for i,l in enumerate(lines):
       if 'except Exception' in l:
           body='\n'.join(lines[i+1:i+4])
           if 'logger' not in body: print('STILL SILENT at line', i+1)
   print('done')"
   ```
   Expected output: `done`, with no `STILL SILENT` lines.
2. Every log call is `logger.exception` and names the keying argument.
3. `return []` behaviour is unchanged — no function raises where it previously
   returned.
4. `cd ml && pytest` **and** repo-root `pytest ml/tests` both pass (80 tests as
   of this writing), and `python scripts/end2end.py` stays 85/85.
5. **A test that fails if a handler goes silent again.** Parse the source as in
   AC1 and assert zero silent handlers. This is the only criterion that prevents
   a third recurrence — a code comment will not.

---

## Out of scope

- Narrowing the exception types.
- Changing any function's return type or signature.
- The historical duplicate `attempt_observations` rows in Firestore (28.4% of
  observations, 46% of practice `SessionEvent`s) — separate cleanup, separate
  build.
- Retry/backoff logic.
