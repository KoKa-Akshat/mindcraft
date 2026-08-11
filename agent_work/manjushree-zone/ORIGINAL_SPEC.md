# MANJUSHREE ZONE — ORIGINAL SPEC (verbatim, saved as a durability safety net)

> This is the project owner's own full spec, saved here so it survives regardless of
> what happens to the Claude Code background agent that was building against it. If
> you're picking this up (Cursor or otherwise), this is the source of truth for scope —
> cross-reference against `HANDOFF_FOR_CURSOR.md` in this same directory for what's
> actually been built so far and what's next.

## Architecture decision already made (do not re-litigate)

`worlds/world2/` is a re-skinned third-party Three.js portfolio template (readme credits
"Ramen-Shop" by Jesse Zhou) — a pre-compiled, minified bundle with NO editable 3D source
in this repo, and all its text is pre-baked as `.ktx2` texture images, not dynamic text.
**Do not extend or touch `worlds/world2/`.** The project owner explicitly chose: build
this as a **new, standalone Three.js scene** — its own route in the real `app/` React
app (`app/src/manjushree/`), fully editable source, own GLTFLoader/DRACOLoader/KTX2Loader
setup, real dynamic HTML/DOM-based HUD (so text, graphs, and the learning summary can be
genuinely dynamic per student). `three` (v0.184.0) is already a dependency of
`app/package.json` but wasn't used anywhere in `app/src` before this — no new heavy
dependency needed, just the loader/controls sub-modules that ship inside the `three`
package itself (`three/examples/jsm/...`).

Trigger integration ("when the student says game and maths") was explicitly left to the
implementer's judgment — the project owner's own phrasing didn't map cleanly onto how the
app actually captures interests (First Spark is pre-auth/2D; the 3D dashboard is a
separate authenticated surface). Whatever real signal was found/used should be documented
in the handoff, not invented from nothing.

---

# MINDCRAFT: MANJUSHREE HIDDEN ACTION-MATH ZONE

You are the lead game engineer, technical artist, interaction designer, narrative designer, and mathematics-learning designer working inside the existing MindCraft repository.

Work end to end. Inspect the actual repository before making architectural decisions. Use parallel subagents for independent repository analysis, cultural and narrative review, mathematics validation, visual QA, and final code review.

When you have enough information to act, act. Do not repeatedly re-plan or ask questions that the repository can answer.

Before reporting that anything works, verify the claim using actual commands, tests, browser output, screenshots, or repository evidence from this session. Never describe an untested feature as complete.

Use the simplest architecture that works well. Do not introduce abstractions, frameworks, services, feature flags, compatibility layers, or defensive code for hypothetical future requirements.

---

## 1. THE OUTCOME

Safely synchronize the existing MindCraft repository and implement a playable browser-based vertical slice of a hidden action-math world titled:

### "THE SWORD OF WISDOM: THE FIRST CUT"

This world is unlocked or recommended for students whose interest profile includes:

- Action
- Adventure
- Fantasy
- Games
- Interactive mathematics

Do not make the world accessible only to students who are already strong at mathematics. It should motivate students who struggle with conventional practice.

The final result must be an integrated MindCraft experience, not a disconnected game prototype.

### Product outcome

Create an 8–12 minute playable 3D experience in which the student:

1. Enters a hidden portal from the existing MindCraft world or dashboard.
2. Arrives above the ancient lake that, according to the Manjushree legend, once covered Kathmandu Valley.
3. Sees a luminous lotus in the distance near the future location of Swayambhu.
4. Traverses toward the Chobhar ridge.
5. Activates "Wisdom Sight," causing the ridge's silhouette to transform into a coordinate plane and quadratic graph.
6. Solves spatial quadratic challenges to discover the correct locations and angle for the legendary cut.
7. Charges the Sword of Wisdom through mathematical understanding.
8. Performs a cinematic final strike.
9. Watches the ridge split and the water begin flowing through the gorge.
10. Receives a short MindCraft learning summary showing what concepts were demonstrated, where mistakes occurred, and what should be practiced next.

The game must communicate: "The sword creates force. Mathematics creates precision."

### Narrative foundation

Treat the following as a legend and communicate it respectfully:

- Kathmandu Valley was once imagined as a great lake.
- A luminous lotus appeared upon the water.
- Manjushree, the Bodhisattva associated with wisdom, saw the lotus.
- Manjushree cut the hill at Chobhar with the Sword of Wisdom.
- The water drained and the valley became habitable.
- The lotus is connected in the legend with Swayambhu.

