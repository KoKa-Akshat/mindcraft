# McCreary Simulation Corpus: Scope and Buildable Handoff

**Date:** 2026-09-05
**Method:** every number below was produced by a command run against the local mirror at `/Volumes/SSK SSD/Developer/mindcraft/agent_work/product/archive_mirror/out`, the concept graphs at `/Volumes/SSK SSD/Developer/mindcraft/ml/data/dynamic_graphs/`, MindCraft's own library at `/Volumes/SSK SSD/Developer/mindcraft/library/sims/`, and Dan McCreary's live GitHub via `gh api`. Nothing is estimated. Anything not directly verified is marked "unverified".
**Builds on prior verified ground truth:** 113 repos mirrored, 4,741 sim directories, 4,144 p5-corpus `.js` files, pn-junction physics is genuine, public microsims repo is CC BY-NC-SA 4.0.

## Corrections to prior ground truth (verified this pass)

Two of the handed-down facts needed refinement:

1. **The mirror is NOT code-only.** Every one of the 113 repos carries three metadata files at its root: `manifest.json` (slug, source URL, fetch date, `sim_count`, `sim_errors`, attribution line, mirror kind), `sims.json` (per-sim slug, live page URL, live embed URL, local `main.html` path, local asset list, per-sim error), and `pages.jsonl` (the full textbook text of the site, page by page). Summed across all manifests: `sim_count` totals 4,741 and `sim_errors` totals 192, which exactly matches the 4,741 sim directories found on disk and the 192 completely empty sim directories (`find * -type d -path "*/sims/*" -empty`). The mirror already ships its own inventory and it is internally consistent. It remains true that there are no per-sim `index.md`, LICENSE, or metadata JSON files inside sim directories.
2. **License text IS present in the mirror**, inside `pages.jsonl` (the site footers and license pages were captured as text). 97 of 113 repos mention Creative Commons somewhere in their captured pages. Details in section 6.

Additionally, 3,199 of the 4,549 `main.html` files carry `<meta name="schema" content="https://dmccreary.github.io/intelligent-textbooks/ns/microsim/v1">`, so a majority of sims self-identify as MicroSims at the HTML level.

---

## 1. Inventory

Headline: **113 repos, 4,741 declared sims, of which 192 are empty directories (mirror fetch errors), leaving 4,549 sims with content on disk.** 4,144 have a `.js` file; the rest are `main.html`-only (script inlined in the HTML, common in the newest repos such as health-education). 11 repos have zero sims (metadata-only mirrors). Not everything counted as a "sim" is a teaching sim: 83 directories are the stock `graph-viewer` utility, 24 are `template`/`TODO` scaffolding, and 66 `.js` files are copies of the same stock "Learning Graph Viewer Script".

### The ten richest repos (eleventh included because of a tie)

| # | Repo | Sims | Subject | Shape |
|---|------|------|---------|-------|
| 1 | health-education | 389 | K-12 health, 7 grade bands | course (7 per-grade graphs exist) |
| 2 | geometry-course | 173 | geometry | course (720 chapter pages) |
| 3 | learning-record-store | 129 | xAPI / learning-record infrastructure | course |
| 4 | linear-algebra | 126 | linear algebra | course |
| 5 | calculus | 123 | calculus | course |
| 6 | computer-science | 121 | intro CS / Python | course |
| 7 | microsims | 115 | meta: the MicroSim pattern itself | grab bag (42 of 115 sims failed to mirror) |
| 8 | statistics-course | 111 | statistics | course |
| 9 | intro-to-physics-course | 104 | physics | course |
| 10 | modeling-healthcare-data | 100 | healthcare graph modeling | course |
| 10 | raspberry-pi-stem | 100 | Raspberry Pi / STEM electronics | course (tie) |

### Full inventory, all 113 repos

Sims = manifest `sim_count` (equals directory count). JS = `.js` files under sims. Err = `sim_errors` (empty dirs). Shape: "course" = sequenced chapters in `pages.jsonl` and/or a learning graph in `dynamic_graphs`; "grab bag" = collection without curriculum sequence; "broken" = most sims failed to mirror; "empty" = zero sims mirrored. Subject is read from the repo's own front page text in `pages.jsonl`.

