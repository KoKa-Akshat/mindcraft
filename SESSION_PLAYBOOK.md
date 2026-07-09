# Session Playbook — how to run a window

> "Window" = one chat session (Claude Code / Cursor / Codex). Read this at
> the START of a window to pick its **type** and starting **model**. Pair
> with `AGENTS_QUICKSTART.md` (what the project is) — this doc is *how to
> operate the session itself*.

---

## 1. Window types — pick one, don't mix

| Type | Lifecycle | Produces | Reads |
|------|-----------|----------|-------|
| **Brainstorm** (soundboard) | Exploratory, ends when a direction crystallizes | a *decision* → feeds a Build window | vision docs (WORLD/BRAND/GAP/FABLE5) |
| **Build** (architect) | One-shot, dies on commit | a spec in `agent_work/{lane}/` | roadmap + canonical docs |
| **Implementer** (Cursor/Codex) | One-shot, dies on push | code, from an existing spec | one `agent_work/` spec + the seam |
| **Debug/ops** | Long-lived, *reseeds* | a fix + a state update | system state (CLAUDE.md + memory) |

Flow: **brainstorm → decision → build → implementer.** Brainstorm and
build can be one window when the idea is small and converges fast; hand to
a *fresh* build window when the brainstorm was long or explored many
discarded options, so the spec isn't born from divergent-exploration bloat.

**Never mix build and debug in one window.** A build task in the debug
window bloats it with spec-drafting turns; a debug task in a build window
lacks the accumulated cross-system history that catches the real bugs.
Build/implementer windows are disposable; only the debug window persists —
and even it reseeds (see §5).

---

## 2. Startup rituals

**Brainstorm window:** free-form, stays on **Opus** start to finish (no
mechanical stretch to tier down — the value is the judgment). Reads the
vision/product docs, not deployment state. **Must end by capturing the
decision durably** — either roll straight into the build file here, or
write the direction into CLAUDE.md `Active workstream` / `Designed, not
built` so a later build window inherits it. A direction left only in the
transcript dies when the window closes.

**Build window:** state what to build (usually just *point*: "the X item
in CLAUDE.md's Active workstream" or "implement `<brief>`"). It reads →
CLAUDE.md (architecture + the roadmap entry) → the canonical doc owning
the area (BRAND_BOOK / AGENT_RULEBOOK / DASHBOARD_NOTEBOOK_SPEC /
FABLE5_VISION) → ACTIVE_TASK.md (don't spec what's in flight) → existing
`agent_work/` specs (don't duplicate). Verify a few facts against code
(targeted greps). Write spec → label lanes → update `agent_work/README.md`
→ commit → close.

**Implementer window:** reads AGENTS_QUICKSTART + ACTIVE_TASK.md + the one
`agent_work/` spec it's assigned. Codes in its lane, verifies, commits,
pushes, updates ACTIVE_TASK.md, closes.

**Debug/ops window:** state the symptom. Reads → CLAUDE.md `Current state`
+ `Known gotchas` + `Deployment` (the live topology) + memory + whatever
subsystem the symptom touches. Gather facts flat, synthesize, fix or spec
the fix. On resolution, **write the conclusion back to CLAUDE.md /
memory** — then the transcript is disposable.

**Don't hand-feed context** — point at the repo. If you're pasting a lot
into a fresh window, that's the signal something durable isn't written
down; fix that by writing it to the repo, not by re-pasting each session.

---

## 3. Model tiering (switch within any window; it keeps full context)

Switching `/model` mid-window loses nothing — all history stays. It only
changes what you pay per turn. On a long window the per-turn cost is
dominated by re-reading context, so being on Sonnet during mechanical
stretches saves the most precisely *because* the window is fat.

**Drop to Sonnet when your next message is:** "run / check / verify /
confirm…", "commit and push / deploy…", "grep / find / where is…", "go
ahead / do it / yes proceed", "test whether X works." (Decision already
made — you just need hands.)

**Switch up to Opus when:** "why is / why did…", "should we / which
approach", a result came back **different from expected**, "design / spec
/ plan…", "does this break X elsewhere" (cross-file reasoning), or you're
about to paste an error you don't understand yet.

**Tiebreaker:** *Do I already know what a correct answer looks like?*
Yes → confirming → Sonnet. No → finding out → Opus.

**Batch same-tier work** — don't ping-pong per message. Three checks in a
row: switch to Sonnet once, run all three, pop back up only if one turns
up something odd.

---

## 4. Context hygiene — keep conclusions, drop payloads

This is what lets a debug window stay long *and* cheap.
- Never read a whole large file when `grep`/`head` answers the question.
- Never let base64 / minified bundles / a whole multi-MB JSON into the
  window — extract the one fact and move on.
- Reduce big command output at the source (`wc -l`, `head`, `jq`, filter)
  so the window gets the number, not the dump.
- When something large is unavoidable, state its conclusion once; don't
  re-cite the blob.

A window full of conclusions runs 200 turns cheaply. A window full of raw
dumps forces you to fragment to control cost — the thing you don't want.

---

## 5. The three trackers — which window reads which

| Doc | Holds | Horizon |
|-----|-------|---------|
| **CLAUDE.md** | what's *true* (architecture, deploy topology) + what's *planned* (`Active workstream`, `Designed, not built`, backlog, `Known gotchas`) | weeks — source of truth |
| **ACTIVE_TASK.md** | what's *happening this week* (who's on which files) | days — deleted after 2 sessions |
| **agent_work/README.md** | which *specs* exist + build status | per-spec |