Do not turn Manjushree into a generic Japanese samurai. The character may have the dramatic presence, responsiveness, camera language, and environmental scale of a premium mythological action game, but all designs must be original. Do not copy Black Myth: Wukong characters, armor, interfaces, animations, sound design, creatures, environments, or assets.

Use original Himalayan, Nepali, Newar, and Buddhist visual references carefully. Avoid combining unrelated Asian cultures into a generic fantasy aesthetic.

The sword should cut: Stone, Illusion, Darkness, Mathematical uncertainty. It should not be used for gore or violence against sacred beings. Do not portray Nagas, Buddhist figures, or local deities as evil monsters. If Nagas appear, they should be neutral guardians, guides, witnesses, or protectors.

### Core gameplay loop

EXPLORE → OBSERVE → REVEAL MATHEMATICAL STRUCTURE → ACT ON THE STRUCTURE → SEE THE WORLD RESPOND

Mathematics must occur in the environment. Avoid stopping the entire game to show a conventional white quiz card unless accessibility requires an alternate input mode.

#### Player controls

Minimum interactions: Walk/run, Camera control, Jump or traversal action if already supported, Wisdom Sight, Place mathematical markers, Sword focus/charge, Directional sword strike, Interact, Pause, Restart encounter. Provide keyboard and mouse controls. Preserve a reasonable path for tablet controls if the existing application supports tablets.

### First vertical-slice encounters

#### Encounter 1: The Shape Hidden in the Mountain

The student reaches an overlook. The Chobhar ridge is visible across the lake. Activating Wisdom Sight should: dim environmental colors, trace the ridge with a glowing quadratic curve, extend an x-axis across the waterline, extend a y-axis through the terrain, display only the minimum notation necessary, allow the student to move around while inspecting the graph.

Learning target: recognize that the ridge is modeled by a downward-opening parabola; connect the graph to a physical object; understand that the x-intercepts represent where the modeled ridge meets the reference ground or waterline.

Do not begin with a long explanation. Let the student inspect first, then give one concise line of guidance.

#### Encounter 2: Root Strike

Use a validated introductory quadratic such as: y = -0.5(x - 1)(x - 9). Roots: x = 1 and x = 9. Axis of symmetry: x = 5. Vertex: (5, 8).

The student must determine the two roots and place two strike markers on the ridge. Interaction options: aim and place markers directly on the x-axis; drag root markers along the terrain; select the correct factorization and then physically mark the resulting locations; use alternate keyboard input for accessibility.

When both markers are correct: the corresponding sections of rock illuminate, thin cracks begin moving inward, the sword receives its first Wisdom Charge, the player remains in the game world.

When incorrect: do not remove health, do not restart the encounter, show a brief environmental response indicating the strike point is unstable, surface a small amber "Common trap" label when the answer matches a known misconception. After one mistake, give a conceptual hint. After two mistakes, reveal a partial scaffold. After three mistakes, provide step-by-step assistance while still requiring the student to complete the final interaction.

Track misconceptions such as: confusing an x-intercept with the y-intercept; changing the signs of roots incorrectly; setting only one factor equal to zero; reading coordinates from the wrong scale; treating the coefficients inside factors as the roots without solving.

#### Encounter 3: The Line of Symmetry

The ridge remains locked because the sword must travel through its centerline. The student must identify the axis of symmetry. For the example above, the correct line is x = 5. The student should physically move or rotate a vertical beam until it passes through the center of the parabola.

When correct: the left and right sides of the mountain pulse symmetrically, the camera briefly shows their mirrored shapes, the sword receives its second Wisdom Charge, the game explains in one sentence that the axis divides the parabola into matching halves.

Track misconceptions such as: reporting the vertex instead of the axis; reporting y = 5 rather than x = 5; averaging the wrong values; using the incorrect sign in -b/(2a).

#### Encounter 4: Vertex Focus

The student must determine the vertex and use it to identify the highest point of the modeled ridge. For the example: Vertex = (5, 8). The player should: use the established axis x = 5; determine the corresponding y-value; aim the sword's focus reticle at the vertex; hold the focus action until the target locks.

When correct: a vertical line connects the waterline, axis, and vertex; the entire parabola becomes visible for a moment; the sword receives its third Wisdom Charge; the final attack becomes available.

Track misconceptions such as: providing only x = 5; treating the axis as the complete vertex; substituting incorrectly; confusing maximum value with the full ordered pair.

#### Encounter 5: The First Cut

1. Stand within the illuminated strike position.
2. Align with the axis of symmetry.
3. Lock onto the vertex.
4. Release the charged sword attack.

