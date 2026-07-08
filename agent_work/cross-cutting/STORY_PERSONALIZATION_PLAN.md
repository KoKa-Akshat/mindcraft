# STORY_PERSONALIZATION_PLAN.md

**Lane:** Engine (Part A, B — data; `ml/data/`) + Product (Part C — `app/**`)
**Author:** Fable 5 (Build window, 2026-07-08)
**Implementer:** Two sessions — one Engine, one Product. **Coordinate before starting Part C** (the Product task depends on the story_worlds JSON schema the Engine task defines).
**Status:** Open

This plan expands MindCraft's story library beyond the current 41 one-world-per-concept setup. Currently every student — regardless of background or interests — sees the same 41 stories (Harrison the navigator, Brahmagupta the astronomer, etc.). WORLD_VISION.md §4 Horizon 3 calls for personalization: the same 42 concepts expressed through a thousand different worlds. This plan builds the foundation: a taxonomy of story worlds and the minimal data + UI hook to make world preference a real concept.

**Read before working:**
- `WORLD_VISION.md` — the vision, especially §3 ("same 42 concepts, a thousand different worlds")
- `BRAND_BOOK.md` §5 (Maya), §10 (Katha sub-brand) — voice and tone rules
- `CLAUDE.md §Architecture` (concept ontology, question bank)
- `AGENTS_QUICKSTART.md` — lane ownership; Engine task (A, B) = `ml/data/`; Product task (C) = `app/`

---

## Background

`app/src/data/conceptStories.json` has 41 concept stories. They are a single curated set — historical and contemporary, all excellent, but **one** per concept. There is no way today to serve a different story for the same concept to a student who prefers a music context over a maritime context.

The 3D world at `worlds/world2/` is one physical world (Jesse, a boat, an ocean). The story personalization plan is the data-layer precursor to Horizon 3's procedural world — it defines the world vocabulary, seeds it with 15–20 authored worlds, and adds a student preference field so the UI can eventually pick from them.

This plan does NOT build procedural generation or a full world-picker UI. It builds:
- The world taxonomy JSON (`ml/data/story_worlds/story_worlds.json`) — the registry
- A source list for narrative research
- A `storyWorldId` preference field on the user doc and one surface in the app where it appears

---

## Part A — Story World Taxonomy (Lane: Engine, `ml/data/`)

### Output file

`ml/data/story_worlds/story_worlds.json`

### Schema

```json
{
  "_meta": {
    "version": "1.0",
    "created_at": "2026-07-08",
    "note": "Story world registry for STORY_PERSONALIZATION_PLAN. Each world defines a context that can wrap any of the 42 MindCraft concepts. Used by story generators and future personalization UI."
  },
  "worlds": [
    {
      "id": "music_production",
      "name": "Music Production Studio",
      "category": "career",
      "protagonist": "Aisha",
      "protagonist_bio": "16-year-old producer with a bedroom studio and a label deal on the table.",
      "setting": "A cramped bedroom studio in Atlanta, 2024. A laptop, a MIDI keyboard, and too many unfinished tracks.",
      "math_necessity": "Tracks don't release until the mix is right. Timing, pitch, and loudness are all math — Aisha needs algebra to finish what she started.",
      "tone": "urgent, contemporary, self-made",
      "concept_affinity": ["fractions_decimals", "ratios_proportions", "sequences_series", "exponent_rules", "functions_basics"],
      "sample_bridge": "Aisha's DAW shows the sample rate: 44,100 Hz. The track is dropping frames. She needs to find the compression ratio that keeps the file small without killing the highs.",
      "katha_voice_sample": "The master clock is drifting. Two tracks that were locked three hours ago are now sixteen milliseconds apart — barely audible, but the engineer's ear caught it, and the label meeting is Thursday."
    }
  ]
}
```

