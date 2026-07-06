# HOTFIX — `/recommend` has been 500ing on every call since 2026-06-29 (URGENT)

**Severity:** production outage, silent, ~2 days running. Every consumer of
`getRecommendations()` in the frontend has been degrading to local fallback
heuristics without any visible error (except GPS route-plotting, which has no
fallback and surfaces "Route unavailable").

## Root cause

Commit `9ff53cae` ("Affective: pre-session check-in → affective_state, read by
`/recommend`", 2026-06-29) added `serve.py`'s import and call of
`load_affective_state` from `mindcraft_graph.firestore_adapter`
([serve.py:299-307](ml/serve.py#L299-L307), used at
[serve.py:351](ml/serve.py#L351)) — but the function was **never implemented**
in `firestore_adapter.py`. It doesn't exist anywhere in the repo, locally or in
the deployed image (confirmed via Cloud Run logs — 100% of real `POST
/recommend` calls throw `ImportError: cannot import name 'load_affective_state'
from 'mindcraft_graph.firestore_adapter'` since 2026-06-30T10:18Z; only CORS
`OPTIONS` preflights return 200, which is what made it look partially "up" in a
crude log scan).

Confirmed via `gcloud logging read` against
`resource.labels.service_name=mindcraft-ml`, filtered to `httpRequest.requestUrl:"/recommend"` and `httpRequest.requestMethod=POST` — every single one is a 500 with that traceback.

## The fix

**File:** `ml/mindcraft_graph/firestore_adapter.py`

Add the missing loader, matching the existing pattern used by
`load_ingredient_state` (~line 332 in the same file) — Firestore doc read, soft
defaults, no exceptions escaping to the caller. Storage shape (already written
by `webhook/api/agent-check-in.ts:189-194`, unchanged): collection
`affective_state`, doc id = `student_id`, field `latest` holds the
`AffectiveState` payload (`stress`, `motivation`, `confidence_by_concept`,
`explicit_struggles`, `captured_at` — ms epoch).

```python
from mindcraft_graph.models.affective_state import AffectiveState  # add to top-level imports

def load_affective_state(student_id: str) -> AffectiveState | None:
    """Load the student's latest pre-session check-in, or None if absent/stale.

    Freshness gate matches the AffectiveState docstring's stated contract
    (>4h old is treated as no signal) — /recommend's stress-softening and
    explicit-struggle override should only apply to a genuinely recent check-in.
    """
    doc = db.collection("affective_state").document(student_id).get()
    if not doc.exists:
        return None
    data = (doc.to_dict() or {}).get("latest")
    if not data:
        return None
    state = AffectiveState(**data)
    now_ms = int(datetime.now().timestamp() * 1000)
    if now_ms - state.captured_at > 4 * 60 * 60 * 1000:
        return None
    return state
```

Place it near `load_ingredient_state`/`load_format_events` for locality with
the other per-student loaders `/recommend` pulls in.

## Verification before deploy

1. `cd ml && source mindcraft/bin/activate && python scripts/end2end.py` — should
   stay 85/85 (this function is only exercised via `/recommend`, which the
   harness may or may not hit directly; if it doesn't, also manually smoke-test
   step 2 below against a local server).
2. Local smoke test: run `uvicorn serve:app` locally
   (`ML_AUTH_ENABLED=false FIRESTORE_PROJECT=mindcraft-93858`), POST to
   `/recommend` with a real `student_id` (a doc with no `affective_state` entry
   should hit the `not doc.exists` branch and return `None` cleanly — confirms
   the no-checkin case doesn't regress), then with a student that HAS an
   `affective_state/{id}` doc (should parse and apply normally).
3. Confirm no OTHER function is missing the same way — this repo has had at
   least one prior instance of `serve.py` referencing something not yet built
   (per CLAUDE.md's "local commits beyond rev 00009 not yet deployed" note from
   earlier project history). A cheap check: `python -c "import serve"` locally
   with all env vars set, to catch any other import-time or call-time
   mismatches before they hit prod the same way this one did.

## Deploy

Standard `mindcraft-ml` deploy per CLAUDE.md — **both** env vars every time
(`--set-env-vars` replaces the whole set, doesn't merge):
```
gcloud builds submit --tag us-central1-docker.pkg.dev/project-e4af30ac-bc17-4691-8b6/mindcraft-ml/mindcraft-ml
gcloud run deploy mindcraft-ml --image us-central1-docker.pkg.dev/project-e4af30ac-bc17-4691-8b6/mindcraft-ml/mindcraft-ml \
  --region us-central1 --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 \
  --allow-unauthenticated \
  --set-env-vars FIRESTORE_PROJECT=mindcraft-93858,ML_SERVICE_SECRET=<secret>
```

## Post-deploy confirmation

Re-run the same log query used to find this:
```
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=mindcraft-ml AND httpRequest.requestUrl:"/recommend" AND httpRequest.requestMethod="POST"' \
  --project project-e4af30ac-bc17-4691-8b6 --limit 20 --format="value(timestamp,httpRequest.status)" --freshness=10m
```
Should show 200s only, going forward. Once confirmed, everything downstream
that silently degraded — GPS route plotting, `worstWeakness()`, the live
pathfinder-ordered practice path, PawHub's weakness pad — starts getting real
engine output instead of client-side fallbacks. Worth a quick manual pass on
each of those in the app afterward to confirm they look meaningfully different
now that real recommendations are flowing (not just "no longer erroring").
