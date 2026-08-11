# MindCraft Canon — agent entrypoint

**Read this first when deciding product, copy, pedagogy, or vision.**  
Updated 2026-08-11 for **The Desk by MindCraft** + Research Constitution **v1.16**.

These are the living contracts. Prefer them over chat memory. Do not invent parallel brand/pedagogy docs elsewhere.

---

## Start here (order)

| # | Doc | Path | Owns |
|---|-----|------|------|
| 1 | **Why** | [`WORLD_VISION.md`](../../WORLD_VISION.md) | Math as a world; three horizons; what we are not |
| 2 | **Brand** | [`BRAND_BOOK.md`](../../BRAND_BOOK.md) | Voice, Maya/Jordan, vocabulary, anti-positioning · PDF: [`BRAND_BOOK.pdf`](../../BRAND_BOOK.pdf) |
| 3 | **Pedagogy** | [`PEDAGOGY.md`](./PEDAGOGY.md) | Research → product rules (SAFE-*, FEI, The Desk surfaces) |
| 4 | **Research OS** | [`agent_work/research/README.md`](../../agent_work/research/README.md) | Constitution + chapters + Red Team · PDF: `MINDCRAFT_RESEARCH_CONSTITUTION_v1.pdf` |
| 5 | **Product UI** | [`FABLE5_VISION.md`](../../FABLE5_VISION.md) | Design tokens / area briefs (Product lane) |
| 6 | **LLM contracts** | [`AGENT_RULEBOOK.md`](../../AGENT_RULEBOOK.md) | What agents can/cannot say or invent |
| 7 | **Dashboard paper** | [`DASHBOARD_NOTEBOOK_SPEC.md`](../../DASHBOARD_NOTEBOOK_SPEC.md) | Field Journal / notebook system |

Session logistics: [`CURSOR_HANDOFF.md`](../../CURSOR_HANDOFF.md) · ship log: [`ACTIVE_TASK.md`](../../ACTIVE_TASK.md) · full stack brief: [`CLAUDE.md`](../../CLAUDE.md).

---

## Product naming (binding)

| Surface | Name |
|---------|------|
| Company / publisher | **MindCraft** |
| Website product name | **The Desk by MindCraft** |
| App home-screen / in-app chrome | **The Desk** (no MindCraft logo mark) |
| Narrative layer | **Katha** (stories inside the system) |
| Student sections | **Notes · Solver · Map** |

---

## Research → product loop

1. Lab writes / Red-Teams chapters in `agent_work/research/chapters/`.
2. Synthesizer promotes survivors into Constitution I.4 company law.
3. **`docs/canon/PEDAGOGY.md`** translates survivors into shippable product rules.
4. Brand Book + website claim only what pedagogy + research can defend.
5. Agents implement features against these rules; experiments live in Constitution Part IX.

Regenerate research PDF:

```bash
python3 agent_work/research/generate_research_constitution.py
```

Regenerate brand book PDF:

```bash
python3 docs/canon/generate_brand_book.py
```

---

## Website

Public marketing: root [`index.html`](../../index.html) → https://joinmindcraft.com  
Claims must stay inside Brand Book + Pedagogy (no point guarantees, no streak-as-mastery, no “AI replaces tutors”).