Field meanings:
- `id` — slug, kebab-case, used as `storyWorldId` in user doc
- `category` — `career` | `cultural` | `modern_youth`
- `protagonist_bio` — one sentence; gender-neutral or explicitly noted; students see only the basics (WORLD_VISION.md §4 "characters have full backstories but students see only the basics")
- `math_necessity` — why math is structurally required in this world (not "math is used here" — math is the only way out)
- `concept_affinity` — concept IDs this world maps most naturally to; a generator uses this to weight world selection
- `sample_bridge` — one concrete example of math-in-story for this world (the template for `questionBridge` in `questionContextFrames.json`)
- `katha_voice_sample` — one sentence in full Katha voice: person + place + problem, present tense, sensory (Brand Book §10)

### The 18 worlds to author

Author all 18 as `story_worlds.json` entries. The spec below gives the data for each; the implementer writes the JSON.

**Category: career (6 worlds)**

| id | name | protagonist | setting | math necessity | concept_affinity (top 3) |
|----|------|-------------|---------|----------------|--------------------------|
| `music_production` | Music Production Studio | Aisha, 16, Atlanta | Bedroom studio, 2024 | Beat ratios and decibel math determine if the track releases | `fractions_decimals`, `ratios_proportions`, `sequences_series` |
| `architecture_intern` | Architecture Firm | Marco, 17, Mexico City | Summer internship at an architecture office, 2025 | Structural loads and floor plans are geometry — one wrong calculation and the building permit is revoked | `area_volume`, `right_triangle_geometry`, `lines_angles` |
| `nursing_simulation` | Hospital Simulation Lab | Grace, 18, Manila | Nursing school simulation ward | Medication dosages are proportions — one decimal error is the difference between recovery and harm | `fractions_decimals`, `measurement_units`, `ratios_proportions` |
| `game_dev_studio` | Indie Game Studio | Kai, 16, Seattle | A two-person indie studio's cramped apartment office | Physics, collision detection, and scoring algorithms don't run without functions and algebra | `functions_basics`, `quadratic_equations`, `linear_equations` |
| `data_analyst_intern` | Data Analysis Desk | Priya, 17, Bangalore | Summer internship at a tech startup | Dashboards only show what the data actually says — and that requires statistics, not guessing | `descriptive_statistics`, `basic_probability`, `algebraic_manipulation` |
| `food_truck_finance` | Food Truck Business | Diego, 16, Los Angeles | A weekend food truck at a farmers market | Profit margins, pricing, and break-even points determine whether the truck stays open next week | `linear_equations`, `ratios_proportions`, `systems_of_linear_equations` |

**Category: cultural/folkloric (7 worlds)**

| id | name | protagonist | setting | math necessity | concept_affinity (top 3) |
|----|------|-------------|---------|----------------|--------------------------|
| `vedic_architect` | The Sulbasutras | Apala, 22, Vedic India (~800 BCE) | A sacrifice ground being laid out; the altar must be geometrically perfect | Vedic rope-stretching geometry requires exact right triangles and area calculations | `right_triangle_geometry`, `area_volume`, `triangles_congruence` |
| `house_of_wisdom` | House of Wisdom | Riyad, 20, Baghdad (~830 CE) | The great library; a student copying Al-Khwarizmi's manuscripts | Completing the square is not metaphor — al-Khwarizmi was literally completing a square to solve inheritance disputes | `quadratic_equations`, `algebraic_manipulation`, `factoring_polynomials` |
| `fibonacci_merchant` | The Merchant of Pisa | Leonardo, 19, Pisa (1202) | A trading house on the waterfront; ledgers full of Arabic numerals his competitors don't understand yet | Fibonacci's *Liber Abaci* opened European commerce — ratios and proportions are the language of trade | `ratios_proportions`, `fractions_decimals`, `sequences_series` |
| `maya_astronomer` | The Calendar Keepers | Maya, 16, Mesoamerica (~900 CE) | A stone observatory; the next Venus alignment must be calculated before the ceremony | The Maya calendar system requires base-20 arithmetic and sequential patterns — and the alignment cannot be off by a single day | `sequences_series`, `number_properties`, `basic_probability` |
| `west_african_drummer` | The Master Drummer | Kwame, 17, Ashanti Kingdom | A drumming academy in a royal court | Polyrhythms are living fractions — the master drummer teaches by counting, not by feeling | `fractions_decimals`, `order_of_operations`, `ratios_proportions` |
| `polynesian_navigator` | The Wayfinder | Hina, 18, Pacific Ocean (traditional era) | An outrigger canoe between islands; no instruments | Stars, swells, and wind are the map — but the math of bearing and distance determines whether the crew drinks water in three days or not at all | `right_triangle_geometry`, `trigonometry_basics`, `measurement_units` |
| `kente_weaver` | The Kente Loom | Adjoa, 15, Kumasi (contemporary) | A family weaving business; a new pattern commission from the palace | Every Kente pattern encodes sequence and symmetry — a broken pattern costs the family the commission | `sequences_series`, `geometric_transformations`, `ratios_proportions` |

