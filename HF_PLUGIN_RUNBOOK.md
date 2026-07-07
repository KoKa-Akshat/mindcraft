# HF Space plug-in runbook (paste into a fresh Claude Code chat as the task prompt)

Everything below the line is a self-contained prompt. It alternates
agent-executable steps with STOP points where the human does browser work.

---

You are plugging the already-scaffolded `mindcraft-ml` FastAPI service into a
new Hugging Face Space and cutting production traffic over to it. Context:

- Repo: `/home/basickellogs/Projects/mindcraft`. All code is already merged
  (commit `a39148e5`): `ml/Dockerfile` is HF-compatible (uid-1000 cache
  fixes), `ml/entrypoint.sh` turns a `FIREBASE_SERVICE_ACCOUNT_JSON` env
  secret into `GOOGLE_APPLICATION_CREDENTIALS`, `ml/README_HF.md` is the
  Space README (sdk: docker, app_port: 8080), `ml/scripts/deploy_hf.sh`
  pushes `ml/` to the Space repo. Webhook reads `process.env.ML_API_URL`
  with a run.app fallback.
- Why: the GCP billing account is closed; Cloud Run cannot start. The HF
  Space is a free bridge. GCP config must NOT be deleted (rollback path).
- Read `HF_SPACES_MIGRATION_PLAN.md` for background. Follow the repo's git
  rules in CLAUDE.md (pull before work, push when done, never force-push).

Work through these steps in order. Do not skip verification gates.

## Step 0 — Preflight (you)
1. `git pull origin main`; confirm `ml/entrypoint.sh`, `ml/README_HF.md`,
   `ml/scripts/deploy_hf.sh` exist and `grep -n "<org>" ml/serve.py` shows
   the CORS placeholder.
2. Retrieve the service secret (needed for smoke tests and already set in
   Vercel):
   `gcloud run services describe mindcraft-ml --region us-central1 --format='value(spec.template.spec.containers[0].env)'`
   — extract ML_SERVICE_SECRET's value into a shell var. (Reading config
   works with billing disabled; if it errors, ask the human to copy
   ML_SERVICE_SECRET from the Vercel dashboard instead.)

## Step 1 — STOP: human creates the Space (~10 min, browser)
Ask the human to:
1. Sign in / register at huggingface.co (note the username or org — call it
   `<OWNER>` below).
2. New Space → name `mindcraft-ml` → SDK **Docker** → hardware
   **CPU basic (free)** → visibility **public** (the API is protected by
   Firebase-token / service-key auth).
3. Create a **write token**: HF Settings → Access Tokens → new token with
   write scope, and paste it to you (needed for the git push deploy).
Resume when you have `<OWNER>` and the token.

## Step 2 — STOP: human mints the Firestore key (~10 min, browser)
Ask the human to:
1. GCP console → project **mindcraft-93858** → IAM & Admin → Service
   Accounts → Create: name `mindcraft-ml-hf`, role **Cloud Datastore User**
   → done → Keys tab → Add key → JSON → download.
2. HF Space → Settings → Variables and secrets → add THREE secrets:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = the entire JSON file contents,
     pasted verbatim (newlines are fine — the entrypoint writes it with
     printf '%s')
   - `ML_SERVICE_SECRET` = the value from Step 0
   - `FIRESTORE_PROJECT` = `mindcraft-93858`
Resume when the human confirms all three are saved.

## Step 3 — Fill placeholders + deploy (you)
1. Replace `<org>` in `ml/serve.py`'s CORS list with `<OWNER>` (origin
   `https://<OWNER>-mindcraft-ml.hf.space`). Commit + push to origin main.
2. Authenticate the HF git remote using the write token (deploy_hf.sh
   header documents the expected remote; use
   `https://<OWNER>:<TOKEN>@huggingface.co/spaces/<OWNER>/mindcraft-ml`).
   Do NOT commit the token anywhere.
3. Run `ml/scripts/deploy_hf.sh`. First build takes ~15 min — watch it at
   `https://huggingface.co/spaces/<OWNER>/mindcraft-ml` (ask the human to
   open it if you can't fetch build logs).

## Step 4 — Smoke tests (you; the deploy gate)
Let `BASE=https://<OWNER>-mindcraft-ml.hf.space`. Retry /health for up to
~3 min after the build finishes (cold start).
1. `curl $BASE/health` → 200.
2. `curl -X POST $BASE/recommend -H 'Content-Type: application/json' -d '{"student_id":"gBFn9vUGIIa7tAiTTQSl8CbPSao2","mode":"exam","target_concepts":[]}'`
   → **401** (auth working).
3. Same request + `-H "X-Service-Key: $SECRET"` → **200 with
   recommendations** (proves the Firestore key end-to-end — this is the
   step that fails if the JSON secret got mangled; fix = re-paste secret,
   restart Space).
4. `curl -H "X-Service-Key: $SECRET" $BASE/exam-concepts/act` → ~29 ids.
5. `curl -X POST $BASE/check-work -H "X-Service-Key: $SECRET" -H 'Content-Type: application/json' -d '{"student_id":"smoke","lines":[{"latex":"2x + 4 = 10"},{"latex":"2x = 5"}]}'`
   → `firstBrokenLine: 1`.
All five must pass before Step 5.

## Step 5 — Traffic flip (you + human)
1. Edit `app/.env.production`: `VITE_ML_API_URL=https://<OWNER>-mindcraft-ml.hf.space`
   (leave the homework URL alone). Commit + push → CI deploys in ~3 min;
   confirm the GitHub Actions run is green.
2. STOP: human sets `ML_API_URL=https://<OWNER>-mindcraft-ml.hf.space` in
   the Vercel project env and redeploys the webhook.
3. Verify prod: open mindcraft-93858.web.app, sign in, dashboard loads a
   weak-spot recommendation (network tab shows calls to the hf.space URL).

## Step 6 — Deploy the new Firestore rules + index (human-assisted)
Commit `a39148e5` added a `student_work` collection rule + composite index
that are NOT yet live:
1. Rules: deploy `firebase/firestore.rules` via the Firebase Rules API
   mechanism documented in TUTOR_PARENT_CLASSROOM_PLAN.md ("Deploy
   mechanism note") — NOT local `firebase deploy`.
2. Index: try `npx firebase deploy --only firestore:indexes` from repo
   root; if the CLI hits the known IAM serviceusage error, skip it — the
   first student_work query will 400 with a console link that creates the
   exact index in one click; ask the human to click it.

## Rollback
Revert the `.env.production` line + Vercel `ML_API_URL`, push. Cloud Run
config is untouched; it resumes when GCP billing is reopened.

## Known failure modes
- Space build OK but crashes at start: almost always the model cache path
  (must be under /app/.cache, not /root) or a mangled JSON secret.
- /health 200 but step-3 500s: Firestore credentials — check Space runtime
  logs for GOOGLE_APPLICATION_CREDENTIALS / permission-denied.
- Browser calls fail but curl works: CORS — the app origins must be in
  serve.py allow_origins (they are; don't remove them).
- First request after ~48h idle takes ~60s: free-tier sleep, expected.
