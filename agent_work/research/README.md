# MindCraft Research Lab

This folder is the company’s **research operating system**, not a marketing archive.

It is an ongoing multi-month evidence program. The Constitution is expected to grow
toward 150–300 pages of densified truth — **never padded**.

## Canonical artifacts

| File | Role |
|------|------|
| `MINDCRAFT_RESEARCH_CONSTITUTION_v1.md` | Core OS (exec summary, doctrine, Red Team) |
| `chapters/*.md` | Deep-dive evidence briefs (mounted via manifest) |
| `CHAPTER_MANIFEST.txt` | Ordered list of files concatenated into the PDF |
| `MINDCRAFT_RESEARCH_CONSTITUTION_v1.pdf` | Shareable PDF (regenerate after edits) |
| `RESEARCH_LOG.md` | Chronological discoveries, failed hypotheses, Red Team kills |
| `generate_research_constitution.py` | Rebuild PDF from manifest |

## Epistemic labels (mandatory)

- **FACT** — empirically established with citable evidence
- **HYPOTHESIS** — testable, not yet settled
- **FOUNDER BELIEF** — Akshat/Blake prior; challengeable
- **SPECULATION** — useful imagination; lowest confidence

## How the lab works

1. **Chief Research Officer** owns coherence across chapters.
2. **Specialists** deepen chapters (psych, games, history, AI, markets).
3. **Red Team** exists only to destroy weak arguments.
4. Nothing graduates into product strategy without: evidence, contradiction, confidence, experiment design.
5. New deep dives = new `chapters/NN_title.md` + one line in `CHAPTER_MANIFEST.txt`.

## Regenerate PDF

```bash
cd agent_work/research
python3 generate_research_constitution.py
```

Requires: `pip install reportlab`

## Versioning rule

Prefer rewriting a weak chapter over padding pages.
Quality bar > page count. Target growth: denser truth, not longer fluff.
