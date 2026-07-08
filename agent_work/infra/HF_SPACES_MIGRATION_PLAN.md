# Build plan: run mindcraft-ml on Hugging Face Spaces (free CPU) while GCP billing is closed

Reversible bridge: GCP billing account was closed Jul 6, Cloud Run cannot
start instances. HF free CPU Space (2 vCPU / 16 GB) comfortably fits the
service (~600-900 MB RSS). Keep ALL GCP config intact — when billing
returns, revert by flipping the two URLs back.

Bonus: the Space builds from the current repo, so it ships everything not
yet deployed to Cloud Run (`/check-work`, exam-target fix, per-line
transcribe support).

## Lane: Engine (`ml/**`, `webhook/**`) + two one-line Product touches

### E1 — Dockerfile: HF compatibility (`ml/Dockerfile`)
HF Spaces runs the container as **uid 1000, not root**. The current image
bakes the sentence-transformer into `/root/.cache`, unreadable at runtime.
- Set `ENV HF_HOME=/app/.cache` (and `SENTENCE_TRANSFORMERS_HOME=/app/.cache`)
  BEFORE the model pre-download step so weights land in `/app/.cache`.
- After all bake steps: `RUN chmod -R a+rX /app` (and `a+w` on `/app/.cache`
  + `/app/data` if anything writes there at startup — the embeddings
  staleness check may rewrite the npz).
- Port stays 8080 (HF respects `app_port` from the Space README).

### E2 — Credentials entrypoint (`ml/entrypoint.sh` + Dockerfile CMD)
On Cloud Run, Firestore auth was ambient. On HF it comes from a
service-account key passed as a Space secret (env var, string):
```sh
#!/bin/sh
if [ -n "$FIREBASE_SERVICE_ACCOUNT_JSON" ]; then
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > /tmp/sa.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json
fi
exec uvicorn serve:app --host 0.0.0.0 --port "${PORT:-8080}"
```
`firestore.Client(project=FIRESTORE_PROJECT)` (firestore_adapter.py:32)
picks up GOOGLE_APPLICATION_CREDENTIALS automatically; `auth.py` token
verification needs no credentials (public certs). No Python changes.

### E3 — Space scaffolding (`ml/README_HF.md` → Space `README.md`)
HF Docker Spaces read config from the README frontmatter:
```yaml
---
title: mindcraft-ml
sdk: docker
app_port: 8080
---
```
Add `ml/scripts/deploy_hf.sh`: pushes the `ml/` directory to the Space git
remote (`https://huggingface.co/spaces/<org>/mindcraft-ml`) with the
README_HF.md renamed to README.md at the Space root. Document usage in the
script header. (HF Space = a git repo; deploy = git push.)

### E4 — CORS (`ml/serve.py`)
Add the Space origin to `allow_origins`: `https://<org>-mindcraft-ml.hf.space`
(exact hostname visible on the Space page after creation — leave a
placeholder + comment, Blake fills the real one before the deploy push).

### E5 — Consumer repoints
- `app/.env.production` line 1: `VITE_ML_API_URL=https://<org>-mindcraft-ml.hf.space`
  (CI bakes at build; one push redeploys the frontend).
- `webhook/lib/jarvisTools.ts` + `webhook/api/generate-summary.ts`: they
  reference the run.app URL — switch to `process.env.ML_API_URL` with the
  run.app fallback, and set `ML_API_URL` in Vercel to the Space URL.

### E6 — Smoke tests (after Blake's manual steps + first build)
- [ ] `GET /health` → 200 (first hit after sleep may take ~60 s — retry).
- [ ] Unauthenticated `POST /recommend` → 401.
- [ ] `X-Service-Key: $ML_SERVICE_SECRET` request → 200 with data (proves
      Firestore key works).
- [ ] `GET /exam-concepts/act` with a Firebase token → ~29 concepts.
- [ ] `POST /check-work` with a 2-line derivation → verdicts.
- [ ] Frontend gap-scan → seed → dashboard weak-spot round-trip on prod.

## Manual steps (Blake — ~30-45 min, browser)
1. Create HF account (or org `mindcraft`) → New Space → name `mindcraft-ml`,
   SDK **Docker**, hardware **CPU basic (free)**, visibility public (the
   API is protected by Firebase-token/service-key auth, same as today).
2. Service-account key: GCP console → IAM & Admin → Service Accounts →
   project **mindcraft-93858** → create `mindcraft-ml-hf` with role
   **Cloud Datastore User** → Keys → new JSON key → download.
   (IAM/service accounts work with billing disabled; Firestore is on the
   free tier.)
3. Space → Settings → Secrets:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = full JSON key file contents
   - `ML_SERVICE_SECRET` = same value as Vercel's (Vercel dashboard → env)
   - `FIRESTORE_PROJECT` = `mindcraft-93858`
4. Give the agent the Space URL for E4/E5 placeholders.
5. After code lands: run `ml/scripts/deploy_hf.sh` (first build ~15 min).
6. Vercel dashboard: add `ML_API_URL` = Space URL, redeploy webhook.

## Rollback (when GCP billing returns)
Revert E5 (two URLs + Vercel env), redeploy Cloud Run per CLAUDE.md. E1-E3
changes are harmless to keep — they don't affect Cloud Run behavior.

## Known trade-offs (accepted: no real users)
- Space sleeps after ~48 h idle → first request pays a cold start (~60 s).
- Single instance, no autoscaling/SLA.
- Firestore free-tier quota (50k reads/day) is the real capacity ceiling
  (~500-1,000 student sessions/day) — fine until marketing.