| Repo | Sims | JS | Err | Subject | Shape |
|------|-----:|---:|----:|---------|-------|
| health-education | 389 | 244 | 0 | K-12 health education | course |
| geometry-course | 173 | 160 | 1 | geometry | course |
| learning-record-store | 129 | 112 | 0 | xAPI learning record store | course |
| linear-algebra | 126 | 126 | 0 | linear algebra | course |
| calculus | 123 | 121 | 0 | calculus | course |
| computer-science | 121 | 120 | 0 | intro CS / Python | course |
| microsims | 115 | 67 | 42 | MicroSim pattern showcase | grab bag |
| statistics-course | 111 | 110 | 0 | statistics | course |
| intro-to-physics-course | 104 | 101 | 0 | physics | course |
| modeling-healthcare-data | 100 | 97 | 1 | healthcare data modeling | course |
| raspberry-pi-stem | 100 | 97 | 0 | Raspberry Pi STEM | course |
| claude-skills | 96 | 70 | 2 | Claude / AI skills authoring | course |
| automating-instructional-design | 91 | 89 | 0 | AI instructional design | course |
| data-science-course | 90 | 23 | 3 | data science | course |
| biology | 89 | 90 | 3 | biology | course |
| ecology | 83 | 83 | 0 | ecology | course |
| ai-persona-testing | 82 | 82 | 0 | AI persona QA | course |
| beginning-electronics | 82 | 120 | 5 | hands-on electronics | course |
| economics-course | 81 | 78 | 0 | economics | course |
| infographics | 81 | 80 | 1 | infographic design | course |
| circuits | 77 | 34 | 7 | linear/AC circuit analysis | course |
| learning-graphs | 74 | 73 | 1 | learning graph theory | course |
| cybersecurity | 72 | 72 | 0 | cybersecurity | course |
| organizational-analytics | 72 | 69 | 1 | org analytics | course |
| theory-of-knowledge | 70 | 69 | 1 | IB theory of knowledge | course |
| it-management-graph | 65 | 61 | 0 | IT management | course |
| learning-sciences | 65 | 33 | 1 | learning sciences | course |
| fft-benchmarking | 62 | 61 | 0 | FFT / embedded DSP performance | course |
| public-health | 59 | 59 | 0 | public health | course |
| genetics | 58 | 58 | 0 | genetics | course |
| search-microsims | 58 | 56 | 0 | search/IR for microsims | course |
| bioinformatics | 56 | 54 | 1 | bioinformatics | course |
| atam | 52 | 34 | 0 | software architecture (ATAM) | course |
| quantum-computing | 52 | 51 | 1 | quantum computing | course |
| conversational-ai | 51 | 46 | 0 | conversational AI | course |
| pre-calc | 51 | 51 | 0 | pre-calculus | course |
| xapi-course | 50 | 49 | 1 | xAPI standard | course |
| chemistry | 47 | 43 | 3 | chemistry | course |
| robot-faces | 47 | 47 | 0 | kids robotics/CS | course |
| 3d-printing-course | 46 | 46 | 0 | 3D printing | course |
| context-graph | 46 | 45 | 1 | AI context graphs | course |
| forensic-science | 46 | 46 | 0 | forensic science | course |
| information-systems | 44 | 44 | 0 | information systems | course |
| token-efficiency | 44 | 44 | 0 | LLM token economics | course |
| moving-rainbow | 43 | 39 | 3 | LED strips / MicroPython | course |
| networking | 39 | 38 | 1 | computer networking | course |
| personal-finance | 38 | 33 | 1 | personal finance | course |
| graph-neural-networks-textbook | 37 | 36 | 0 | graph neural networks | course |
| us-history | 37 | 37 | 0 | US history | course |
| Digital-Transformation-with-AI-Spring-2026 | 36 | 33 | 1 | business AI transformation | course |
| inverting-the-impossible | 35 | 31 | 1 | innovation methods | course |
| blockchain | 34 | 34 | 0 | blockchain | course |
| intelligent-textbooks | 33 | 26 | 3 | building intelligent textbooks | course |
| us-geography | 33 | 32 | 0 | US geography | course |
| ai-strategy-for-education | 32 | 31 | 1 | AI strategy for schools | course |
| learning-python | 32 | 31 | 1 | Python | course |
| moss | 32 | 27 | 1 | bryology (moss) | course |
| signal-processing | 32 | 22 | 9 | signal processing | course |
| unicorns | 32 | 25 | 0 | playful data/modeling course | course |
| food-science | 31 | 25 | 0 | food science | course |
| hydroponics | 30 | 30 | 0 | hydroponics | course |
| functions | 29 | 29 | 1 | math functions | course |
| learning-micropython | 28 | 25 | 2 | MicroPython | course |
| reading-for-kindergarten | 26 | 42 | 1 | early literacy | course |
| stem-robots | 25 | 15 | 4 | robotics | course |
| us-government | 23 | 22 | 1 | US civics | course |
| Dementia | 21 | 26 | 0 | dementia care | course |
| english-language-arts | 21 | 17 | 0 | ELA | course |
| machine-learning-textbook | 18 | 0 | 18 | machine learning | broken (all 18 empty) |
| graph-algorithms | 17 | 1 | 15 | graph algorithms | broken |
| semiconductor-physics-course | 15 | 15 | 0 | semiconductor physics | course |
| algebra-1 | 14 | 14 | 0 | algebra 1 | course |
| ethics-course | 14 | 11 | 0 | ethics | course |
| learning-linux | 14 | 7 | 0 | Linux | course |
| systems-thinking | 14 | 8 | 4 | systems thinking | course |
| clocks-and-watches | 13 | 5 | 8 | horology STEM | grab bag, half broken |
| deep-learning-course | 12 | 8 | 2 | deep learning | course (small) |
| ee-microsims | 11 | 0 | 11 | EE microsims | broken (all 11 empty) |
| intro-to-graph | 9 | 7 | 0 | graph databases | course |
| digital-citizenship | 8 | 6 | 0 | digital citizenship | course |
| digital-electronics | 8 | 10 | 0 | digital logic | course |
| mccreary-heritage | 8 | 1 | 2 | family genealogy | grab bag (personal) |
| GED-Science-prep | 7 | 1 | 6 | GED science | broken |
| control-systems | 7 | 5 | 1 | control systems | course |
| graph-lms | 6 | 2 | 2 | LMS architecture | grab bag |
| psychology | 6 | 4 | 0 | psychology | course |
| agents-course | 5 | 2 | 2 | AI agents | grab bag (new) |
| clan-macquarrie | 5 | 0 | 0 | genealogy | grab bag (personal) |
| graph-data-modeling-course | 5 | 3 | 2 | graph data modeling | course |
| right-database | 5 | 0 | 0 | database selection | course |
| spectrum-analyzer | 5 | 5 | 0 | audio spectrum analyzer build | grab bag |
| neurodiversity-course | 4 | 2 | 1 | neurodiversity | course (small) |
| seizure-safe-schools | 4 | 1 | 0 | seizure safety | small |
| cmm-for-genai | 3 | 0 | 3 | GenAI maturity model | broken |
| fluid-power-systems | 3 | 1 | 1 | hydraulics/pneumatics | small |
| genai-arch-patterns | 3 | 0 | 3 | GenAI architecture | broken |
| prompt-class | 2 | 1 | 0 | prompt engineering | course |
| robot-day | 2 | 0 | 2 | robotics event | broken |
| tracking-ai-course | 2 | 0 | 2 | AI progress tracking | broken |
| ancient-history | 1 | 1 | 0 | ancient history | course, 1 sim |
| asl-book | 1 | 1 | 0 | American Sign Language | 1 sim |
| mini-mba-for-startups | 1 | 1 | 0 | startup business | 1 sim |
| Intelligent_Textbook | 0 | 0 | 0 | meta | empty |
| ai-racing-league | 0 | 0 | 0 | AI racing | empty |
| chatgpt-for-teachers | 0 | 0 | 0 | ChatGPT for teachers | empty |
| dakota-textbook | 0 | 0 | 0 | Dakota language | empty |
| graph-rag | 0 | 0 | 0 | graph RAG | empty |
| i-book-v1 | 0 | 0 | 0 | intelligent book v1 | empty |
| ir-textbook | 0 | 0 | 0 | information retrieval | empty |
| ojibwe-textbook | 0 | 0 | 0 | Ojibwe language | empty |
| stem-classroom-admin | 0 | 0 | 0 | STEM classroom admin | empty |
| trigonometric-functions | 0 | 0 | 0 | trigonometry | empty |
| umn-senior-design | 0 | 0 | 0 | UMN senior design | empty |

