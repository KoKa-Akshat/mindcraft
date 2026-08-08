# Field Book cook pipeline

Modular extract → tag → generate → bind. Prototype-only under `agent_work/product/desk_os/`.

## Modules

| Stage | File | Job |
|-------|------|-----|
| Extract | `js/pipeline/extract.js` | Text / signals from notes, seeds, files |
| Tag | `js/pipeline/tag.js` | Subject, concept hints, interaction intent |
| Generate | `js/pipeline/generate.js` | Chapters + playable `pages[]` + HTML fallback |
| Run | `js/pipeline/run.js` | Orchestrates stages → `{ book, inst }` |
| Studio UI | `js/createBook.js` | Hawk cook UI · calls `runBookPipeline` |
| Player | `js/bookPlayer.js` | Cover → pages → piano / MCQ / quiz / action |

## Seed instances (hub)

| Instance | Seed | Engagement |
|----------|------|------------|
| `act-fieldbook` | `data/actSeed.json` | Read + MCQ · optional `/try/diagnostic` |
| `piano-book` | `data/pianoSeed.json` | Read + Web Audio keyboard drills |

Stored in `localStorage` (`deskOs.books`, `deskOs.instances`, `deskOs.bookProgress`).

## Local demo

```bash
cd agent_work/product/desk_os && python3 -m http.server 5180
# optional for ACT live diagnosis page inside the book:
cd app && npm run dev
```

Open `http://localhost:5180/?v=r9a`.

## Integrate later (not this phase)

| Layer | Source |
|-------|--------|
| Cross-subject intelligent textbooks / MicroSims | [McCreary case studies](https://dmccreary.github.io/intelligent-textbooks/case-studies/) |
| Math spine / verify / story wrap | `ml/scripts/pipeline/` · `ml/generation/` |
| Ontology / pathfinder | `ml/data/5_level_ontology/` · `/recommend` |
| Cloud / Firebase / HF | Owner lane · do not ship from Desk OS |

Pattern: LLM owns language; deterministic spine owns structure.
