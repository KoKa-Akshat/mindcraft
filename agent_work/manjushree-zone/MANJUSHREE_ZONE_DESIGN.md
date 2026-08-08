# Manjushree Zone — design

## Narrative synopsis

Kathmandu Valley is a lake. A luminous lotus waits across the water. The player is framed as Manjushree carrying the Sword of Wisdom: the cut is precision, not force. Wisdom Sight reveals that the Chobhar ridge is a downward parabola. Finding roots, axis, and vertex charges the cut that opens the ridge so water can move.

## Cultural framing + sources

Explicit in-product note (`CULTURAL_NOTE` in `math/content.ts`): inspired by a Nepali Buddhist legend (lake-valley, lotus, Chobhar cut, Swayambhu memory). Framed as legend, not history. Sword cuts stone / illusion / uncertainty — never living beings.

Sources to cite in any public write-up (not loaded at runtime):
- Traditional Newar / Kathmandu Valley origin legends associated with Manjushri and the draining of the lake
- Swayambhu / Swayambhunath lotus association in local tradition
- Chobhar gorge as the geographic counterpart in the legend

Avoid: Japanese samurai armor, Black Myth: Wukong pastiche, gore, portraying Nagas or deities as enemies. Current slice uses abstract procedural terrain and no deity combatants.

## Environment map

- Lake water plane + procedural path/overlook terrain (`engine/world.ts`)
- Ridge silhouette = max(0, parabola) in world units (`math/mapping.ts`)
- Lotus light across the water (directional cue)
- Strike circle appears only after three charges

## Player journey

1. Intro card (cultural note + Enter / Not now)
2. Explore to overlook (`reachPlatform`)
3. Wisdom Sight (F) → parabola reveal
4. Roots: place two waterline markers (or type)
5. Axis: move symmetry beam (Q/E)
6. Vertex: typed/held focus on peak
7. Strike: hold Space in circle
8. Short cinematic cut
9. Learning summary + optional Discriminant Sight practice arcs

## Gameplay loop / encounters

See `state.ts` phase machine: `intro → explore → sight → roots → axis → vertex → (discriminant?) → strike → cinematic → summary`.

Hint ladder: 1 hint / 2 scaffold / 3 full assist (`ZoneSession`). Wrong answers do not cost health or restart the encounter.

## HUD

Chrome title, objective line, charges, Wisdom Sight toggle, pause, toast feedback, typed-entry drawer, trap/misconception label, controls reference on pause.

## Art / sound

Code-authored geometry, fog, water plane, particle pulse on solves. No licensed GLB pack in this slice. No voice acting.

## Accessibility

Keyboard-first controls, typed math path, restart trial (R), reduced-motion flag into engine, non-timed answers, cultural note as readable text (not image-only).

## Technical architecture

Lazy React route → `ZoneEngine` owns WebGL lifecycle and dispose-on-unmount. Pure math modules are unit-tested without Three.js. Telemetry dual-writes soft events + hard mastery outcomes.

## Excluded (out of scope this slice)

Open world, inventory, combat AI, dialogue trees, multiplayer, photoreal assets, mobile-first polish, live LLM level gen.