Notes on oddities, all verified: `biology` and `reading-for-kindergarten` have more `.js` files than sims because some sims ship helper libraries alongside the sketch (e.g. `beginning-electronics` ships `breadboard-lib.js` next to each breadboard sim, which is why it shows 120 js for 82 sims). `data-science-course` (23 js for 90 sims) and `health-education` (244 js for 389 sims) write many sims as self-contained `main.html` with inline script.

---

## 2. Structural conventions: can 4,144 sims be ingested programmatically?

**Short answer: the corpus splits cleanly into a 65% core that follows one strict template and can be handled programmatically, a 25% long tail of non-p5 sims in four other frameworks, and a 10% residue. Input controls are machine-discoverable for most of the core. Outputs are not machine-discoverable for any of it. That last sentence is the bad news and it is load-bearing: nothing in any convention tells you what a sim's result variables are.**

Evidence, from a single-pass scan of all 4,144 `.js` files plus close reads of 30+ files across 20+ repos (health-education, semiconductor-physics-course, ethics-course template, learning-record-store, modeling-healthcare-data, geometry-course, data-science-course, us-history, reading-for-kindergarten, quantum-computing, intro-to-physics-course, claude-skills, beginning-electronics, digital-electronics, microsims, linear-algebra, token-efficiency, ai-persona-testing, learning-graphs, circuits, fft-benchmarking, and others):

### 2a. The framework split (exact counts)

| Population | Files | Share |
|---|---:|---:|
| p5.js sketches (`createCanvas`) | 3,106 | 75.0% |
| ...of which follow the FULL standard template (`setup` + `drawHeight` + `controlHeight` + `updateCanvasSize` + `windowResized`) | 2,711 | 65.4% of all js, 87% of p5 |
| ...p5 but not full template (older/fixed-width/partial) | 405 | 9.8% |
| Non-p5: vis-network (concept/network maps) | 413 | 10.0% |
| Non-p5: Mermaid (flowchart/diagram sims) | 174 | 4.2% |
| Non-p5: Chart.js (chart sims, IIFE style) | 159 | 3.8% |
| Non-p5: d3 (4), cytoscape (1) | 5 | 0.1% |
| Non-p5: other/unknown (incl. 66 stock graph-viewer scripts, custom DOM sims) | 277 | 6.7% |

### 2b. The standard MicroSim template is real, strict, and stable across repos and time

Marker prevalence across all 4,144 js files: `canvasWidth` 3,001; `margin` 3,027; `windowResized` 2,993; `updateCanvasSize` 2,989; `drawHeight` 2,890; `controlHeight` 2,753; `describe()` accessibility call 2,425; `CANVAS_HEIGHT:` header comment 1,986 (plus 178 more in main.html); Bloom-level annotation comments 901; `defaultTextSize` 1,621; `sliderLeftMargin` 808; `containerWidth` 1,482.

The canonical layout, seen essentially verbatim from the oldest template (`ethics-course/sims/template/template.js`, the sine-wave demo) to the newest repos (health-education, claude-skills era 2026):

