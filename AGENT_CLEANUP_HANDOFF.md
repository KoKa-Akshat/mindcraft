# Agent Cleanup Handoff (Cursor + Claude + Codex)

Last updated: 2026-06-28  
Companion to `REPO_CLEANUP_AUDIT.md`. Read both before deleting, deploying, or refactoring.

## Who Owns What

| Area | Deploy target | Source of truth | Do not confuse with |
|------|---------------|-----------------|---------------------|
| Student app | `hosting:app` → `app/dist` | `app/src/` | `phoenix/` |
| Jesse's Kitchen world | `hosting:world1` → `worlds/world2/` | Textures + `bundle.*.js` + `mc-diagnostic.*` | `worlds/_world-builder-training/` |
| Marketing site | `hosting:marketing` → repo root | `index.html`, `blog.html`, `img/` | `app/` |
| ML engine | Cloud Run `mindcraft-ml` | `ml/` | — |
| Homework LLM | Cloud Run `mindcraft-homework` | `homework/` | — |
| Webhooks | Vercel `webhook/` | `webhook/api/` | — |

## Blessed Deploy Commands

**CI is the only deployer for Firebase Hosting.** `.github/workflows/deploy.yml`
runs on every push to `main`: builds `app/` and deploys `hosting:app`,
`hosting:world1`, and `hosting:marketing` to project `mindcraft-93858`.

```bash
git pull origin main
# ... make changes, commit ...
git push origin main
# Wait ~2–3 min; confirm green run in GitHub Actions tab.
```

**Do NOT run `firebase deploy` locally.** Manual deploys overwrite live from your
disk and have clobbered co-founder work. `main` is the single source of truth.

**Not auto-deployed** (manual GCP / Vercel):
- `ml/` → Cloud Run `mindcraft-ml` (`gcloud builds submit` + `gcloud run deploy`,
  `--set-env-vars FIRESTORE_PROJECT=mindcraft-93858`)
- `homework/` → Cloud Run in `mindcraft-93858`
- `webhook/` → Vercel

## Answers to Audit Questions (Cursor, 2026-06-28)

### `worlds/_world-builder-training/`

- **Created by:** Codex (world-builder experiments), not Cursor core product paths.
- **Contents:** Nested Vite projects (`world1/`, `world3/`) with `src/`, `dist/`, `node_modules`. ~18–27M, thousands of files if scanned.
- **Needed for production?** **No.** Live Jesse world is `worlds/world2/` only.
- **Action:** Already `.gitignore`d. Safe to **delete locally** to reclaim disk; keep ignored unless actively developing new world source there.

### Root / world `*_unpacked_*`, `*_transcoded_*`, `*.astc`

- **Created by:** Running `basisu -info` / `-unpack` on `.ktx2` during texture debugging (Codex + Cursor sessions).
- **Needed?** **No.** Regenerated anytime from source PNG/ktx2.
- **Action:** Deleted from repo root (939 files). Deleted from `worlds/world2/` (61 files). `.gitignore` + `firebase.json` ignore patterns prevent recurrence.

### `project*_orig.ktx2` and `*_orig.ktx2` (14 tracked files)

- **Purpose:** Rollback copies from pre-redesign screens (ramen-era vending, about-me screens).
- **Runtime:** Bundle loads `projectN.ktx2`, not `projectN_orig.ktx2`.
- **Action:** Excluded from Firebase `world1` deploy via `**/*_orig.ktx2`. **Optional later:** `git rm` from repo after owner confirms no rollback needed (~600KB each).

### `bundle.3ea4b3f1364c1bb7.js.map` / `main.css.map`

- **Needed in production?** **No.**
- **Action:** Excluded from `world1` deploy (`**/*.map`). Optional phase 2: stop tracking maps in git (`git rm --cached`) to shrink repo ~3.4M+.

### `functions/`

- **Status:** Only `node_modules/` present; no `index.js`, no firebase.json functions block.
- **Action:** Treat as **abandoned**. Safe to delete local `functions/node_modules`. Do not add functions deploy until source exists.

### `phoenix/`

- **Status:** Static build output (portfolio 3D page). Referenced from root `index.html` iframe (`phoenix/index.html?embed=1`).
- **Action:** **Keep** while marketing landing embeds it. If embed is removed from `index.html`, archive or delete in a separate marketing cleanup.

### `app/.env.production`

- **Tracked values (public by design):** Cloud Run URLs only (`VITE_ML_API_URL`, `VITE_HOMEWORK_API_URL`).
- **No secrets.** OK to keep tracked.

### `VITE_GEMINI_API_KEY`

- **Removed from `app/.env.example`.** Correct — any `VITE_*` is browser-exposed. Use `GEMINI_API_KEY` for local scripts only.

## Safe Deletes (approved patterns)

Already done or safe without asking again:

- `*_unpacked_*`, `*_transcoded_*`, `*.astc` anywhere (regenerated junk)
- Root-level basis inspection outputs
- Accidental local edits to `worlds/world2/bundle.*.js` (revert; edit textures/scripts instead)

Ask owner before deleting:

- `worlds/_world-builder-training/` (local only, already ignored)
- `*_orig.ktx2` from git history
- Large PNG bakes if `.ktx2` is confirmed sole runtime path
- `phoenix/`, PDFs, login videos, `img/Video.mp4`
- Any `node_modules/` (reinstall required)

## Git Hygiene

- Slow `git status` was caused by untracked generated textures + training folder. Fixed via `.gitignore`.
- Leftover garbage: `.git/objects/pack/tmp_pack_LP7QbV` — run `git gc --prune=now` after pulls/pushes settle.
- Prefer path-scoped status: `git status --short worlds/world2`

## CSS / Code Streamlining (do not rush)

1. Add design tokens to `app/src/global.css` (colors, radii, spacing).
2. Migrate one page at a time; **Practice.module.css (~3k lines) last**.
3. Do not change visuals during cleanup-only commits.
4. Removed dead routes/files in prior sessions: `app/src/pages/Diagnostic.tsx`, duplicate `actDiagnostic.json` in app (world copy is canonical).

## Vending / World Texture Workflow

```bash
cd worlds/world2
python3 tools/generate_vending_project_cards.py
basisu -ktx2 -comp_level 5 -q 255 textures/screens/vendingMachineScreens/projectN.png \
  -output_file textures/screens/vendingMachineScreens/projectN.ktx2
```

Layout coordinates must match original `*_orig.ktx2` grid (see generator constants). Preview: `vending-demo.html` via local `python3 -m http.server`.

## Open Items for Owner

Resolved 2026-06-28 (Cursor):

1. **`worlds/_world-builder-training/`** — **Keep ignored, delete locally when ready**
   (`rm -rf worlds/_world-builder-training`). Not production; ~18M. Nested `.git` dirs
   inside may require running delete outside sandbox / from Terminal.
2. **`*_orig.ktx2`** — Keep in git as rollback reference; excluded from Firebase deploy.
3. **`.map` files** — Keep in git for local debug; excluded from Firebase deploy.
4. **`phoenix/`** — Keep while marketing embeds it in `index.html`.
5. **CSS token migration** — Deferred; do Dashboard/Login first when ready.

Still manual / separate:

- `ml/` Cloud Run deploy when backend changes ship
- Large asset archive (PDFs, duplicate videos) — separate pass when marketing trims
