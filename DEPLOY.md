# MindCraft Deploy Rules

Read this before any release step. Full cleanup context: `REPO_CLEANUP_AUDIT.md`,
`AGENT_CLEANUP_HANDOFF.md`.

## Firebase Hosting (app + world + marketing)

**Auto-deploy on push to `main` via `.github/workflows/deploy.yml`.**

```bash
git pull origin main
git push origin main
```

CI builds `app/` and deploys Firebase targets `app`, `world1`, and `marketing`
to project `mindcraft-93858`. Live in ~2–3 minutes — confirm green in GitHub Actions.

| Target | Source | URL |
|--------|--------|-----|
| `app` | `app/dist` | https://mindcraft-93858.web.app |
| `world1` | `worlds/world2/` | https://mindcraft-world1.web.app |
| `marketing` | repo root | https://mindcraft-marketing-site.web.app |

### Hard rules

1. **Do not run `firebase deploy` locally.** It publishes your disk and overwrites CI.
2. **Do not force-push `main`.**
3. **Do not commit secrets** (`.env.local`, service account JSON, API keys).

App build in CI uses `npm install --legacy-peer-deps` (required for `@react-three` peers).

## Not auto-deployed

- **`ml/`** → Cloud Run `mindcraft-ml` (GCP project `project-e4af30ac-bc17-4691-8b6`).
  Manual: `gcloud builds submit` + `gcloud run deploy` with
  `--set-env-vars FIRESTORE_PROJECT=mindcraft-93858`.
- **`homework/`** → Cloud Run in `mindcraft-93858`.
- **`webhook/`** → Vercel.

Pushing to `main` does **not** deploy ML or webhooks.