```js
let canvasWidth = 400;                       // responsive, updated from container
let drawHeight = 420;                        // drawing region
let controlHeight = 60;                      // control strip below drawing
let canvasHeight = drawHeight + controlHeight;
let margin = 25;
let containerWidth;                          // measured in updateCanvasSize()
function setup() {
  updateCanvasSize();
  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent(document.querySelector('main'));
  // controls created here, positioned at drawHeight + offset
  describe('...', LABEL);
}
function windowResized() { updateCanvasSize(); resizeCanvas(...); }
```

A one-per-repo random sample across all 94 repos that have js sims found the template in the overwhelming majority of p5 files, in old repos and new alike. Per-repo adherence among the biggest: health-education 243/244 (100%), computer-science 119/120 (99%), linear-algebra 124/126 (98%), calculus 118/121 (98%), intro-to-physics-course 96/101 (95%), statistics-course 102/110 (93%). Lower adherence repos are the ones that lean on other frameworks, not template drift: learning-record-store 31/112 (28%, heavy Chart.js/vis-network), modeling-healthcare-data 41/97 (42%, vis-network concept maps), beginning-electronics 58/120 (48%, the js count includes breadboard-lib helpers). Height is fixed per sim, width is responsive: this is uniform. 2,631 of the main.html files pin `p5@1.11.10` from jsdelivr; stragglers pin 1.9.4 through 1.11.13 (and exactly one p5@2.0.0). External libraries are CDN-referenced, not vendored (stated in each `manifest.json` mirror_kind and confirmed in main.html).

### 2c. Controls: consistent in style, machine-findable, but labeled only on canvas

Control usage across the corpus: `createButton` in 1,871 files, `createSlider` in 998, `createSelect` in 663, `createCheckbox` in 503, `createInput` in 140, `createRadio` in 29. Interactivity classes among the 3,106 p5 sims: 2,354 have DOM controls, 561 are mouse/touch-only (canvas hit-testing), 191 have no interaction found (static diagrams).

The slider idiom is highly consistent: **917 of the 998 slider files (92%) use the exact pattern `somethingSlider = createSlider(min, max, default, step)`** followed by `.position(sliderLeftMargin, drawHeight + n)` and `.size(...)`, with the current value read via `.value()` inside `draw()` on every frame. The variable name (e.g. `voltageSlider`, `amplitudeSlider`) is the ONLY semantic name a parameter has: slider labels are painted onto the canvas with `text()`, not attached in the DOM. Top-level declarations use `let`, so the names are not reachable as `window` properties at runtime; they are, however, trivially extractable from source with a regex at build time.

### 2d. Parameter exposure: the honest verdict

- **Inputs: YES, programmatically recoverable for the core.** A build-time source parse (regex for the `xSlider = createSlider(a,b,c,d)` idiom plus the select/checkbox/radio equivalents) recovers name, min, max, default, step for 92% of slider sims, and creation-order matching pairs them with live DOM elements at runtime. This was verified by pattern-count, not assumed.
- **Outputs: NO. There is no convention, none, in any era or repo.** Sims compute results in arbitrarily-named locals and paint them with `text()` and shapes. `pn-junction.js` holds its result in `appliedVoltage` plus curve arrays; the dice sim holds histogram state; the ALU sim holds `result`. No shared name, no getter, no event, no state object. Recovering outputs is per-sim comprehension work.
- **No sim posts messages.** Zero corpus sims speak any postMessage protocol (checked: `sim:ready` appears nowhere in the mirror corpus js).
- The `microsim-schema.json` in the public microsims repo (dublinCore/educational/search/technical/userInterface) is aspirational: no per-sim instance documents exist in the mirror, and the schema meta tag in 3,199 main.html files carries no per-sim data, only the namespace URL.

**Consequence:** ingestion-for-display is programmatic and cheap for everything (iframe the mirrored main.html). Ingestion-as-controllable-sims is programmatic for roughly 2,300+ p5 sims (inputs only). Ingestion-as-dataflow-nodes (inputs AND outputs, what Sim Studio chains) is per-sim work for every single sim. Plan around that three-tier reality.

---

## 3. The integration gap: wrapping the corpus for Sim Studio

Sim Studio's wire protocol (verified in `/Volumes/SSK SSD/Developer/mindcraft/agent_work/product/desk_os/js/simStudio.js`, the only protocol consumer in the repo):

- iframe -> host `{type:'sim:ready', inputs:[{id,label,min,max,step,default}], outputs:[{id,label,unit}]}`
- iframe -> host `{type:'sim:output', values:{outputId:number}}` on every change
- host -> iframe `{type:'sim:input', values:{inputId:number}}`
- host -> iframe `{type:'sim:highlight', inputId}` (optional)
- The host builds ports generically from whatever `sim:ready` declares, and already renders an honest "has no outputs" state for output-less nodes.

