# Field Book cook pipeline

Create Instance → hawk studio → append ACT-like book on Dashboard.

## Local demo (now)

1. **Ingest** — files + notes, each tagged with a prompt  
2. **Learning graph spine** — subject pick (ACT Math, Biology, Chemistry, History, Custom)  
3. **Chapters + MicroSim stubs** — one chapter per tagged source  
4. **Bind** — instance `kind: 'act'` opens as a moveable panel on the desk (same as ACT Prep)

Stored in `localStorage` (`deskOs.books`, `deskOs.instances`).

## Integrate next

| Layer | Source |
|-------|--------|
| Cross-subject intelligent textbooks / MicroSims | [McCreary case studies](https://dmccreary.github.io/intelligent-textbooks/case-studies/) · skills at [dmccreary.github.io](https://dmccreary.github.io/dmccreary/) |
| Math spine / verify / story wrap | `ml/scripts/pipeline/` · `ml/generation/` · `PIPELINE_MCQ_SPEC.md` |
| Ontology / pathfinder | `ml/data/5_level_ontology/` · `/recommend` |

Pattern: LLM owns language; deterministic spine owns structure (same MindCraft split). McCreary’s learning-graph + MicroSim library is the model for **non-math** subjects; MindCraft’s ontology + question pipeline stays the model for **ACT Math**.