Build windows read the **roadmap** (CLAUDE.md) to learn *what to build*.
Debug windows read the **state** (CLAUDE.md + memory) to learn *what's
true*. Both point at CLAUDE.md first — different sections.

---

## 6. Commands you can just run — no window needed

Verified against this machine/session. If a step below needs more than
one command or judgment about *what* to run, it's flagged "not a
one-liner" — start a debug window for those instead of memorizing a
fragile multi-step sequence.

**Git — status, commit, push:**
```bash
git status                              # what's dirty right now
git pull origin main --no-rebase        # get latest before starting
git add <files> && git commit -m "..."  # stage only what you mean to commit
git push origin main                    # if rejected: git pull origin main --no-rebase --no-edit, resolve conflicts, retry
git log --oneline -5                    # confirm what's on top
```
`git status` before *any* pull/merge — an uncommitted change (yours or an
agent's) will block a merge. Never `git reset`/`git checkout .` on a dirty
tree without checking `git status` first.

**Deploy the frontend:** nothing to run — `git push origin main` triggers
CI (Firebase Hosting: app + world1 + marketing). Confirm the Actions run
went green on GitHub (`gh` CLI is not installed on this machine — check
in the browser).

**Deploy the ML engine (HF Space):**
```bash
cd ml && HF_ORG=joinmindcraft ./scripts/deploy_hf.sh
```
Pushes `ml/` to the Space; first build ~10-15 min. Cloud Run is dormant
(GCP billing) — this is the only live deploy target for `ml/` right now.

**Check the ML engine is actually up:**
```bash
curl https://joinmindcraft-mindcraft-ml.hf.space/health
```
200 + JSON = healthy. If it's asleep (>48h idle), first request takes
~60s — retry once before assuming it's broken.

**Smoke-test a server-key endpoint** (needs the current secret):
```bash
SECRET=$(gcloud run services describe mindcraft-ml --region us-central1 \
  --format='value(spec.template.spec.containers[0].env)' \
  | grep -o "ML_SERVICE_SECRET[^;}]*" | sed "s/.*value': '//;s/'.*//")
curl -s -X POST https://joinmindcraft-mindcraft-ml.hf.space/recommend \
  -H "X-Service-Key: $SECRET" -H 'Content-Type: application/json' \
  -d '{"student_id":"<uid>","mode":"exam","target_concepts":[]}'
```

**Check GCP billing is still open** (this bit us once already):
```bash
gcloud billing projects describe mindcraft-93858
```
`billingEnabled: true` = fine. `false` = everything ML-adjacent is dead;
see CLAUDE.md `Known gotchas`.

**Local dev servers** (from CLAUDE.md — unchanged, listed here for
one-stop reference):
```bash
# ML
cd ml && source mindcraft/bin/activate && ML_AUTH_ENABLED=false FIRESTORE_PROJECT=mindcraft-93858 uvicorn serve:app --host 0.0.0.0 --port 8080
# Frontend
cd app && npm run dev        # http://localhost:5173
```

**App tests / typecheck** (run before trusting a merge or handing off):
```bash
cd app && npx tsc --noEmit && npx vitest run
```

**NOT a one-liner yet — needs a debug window:** Firestore/Storage rules
deploys. `webhook/scripts/deploy-rules.ts` exists but is a Vercel HTTP
handler (needs `FIREBASE_SERVICE_ACCOUNT` env + a running server + a
derived secret) — not a plain CLI invocation. This session did rules
deploys via raw Firebase Rules API calls (`gcloud auth print-access-token`
+ a Python script), which works but isn't memorizable. **TODO:** turn that
into a real local script (`webhook/scripts/deploy-firebase-rules.sh`) so
this becomes a genuine one-liner — worth a short build window.

---

**Debug-window reseed discipline:** it holds live system state + open
investigations *only*. When an investigation resolves, its conclusion goes
to CLAUDE.md (`Known gotchas` / `Current state`) or memory, and you reseed
the window fresh from that distilled state rather than carrying the whole
transcript. Long lifecycle, not immortal.