**Category: modern_youth (5 worlds)**

| id | name | protagonist | setting | math necessity | concept_affinity (top 3) |
|----|------|-------------|---------|----------------|--------------------------|
| `track_athlete` | The Track | Jordan, 17, high school in Ohio | The school track; the state championships are in six weeks | Split times, pacing strategy, and VO2 max are all linear functions — the coach's plan only works if the math is right | `linear_equations`, `measurement_units`, `descriptive_statistics` |
| `dj_radio` | Behind the Decks | Zara, 16, Chicago | A community radio station's broadcast booth | Matching BPMs and key signatures requires fraction arithmetic; a bad transition clears the floor | `fractions_decimals`, `ratios_proportions`, `exponential_functions` |
| `content_creator` | The Analytics Desk | Bea, 16, internet | A bedroom with ring lights and three screens showing dashboards | Viral growth is exponential — and the gap between 10K and 100K followers is not arithmetic | `exponential_functions`, `descriptive_statistics`, `basic_probability` |
| `esports_team` | The Esports Roster | Remy, 17, online tournament | A LAN tournament in a hotel conference room | Draft strategy and expected value calculations determine who gets picked and who watches from the bench | `basic_probability`, `descriptive_statistics`, `systems_of_linear_equations` |
| `skatepark_design` | The Skatepark Project | Luca, 15, Barcelona | A vacant lot that the neighborhood is petitioning to convert into a skatepark | Ramp angles, surface area, and parabola curvature determine whether the design gets approved by the city | `area_volume`, `quadratic_equations`, `lines_angles` |

### Katha voice for each world

For each of the 18 worlds, include a `katha_voice_sample` in the JSON: one sentence in full Katha voice (see Brand Book §10). Rules:
- Present tense, sensory, specific
- One person, one crisis, one mathematical stake — implicit, never named
- ≤ 40 words
- No interface words ("concept", "practice", "level", "question")

Examples already in the table above for `music_production`. Author the remaining 17 before committing.

---

## Part B — Narrative Source List (Lane: Engine, reference only)

These sources are for future story authoring pipelines (when generating new concept-world story text via LLM). No code to write in this task — document the sources in `ml/data/story_worlds/narrative_sources.md` for the next story-generation build session.

**Public-domain sources of mathematical narrative:**

| Source | URL | What to extract | License |
|--------|-----|-----------------|---------|
| Project Gutenberg — *Liber Abaci* translation | gutenberg.org (search "Fibonacci Sigler") | Merchant puzzle framings using proportions and sequences | Public domain |
| NRICH (Cambridge) | nrich.maths.org | Rich contextual problems with full narrative setup; 1,000+ problems, CC-licensed | CC-BY-NC-SA |
| Underground Mathematics | undergroundmathematics.org | Concept-driven problems with historical context; algebra through calculus | Free for education |
| Math Through Stories (University of Cambridge) | — | Research papers on math narrative; contains worked examples | Academic |
| Brahmagupta's *Brahmasphutasiddhanta* (excerpts) | Various translations | Geometry and equation-solving problems in verse, 628 CE | Public domain |
| Al-Khwarizmi's *Kitab al-mukhtasar* (excerpts) | Various translations, e.g. Rosen translation at archive.org | Earliest algebra problems with real-world contexts | Public domain |
| Fibonacci's *Liber Abaci* (Sigler translation) | archive.org | Medieval merchant arithmetic puzzles | Translation copyright; original public domain |
| UKMT (UK Math Trust) problems | ukmt.org.uk | Competition problems with narrative framings | Free for non-commercial use |