McCreary sims speak none of this (verified: zero `sim:ready` in the corpus, and also zero in MindCraft's own 722 library sims).

### What a shim must do

1. **Declare inputs.** Enumerate the sim's controls with names, ranges, defaults.
2. **Accept `sim:input`.** Set control values so the sketch reacts.
3. **Declare and emit outputs.** Name the computed quantities and post them continuously.
4. **Size honestly.** Fixed height (the `CANVAS_HEIGHT` comment where present, else `drawHeight + controlHeight` parsed from source), responsive width. The template already handles container resize.

Items 1, 2, 4 are generic for the template core. Item 3 is not generic for anything, per section 2d.

### Shim design (two parts, verified against the actual idioms)

**Build-time extractor** (runs once over the mirror, per sim):

```js
// extract-manifest.mjs: static parse of <slug>.js
// Matches the 92% idiom: voltageSlider = createSlider(-5, 0.75, 0, 0.05);
const SLIDER_RE = /(\w+?)(?:Slider)?\s*=\s*createSlider\(\s*([^)]*)\)/g;
// similar REs for createSelect/createCheckbox/createRadio + .option() calls
// emits per-sim manifest:
// { slug, inputs:[{id:'voltage', kind:'range', min:-5, max:0.75, default:0, step:0.05, order:0}],
//   buttons:[{id:'reset', order:1}], height: <CANVAS_HEIGHT|drawHeight+controlHeight>,
//   framework:'p5-template'|'p5-other'|'chartjs'|'vis-network'|'mermaid'|'other',
//   outputs: [] }   // ALWAYS empty at extraction time; see tier 2
```

**Runtime shim** (`mccreary-bridge.js`, injected into a rewritten main.html between the p5 script tag and the sketch script tag):

```js
(function () {
  const manifest = window.MC_SIM_MANIFEST;           // inlined by the rewriter
  const live = [];                                    // p5.Elements in creation order
  // p5 global-mode functions exist on window once p5 loads; wrap them so we
  // capture every control the sketch creates, in order:
  for (const fn of ['createSlider','createSelect','createCheckbox','createRadio','createButton']) {
    const orig = window[fn];
    window[fn] = function (...args) { const el = orig.apply(this, args); live.push({fn, el}); return el; };
  }
  window.addEventListener('load', () => setTimeout(() => {
    // pair manifest inputs to live controls by creation order + kind
    const inputs = pairByOrder(manifest.inputs, live);
    parent.postMessage({ type:'sim:ready', inputs, outputs: manifest.outputs }, '*');
  }, 50));
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m && m.type === 'sim:input' && m.values) {
      for (const [id, v] of Object.entries(m.values)) {
        const ctl = lookup(id); if (!ctl) continue;
        ctl.el.value(Number(v));       // template reads .value() every draw(),
        ctl.el.elt.dispatchEvent(new Event('input')); // so this takes effect next frame
      }
    }
  });
  // tier-2 hook: a per-sim adapter (hand- or LLM-authored) registers real outputs
  window.MC_EMIT = (values) => parent.postMessage({ type:'sim:output', values }, '*');
})();
```

Why monkey-patching instead of DOM scanning: the sketches declare controls with top-level `let`, so variable names are not on `window`; and slider labels live on the canvas, so the DOM carries no names. Creation-order pairing against the build-time manifest is the only naming path, and the 92% idiom makes it reliable for the core.

### One generic shim, or bespoke work per sim?

| Tier | What | Coverage | Cost |
|---|---|---|---|
| 0: display only | iframe the mirrored main.html as-is, no protocol. Already how the live `webhook/lib/handlers/microsims.ts` endpoint serves the corpus (its own header says 4,013 sims across 95 repos, built from an earlier snapshot; it fetches content from Dan's live GitHub at request time) | all 4,549 non-empty sims | zero per sim |
| 1: generic input shim | extractor + bridge above; sims become controllable, output-less nodes ("has no outputs" is already an honest host state) | ~2,354 p5 sims with DOM controls; high confidence for the 917 idiom-conforming slider sims; button-only sims get event triggers | one-time engineering, est. 2 to 4 focused agent-days incl. rewriter + tests (estimate, unverified); zero marginal per sim |
| 2: true dataflow node | per-sim output adapter: read the sketch, identify result variables, call `MC_EMIT` from `draw()` | any individual sim | per-sim comprehension + verification. With LLM assistance and the existing generation-gate rubric as verifier: minutes-to-tens-of-minutes per sim (estimate, unverified), and it must be reviewed, because a wrong output is worse than none |

**Honest per-sim bottom line:** there is no world in which all 4,144 become chainable nodes cheaply. Tier 2 across the whole corpus is months of agent time for mostly low-value nodes (a WWII timeline has no meaningful numeric outputs; neither do 413 vis-network concept maps or 174 Mermaid diagrams). Tier 2 is worth it only for a curated set, roughly 100 to 300 sims, chosen where a real physical quantity flows (electronics, physics, circuits, linear algebra, statistics). The vis-network/Mermaid/Chart.js populations should be treated as tier 0 forever.

Also note two operational facts for any hosting path: sims load p5/Chart.js/vis-network from CDNs (not vendored), and the mirror's `main.html` files contain relative back-links to lesson pages that will 404 outside the original sites. A rewriter pass has to handle both.

---

## 4. Concept coverage

Verified graph ground truth: 108 graph files, 28,631 concepts total (both numbers reproduced by command). Concept ids are `<subject>::<slug>` with per-concept `dependencies`, `taxonomy_id`, `level`. **45,565 dependency edges, and exactly zero cross subject-graph edges: the ontology is 108 silos.** That fact matters for both this section and section 5.

Repo-to-graph mapping: 108 graphs cover most repos, some under split names (health-education has 7 per-grade graphs; `dementia` covers `Dementia`). Repos with sims but NO matching graph include: microsims, search-microsims, learning-graphs (only utility sub-graphs), it-management-graph, graph-neural-networks-textbook, systems-thinking, signal-processing (only `__data`/`__docs` fragments), spectrum-analyzer, clocks-and-watches, machine-learning-textbook, graph-algorithms, ee-microsims, mccreary-heritage, moving-rainbow, agents-course, and the Digital-Transformation course. Conversely 12 graphs have no sim repo (classics like `darwin_origin_of_species`, `euclid_elements`).

### The semiconductor correction

The prior finding stands: `circuits.json` (300 concepts, "Circuits 1" v0.1.0) has no transistor, diode, semiconductor, motor, flyback, BJT, or PWM concepts. **But the branch is NOT missing from the ontology.** `semiconductor-physics-course.json` exists with 600 concepts and full depth: 26 diode concepts (including "Ideal Diode Equation"), 8 transistor, 24 MOSFET, 5 BJT, 8 depletion-region, 29 band-structure, 10 Fermi concepts, plus "P-N Junction" itself. `digital-electronics.json` (300) and `beginning-electronics.json` (500) cover the adjacent rungs. The real ontology defect is the zero cross-subject edges: `circuits::...` concepts cannot depend on `semiconductor-physics-course::diode-...` concepts, so the physical prerequisite chain exists as content but is unexpressed in the graph.

### Sims vs concepts, ten richest repos (plus tie)

Method (stated because it bounds the numbers): token Jaccard similarity between sim directory slug and concept slug+label, stopwords like "explorer/simulator/chart" removed. "Exact" is a full-token match; "strong" is similarity >= 0.5, hand-spot-checked as genuinely the same topic; "no match" is < 0.25, meaning no concept is even close. This is a heuristic; treat mid-range numbers as bands, not truths.

| Repo | Sims | Concepts in graph(s) | Exact | Strong match | Sims w/ NO concept | Concepts w/ a sim | Concepts w/ NO sim |
|---|---:|---:|---:|---:|---:|---:|---:|
| health-education | 389 | 609 (7 grade graphs) | 17 | 154 (40%) | 88 (23%) | 117 | 492 (81%) |
| geometry-course | 173 | 200 | 35 | 95 (55%) | 28 | 66 | 134 (67%) |
| learning-record-store | 129 | 578 | 13 | 50 (39%) | 33 | 49 | 529 (92%) |
| linear-algebra | 126 | 300 | 59 | 93 (74%) | 3 | 87 | 213 (71%) |
| calculus | 123 | 380 | 29 | 74 (60%) | 9 | 70 | 310 (82%) |
| computer-science | 121 | 400 | 23 | 61 (50%) | 11 | 58 | 342 (86%) |
| microsims | 115 | 600 (nearest: p5-textbook) | 0 | 5 (4%) | 73 | 5 | 595 |
| statistics-course | 111 | 300 | 29 | 71 (64%) | 9 | 62 | 238 (79%) |
| intro-to-physics-course | 104 | 200 | 25 | 51 (49%) | 23 | 49 | 151 (76%) |
| modeling-healthcare-data | 100 | 200 | 8 | 50 (50%) | 11 | 44 | 156 (78%) |
| raspberry-pi-stem | 100 | 531 | 15 | 66 (66%) | 8 | 65 | 466 (88%) |

Reading in both directions, plainly:

- **Sims with no concept:** in course-shaped repos, 40 to 74 percent of sims land on a real concept, because Dan generates sims from the same learning graphs the concepts come from. The gap cases are pedagogy sims (quizzes, workflows, rubric builders) and utility viewers. `microsims` (the showcase repo) aligns with nothing, as expected for a grab bag. Corpus-wide, most of the 4,549 sims will NOT auto-map: only the course repos with same-name graphs even have a candidate namespace, and the match needs the label-similarity path MindCraft already uses (`resolveConcept()` semantic search), not slug equality (exact slug matches are rare everywhere: 0 to 59 per repo).
- **Concepts with no sim: this is the dominant direction of mismatch.** Even in the best-covered repo (linear-algebra) 71% of concepts have no matching sim; typically 80 to 90 percent. The corpus decorates the concept graphs, it does not cover them. Any plan that assumes "a sim per concept from Dan's corpus" is off by roughly an order of magnitude.

---

## 5. The GPU path: verified file by file

Claim under test: a "how a GPU actually works" path exists from existing sims: semiconductor physics -> transistors -> logic gates -> circuits -> matrix multiplication -> serial vs parallel tradeoffs.

**Verdict: five of the six steps have real sims; the sixth does not exist, and two connective gaps mean the chain as claimed cannot be assembled from existing sims. The claim fails at the finish line.**

| Step | Status | Actual sims on disk (mirror paths) |
|---|---|---|
| 1. Semiconductor physics | SOLID | `semiconductor-physics-course/sims/`: 15 sims, all present, incl. `pn-junction` (Shockley equation verified previously), `energy-band-diagram-explorer`, `ek-band-structure-explorer`, `fermi-dirac-explorer`, `direct-indirect-bandgap-explorer`, `quantum-tunneling-explorer`, `density-of-states-explorer`, `intrinsic-concentration-temperature` |
| 2. Transistors | SOLID | `beginning-electronics/sims/`: `transistor-family-explorer`, `transistor-current-gain-explorer`, `transistor-switch-breadboard-demo`, `transistor-gate-explorer`, `transistor-motor-driver-explorer`, `transistor-and-or-logic-gates` (read: two NPNs in series = AND, in parallel = OR, with truth tables; genuine). Caveat: `ee-microsims/sims/mosfet-biasing` is an EMPTY directory (that whole repo failed to mirror, 11/11 errors), and `moving-rainbow/sims/transistor-circuit-diagrams` is a Mermaid diagram |
| 3. Logic gates | PRESENT, thin | `digital-electronics/sims/`: `single-logic-gate`, `logic-gates` (shared `logic-gate-lib.js`), `flip-flop`, `shift-register`, `binary-place-value`, `decimal-to-binary-stepper`; plus the step-2 bridge sim `transistor-and-or-logic-gates`. Note `microsims/sims/logic-gates` is an EMPTY directory (one of that repo's 42 fetch errors). The whole digital-logic rung is one 8-sim repo |
| 4. Circuits | PRESENT | `circuits/sims/`: 77 declared (7 empty), incl. `kirchhoffs-law`, `kvl-loop-walkthrough`, `kcl-node-viz`, `series-parallel-circuit`, `iv-characteristics`, and even `diode`. But this is a linear/AC analysis course; it supports steps 1-2, it is not a digital-circuits rung. Note the mismatch: the circuits REPO has a diode sim while the circuits GRAPH has no diode concept |
| 4.5 (unclaimed but needed): gates -> arithmetic -> datapath | MOSTLY MISSING | `microsims/sims/alu` exists and is real (A/B sliders, operation select, bit-box visualization). There is NO adder-built-from-gates sim, NO datapath sim, NO cache/memory-hierarchy teaching sim. Closest hardware-reality material is in `fft-benchmarking/sims/`: `register-tracer`, `instruction-encoding-bit-builder`, `branch-misprediction-visualizer`, `cycle-budget-calculator`, `pico2-memory-map-explorer`, `double-buffering-pipeline` (embedded/single-core flavored) |
| 5. Matrix multiplication | SOLID | `linear-algebra/sims/matrix-multiplication` (read: step-by-step row-by-column animation), `matrix-basic-ops`, `block-matrix` (tiling-adjacent), `matrix-inverse`, `matrix-rank-visualizer`; also `pre-calc/sims/matrix-multiplication` and `data-science-course/sims/matrix-multiplication-visualizer` |
| 6. Serial vs parallel COMPUTE | **BREAKS** | The only candidate, `token-efficiency/sims/serial-vs-parallel-tradeoff`, was read: it charts wall-clock time vs dollar cost of parallel LLM API calls (constants: $3/MTok input, $15/MTok output). It teaches batch-request economics, not hardware parallelism. `ai-persona-testing/sims/parallel-sequential-explorer` (read) is about organizational workflow patterns. Every electronics "series-parallel" sim is resistor topology. Corpus-wide grep for GPU finds only passing mentions (password-cracking cost, Moore's-law charts, `quantum-computing/sims/improvement-trajectories` plotting GPU FLOPS-per-dollar trend points). There is no Amdahl's-law sim, no core-scaling sim, no SIMD sim, no GPU-architecture sim, anywhere in 113 repos |

Two more chain-level facts:

- The ontology cannot express the path either: zero cross-subject dependency edges (section 4), so semiconductor -> circuits -> linear-algebra prerequisites do not exist as graph data.
- To make the claimed path real, roughly 4 to 6 new sims are needed (adder-from-gates, ALU-to-datapath, core-scaling/Amdahl explorer, SIMD/lane visualizer, CPU-vs-GPU matmul race), plus a hand-authored cross-subject sequence. The existing sims cover the first two-thirds well; whoever made the claim extrapolated the last third.

---

## 6. Licensing. Careful and plain.

**Nothing anywhere grants MindCraft commercial use. "Dan is our advisor" is a relationship, not a license. Every license statement that exists anywhere in this corpus is NonCommercial, and a large fraction of the repos have no license file at all, which is worse, not better.**

What was actually checked:

1. **Site text in the mirror** (`pages.jsonl`, all 113 repos): 97 repos mention Creative Commons. 84 state CC BY-NC-SA 4.0 outright. 9 more mention several CC variants because their pages discuss licensing as course content (microsims, search-microsims, claude-skills, infographics, intelligent-textbooks, 3d-printing-course, algebra-1, automating-instructional-design, token-efficiency); their own license pages, where fetched live, are BY-NC-SA. 3 mention CC without a variant (control-systems, ir-textbook, us-geography). 16 repos have no license mention in captured text at all (incl. Digital-Transformation, GED-Science-prep, moss, reading-for-kindergarten, inverting-the-impossible, seizure-safe-schools, and several empty mirrors).
2. **GitHub license files via `gh api`** (18 repos checked live, not assumed): only 4 of 18 have a license file. `microsims`, `geometry-course`, `modeling-healthcare-data`: `license.txt` saying "Attribution-NonCommercial 4.0 International" with `docs/license.md` (fetched) specifying CC BY-NC-SA 4.0 DEED. `semiconductor-physics-course`: `license.md` reading, verbatim, "All content is license under creative commons shareakile non-commercial" (sic). **14 of 18 checked repos have NO license file at all**, including 8 of the 10 richest: health-education, linear-algebra, calculus, computer-science, statistics-course, intro-to-physics-course, learning-record-store, raspberry-pi-stem (also moss, reading-for-kindergarten, GED-Science-prep, Digital-Transformation, inverting-the-impossible, seizure-safe-schools). A repo with no license file is all-rights-reserved by default; the only public grant for those is whatever the site footer says, which is BY-NC-SA where present.
3. **In-code license headers exist too:** `beginning-electronics/sims/*/breadboard-lib.js` carries "License: CC BY-NC-SA 4.0" in the file header.
4. **Every mirror `manifest.json` carries an attribution line** pointing at Dan's site, so the mirror itself acknowledges the source but confers nothing.
5. **Authorship is not 100% Dan.** Contributor checks via `gh api`: `beginning-electronics` and `semiconductor-physics-course` are dmccreary alone, but `microsims` has a second contributor (iowerx) and `linear-algebra` has another (ArtemisPearson). A grant from Dan covers only what Dan owns. (Extent of third-party contributions: unverified.)

What CC BY-NC-SA 4.0 means for MindCraft, concretely: no commercial use (a paid or ad-funded product is commercial), ShareAlike on any adaptations distributed under the CC path, attribution required, and the NC restriction cannot be waived retroactively by anyone except the rights holder granting a separate license.

**What must be obtained in writing before any commercial use:**

1. A signed license agreement (not an email emoji, not an advisory agreement clause unless it explicitly says this) from Dan McCreary granting MindCraft a non-exclusive, perpetual, worldwide, commercial license to the enumerated repositories (list them by name; include the no-license-file repos explicitly, since those currently grant nothing at all), covering use, modification, hosting, and distribution inside MindCraft products, with attribution terms agreed.
2. A representation that he holds the rights to grant it, plus handling for the known third-party contributors (microsims, linear-algebra at minimum: either their consent or exclusion of their contributions).
3. Ideally, resolution of the AI-generation question in the representation (much of this corpus is LLM-generated content published by Dan; his grant should warrant it is his to license). (Legal weight of this point: get real counsel; unverified.)

Until that document exists, the corpus can be used internally for evaluation and for non-commercial prototypes, and as inspiration/quality-bar reference (rubrics, template conventions, prompt patterns are ideas, not copied expression, but wholesale style copying should still wait for the grant). It cannot ship in the paid product. Do not let the live `microsims.ts` endpoint drift into a paid surface before the paper exists.

---

## 7. Recommendation, in order

1. **Get the license letter signed first, this month.** Everything else in this document is gated on section 6, and the ask is small: Dan is an advisor and plainly friendly to the project. Enumerate all 113 repos, name the two known third-party contributors, have counsel bless one page. If this cannot be obtained, stop here: build tooling, not on the corpus.
2. **Do NOT bulk-ingest 4,549 sims.** A third of the corpus is diagrams and concept maps (vis-network, Mermaid, Chart.js), a tenth is utility viewers and templates, and even the p5 core is 80% untethered from MindCraft's concept graphs by strict matching. Bulk ingestion buys a big number and a curation debt.
3. **Ship tier 0 deliberately where it already works.** The `microsims.ts` endpoint exists and serves the corpus for solo play. Curate shelves per subject from the course-shaped repos (the ten richest cover math, physics, stats, CS, health), map each shelf item to a concept via the existing `resolveConcept()` path with the correctable-chip UX the Sim Studio scope already recommends. This is days of curation, no new architecture, and (pending step 1) the first visible win.
4. **Build the tier-1 generic shim as one focused task** (extractor + bridge + rewriter + tests, section 3). It converts the ~2,300 control-bearing p5 sims into controllable nodes for near-zero marginal cost. Accept output-less nodes; the host already renders that honestly.
5. **Do tier 2 (real outputs) for a curated 100 to 300 only**, chosen by concept traffic and physical meaning: beginning-electronics, semiconductor-physics, circuits, intro-to-physics, linear-algebra, statistics first. Use the existing generation-gate rubric as the verifier for each adapter. Never do this corpus-wide; the value is not there.
6. **Build the GPU path as a flagship, but budget the missing rungs honestly:** reuse the verified step 1/2/3/5 sims, generate the 4 to 6 missing sims (adder-from-gates through CPU-vs-GPU matmul race) through MindCraft's own pipeline, which also sidesteps licensing for the new rungs, and hand-author the cross-subject sequence, because the ontology has zero cross-subject edges to lean on. That last fact is also a standing defect worth fixing in the graph layer regardless of this corpus.
7. **Steal the conventions, which are free.** The MicroSim template (fixed drawHeight + controlHeight, responsive width, describe() accessibility, CANVAS_HEIGHT header, Bloom annotations in 901 files, per-repo sims.json manifests) is a better standard than MindCraft's own 722 unannotated, protocol-less library sims follow today. Fold the template plus the `sim:ready` bridge into the generation prompt so every NEW MindCraft sim is born chainable and self-describing. The corpus's most valuable export is its discipline, not its files.
8. **Treat MindCraft's own library as the commercial spine.** 722 self-contained sims, concept-keyed by construction (`subject__concept.html`), owned outright, already wired to Learn. The McCreary corpus is the reference library next door: bigger (4,549 vs 722), deeper in physics and electronics, weaker in ownership and concept alignment. Grow the owned library toward the corpus's quality bar; borrow the corpus (post-grant) where a curated sim beats generating one.

## Appendix: what "verified" means here

Counts came from `find`/`grep -l | wc -l`/single-pass Python scans over the mirror; graph numbers from parsing all 108 JSONs; GitHub license and contributor facts from live `gh api` calls on 2026-09-05; protocol facts from reading `simStudio.js`; close reads covered 30+ sim files across 20+ repos including every file named in section 5. The two explicitly estimated figures (shim engineering days, per-sim adapter minutes) are marked unverified. The heuristic concept-matching thresholds in section 4 are stated inline.