The animation should visually connect all solved information: root markers glow at the base, the symmetry line becomes the attack trajectory, the vertex becomes the focal point, cracks propagate according to the graph's structure, the ridge separates, water begins flowing through the new gorge.

The final cinematic should be brief, controllable, and skippable after the first viewing. Do not create a twenty-second non-interactive cutscene when five to eight seconds will communicate the transformation.

### Optional mastery encounter: Discriminant Sight

Include this only if the core sequence is stable. Present three possible sword trajectories represented by quadratics. The student determines whether each trajectory has two real intersections, one repeated intersection, or no real intersections. Positive discriminant: two visible contact points. Zero discriminant: one precise tangent contact. Negative discriminant: the projected strike never reaches the target plane. This should feel like tactical foresight, not another worksheet question.

### Post-level learning summary

After completion, return the student to a quiet overlook or MindCraft summary screen. Show: concepts demonstrated, correct answers, number and kind of hints used, misconceptions detected, one strength statement, one recommended next action, an option to replay at a harder difficulty.

Example: "You found both roots and used symmetry correctly. Substituting into the function took two attempts. Your next mission will strengthen vertex calculations."

Do not use childish praise or excessive confetti. The tone should be calm, premium, intelligent, and encouraging.

---

## 2. THE SOURCE MAP

### B. Canonical documentation

Inspect: CLAUDE.md, BRAND_BOOK.md, AGENT_RULEBOOK.md, DASHBOARD_NOTEBOOK_SPEC.md, ACTIVE_TASK.md, README files relevant to app and world code, package manifests, existing architecture documents, existing story-cell or world-design documentation. Do not create parallel documentation that duplicates a canonical source. Update the canonical source where appropriate.

### C. Existing world implementation

`worlds/world2` is locked (see architecture decision above). Reuse conceptual patterns instead: existing asset-loading/lazy-load conventions (`desmosLoader.ts`), existing overlay/interaction UI conventions (`ScratchPad.tsx`, `SessionCallCard.tsx`, `dashboardPersonalization.ts`), existing mobile/tablet behavior, existing performance protections (dynamic `import()` lazy-loading as used elsewhere). Do not add Unity, Unreal, Babylon, Phaser, or another game framework.

### D. Existing learning architecture

Resolve concepts to real ontology ids (`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`, e.g. `quadratic_equations`). Reuse the real misconception id pattern (`mis_{concept}__{slug}`). Reuse existing Firestore attempt-tracking shapes (`student_work`/`interactions`-style writes) rather than inventing a parallel schema. Prefer authored, validated static content; do not generate live quadratic questions with an LLM during gameplay.

### E. Brand and product experience

