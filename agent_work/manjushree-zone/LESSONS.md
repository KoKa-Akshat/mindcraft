# Lessons (durable)

## The 2026-07-21 pivot from 3D to 2D illustration — why, and what it means

After the axis-of-symmetry pilot (rune stones, real reference-photo palette
tuning, Higgsfield textures), the project owner played the build again and
the visual style still wasn't landing — not a specific bug this time, a
category mismatch: the ask was always closer to a bright, painted, legible
2D mobile game (a tower-defense-style reference screenshot was shared) than
to an atmospheric 3D scene, no matter how much the 3D scene's lighting/bloom/
terrain improved. This is a real, recurring pattern worth naming: **iterating
on execution quality inside the wrong medium has a ceiling** — no amount of
post-processing polish on a Three.js scene make it read as "clean painted
mobile game," because the medium itself (real-time 3D geometry/lighting)
produces a different visual language than a hand-illustrated 2D scene, no
matter how good the code-driven lighting gets. When a stakeholder's
reference is a genre/medium (not just "make it prettier"), consider whether
the fix is a medium change, not another polish pass, before spending another
round on the same architecture.

The 3D engine, math validation, state machine, and telemetry underneath were
NOT the problem — all of that was preserved and reused. Only the rendering
layer changed. This is why the codebase already had a clean seam for it:
`math/quadratics.ts`, `math/content.ts`, `state.ts`, `telemetry.ts` have zero
rendering imports (no Three.js, no DOM, no React even, in the pure math/state
modules), so swapping the entire visual layer touched none of them beyond
one deliberate adaptation (state.ts's phase sequencing, see below) and
zero regressions in 53 pre-existing math tests (56 after adding 2D-mapping
tests, 57 after adding the vertex-height-candidates tests). Architecting a
game's "what's true" (math, state, scoring) separately from its "what it
looks like" (any rendering layer) is what made a same-night full-engine swap
possible at all without a rewrite from scratch.

19. **A pure module with no rendering imports survives a rendering-layer
    rewrite for free.** `state.ts`, `math/*.ts`, `telemetry.ts` never
    imported Three.js, DOM APIs, or even React. Swapping the entire visual
    layer (Three.js scene -> layered DOM/CSS/SVG) required zero changes to
    scoring, misconception detection, or the mastery-pipeline wiring, and
    only one deliberate, well-scoped adaptation to state.ts (folding
    axis-of-symmetry from its own gated Phase into a sub-step of the vertex
    phase, per the simplified loop). If you're not sure whether a module
    belongs in the "math/state" layer or the "rendering" layer, the test is:
    does it import anything from the rendering stack? If not, it's safe.

20. **A "shared mapping function" pattern survives a coordinate-space change,
    not just a technology change.** The 3D build's `mapping.ts` mapped graph
    space to Three.js world units so the ridge mesh and the Wisdom Sight
    overlay could never visually disagree (same function, two consumers).
    The 2D pivot changed the TARGET space (world units -> SVG viewBox
    percent) but kept the exact same principle: `graphXToPercent`/
    `graphYToPercent`/`curvePoints` are the one source of truth the SVG
    curve, the root tick-mark buttons, and the axis/vertex markers all read
    from. When a rendering technology changes, look for the pure mapping
    layer underneath it and adapt its OUTPUT UNITS rather than discarding
    the pattern.

21. **A static illustration can't be deformed per-question the way procedural
    geometry could -- name that tradeoff instead of quietly narrowing scope.**
    The 3D ridge mesh was LITERALLY shaped by `evaluate(q, x)` at every
    vertex, so the terrain and the answer key were pixel-identical by
    construction. A single generated hill illustration cannot bend its own
    silhouette to match every quadratic in the bank. The honest resolution:
    keep the SVG parabola curve as the actual mathematical authority (it is
    still sampled from the exact same `evaluate()`/`checkX()` functions that
    grade the student), and treat the illustration as mood/place-setting that
    the curve is drawn "over," not a silhouette the curve is required to
    trace exactly. Documented explicitly here and in `mapping.ts`'s own
    comments, rather than letting a future reader assume the curve and the
    art are bound the way they used to be.

22. **A curve sampled across a margin past the roots must be clamped to the
    physically sensible range, or it draws off in a way that reads as
    broken.** The 3D ridge used `Math.max(0, evaluate(q, x))` ("the rock only
    rises above the water between its roots"). The first 2D `curvePoints`
    implementation dropped that clamp and sampled the raw `evaluate()` value
    across the full `graphRange` margin (2.5 units past each root) -- since
    the parabola is negative outside its roots, this produced a curve that
    plunged steeply below the baseline and off the bottom of the visible
    overlay at both ends. On screen (mid-transition, with a fade-in) this
    looked exactly like scattered disconnected diagonal fragments, which was
    first misdiagnosed as an SVG animation bug before actually computing what
    the unclamped curve's shape should be at those sample points. Re-applying
    the same `Math.max(0, ...)` clamp fixed it immediately. Lesson: before
    debugging a rendering technique, verify the INPUT DATA to the renderer is
    what you think it is -- plot/compute a few sample values by hand.

23. **`stroke-dasharray`/`stroke-dashoffset` sized via the SVG `pathLength`
    override attribute breaks under non-uniform scaling.** Used twice in this
    pass (the Wisdom Sight curve reveal, the cinematic crack-line reveal) as
    a "self-drawing line" trick: `pathLength={1}` on the path plus
    `stroke-dasharray:1; stroke-dashoffset: 1 -> 0` in CSS. Both instances
    rendered as broken, disconnected line fragments instead of a continuous
    partial draw. Root cause (confirmed by screenshot, not just suspected):
    both SVGs use `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`
    stretched over a wide, non-square container (a 1280x800 game viewport
    over a 100x100 percent-space viewBox is roughly 12.8x horizontal scale
    vs 8x vertical) -- `pathLength`-normalized dash patterns do not render
    reliably under that kind of extreme non-uniform stretch in at least this
    Chromium build. Fix: drop the self-drawing dash technique entirely and
    use a plain CSS `opacity` fade-in instead. Less flashy, but it never
    silently breaks the same way. Rule of thumb: any "fancy" SVG stroke
    animation technique needs an actual screenshot check under the REAL
    aspect-ratio/scaling conditions it will ship in, not just a mental model
    of how the CSS should behave -- non-uniform scaling is exactly the kind
    of condition that breaks dasharray tricks in browser-specific ways.

24. **A "reveal the gap between two things" effect needs the revealed layer
    UNCLIPPED and BEHIND, not clipped to the same shape as what's moving.**
    The cinematic cut splits a single background image into two clip-path
    halves that translate apart, meant to reveal a turquoise "water" layer
    underneath in the gap. First attempt clipped the water layer to the
    SAME two polygon shapes as the image halves -- which meant the water was
    only ever visible where a half already covered that area, never in the
    NEW gap that opens once the halves move (a moving clip-path shape doesn't
    retroactively make a third region visible; the third region was never
    covered by either clip-path to begin with). Caught by an actual
    screenshot: the "water flows through" beat was invisible, just two
    slightly-shifted image halves with no gap effect. Fix: make the water a
    single full-bleed, unclipped layer placed BEHIND both image halves.
    Before the split, the two halves together cover 100% of the stage so the
    water is fully hidden (correct: no water should show before the cut).
    After the split, whatever region neither translated half now covers is,
    by definition, exactly the newly-opened gap, and the water underneath
    shows through there automatically -- no gap-shape geometry to compute at
    all. When an effect requires "whatever becomes uncovered," make it a
    static full-bleed layer behind the moving pieces, not a shape that tries
    to predict where the gap will be.

25. **A progress ring in the SAME hue family as the button it surrounds is
    invisible regardless of contrast ratio math.** The strike-charge hold
    ring used a gold stroke (`#ffe07a`) around a button that turns gold
    (`radial-gradient(..., #ffe07a)`) once actively held -- exactly the
    moment the ring most needs to be visible. Caught on a screenshot where
    the ring was essentially imperceptible despite technically having
    contrast against the page background elsewhere. Fixed by using a dark
    ink stroke (matching the UI's ink/charcoal token) instead of a color
    drawn from the same palette family as its own immediate surroundings.
    General check for any progress indicator drawn on or around an element
    that itself changes color on interaction: pick the indicator's color
    against the element's ACTIVE state, not its resting state.

26. **A background-removal (chroma-key) generation is not guaranteed to
    return the literal key color you asked for, and it can vignette.**
    Asked for "a solid uniform bright magenta background #FF00FF"; the
    actual generated background sampled at `(250, 20, 172)` -- close in hue
    but meaningfully different in the blue channel -- and darkened
    measurably toward the corners (a soft vignette the model added despite
    "no vignette" in the prompt). A naive key against pure `#FF00FF` left
    the vignetted corners semi-transparent-but-not-quite, which made a
    bounding-box crop return the FULL canvas instead of a tight crop around
    the character. Fix: always sample the actual delivered background color
    from the image itself (a corner or an edge strip) before choosing chroma
    key thresholds, and measure the real range of color-distance values
    across background vs subject pixels before picking low/high cutoffs --
    don't trust the prompt's stated color as the actual key.

27. **A generation model can bake in an entire unwanted background SCENE, not
    just a stray object.** Lesson 15 documented a model adding an unwanted
    decorative object (prayer flags) inside a texture. This pass hit the
    same failure mode at a larger scale: a character sprite prompt asking for
    "single character... on a solid uniform bright magenta background" came
    back with a full rectangular rice-terrace-and-river landscape scene
    behind the character, bordered by magenta -- charming alone, useless for
    keying (a rectangular photo inset isn't a clean silhouette cutout). Fix
    was the same class as Lesson 15: regenerate with an explicit, repeated
    anti-content clause ("isolated alone with absolutely no landscape or
    scenery or rectangular inset... nothing behind the character except
    plain flat magenta color reaching all the way to every edge") rather
    than trying to prompt-tune around it. One extra generation (the skill's
    own 2-attempt regen budget) fixed it completely on the second try.

1. **Save the spec to disk before launching a background agent.** Prompt-only specs die with the session. `ORIGINAL_SPEC.md` + `ACTIVE_TASK.md` top entry are the durability pattern.
2. **Uncommitted vertical slices are fragile.** A workspace root move / git reset wiped the Manjushree tree; restore came from Claude transcript Write/Edit ops + Cursor local history. Prefer a WIP branch or named stash before long agent runs.
3. **Bind visuals to the same pure function as the answer key.** `mapping.ts` shared by ridge and Wisdom Sight prevents "pretty but wrong" graphs.
4. **Reuse the real mastery pipe.** `recordOutcomes` + real ontology ingredient ids beat inventing a parallel analytics collection.
5. **`logEvent` → `events` is currently soft-fail under Firestore rules.** If telemetry must persist, add a rules match; do not assume silent success.
6. **Cultural framing belongs in the first screen the student sees**, not only in a design doc. This regressed once already: a later copy-tightening pass moved the full cultural note out of the intro and into the pause screen only, so a student who never pressed Esc would never see it. Caught by re-running the same Playwright assertion after every content pass, not by assuming prior verification still holds — any future copy edit to the intro overlay needs the same check.
7. **Dev harness (`/manjushree-dev` + `window.__mcZone` + `?q=`) is required** for a Three.js feature this size; AuthGuard alone is too slow for iteration.
8. **Low-segment primitives are the #1 tell of "fake 3D."** The original flank mountains were `ConeGeometry(r, h, 7, 3)` — only 7 radial facets, which reads as an obvious low-poly toy in silhouette against a bright sky (this was the single most visible complaint in the owner's "ugly and low level" verdict). Fix was cheap: raise segment count and displace vertices with fbm noise, no new asset pipeline needed. Rule of thumb: any silhouette-critical background geometry needs either high segment count + noise, or a deliberately stylized flat-shaded look chosen on purpose — never a low-segment primitive left at its default, which reads as "didn't finish" rather than "stylized."
9. **Bloom needs a genuine luminance threshold, not just "on."** `UnrealBloomPass` at threshold 0 blooms everything and looks like a Instagram soft-glow filter over the whole scene. Setting `luminanceThreshold` around 0.7 so only truly emissive elements (lotus, sight curve, markers, charge rings) glow reads as "these things are lit from within" instead of "the whole render is hazy." This is the difference between "premium" and "cheap" bloom.
10. **Real reference photography is useful even when you never touch the pixels.** WebFetch summaries of licensed Wikimedia Commons images (color, terrain, water tone described in words) were enough to retune a hand-authored palette and noise-based silhouette toward something that reads as an actual place, without any image import pipeline or licensing risk. When there's no texture pipeline, treat reference photos purely as a palette/shape brief for procedural code, and say so explicitly in the asset manifest rather than silently "not using photos."
11. **Verify post-processing costs before claiming it's fine.** A composer pass (bloom in particular) has a real per-frame GPU cost. A 180-frame `requestAnimationFrame` timing sample via Playwright (`avg frame ms`, `worst frame ms`) is a cheap, repeatable way to catch a regression instead of eyeballing "feels smooth." Measured 60fps average / 19ms worst frame with bloom active on this machine's headless ANGLE renderer; keep this check in the loop any time post-processing gets heavier.
12. **A screenshot taken for one purpose can reveal an unrelated bug.** Capturing the cinematic beat to check bloom/camera weight also caught a stale toast ("In position...") visually overlapping the letterboxed credo line — a pre-existing phase-transition gap (toasts weren't cleared entering `cinematic`) that had nothing to do with the visual makeover itself. Look at every verification screenshot for anything wrong, not just the thing you were checking for.
13. **A live numeric readout during a drag interaction is an answer-key leak, not a UX nicety.** The axis encounter showed "beam at x = -1.5" updating continuously while free-dragging — this lets a student converge on the right answer by trial-and-nudge with zero algebra, and reveals the exact mechanism (a coordinate) the concept is testing. The fix wasn't "hide the number and keep everything else" — it was removing the ability to search at all: the beam (Encounter 3, axis-of-symmetry) now doesn't exist until the student commits to a computed value via a small set of rune stones (candidate x-values, including real misconception traps like the vertex height read as the axis), and manifests with a reward animation ONLY on a correct commit. Test for this class of bug generically: "could a student solve this by staring at a live number and nudging it, with zero math?" — if yes, the mechanic itself needs to change, not just the label.
14. **Multiple-choice option values are not the same category of leak as a live readout.** Showing 4 candidate answers (e.g. `x = 4`, `x = 8`, `x = -4`, `x = 6`) is a normal, legitimate assessment format — the student still has to recognize/compute which one is right. Don't over-correct an answer-leak fix into hiding legitimate information; the distinguishing test is whether the UI reveals the CURRENT STATE of an in-progress guess (bad) vs. a fixed set of candidates to choose among (fine).
15. **A generation model can spontaneously bake in exactly the color accents you asked for, in the wrong place.** Asking for "sacred accents in Tibetan prayer-flag blue/white/red/green/yellow" in a rock TEXTURE prompt (a `seamless tileable surface texture of grey-green mountain rock...`) got a genuinely charming result — a garland of prayer flags draped across the rock — but a discrete object repeating diagonally across every tile reads as an obvious tiling artifact at ridge scale, not a decoration. Caught by actually tiling it 2×2 and looking, not by eyeballing the single generated square. Fix: regenerate with an explicit anti-object clause ("plain rock material only, no ropes, no flags, no banners, no embedded objects of any kind") rather than trying to prompt-tune around it — one extra generation (1 credit) was cheaper than fighting it in the same prompt.
16. **A single perspective photo does not become a 3D skybox by pasting it into the scene.** A gorgeous generated establishing shot (turquoise lake, twin peaks, prayer flags, golden hour) cannot correctly replace or wrap around an existing 360° procedural sky sphere — it has its own fixed camera composition that won't line up with the actual (per-quadratic, dynamically generated) ridge silhouette from other viewing angles, and doesn't tile as an equirectangular map. Used instead as a 2D CSS background on the victory/summary overlay, where no 3D alignment is required — the safer, more honest integration for a single non-tileable generated image. Don't force a generation-shaped asset into a use it wasn't shaped for just because it's exciting.
17. **Check the actual account/plan gating before planning generation work, not just CLI authentication.** `higgsfield account status` reporting credits available did not mean every model in `model list` would actually run — three of the skill's own suggested models (`nano_banana_flash`/"Nano Banana 2", `gpt_image_2`, `nano_banana`) all failed with `job_minimum_basic_plan_required` on this free-tier account, with the more common `nano_banana_flash` failure showing only a generic `"failed"` status (no reason) until a differently-gated model (`nano_banana` v1) surfaced the real error text. `seedream_v5_lite` worked at 1 credit/generation and became the de facto primary generator for this pass — a real substitution, not a guess, and worth checking with one cheap trial job (a disposable "red apple on white background" prompt) before committing a prompt/budget plan to a specific model.
18. **A game-generation skill's recommended texture pipeline assumes a REAL reference photo file on disk.** `references/textures.md`'s Phase 1 (`gpt_image_2` seamless-edit) is built around editing an existing image; with no downloaded reference file (only prose descriptions of 4 photos), the workable path was `stylization.md`'s plain text-to-image `texture` kind template, then still running the result through the SAME Phase 2/3 post-process (seam-fix, PBR maps, seam-ratio check, 2×2 tile inspection) for the tiling guarantee. The reference-photo-editing pipeline and the pure-generation pipeline converge at Phase 2 — entering at the right phase for what you actually have (a description vs. a file) matters more than following Phase 1 by rote.
