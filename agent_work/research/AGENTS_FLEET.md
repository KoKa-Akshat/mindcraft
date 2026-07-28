# Research Lab Agent Fleet

Goal: grow the Constitution **day and night** with high signal-per-run — so MindCraft can lock **marketing language, product, positioning, growth, direction, future, and vision** on evidence, not vibes.

## Why ticks beat “one giant agent”

| Approach | Problem |
|----------|---------|
| One endless chat | Context rot, cost, stalls |
| Rewrite whole PDF every time | Waste |
| **One chapter per scheduled tick** | Compounding, reviewable, cheap |

## Fleet roles

| Agent | Cadence | Job |
|-------|---------|-----|
| **Researcher** | Most ticks | Write 1 evidence chapter from queue |
| **Red Team** | ~every 3rd tick | Kill weak claims in newest chapter |
| **Synthesizer** | ~every 8 researcher ticks | Merge/simplify core OS |

Implemented as **one Cursor Automation** with role rotation in the skill (hour/log heuristic). Optional: split into 2–3 automations later if needed.

## Required for cloud agents

Cloud automations check out git. They **cannot see untracked local files**.

Before enabling the schedule:

```bash
git add agent_work/research .cursor/skills/mindcraft-research-lab
git commit -m "Add MindCraft Research Lab OS and agent tick skill"
git push origin main
```

(Only when you explicitly want that commit.)

## Local vs cloud

| Mode | Use when |
|------|----------|
| **Cursor Automation (cron)** | Day/night unattended growth |
| **This chat + skill** | Interactive deep work |
| **`/loop` in Agents Window** | Short bursts while you watch |

## Efficiency knobs

- Default schedule: **every 3 hours** → 8 ticks/day ≈ 8 chapters or red-team passes/day peak
- Cap chapter size 1.2–2.5k words
- Never reread full Constitution in a tick
- Extended queue: `chapters/QUEUE_EXTENDED.md`

## Stop conditions

Pause the automation if:

1. PDF generation breaks repeatedly  
2. Citations start looking fabricated (Red Team emergency)  
3. Disk/PR noise from unattended commits (keep automations **no-auto-commit** unless you opt in)  

**Unsupervised fleet default:** each cloud tick commits + **`git push origin main`** for lab paths only (`agent_work/research`, `.cursor/skills/mindcraft-research-lab`).  
**Draft PRs = failed delivery** (that’s how progress looked stuck). Never open PRs for lab ticks. Never force-push. Never touch unrelated app code.