Premium and calm: deep green, charcoal, soft off-white, restrained accent colors (see `BRAND_BOOK.md` and `index.html`'s CSS custom properties for canonical tokens). Strong explanations, student confidence over punishment. The hidden world can go darker/more cinematic but must still read as a secret part of MindCraft, not a bolted-on separate product.

---

## 3. THE BOUNDARIES

### Technical boundaries

Use the existing frontend/backend/routing/asset/auth/data architecture (React Router route in `app/src/App.tsx`, `AuthGuard`-wrapped, Firestore for attempt tracking). No heavy dependency beyond `three` itself and its standard loader/controls sub-modules (they ship inside `three/examples/jsm/...`, not separate npm installs). Lazy-load the hidden world (dynamic `import()`) so the normal dashboard bundle is untouched. Target smooth operation on a normal modern laptop; degrade gracefully without WebGL2/when reduced-motion is preferred. Dispose all Three.js geometries/materials/textures/renderers on unmount — a real, common bug class, be rigorous. Preserve existing routes/flows; do not refactor unrelated systems or redesign the dashboard.

Suggested asset targets: lazy-loaded compressed package ≈15MB or less; individual GLB ≈3-5MB or less when practical; reuse textures/materials; Draco/KTX2 via standard `three/examples` loaders; given no Blender pipeline is available, prefer procedural/primitive geometry (displaced-plane terrain, shader or animated-plane water, a simple stylized sword mesh) over hand-modeled GLB assets you can't actually produce and verify — be honest about what's achievable with code-authored geometry/materials/lighting/fog/particles/camera work.

### Educational boundaries

Every required answer mathematically validated via real automated tests. No default timers (speed ≠ ability). No health loss / encounter restarts for wrong answers. Don't interrupt exploration constantly. Don't give the final answer after one error (1-hint / 2-scaffold / 3-full-assist ladder). Distractors must connect to known misconceptions, not be random. The visual graph must mathematically agree with the terrain — never fake the parabola for cinematic convenience.

### Cultural boundaries

Explicitly frame as inspired by a Nepali Buddhist legend. Manjushree is a figure of wisdom, not a generic combat avatar — avoid Japanese samurai armor, Chinese action-game art conventions, generic pan-Asian fantasy symbols. The sword symbolizes insight/precise action, never gore. Nagas/local deities, if present, are neutral guardians/guides, never disposable enemies. Frame as legend, not established scientific history. Include a cultural note + source list in the design doc. Favor understated/abstract representation over a specific guess you're not confident about.

### Scope boundaries

Required for this slice: one explorable environment, one traversal route, Wisdom Sight, three connected quadratic interactions (root strike, symmetry, vertex), one final environmental strike, one short transformation cinematic, one learning summary, telemetry, tests, documentation. Not required: large open world, inventory, skill tree, enemy combat, crafting, dialogue trees, multiple characters, multiplayer, procedural terrain, live AI-generated levels, voice acting, full mobile optimization, photorealistic assets. Discriminant Sight is optional, only if the core five-encounter sequence is solid.

---

## 4. THE PROOF STANDARD

**Repository proof**: current branch/commit, exact files created/modified, confirmation nothing destructive happened.

**Playability proof**: main app still starts, dashboard still loads, hidden entry point appears under its actual documented condition, 3D zone loads, player can move/control camera, Wisdom Sight activates, root markers placeable, correct/incorrect answers produce different responses, axis interaction works, vertex interaction works, final strike triggers only after prerequisites met, completion summary appears, replayable, returning to normal MindCraft works. Use real headless-browser checks where feasible; be explicit about what was only code-reviewed vs. actually executed.

**Mathematics proof**: automated tests for every included quadratic (equation, coefficients, roots, axis, vertex, discriminant, accepted answer formats, distractors, misconception mappings, visual coordinates). At least twelve authored, validated quadratic question instances across three difficulty levels. No irrational/complex roots in the intro route unless clearly marked advanced.

**Integration proof**: attempt data reaches the real learning pipeline via the repository's actual schema/endpoint. Capture student/session id, world/encounter/question id, concept ids, submitted answer, correctness, attempt number, response time, hint level, misconception id, relevant game state, timestamp. Verify the post-level recommendation can actually consume the resulting attempt state.

**UX proof**: screenshots of lake exploration, Wisdom Sight overlay, root-marker interaction, symmetry/vertex interaction, final ridge-cut moment, learning summary. Check clipping, unreadable text, hidden graph labels, camera collision, console errors, frozen loading states, unexplained controls, frame-rate collapse during the final effect.

**Accessibility proof**: keyboard controls + reference, reduced-motion behavior, text alternative for narrative lines, non-timed math mode, restart-encounter option, alternate equation-entry method, adequate contrast.

**Final report**: `agent_work/manjushree-zone/MANJUSHREE_ZONE_REPORT.md`, outcome-first: what was built, what was verified (and how), how to run/enter it, architecture, math content, data integration, performance results, accessibility behavior, known limitations, exact test commands + results, exact files changed, screenshot locations, remaining blockers.

---

## 5. THE COMPOUNDING STEP

Create in `agent_work/manjushree-zone/`: `SYNC_REPORT.md`, `MANJUSHREE_ZONE_DESIGN.md` (narrative synopsis, cultural framing + sources, environment map, player journey, gameplay loop, encounter sequence, HUD behavior, art/sound direction, accessibility, technical architecture, excluded decisions), `MANJUSHREE_MATH_CONTENT_SPEC.md` (concept mappings, question archetypes, validated question bank, misconception mappings, hint ladders, difficulty rules, visual-binding rules, testing method, rules for future questions), `MANJUSHREE_ASSET_MANIFEST.md` (per asset: name, source/how made, license, file type, size, format, loader, scene usage, optimization status), `LESSONS.md` (durable lessons only), `NEXT_RUN.md` (design, do not implement, "THE RIVER OF FUNCTIONS" next chapter + the six-chapter expansion arc sketch).

## Session-specific constraints

Product lane (`app/**`) plus content-only files under `agent_work/manjushree-zone/`. Stay out of `ml/**`/`data/**` runtime code (read-only reference to the ontology is fine). Zero em dashes anywhere. Do NOT commit or push — left uncommitted for review, verified independently (browser testing, direct checks, tsc/build) before anything ships, matching how every other feature was shipped this session. If running low on scope, prioritize a genuinely complete, tested, working vertical slice over full documentation depth — say so plainly if that tradeoff was made.
