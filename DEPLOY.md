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
| `marketing` | repo root | **https://joinmindcraft.com** (Firebase site `mindcraft-marketing-site`) |

Primary public / marketing link: **https://joinmindcraft.com**  
Legacy alias (same Firebase site until DNS cutover finishes): `https://mindcraft-marketing-site.web.app`

### Custom domain (Namecheap → Firebase)

Domain is owned at Namecheap. Connect it to Firebase Hosting target `marketing`
(site id `mindcraft-marketing-site`) so joinmindcraft.com serves this repo’s
root marketing files.

1. Firebase Console → project `mindcraft-93858` → **Hosting** → site
   **mindcraft-marketing-site** → **Add custom domain** → `joinmindcraft.com`
   (also add `www.joinmindcraft.com` and choose redirect www → apex).
2. Copy the DNS records Firebase shows (TXT verify + A / AAAA, and CNAME for www).
3. Namecheap → Domain List → **joinmindcraft.com** → **Advanced DNS**:
   - Delete Namecheap parking / Stopper records pointing at `198.54.117.x`
   - Add Firebase’s records exactly (TTL Automatic or 5 min while testing)
4. Wait for Firebase to show domain **Connected** (often 15 min–a few hours).
5. Use **https://joinmindcraft.com** everywhere in marketing.

Details: `DOMAIN_SETUP.md`.

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