**For story generation:** The story_generator pipeline at `ml/scripts/pipeline/story_generator.py` already samples 3 real questions before generating a story (ensuring setting compatibility). When expanding to multi-world generation, the same pipeline should be called with a `--world <world_id>` flag that sets the protagonist/setting from `story_worlds.json` rather than generating them from scratch.

---

## Part C — Product: Story World Preference (Lane: Product, `app/**`)

**Scope:** Minimal first-pass. One new field on the user doc. One surface in the UI where it appears. This is NOT a world-picker flow — it is the foundation that makes world-picker possible later.

**Do not build:** a full personalization wizard, a world-selection onboarding screen, or any generative story content. The world stories are static JSON for now. The preference field exists so the next Product build can use it.

### C1. Data model

New field on `users/{uid}`: `storyWorldId: string | null`. Default: `null` (means the current curated story set).

The app already reads `users/{uid}` for `diagnosticCompleted`, `practiceDrafts`, `tutorFocusConcepts`. Piggyback on the same Firestore listener already subscribed in `App.tsx` or `Practice.tsx` — no new listener needed.

### C2. Where it surfaces

One place: the **Profile / Settings** modal (or the gear icon on Dashboard, wherever settings currently live — check `app/src/pages/Dashboard.tsx` or nav). Add a "Story Style" row:

```
Story Style    [ Music Studio | Architecture | ···  Change ]
               Currently: Music Production Studio
```

A single `<select>` dropdown listing the 18 world names from `story_worlds.json` (import the JSON as a static asset — same pattern as `actOntologyCoverage.json`). On change, write to Firestore:

```typescript
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

await updateDoc(doc(db, 'users', uid), { storyWorldId: selectedWorldId });
```

This field is NOT in the server-authoritative protected set (`role`, `childId`, etc.) — the client can write it directly.

### C3. How it connects to story display (future-proofing, no build now)

The `questionContextFrames.json` currently has one `questionBridge` per concept. In a future pass, the bridge text will be world-aware: `questionBridge_music_production`, `questionBridge_vedic_architect`, etc. The `ConceptChapterPage` will check `storyWorldId` and fall back to the default bridge.

For now, `storyWorldId` is stored but not yet read by any story renderer. That's intentional — ship the preference hook first, build the renderer in a separate Product session once `story_worlds.json` has content.

### C4. Story worlds JSON as a static app asset

Copy `ml/data/story_worlds/story_worlds.json` → `app/src/data/storyWorlds.json` after the Engine task is done. The Product implementer can create a stub version with just `id` and `name` for the dropdown if the Engine task is not yet complete.

Stub format for the dropdown (enough to ship Part C without blocking on Part A):
```json
[
  { "id": "music_production", "name": "Music Production Studio" },
  { "id": "architecture_intern", "name": "Architecture Firm" },
  ...
]
```

---

## Implementation Order

**Engine task (Part A + B) comes first.** The Product task only needs the world ID list, which can be a stub — but the Engine implementer should author the full `story_worlds.json` before the Product implementer copies `storyWorlds.json` into `app/src/data/`.

**Engine session tasks:**
1. Create `ml/data/story_worlds/` directory
2. Author `story_worlds.json` with all 18 worlds (use the table in Part A above)
3. Author `narrative_sources.md`
4. Commit to `ml/data/story_worlds/`

**Product session tasks (after Engine, or in parallel with a stub):**
1. Copy/create `app/src/data/storyWorlds.json` (stub or full)
2. Add `storyWorldId` Firestore write to Profile/Settings UI
3. Add the "Story Style" row to the settings modal/page

---

## Files changed / created

```
ml/data/story_worlds/story_worlds.json        (new — Engine)
ml/data/story_worlds/narrative_sources.md     (new — Engine)
app/src/data/storyWorlds.json                 (new — Product, copy from Engine output or stub)
app/src/pages/Dashboard.tsx (or Profile page) (edit — Product: add storyWorldId select)
```

No `ml/**` Python changes. No Firestore rules changes (the field is not protected).
