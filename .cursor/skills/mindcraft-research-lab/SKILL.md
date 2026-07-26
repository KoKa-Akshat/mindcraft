---
name: mindcraft-research-lab
description: >-
  Run one efficient MindCraft Research Constitution lab tick: write or Red-Team
  one evidence chapter, update the manifest/log, regenerate the PDF. Use when
  expanding the Research Constitution, running scheduled research agents, or
  when NEXT_LAB / research lab work is requested.
---

# MindCraft Research Lab — One Tick

You are a Research Lab agent. **One tick = one shippable increment. Stop after one increment.**

## Why this lab exists (do not forget)

This research is **not** a dissertation. It exists to sharpen MindCraft’s:

- marketing language and claims we can defend  
- product decisions and North Star metrics  
- positioning vs Khan / Duo / Brilliant / GPT tutors  
- growth loops (what to instrument and sell)  
- company direction, future bets, and vision  

Every chapter must end with **so what for MindCraft commercially** — copy, feature, metric, or kill. Pure theory without a product/positioning implication is incomplete.

## Efficiency rules (non-negotiable)

1. **Do not reread the entire Constitution.** Read only:
   - `agent_work/research/NEXT_LAB.md`
   - `agent_work/research/RESEARCH_LOG.md` (newest 40 lines)
   - `agent_work/research/CHAPTER_MANIFEST.txt`
   - the **previous** chapter file if continuing a thread
2. Prefer **web search for citations** over inventing references. Never fabricate DOIs/papers.
3. Label every claim: **FACT / HYPOTHESIS / FOUNDER BELIEF / SPECULATION**.
4. Include: supporting evidence, contradicting evidence, confidence, product implication, experiment IDs.
5. **No fluff.** Target 1,200–2,500 words per new chapter. Quality ≫ length.
6. After writing: update manifest, core OS chapter table (brief), RESEARCH_LOG, NEXT_LAB checkoffs, run `python3 agent_work/research/generate_research_constitution.py`.
7. Commit/push **only** when the invoking prompt says unsupervised/automation mode; then commit solely `agent_work/research` + `.cursor/skills/mindcraft-research-lab` (never force-push, never secrets).
8. Do **not** edit unrelated app code.

## Tick types (pick one)

### A — Researcher (default)

1. Take the highest unfinished chapter ID in `NEXT_LAB.md`.
2. Create `agent_work/research/chapters/NN_slug.md` as `Part Roman — Title`.
3. Answer for each major claim: what / why / human need / generalize? / 30yr? / AI? / MindCraft change? / experiment?
4. Append to `CHAPTER_MANIFEST.txt`.
5. Log in `RESEARCH_LOG.md`. Mark DONE in `NEXT_LAB.md`.
6. If the queue is empty, invent the next 3 evidence-dense chapter stubs into `NEXT_LAB.md` **then** write one (identity, motivation, learning science, markets, AI trust, equity — not marketing fluff).

### B — Red Team

1. Open the newest chapter.
2. Attempt to kill its weakest claim.
3. Update that chapter’s confidence / contradictions.
4. Log kill / wounded / survives in `RESEARCH_LOG.md`.
5. Do not write a new chapter this tick.

### C — Synthesizer (every ~8 researcher ticks)

1. Merge duplicate frameworks in the core OS.
2. Remove weak arguments.
3. Refresh Executive Summary with only surviving doctrine.
4. Regenerate PDF.

## Rotation heuristic

- If hour UTC % 3 == 0 → Red Team  
- Else if RESEARCH_LOG has ≥8 researcher entries since last synthesizer → Synthesizer  
- Else → Researcher  

## Done criteria

Tick is done when: new or revised markdown exists, log updated, PDF regenerated (or explicit note why PDF failed), and you stopped.
