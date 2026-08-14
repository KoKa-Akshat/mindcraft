# MindCraft — handoff for Cursor (and sibling agents)

**Canonical live checkout:** `/Users/akoirala/Developer/mindcraft`  
**Read this at the start of every session.** Full project brief: `CLAUDE.md`. Current shipped/open work log: `ACTIVE_TASK.md` (read the top).  
**Canon (brand / vision / pedagogy / research):** `docs/canon/README.md` — Brand Book PDF `BRAND_BOOK.pdf`; Research Constitution `agent_work/research/`.  
Manjushree landing-panel brief: `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md`.

---

## Brand pivot notice (2026-08-11)

MindCraft's positioning moved from "ACT-math tutoring" to "collaborative workspace / operating system for student work." `BRAND_BOOK.md` bumped to **v2.0** — read it before writing any new marketing or product copy. Math/Katha/"the click" is now the voice of the **Solver** vertical specifically, not the whole brand. New: `BUSINESS_MODEL.md`.

---

## Active Field Desk checkpoint (2026-08-09)

Native Desk OS + Desk Operator agent work landed today and is **pushed to main**.

| Surface | Tip |
|---|---|
| iOS prototype | `/Users/akoirala/Developer/mindcraft/ios-prototype` · tip `4c30ccf` · full note `DESK_SESSION_CHECKPOINT_2026-08-09.md` |
| Webhook / desk Ask | `webhook/api/desk-ask.ts` · tip includes `a8e0fd7e` |
| Agent growth ladder | `agent_work/product/DESK_AGENT_GROWTH.md` |

**Locked product shape:** Field Desk home · real Gmail (not AgentMail) · Calendar · Connect enablers · Ask → Desk Operator · live on-device record/tag · Apply today board · hub settings gear.

**Next:** enable Gmail/Calendar APIs on GCP if inbox 403 · harden coffee-shop record · grow agent tools (receipts → mail draft → Job OS → ask_tutor).

---

## Repo, branch, remote

- **One repo, one remote:** https://github.com/KoKa-Akshat/mindcraft.git
- **Everyone works on `main` directly.** No feature branches in this workflow — commits land on `main` and CI deploys immediately.

### Two local checkouts (do not confuse them)

| Path | Status |
|------|--------|
| `/Users/akoirala/Developer/mindcraft` | **Live** — all real work happens here |
| `/Users/akoirala/Desktop/Business Ideas/mindcraft-site` | **Stale** — tens of commits behind; agents working here have shipped nothing until work was manually copied |

**Before editing anything:** run `pwd` and `git log --oneline -3`.  
If `pwd` shows `Desktop/Business Ideas`, **stop and switch** to `/Users/akoirala/Developer/mindcraft`.

---

## How deploys work

`git push origin main` triggers `.github/workflows/deploy.yml`, which builds `app/` and deploys three Firebase Hosting targets:

| Target | Live URL | Source |
|--------|----------|--------|
| `app` | https://mindcraft-93858.web.app | dashboard / student app (`app/dist`) |
| `world1` | https://mindcraft-world1.web.app | 3D world static site |
| `marketing` | https://joinmindcraft.com | root-level `index.html` / `blog.html` |

- **Never run `firebase deploy` locally.** It publishes whatever’s on disk and clobbers CI, overwriting other people’s in-flight work. Push to `main` and let CI do it.
- After every push, confirm the Actions run went green before calling anything shipped:
  - `gh run list --branch main --limit 1`
  - `gh run view <id>`
- Client app is a SPA — an already-open tab will **not** pick up a new deploy until a hard refresh (**Cmd+Shift+R**) or a fresh tab. “I don’t see my changes” is often a cache false alarm.

---

## Lane ownership (read before touching anything)

Two people’s work lives in this same tree, on **disjoint** trees:

| Lane | Owner | Tree |
|------|-------|------|
| **Engine** | Blake | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| **Product** | Akshat | `app/**`, `index.html`, `blog.html`, root marketing files |

Coordinate before crossing a lane boundary. Shared seam files (also in `CLAUDE.md`): `app/src/lib/questionBank.ts`, `app/src/lib/mlApi.ts`, `CLAUDE.md`.

### Manjushree (third in-progress lane — co-founder WIP)

Real, in-progress feature. Treat as live WIP, **not** dead code:

| Area | Paths |
|------|--------|
| Zone | `app/src/manjushree/` |
| Post-cut slideshow | `app/src/pages/StorySlideshow.tsx` |
| Routes in `App.tsx` | `/manjushree`, `/manjushree-dev`, `/story-loop/:conceptId`, `/story-loop-dev/:conceptId` |
| Kitchen → zone handoff | `worlds/world2/sq-standalone.js` (+ css/html, cache `sq-lock-2`) — coordinate with Engine lane before changing world hosting broadly |
| Landing panel brief | `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md` |

`App.tsx` has a permanent comment that this exact wiring has been **lost to concurrent overwrites multiple times**. If you edit `App.tsx`:

1. Read the **whole** file first  
2. Make only your specific change  
3. **Never** delete or “clean up” anything that looks like dead Manjushree code — it’s live WIP  

Prefer **scoped commits** (`git add` only relevant files). Never `git add -A` when Manjushree or another agent’s WIP is sitting uncommitted.

---

## How work has been happening (match this pattern)

1. Real bug reports come in as screenshots/descriptions from someone using the **live** product, not only spec docs.
2. Every change is independently verified before it’s called done:
   - `npx tsc --noEmit`
   - `npx vitest run` (baseline when last noted: ~120 passed / 1 skipped, 8 files — re-check current)
   - `npm run build`
   - Real before/after screenshot when UI-facing (a temporary `VITE_SCREENSHOT_MODE`-gated auth bypass in `App.tsx` is the established pattern — **always fully revert** afterward; confirm via `git diff`)
3. Never claim fixed/shipped without having **run** the check.
4. Commits are scoped precisely — only files for that fix.
5. `ACTIVE_TASK.md` gets a new **dated entry** after every real batch — check the top before starting anything new.

---

## Current focus (update this section as batches ship)

### Recently shipped and live

- Contents “roadmap” redesign on the dashboard (horizontal progress dots per subject lane)
- Live typed-expression graph box in Practice / chapter question views
- All 42 concept chapters given real photo art and expanded stories
- “Find a Tutor” page with Google Maps + tutor self-set location
- Marketing-page overhaul (hero, **Sword of Wisdom** demo panel with real product preview, tutor-recruitment section, honest “reviews coming soon” placeholder)

### Still open / in progress (as of handoff write-up — verify in `ACTIVE_TASK.md`)

- Caption-rendering bug in practice questions
- Graph-box shows-the-wrong-thing bug
- Story-pagination issues on a handful of concepts
- Shortening recently-expanded concept stories
- Dashboard hero-bar layout tweaks
- Tabbed apply-for-seat / apply-to-tutor form on the marketing page
- Manjushree sequence polish + landing-panel placement (see `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md`)

---

## Complementary agents

Use this file so Product, Engine, and Manjushree agents stay aligned:

- Confirm checkout path first  
- Stay in your lane unless coordinating  
- Don’t clobber Manjushree routes in `App.tsx`  
- Don’t push from the stale Desktop checkout  
- Don’t local `firebase deploy`  
- Leave `ACTIVE_TASK.md` and this file honest after real batches  
