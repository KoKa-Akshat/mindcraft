# MindCraft World Story Bible v1

**Status:** draft for canon review, produced 2026-09-05 under `docs/canon/STORY_DIRECTOR.md` (First assignment).
**Scope:** Volume I, The House Wakes, fully developed, centered on the opening vertical slice **The Garden That Forgot Spring** (15 to 25 minutes), plus a scoped roadmap for the next three missions.
**Companion file:** `docs/canon/story_bible/CONTINUITY_LEDGER.md`. Query it before writing new content. Update it after approved content. Never retcon silently.

**Grounding sources actually consulted before writing:**

| Source | What it constrains here |
|---|---|
| `docs/canon/STORY_DIRECTOR.md` | World bible, cast, rubrics, output contract, first-assignment beat list |
| `AGENT_RULEBOOK.md` §1.7 | The pathfinder IS the quest line; narrative never grants mastery; world state in Firestore `world_state/{uid}`; feature flagged "do not build yet" |
| `ml/data/ontology.json` (v0.2-pilot15) | The live concept ID space every target concept below resolves into |
| `ml/mindcraft_graph/models/concept.py` | Shape of a concept record; canonical ID registry semantics |
| `agent_work/research/RESEARCH_HANDOFF_SUMMARY.md` | SAFE-STORYLOAD, SAFE-COLD, SAFE-PF, SAFE-GENQ, SAFE-COVER; Founder Question #4; Open Problem #6 |
| `WORLD_VISION.md` | Voice, "no red X, the world responds honestly," worlds/world2 and Roblox as two skins on one graph |
| `BRAND_BOOK.md` | Katha sub-brand rules, naming canon, anti-shame voice |
| `worlds/world2/` and `app/src/world/MindCraftWorldScene.tsx` | World-object reuse check (findings in Appendix A, gate 4) |

**Engine authority note, stated once and binding throughout:** every Shard, capability, branch lighting, and unlock in this document is a *narration* of an evidence event the deterministic engine has already recorded. Katha, Maya, Piko, and every other character are the aesthetic voice. They never sequence concepts, never grade, never grant. Where this document says "the shard is minted," read "the engine verified the evidence set and emitted the mastery event, and the story layer then dressed it."

---

## 1. One-sentence promise

In a world that forgot why things happen, you are the one who still asks, and the first garden you wake will prove that understanding is not something you are given, it is something you can hold.

## 2. Emotional premise

Volume I is about waking something gently, and being woken in return.

The player arrives in a house that has been holding its breath. Nothing here is dead: the tree is unlit, the clock is stopped, the garden is grey, the little machine under the workbench is unfinished. The volume's emotional engine is the difference between *empty* and *not yet*, felt from the inside. A new student's map is all fog, and every product instinct MindCraft has says: that is not shame, that is terrain. Volume I makes that sentence physical. The player is never behind. The world is behind, and the player is the one thing in it that can catch it up.

The secondary current is company: Piko imprinting like a duckling made of copper, Maya arriving with forty measurements and no reasons, Katha performing delight to cover fear. By the end of the volume the player should feel that the House is *theirs*, that grey is the shape of what they get to do next, and that something large and quiet is waiting past the fog, some of it wonderful and one piece of it, the grey seal on the gate, faintly wrong.

## 3. Region state before the player arrives

**The Commons, before Day 0.** All of this is established state, recorded in the ledger as REG-COMMONS-BEFORE.

The House at the Edge stands at the last hedge before the fog, and it has been almost, not quite, asleep. Its clock stopped at some hour nobody remembers. Dust lies in drifts on the Desk by the window. The hearth holds cold ash and one half-burnt page. The Workshop door is locked and its window too grimed to see through. In the Room of Pages, the books have gone quiet in the way books do here since the Quieting: middles intact, endings missing.

Behind the House stands the Knowledge Tree: enormous, leafless, grey glass, hung with dozens of small unlit shard-lanterns. It has not shown a light in years. A small brass plate at its roots reads: NOTHING IS KNOWN YET. THIS IS AN HONEST PLACE TO START.

The garden inside the wall has forgotten spring. Rows that once ran green hold grey-green stalks that neither grow nor die. One plant is different: a sunwick, in a cracked pot on the potting bench, the last seedling from Row 7. A girl from the village, Maya, has walked up the hill every day for a season to measure it. Her notebook holds forty days of numbers and not one reason. The sunwick is losing height.

On the garden gate hangs a grey metal tag, wired on, weathered: it has been there four months. Nobody from the village put it there, and nobody has come back about it.

Under the workbench sits a crate stenciled UNFINISHED. Inside it, something with a tail.

Beyond the wall: Resource Meadow gone to thistle, Build Valley silent, the Discovery Cave mouth boarded, Mission Hall's board empty. The fog at the edge of the Commons has not moved in living memory.

## 4. Principal characters and conflicting desires

The full desire/fear/contradiction/relationship records live in the ledger (CHAR-* entries). This section is the Volume I working summary. Conflict in Volume I is quiet by design: no antagonist appears on screen. The friction is between ways of caring.

| Character | Wants (Volume I) | Fears | Contradiction in play | Conflicts with |
|---|---|---|---|---|
| **The Wayfinder** (player) | To wake the garden, then to know what else is out there | Authored by play, not by us | n/a | The seal's instruction; Katha's evasions |
| **Katha** | The player to stay; the story to keep not-ending | Endings; being asked what the tree was | Celebrates uncertainty while curating what the player learns and when | Maya's demand for plain answers; the player's questions about the Quieting |
| **Maya** | The Row 7 sunwick alive, and the *mechanism*, not comfort | Vague explanations; losing the last living link to her sister's rows | Loves living systems, treats them as fully knowable machines, insists one dial must explain everything | Katha's theatrics; the plant's refusal to be one equation |
| **Piko** | To be near the player; for its tail to stop shaking | Its own reflection, at first | Built from a spec, keeps exceeding it in small unprogrammed ways | Nothing yet; Piko is the volume's unguarded heart |
| **Director Vale / the Archive** (distant) | Nobody harmed by anyone's reckless idea | Repeat of the invention that took his childhood community | Mistakes removing agency for removing danger | The player's entire existence, though neither knows it yet |
| **Surveyor Bell** (minor, Mission 4) | To do a good job by Archive lights; genuinely to help | Filing an inaccurate report | Kind in person, employed by a system that cannot see persons | The player's Care Card; Maya's pride |

Character knowledge boundaries for Volume I (who knows what, enforced in every scene; full table in ledger):

- Katha knows what the tree was, what the Atlas was, and who last lived in the House. Katha says none of it in Volume I and visibly changes the subject twice.
- Maya knows her sister planted Row 7 and vanished investigating the Quieting. In the slice she says only "my sister planted these." The fuller admission is Mission 3.
- Maya does not know Katha is anything but "the House's voice." Piko knows nothing and is learning everything.
- Nobody in the Commons has met Vale. The Archive exists in Volume I as an object (the seal), a crate (Mission 2), a person (Bell, Mission 4), in that order: institution before face, on purpose.

## 5. Chapter structure

Volume I is four chapters. Chapter 1 is the opening vertical slice, developed to implementation readiness in §5.1. Chapters 2 through 4 are scoped roadmap missions (§5.2), each one buildable as its own vertical slice later.

| Ch | Title | Player-facing arc | Target concepts (live IDs) | Ships |
|---|---|---|---|---|
| 1 | The Garden That Forgot Spring | Wake, repair Piko, wake Katha, restore the sunwick, first Shard, first branch | `sequences_patterns`, `rates_proportion`; support `statistics_averages`; advanced `coordinate_slope`, `inequalities` | Opening slice, this doc |
| 2 | The Pump Below the Workshop | Open the Workshop by reviving the House's water pump | `rates_proportion` (application, construction), `statistics_averages` | Roadmap |
| 3 | The Ledger of Row Seven | Meadow seed census with Maya; her sister said aloud | `statistics_averages` (core), `sequences_patterns` (transfer) | Roadmap |
| 4 | The Certified Garden | The Archive's solution arrives, four months late, and works | `words_to_equations`; advanced `inequalities` | Roadmap |

### 5.1 Chapter 1, the opening vertical slice: The Garden That Forgot Spring

**Runtime target:** 20 minutes nominal; 15 floor (minimal path); 25+ for explorers. Timings per beat below.

#### 5.1.1 Mission design contract (per the world bible's contract, all fields)

- **Need:** the last Row 7 sunwick is dying, and Maya has run out of ways to ask it why.
- **Emotional stake:** the plant is the last living thing from her sister's rows. Understated on the novice path (one line: "my sister planted these"), never milked.
- **Characters and conflicting desires:** §4 above. In-slice friction: Maya wants mechanism and speed; Katha wants ceremony and delay; the player is the tiebreaker.
- **Explorable location:** House interior (window seat, Desk, hearth, Room of Pages doorway, workbench), rear yard (Knowledge Tree), walled garden (potting bench, model bed, rows, gate).
- **Target concepts hidden beneath the fiction** (every ID resolves in `ml/data/ontology.json` v0.2-pilot15; wording below cites that file's own descriptions):
  - `sequences_patterns` (primary): daily height readings as a sequence; first differences as "growth per day"; recognizing where the pattern breaks. The ontology description is literally "comparing successive terms, finding first differences."
  - `rates_proportion` (primary): water as a unit rate, ml per day; converting a can's volume and a number of days into a rate. Ontology: "unit rate... unit conversion... proportional reasoning."
  - `statistics_averages` (support): averaging repeated measurements; mean growth per day across a run.
  - `coordinate_slope` (advanced-path stretch): the journal's chart view reads growth rate as slope. Real prerequisite edges exist in the live ontology from both primaries into this node, so the pathfinder can genuinely route here next.
  - `inequalities` (advanced-path stretch): the sunwick's water tolerance stated as a compound inequality, a band with endpoints.
  - Coverage honesty (SAFE-COVER): this mission teaches *number patterns, unit rates, and averages dressed as gardening*. It does not teach botany, and no material in it may claim plant-science coverage. The fiction's "causality, observation, plant systems" language is framing, not assessed content.
- **Prerequisite evidence and capabilities:** none. This is the cold start. Humble prior; nothing pre-lit (SAFE-COLD).
- **Materials and constraints:** watering can (84 ml), light shutter (hours per day), nutrient drops, the model bed's day-lever; the physical sunwick can only be treated once, so the regimen must be earned in the model first.
- **Observations:** leaf length by tape; daily heights auto-charted in the Observation Journal; leaf-tip color; soil sheen; Piko's tail angle (uncertainty display); optional yard and house hotspots.
- **Predictions:** claim chips stamped into the journal before any run (see beat 7).
- **Simulations / Knowledge Boxes:** the Model Bed MicroSim v1 (§7), Observation Journal, Claim Assembler.
- **Construction / writing possibilities:** the Drip Regulator (optional build, counts as construction evidence); the Sunwick Care Card v1 (Blueprint, authored at beat 15).
- **At least two defensible approaches:** (a) controlled sweep on water, one variable at a time; (b) observe-first: run three unchanged model days, read the pattern, then make one targeted change; (c) builder path: construct the Drip Regulator to hold a steadier rate than hand watering. All three reach the band; Maya and the journal acknowledge which was used.
- **Failure states that reveal information:** overwatering yellows tips by model-day 3 and turns growth negative by day 4 (reveals the upper endpoint); underwatering slows growth without yellowing (reveals the two failure modes differ, which is itself data); a correct water setting still stalls if light stays at the inherited 4 hours (reveals a second variable exists). No failure resets anything; all runs stay in the journal as evidence.
- **Question-bank opportunities:** three diegetic items, §8.
- **Reflection proportional to the mission:** one journal sentence at beat 15, one optional line to Maya. No essay.
- **Persistent world consequences:** §11.
- **Character consequences:** Maya's trust +1 tier and her contradiction dented (she says "two dials" out loud, grudgingly); Katha's first visible evasion on record; Piko imprints on the player permanently.
- **Rewards tied to demonstrated capability:** the Causal Shard and everything it unlocks (§10) mint only from the verified evidence set, never from dialogue.
- **One local resolution:** the sunwick buds. The garden's first square of color returns.
- **One clue, promise, or complication advancing the larger story:** three, budgeted by path: the grey seal (all paths), the Atlas half-line (all paths, at the shard moment, one line only), the coat and the radio fragment (explorer/advanced only).

#### 5.1.2 Beat map

Engine events named here are the deterministic engine's; the story layer emits nothing authoritative.

| # | Beat (required by First assignment) | Time | Engine events |
|---|---|---|---|
| 1 | Awakening inside the House at the Edge | 1.5 min | `evt.session_start` |
| 2 | Discovering and repairing Piko | 2.5 min | none (warmup, ungraded by design) |
| 3 | Awakening Katha | 1.5 min | none |
| 4 | Seeing the grey Knowledge Tree | 1.0 min | none |
| 5 | Meeting Maya and the struggling plant | 2.0 min | none |
| 6 | Observing the plant | 2.0 min | `evt.observation_logged` (n) |
| 7 | Making a prediction | 1.0 min | `evt.prediction_made` |
| 8 | Manipulating water, light, nutrients, time | 4-6 min | `evt.sim_run` (n), `evt.question_answered` (q1, q2) |
| 9 | An informative surprise or failure | inside 8 | `evt.sim_run` outcome |
| 10 | Revising the model | 2.0 min | `evt.revision` |
| 11 | Explaining a supported causal relationship | 2.0 min | `evt.explanation`, `evt.question_answered` (q3) |
| 12 | Restoring the physical plant | 1.5 min | `evt.world_mutation` (plant) |
| 13 | Earning the first Causal Shard | 0.5 min | `evt.shard_minted` (engine-verified) |
| 14 | Illuminating the first Knowledge Tree branch | 1.0 min | `evt.world_mutation` (tree branch 1) |
| 15 | Preserving the plant and evidence in the House | 1.0 min | `evt.blueprint_created` |
| 16 | First sign of the Archive of Finished Things | 1.0 min | `evt.clue_found` |
| 17 | Ending: promise of a much larger world | 1.0 min | `evt.chapter_complete` |

#### 5.1.3 The slice, beat by beat

**Beat 1. Awakening.**

Grey light through a tall window. The player wakes on the window seat of the House at the Edge, under a coat that is not theirs, smelling faintly of cedar and rain. Dust hangs in the light like slow snow. A desk by the window. A hearth full of cold ash and one half-burnt page. On the mantel, a clock, stopped, and an old radio with a cracked dial.

Nothing speaks. There is no text box explaining a world. The first interaction is the window latch; it opens with a sound like the house exhaling, and the dust moves for the first time in years. Below, through the glass: a walled garden in grey-green, and one small plant in a cracked pot on a bench, and a girl with a measuring tape, arguing with it.

Design: environmental storytelling only. One soft objective marker (the stairs). The novice path reaches its first interaction inside 20 seconds.

**Beat 2. Piko.**

At the foot of the stairs, a workbench, and under it a crate stenciled UNFINISHED. Inside: a fox-sized creature of pale wood and copper ribs, curled nose to tail. A dim shard sits in its chest like a held breath. Its tail is a fan of thin brass leaves.

Three of its four leg joints click home when touched. The fourth needs a gear. The three working joints show their gears through little amber windows: six teeth, eight, ten. In the crate, two loose gears: a twelve, and a nine with a chipped tooth. Nothing grades this. It is the world's first quiet invitation to notice a pattern, and if the player seats the nine, the leg turns with a limp and Piko looks at it, and at the player, until they try again.

The gear seats. The chest-shard warms. Piko unfolds like a hand opening, sees its own reflection in the window, hides behind the player's legs, and peers out. Its tail spins in a full wild circle: everything, right now, is uncertain.

From then on the tail is a permanent honest instrument: steady when the world makes sense, wide when it does not. Nobody explains this. Players learn to read it because it is true.

**Beat 3. Katha.**

Piko noses the radio on the mantel. Static, then a voice mid-sentence, as if it had been talking for years with nobody tuned in:

KATHA: "...and that is why endings are overrated. Oh. *Oh.* Is it today? It is today. Hello. You are awake and I have not rehearsed."

The lamplight leans toward the player like a listener. Writing appears in the dust of the mantel, quick strokes, signing itself with a small flame.

KATHA: "I am Katha. I keep the unfinished stories. This house is full of them, and as of this morning, so are you. Yours is already my favorite, for the best possible reason: I do not know how it ends."

If the player asks what happened here, the light flickers, and Katha's voice does something careful:

KATHA: "A middle-of-story question. We are barely past the title page. There is a girl in the garden who has been asking a better one all season."

Design: Katha's Volume I introduction is four lines on the novice path. The deflection is itself a planted character beat (MYST-KATHA-NATURE in the ledger): Katha's first on-record evasion, staged before the player can know it is one. Advanced/explorer paths may find the radio's late-night fragment (Appendix B).

**Beat 4. The grey tree.**

The back door opens on the yard, and the player walks under the Knowledge Tree without meaning to; there is no other path. Grey glass branches. Dozens of unlit lanterns, each shaped to hold a shard that is not there. Piko will not walk under it; it goes around, watching.

KATHA: "It is not dead. Nothing here is dead, whatever it looks like. It is unlit. That is a different thing entirely, and the difference, I suspect, is you."

At the roots, the brass plate: NOTHING IS KNOWN YET. THIS IS AN HONEST PLACE TO START.

Design, SAFE-COLD made diegetic: the tree is the seed state, visibly labeled as such. No branch, node, or lantern shows any light before real evidence exists. The plate is the humble prior in brass. Nothing in the slice may imply day-one mastery.

**Beat 5. Maya and the sunwick.**

The garden gate. The girl does not look up.

MAYA: "If you are going to say maybe it is sad, the gate is behind you. Sad is not a mechanism."

She is thirteen or so, sleeves rolled, a measuring tape around her neck like a scarf, a notebook fat with sums. On the bench: the sunwick, a hand-high plant with paired leaves gone dull at the tips, in a cracked pot.

MAYA: "Forty days of measurements. Height, every morning. It grew, then it slowed, then it stopped, and I have forty numbers and not one reason." She finally looks at the player. "The house woke up for you. Fine. Do you collect reasons? Because I am out."

She says one more thing, flat, not looking at the pot: "My sister planted these. This one is the last."

Beside the bench stands the model bed: a copper-framed twin of the pot under angled glass, its soil threaded with faint glass roots. Maya built it from parts she found in the yard ("the House left them out for me; ask it, not me"). It runs a day in a minute.

MAYA: "It is a guess about a plant. It is not a plant. But it lets us be wrong fast, and wrong fast is the only kind of wrong I can afford this week."

Design: the model bed is the MicroSim, and Maya's line is the model-versus-reality honesty stated in character. The real sunwick is treated exactly once, at beat 12, with whatever regimen the evidence supports.

**Beat 6. Observing.**

The Observation Journal opens as a spread in the bench's lid: Maya's forty days, auto-charted. The player can run untouched model days to just watch. Tape-measure the leaves. Note tip color. The journal quietly teaches its two views: the list of daily heights, and the differences between them, day to day. Growth per day is a column the player can reveal, and revealing it is the slice's first small gasp: the heights look almost flat, but the differences tell a story, positive, shrinking, gone.

Optional hotspots (explorer content, never required): six across the slice. Four out here: the rain barrel's level marks, a snail's silver track that avoids one row, the boarded cave mouth visible over the wall, and a small maker's mark stamped into the model bed's copper frame. Two back in the House: the half-burnt page in the hearth, and the coat that is not the player's.

**Beat 7. The prediction.**

The bench offers claim chips, plain language, stamped into the journal with a date before any run:

- "More water and it grows faster."
- "It is getting too much of something."
- "Water is not the problem."
- Or the player writes their own comparative claim.

MAYA: "Stamp one. I do not run experiments nobody bet on. If you will not say what you expect, the numbers cannot surprise you, and surprise is the whole point of numbers."

Design: `evt.prediction_made` records the claim before the run. The rule, stated exactly because a speedrunner will test it: unstamped runs are allowed, exploration is always free, but an unstamped run condenses to grey mist in the journal instead of an evidence card. The bed will show you anything; it only *remembers* what somebody bet on. Maya's line is that rule wearing clothes. Hide-correctness (SAFE-COLD): the journal shows no right or wrong at stamping, and no red anything after. The world answers instead.

**Beat 8. Dials and days.**

The model bed's four controls: water (ml per day, fed by the 84 ml can), light shutter (hours per day), nutrient drops, and the day-lever, one model day per pull. Runs auto-log to the journal.

Two bank moments arrive diegetically here, not as a quiz screen:

- Maya, filling the can: "Eighty-four milliliters, and I made it last seven days flat. How much a day was it getting? Because whatever we try next, I want it as a per-day number or it is not a number." (q1, `rates_proportion`.)
- The journal, when the player opens the differences column on Maya's forty days: "Between which days did growth actually stop?" (q2, `sequences_patterns`.)

The nutrient dial, honestly: within a sane range it does nothing measurable in seven model days. The journal records "no measurable change." Maya: "Write the nothing down. Nothing is a result. People die of not writing down the nothings." A null result, presented as data, on purpose.

**Beat 9. The surprise.**

The surprise is guaranteed, but it never requires the player to have been wrong. Two branches, one beat, same engine event.

*Branch A, the generous instinct.* The plant has been living on 12 ml a day, so the player opens the tap: 36, 40, whatever "should make it thrive." Model-day one: nothing. Day two: nothing. Day three: the leaf tips go the color of old paper. Day four: the height difference turns negative for the first time in the whole journal. Piko's tail snaps wide open. The model sunwick droops in its copper frame exactly the way the real one droops in its cracked pot.

Silence for a beat. Then Maya, quietly, and this is the slice's thesis:

MAYA: "Good. Write it down. A dead end you can point to beats a road you only believe in. Now we know the top of something. We did not know the top of anything an hour ago."

*Branch B, the correct prior.* The player raises water carefully into the low twenties, which is in fact inside the band, and the model sunwick... stalls anyway. Growth per day barely moves. Piko's tail opens just as wide, because being right and seeing no result is the strangest feeling on the bench. It is Maya who cracks first: she checks the bed, goes still, and admits it. The light shutter is set to four hours. She turned it down weeks ago, chasing her one-dial theory, and forgot.

MAYA: "...I did that. Fine. Write that down too. You were right and it still drooped, which means being right about water is not the same as being done." A breath. "It is not one dial. I hate that. Keep going."

Design, SAFE-PF: either branch is a designed, sequenced generate-before-consolidate failure, and either yields load-bearing evidence: branch A the band's upper endpoint, branch B the existence of a second variable, which also dents Maya's contradiction on screen. Both branches log as the same beat-9 event. No progress is lost; the surprising run is evidence, not a penalty. Nobody, ever, says "wrong."

**Beat 10. Revision.**

(Branch A housekeeping: before the sweep, Maya rechecks the bed herself, finds her own shutter at four hours, and makes the same admission branch B players already heard; both branches enter the sweep with the second variable on the table.)

The player sweeps: runs at 10, 20, 30, 40, with the shutter now honest at eight hours. The journal's differences column turns the four runs into four little stories: slow, good, good, poison. (A branch A player discovers here that the middle exists; a branch B player discovers here that the top does.) Somewhere between "not enough" and "too much" is a band where growth per day stays positive. The player narrows it. Maya watches the chart fill in and says, mostly to herself: "It is not a dial. It is a *window*." Revised claim stamped: `evt.revision`.

Advanced path: the journal offers the band as a compound inequality with real endpoints to pin down (`inequalities`), and the chart view reads run slopes against each other (`coordinate_slope`). Novice path: the band stays in plain words and pictures. Same truth, two representations.

**Beat 11. The explanation.**

The Claim Assembler: the player builds one supported causal sentence from evidence cards, each card a real run or measurement from their own journal:

> "Between [18] and [28] ml per day, growth per day stayed positive [runs 2, 3]; above [about 32], tips yellowed within two days [run 4]."

Distractor cards exist in the tray: "the plant grew because we watched it more," "day 3 was just a bad day," "more water always helps eventually." Choosing evidence that does not support the claim gets Maya's diagnosis, not a buzzer: "That run says nothing about your top number. Which run does?" (q3 lives here: choose the claim all five runs support, `statistics_averages` with the mean-growth comparison.)

KATHA, from the bench lamp, gently: "Say it so a stranger could water it."

`evt.explanation` records the claim and its cited evidence set.

**Beat 12. Restoring the sunwick.**

The regimen goes on the real plant once: measured water from the marked can, and the cracked pot carried out of the wall's shadow into honest sun, because the band asked for hours the bench corner never got. And then, because real plants do not run on a lever, nothing happens. It gets late. Maya has to go home. The player banks the House's hearth (one log, one match, the Flame catches). Night falls over the Commons for the first time in the slice, and the House windows are gold, and that is all.

Morning. The sunwick has lifted. Two leaves have turned the grey off like a held breath released, and at the stem's crown there is a bud the color of a struck match.

MAYA, arriving at a dead run, tape flying: measures it, twice, writes it down, and then forgets to be precise for exactly one sentence. "It *woke up.*"

**Beat 13. The Causal Shard.**

The model bed's copper frame begins to hum. It draws the journal in, the runs, the wrong turn, the numbers, the stamped claims, the sentence a stranger could water by, and condenses. In the frame's cradle: a shard of warm glass, small as a thumb, with the growth curve etched inside it like a fossil of the week.

KATHA: "I did not make that. Neither did the bench. You should be clear about that. It is the shape of what you *did*. The House only holds things. It has never once made one."

Design, mastery-authority gate: the mint is the engine's verification of the triangulated evidence set (recognition q1/q2, application in runs, construction of the regimen, explanation at beat 11), emitted as `evt.shard_minted` with the evidence IDs attached. Katha's line above is the constraint spoken as canon: the narrative layer explicitly disclaims granting power. If the evidence set is incomplete, the frame does not hum, and Maya points at what is missing ("you never said it out loud; say it so a stranger could water it").

**Beat 14. The first branch.**

The tree at dusk. The player sockets the shard into the lowest lantern. Light climbs one branch, only one, glass going honey-gold from the inside, and for one held second the light shows something else: the faint imprint of an entire canopy, thousands of branches, the ghost of what this tree was. Then it is one lit branch again, and the rest is grey.

In the dust of the path, quick strokes, the small flame signature: *the Atlas was not broken.*

The sentence stops there. Katha, asked, does not answer, and the lamp light, for the first time, moves *away*.

Above, faintly, one star in the Constellation is new.

KATHA, recovering, softly: "One branch. Everything else stays grey, and I will not pretend otherwise. Grey is not what you lack. Grey is the shape of what we get to do next."

Inside the House, the stopped clock ticks. Once.

**Beat 15. Preserving.**

The cracked pot goes on the House windowsill, first color in the grey room. The journal's week becomes the first page of the Garden Ledger in the Room of Pages, and the player authors the slice's one act of writing: the **Sunwick Care Card v1**, a Blueprint with the fields filled in their own words: what it needs (the band), how we know (cited runs), and, mandatory, what we do not know: *tested on one plant, in a model, for one week. May not hold for other plants, other seasons, or the real sun.* Maya signs it too, second author.

Design: the limitations field is SAFE-COVER made diegetic; the Blueprint's provenance/tests/limitations structure per the world bible ships in the player's own handwriting from minute eighteen of the game.

**Beat 16. The seal.**

Leaving at dusk, Piko stops at the gate and will not pass it. Wired to the latch, weather-greyed, a metal tag nobody noticed on the way in because nobody looks at gates on the way in:

> COMMONS GARDEN, PLOT 1.
> SURVEYED. DEFECT LOGGED.
> A CERTIFIED SOLUTION IS BEING PREPARED.
> PLEASE DO NOT ATTEMPT REPAIR.
> THE ARCHIVE OF FINISHED THINGS.

MAYA, rubbing the stamped date with a thumb: "This is dated four months ago." A pause while that lands. "Nobody came. Nobody came, and it is *still here*, telling us not to."

The player has, of course, already attempted repair. The bud on the windowsill is visible from the gate.

Katha says nothing at all, which from Katha is a sound. Pressed: "The Archive files things. Some things do not want filing." And the radio in the house, unprompted, changes stations.

Choice, small and real: leave the tag on the gate, or take it down and keep it in the House drawer. Both are recorded. Nothing announces a consequence. (One arrives in Mission 4.)

**Beat 17. The promise.**

The upper window, night. Maya has gone home with the Care Card copy. Piko is asleep on the coat that is not the player's. And for one minute, the fog past the edge rolls back like a tide going out:

Two mountains, far off, with a river between them like a stitch of silver. A smudge of warm lanterns low in a valley. Higher, a glow with corners, geometric, patient. Then the fog comes back.

KATHA: "You woke one garden. Aster is very large, and very quiet, and you are the loudest thing to happen to it in years. Every light out there is a question that stopped being asked. Sleep. The House holds what you made. It has been waiting a long time to hold anything."

Piko's tail, in its sleep, steadies, and points: at the river.

The clock ticks again. End of chapter.

#### 5.1.4 Structured mission content (for conversion into repository schemas)

```yaml
mission:
  id: mission.commons.garden_spring.v1
  region: commons
  chapter: vol1.ch1
  runtime_minutes: {floor: 15, nominal: 20, explorer: 25}
  target_concepts:            # all IDs resolve in ml/data/ontology.json v0.2-pilot15
    primary: [sequences_patterns, rates_proportion]
    support: [statistics_averages]
    advanced: [coordinate_slope, inequalities]
  prerequisites: []           # cold start
  states:
    - s0_wake        # house interior
    - s1_piko        # repair complete -> companion active
    - s2_katha       # radio triggered
    - s3_tree        # yard traversal
    - s4_garden      # maya met, model bed available
    - s5_loop        # observe/predict/run/revise/explain (repeatable)
    - s6_restore     # regimen applied to real plant, night passes
    - s7_shard       # engine-gated
    - s8_branch      # world mutation
    - s9_preserve    # blueprint authored
    - s10_seal       # clue found, choice recorded
    - s11_promise    # vista, chapter end
  narrative_triggers:
    - {on: enter_s5_first_run, speaker: maya, line_id: maya.stamp_one}
    - {on: run_overwater_day3, speaker: maya, line_id: maya.dead_end_data}
    - {on: shard_minted, speaker: katha, line_id: katha.i_did_not_make_that}
    - {on: branch_lit, world: atlas_halfline_dust_writing}
  engine_contract:
    events_emitted: [session_start, observation_logged, prediction_made, sim_run,
                     question_answered, revision, explanation, blueprint_created,
                     clue_found, chapter_complete]
    events_consumed: [shard_minted, world_mutation]   # engine-authored only
    shard:
      id: shard.causal.rate_pattern.v1
      concept_ids: [sequences_patterns, rates_proportion]
      evidence_required:
        recognition: [qb.garden.001, qb.garden.002]   # either counts; both preferred
        application: {sim_runs_min: 3, distinct_water_levels_min: 3}
        construction: {regimen_in_band: true}         # drip regulator build also satisfies
        explanation: {claim_with_cited_runs: true}
      authority: deterministic_engine_only
  persistence:
    world_state_doc: world_state/{uid}                # per AGENT_RULEBOOK 1.7
    mutations: [garden.plot1.color, tree.branch1.lit, house.clock_ticks,
                house.windowsill.sunwick, gate.seal_tag.player_choice,
                room_of_pages.garden_ledger.p1, blueprint.sunwick_care_card.v1]
  question_bank_refs: [qb.garden.001, qb.garden.002, qb.garden.003]
  accessibility:
    color_independent_cues: true    # yellowing paired with leaf droop shape + journal text
    no_timed_input: true
    all_dialogue_captioned: true
    tail_uncertainty_redundant_cue: audio chime pattern
  deferrals:
    - collaborator co-op session (design intent documented, engine support absent)
    - voice acting
    - roblox skin of this mission
    - procedural weather
```

### 5.2 Scoped roadmap: the next three missions

Each is scoped to the same vertical-slice shape: one playable emotional and learning outcome, one location, engine events named, no more than one new system per mission. These are Arc-mode outlines awaiting Mission-mode development; they may not ship content directly from this section.

**Chapter 2. The Pump Below the Workshop (25 to 35 min).**
*Need:* the Care Card works, and Maya immediately wants forty rows on it before the season turns; one plant's band is a cupful, forty rows at band rates is more water than anyone can carry up the hill, and the scale-up arithmetic is itself the mission's front door. The House's pump is dead behind the locked Workshop door, and the door answers only to running water in its old gauge. *Learning spine:* `rates_proportion` at application and construction depth (fill times, flow as a rate, gear ratios on the pump crank), `statistics_averages` (timing repeated fills, averaging away sloppy stopwatch hands). *Shape:* measure the well's recovery rate, gear the crank so the pump draws slower than the well refills, prove it holds for ten model minutes. *The informative failure:* an over-geared pump runs dry and airlocks, loudly, teaching the constraint is the well, not the machine. *Unlocks:* the Workshop opens (Volume I contract fulfilled); Flow Box (first Knowledge Box); Drip Regulator formalized as Blueprint v1.1 if built in Ch1. *Archive beat:* a crate of CERTIFIED PARTS sits at the House door one morning, unrequested. One part fits the pump perfectly and cannot be opened, even by the Workshop's tools. Kept or not, recorded. *Clue:* the pump's maker's mark matches the model bed's. Someone built both. (MYST-HOUSE-HANDS.) *New system:* Knowledge Boxes v1.

**Chapter 3. The Ledger of Row Seven (25 to 35 min).**
*Need:* winter is notional but seed is real; Maya wants the meadow's scattered seed stock counted, tested, and rationed before anything else is planted. *Learning spine:* `statistics_averages` at core depth (germination trays as repeated trials, means and weighted means when tray sizes differ), `sequences_patterns` in transfer dress (viability falling off by seed age, read from first differences again, new context, same tool, `evt` tagged as transfer). *Shape:* sample, don't census; the meadow is too big, and choosing how to sample is the mission's real choice. *Emotional spine:* Row 7's seed tin surfaces, and inside its lid, in handwriting that is not Maya's: "Row 7. If they stop waking, start with what changed." Maya says the whole thing out loud for the first time: her sister, the investigation, the not coming back. She asks the player to help her keep the rows alive, not solve the disappearance. Restraint here is a design rule: Volume I does not chase the sister. *Unlocks:* Resource Meadow gathering; Garden Ledger page 2, co-authored; Maya trust tier 2. *Clue:* the handwriting matches the House journal's older entries. (Feeds MYST-SISTER and MYST-HOUSE-HANDS; the player can notice, nobody confirms.) *New system:* Living Book authoring v1 (the Ledger becomes a real Living Book with data pages).

**Chapter 4. The Certified Garden (25 to 35 min).**
*Need:* the Archive finally arrives, in the person of Surveyor Bell: polite, dust-grey coat, genuinely good at their job, four months late and sorry about it. Bell installs the Certified Solution for Plot 1: a sealed irrigation timer, handsome, silent, correct. And it works. That is the point. It waters while everyone sleeps. *Conflict:* the timer's posted rule is one fixed number; the player's Care Card is a band with endpoints. During the volume's one cold snap, fixed and band disagree. *Learning spine:* `words_to_equations` (turn the timer's posted rule and the Card's band into symbols so they can be compared at all; real prerequisite edges into this node exist from both `sequences_patterns` and `linear_equations` in the live ontology), advanced `inequalities` (defend the band as a compound inequality to someone who only files single numbers). *Shape:* not a debate scene, an evidence scene: the player demonstrates the band claim to Bell with the journal, and Bell, decent to the bone, measures twice, files "local variance, noted," and means it. Vale is never seen. The Archive appears exactly as Volume I requires: helpful, and distant, and unable to file a window. *Choice with weight:* keep the timer, keep hand care, or hybrid; recorded, and it is the seed of the player's own Volume III reckoning (their automation, their unintended consequence). If the player pocketed the seal tag in Ch1, Bell asks, mildly, where it went; the drawer opens or the lie is told; recorded either way. *Unlocks:* Mission Hall board wakes with region notices; Bell leaves a pamphlet: THE ARCHIVE MAINTAINS THE RIVER GATES. *Volume close:* second vista, the two mountains again, nearer; Piko's tail agrees with the pamphlet. Volume II is a door, visibly. *New system:* none, deliberately; Ch4 spends its budget on the first Archive human.

### 5.3 Volume I exit state

By volume end the player has: a lit branch and one to three shards; a home with a ticking clock, a plant, a Ledger, and a workshop; two relationships (Maya at trust 2, Piko imprinted) and one uneasy voice (Katha, twice evasive on record); an institution encountered as tag, crate, and person; three private mysteries (the half-line, the handwriting, the coat) if they looked, zero blocking mysteries if they did not; and one direction: the river. The Archive has been *helpful and distant*, exactly per the world bible, and the volume never once resolved the philosophical conflict, because it must not.

## 6. Mysteries, clues, and planned payoffs

Master table lives in the ledger (MYST-*, CLUE-*); this is the Volume I working set with payoff windows.

| Mystery | Planted (Vol I) | Visible to | Payoff window |
|---|---|---|---|
| MYST-ATLAS: "the Atlas was not broken" half-line | Beat 14 dust-writing | All paths, one line | Second half found in a far region (Vol II-III); meaning: Vol IV-V |
| MYST-SISTER: Maya's sister | "My sister planted these" (Ch1); seed tin note (Ch3) | All paths | Trail: Vol II. Truth: Vol IV |
| MYST-KATHA-NATURE: what Katha is | Two on-record evasions; lamp moving away; radio changing stations | All paths feel it; explorers collect it | Vol IV (the omissions damage trust, per world bible) |
| MYST-HOUSE-HANDS: who built the bed, the pump, who wore the coat | Maker's marks (Ch2), handwriting (Ch3), the coat (Ch1, explorer) | Explorer/advanced | Vol II hints; converges with MYST-SISTER in Vol IV |
| MYST-SEAL-DATE: four months, nobody came | Beat 16 | All paths | Vol III: the Archive triages whole regions; the Commons was not worth its time. Certainty has a queue. |
| CLUE-PIKO-RIVER: the tail points | Beat 17, Ch4 close | All paths | Vol II opening |
| MYST-CLOCK: one tick per shard | Beats 14, 17 | Attentive players | Vol V: what the House is counting toward. Recorded; unresolved by design. |

Rules: no Volume I mystery blocks progress; every planted clue has a ledger entry with a payoff window before it ships; Katha's evasions are always *witnessable* (a player who replays Vol I after Vol IV should wince, not cry retcon).

## 7. Core simulation systems

**Model Bed MicroSim v1.** State: `water_ml_day`, `light_h_day`, `nutrient_drops`, `day` (lever-advanced). Hidden model, fixed and inspectable by engineering, never by the slice's UI:

- Optimal band: water 18 to 28 ml/day AND light 6 to 10 h/day gives growth +2.4 to +3.2 mm/day (peak at 23 ml, 8 h).
- Under band (water < 18): growth decays toward 0, no yellowing. Distinct failure signature.
- Over band (water > 32): tip yellowing from day +2, growth negative from day +4, severity scales.
- Light inherited at 4 h/day at mission start (Maya turned the shutter down weeks ago and forgot; she admits it when caught, which is her contradiction taking its first dent).
- Nutrients: within 0 to 5 drops, no measurable effect inside 7 days; journal logs the null honestly. Beyond 5, logged "excess retained in soil," consequence deferred (ledger: UNRES-NUTRIENT).
- Noise: novice bed is deterministic. The advanced second bed (see §5.1 beat 10 and Appendix B) adds measurement noise of about 1 mm, forcing repeated measurement and means.

**Observation Journal.** Time-series list, first-differences column (revealable), chart view (advanced: run-slope comparison). Every run, claim, and question lives here; it is the mission's evidence store and the Care Card's source.

**Claim chips and Claim Assembler.** Structured plain-language prediction and explanation objects carrying machine-readable comparisons (variable, direction, range). These are what `evt.prediction_made`, `evt.revision`, and `evt.explanation` serialize.

**Shard Mint.** Pure engine: validates the evidence set in §5.1.4 and emits `evt.shard_minted`. The story layer renders the hum and the glass, and nothing else.

**Piko's tail.** Uncertainty display bound to the current claim's evidence coverage: wide when the active claim has uncited territory, steady as evidence accumulates. Redundant audio cue for accessibility. Piko is a display and a friend; Piko is not a hint engine that knows the answer.

**Systems check (loop step 4):** bed feeds journal; journal feeds chips, assembler, and Care Card; assembler feeds mint; mint feeds tree and Constellation; tree and clock feed the House's persistent state; the seal choice feeds Ch4. No orphan system ships in the slice.

## 8. Question-bank integration points

Three items, all diegetic, all carrying the world bible's full item metadata. Per SAFE-GENQ these are **draft items, blocked from the live bank until independent key verification**; alternatively `/story-module` may rewrap already-verified bank items tagged to the same concept IDs, which is the preferred ship path.

**qb.garden.001** (v1). Concept: `rates_proportion`. Prereqs: none. Context tags: garden, water, unit-rate. Representation: numeric entry with unit choice. Difficulty est.: 0.3 (foundational; population failure rate for the concept pending bank calibration). Stem (Maya, diegetic): the 84 ml can lasted 7 even days; how much per day? Expected reasoning: volume divided by days; unit awareness (ml/day). Distractors n/a (numeric), but unit choice includes ml/week and ml to catch rate-versus-quantity confusion. Hints: (1) "Per day means for one day." (2) "Split 84 into 7 equal parts." Solution: 12 ml/day, explanation in Maya's voice. Transfer distance: zero (in-context). Provenance: authored for this slice; validation: DRAFT, needs independent key verification.

**qb.garden.002** (v1). Concept: `sequences_patterns`. Prereqs: none. Context tags: garden, time-series, first-differences. Representation: table read, day-pair choice. Stem (journal, diegetic): daily heights 41, 44, 46, 48, 49, 49 mm; between which days did growth stop? Expected reasoning: successive differences (+3, +2, +2, +1, 0), a shrinking pattern that reaches zero; growth stops between days 5 and 6. This is the same "positive, shrinking, gone" shape the differences column revealed at beat 6, and it matches the under-band model signature in §7 (growth decays toward zero, no reversal). Distractor rationale: "day 6" alone probes value-versus-change confusion; "days 1 and 2" probes biggest-jump misreading; "it never stopped, it is still 49" probes height-versus-growth conflation. Hints: (1) "Look at the jumps, not the numbers." (2) "Reveal the differences column." Solution keyed to the differences view. Difficulty est.: 0.35. Transfer distance: zero. Provenance/validation: as 001.

**qb.garden.003** (v1). Concepts: `statistics_averages` (primary), `inequalities` (advanced variant). Prereqs: qb.garden.001-002 or equivalent evidence. Context tags: garden, model-choice, evidence. Representation: claim choice among four, citing runs. Stem (Claim Assembler, diegetic): which claim do all five runs support? Options: (a) more water always helps (contradicted by run 4; overgeneralization distractor), (b) water does nothing (contradicted by runs 1 to 3; reversal distractor), (c) watching the plant more made it grow (coincidence/agency distractor, and Maya's favorite to demolish), (d) between about 18 and 28 ml/day mean growth stayed positive, above about 32 it turned negative (keyed). Expected reasoning: compare mean growth per run against claims; recognize a band. Advanced variant asks the band as a compound inequality with endpoints. Hints: (1) "A claim has to survive every run, not just one." (2) "Check each claim against run 4 first." Difficulty est.: 0.5. Transfer distance: near (same context, new representation). Provenance/validation: as 001.

Placement rules honored: q1 and q2 arrive inside believable purposes (calculating a needed quantity, interpreting evidence); q3 is the model-choice moment; no question interrupts beats 12 to 17, which are the slice's emotional payoff, per "never stop an emotionally urgent scene for an unrelated quiz."

## 9. Player-created possibilities

- **The regimen itself**: the band is the player's, in their numbers, and two players' Care Cards will legitimately differ (18-26 vs 20-28), which Maya explicitly blesses: "A window has room in it."
- **The Drip Regulator** (optional build): bench parts assembled to hold a steadier rate than hand watering; counts as construction evidence toward the shard; becomes a Blueprint in Ch2 if built.
- **The Sunwick Care Card v1**: the first authored Blueprint, with provenance, cited tests, and a limitations field in the player's own words.
- **The Garden Ledger**: grows into a real Living Book across Ch3, co-authored with Maya, data pages and all.
- **The seal-tag choice**: not a creation, but the first persistent world edit the player makes for non-mechanical reasons; it is theirs.
- **Room to be wrong on purpose**: the model bed happily runs bad regimens; several journal badges (explorer content) exist only for players who mapped the failure space nobody required.

## 10. Capability and Blueprint unlocks

All unlocks ride `evt.shard_minted` or later engine events. Capability-graph verbs per the world bible.

During the mission itself, the bed, the parts, and the tools are Maya's, used under her eye: diegetic scaffolding, no capability required, which is what makes the cold start playable at all. What the capability graph grants is the *unsupervised* version of each verb, for every session after.

| Unlock | Type | Granted on | Grounded in |
|---|---|---|---|
| Inspect (garden objects, later sessions, unprompted) | capability | shard.causal.rate_pattern.v1 | triangulated evidence set, §5.1.4 |
| Use (model beds unsupervised; the second bed) | capability | same shard | same |
| Build (bench parts, regulator class, without Maya present) | capability | construction evidence in the shard's set | `evt.sim_run` + build action during the mission |
| Publish (Care Card, to House only) | capability | explanation evidence present | `evt.explanation` |
| Blueprint: Sunwick Care Card v1 | Blueprint | beat 15 authored | journal evidence, limitations mandatory |
| Blueprint: Drip Regulator v1 (draft) | Blueprint | optional build | formalized Ch2 |
| Tree branch 1 lit + Constellation node | world/graph state | `evt.shard_minted` | engine mastery event only |

Publishing to shared spaces stays locked all volume: transfer evidence does not exist yet, and the capability graph says so honestly when asked.

## 11. Persistent consequences

Written to `world_state/{uid}` (per AGENT_RULEBOOK §1.7) and mirrored in the ledger's region-state records:

- Garden Plot 1 holds color permanently; visible from the House window in every later session.
- The Knowledge Tree's branch 1 stays lit; the rest stays grey until real evidence lights it.
- The House clock has ticked (count persists; meaning deferred, MYST-CLOCK).
- The sunwick lives on the windowsill; it can be watered in later sessions (idle care, no mechanics, pure attachment).
- The Garden Ledger p.1 and Care Card v1 exist, citable by later missions and by Bell in Ch4.
- The seal tag is where the player left it, and Ch4 knows.
- Piko is imprinted; Piko's tail history is real telemetry of the player's evidence states.
- Maya's trust tier, and the dent in her one-dial worldview, persist into every later Maya scene.

## 12. Implementation slices

Vertical slices for the engine lane, each independently playable, per the collaboration contract. **This document does not lift AGENT_RULEBOOK §1.7's "do not build yet" flag.** These slices are specified so that whoever owns that decision can act on it without another content pass.

**Slice A: The House Wakes (beats 1-4).** Reuse: `MindCraftWorldScene.tsx` RoomShell, DeskStation, Interactive hover system, Flame, WindowScene, day/night Lighting, Avatar and CameraRig; palette as-is. New: Piko model + gear micro-puzzle UI, radio/dust-writing dialogue surface, yard traversal with Tree instance dressed as the Knowledge Tree (existing `Tree` component, grey material variant, lantern props). Events: `session_start`. Acceptance: a new player reaches the garden gate inside 7 minutes with zero text boxes longer than 40 words.

**Slice B: The Garden Loop (beats 5-11).** Reuse: PlantLab group as the potting bench base, BookNook shelving for journal visual language. New: Model Bed MicroSim (the slice's one real new system), Observation Journal component, claim chips, Claim Assembler, three bank items via existing question-render path. Events: observation/prediction/run/question/revision/explanation. Acceptance: the §7 hidden-model numbers reproduce; the three failure signatures are visually and textually distinct; hide-correctness verified (no red anywhere).

**Slice C: The Shard and the Tree (beats 12-15).** Reuse: Lighting night mode, LearningHearth for the hearth beat, existing Constellation/graph node rendering from the Map surface if the engine lane prefers. New: shard mint visual, branch-light shader moment, Blueprint authoring form (three fields, limitations mandatory). Events: consume `shard_minted`, `world_mutation`; emit `blueprint_created`. Acceptance: shard cannot mint with any evidence class absent; verified by forcing each absence in test.

**Slice D: The Seal and the Promise (beats 16-17).** Reuse: OutdoorWorld fog/distance treatment. New: seal-tag prop + choice record, vista skybox moment. Events: `clue_found`, `chapter_complete`, persistence writes. Acceptance: all §11 mutations present in `world_state/{uid}` after one full run; second session shows them.

Explicit deferrals: co-op collaborator session; voice acting; Roblox skin (the graph seam per WORLD_VISION §8 is the eventual bridge, not this slice); procedural weather; worlds/world2 integration beyond asset-pipeline reuse (Appendix A, gate 4).

## 13. Self-review scores

Evaluation Rubric, opening slice, scored after the loop's rewrite cycle (§14 documents what changed). Written evidence per category; no inflation; gates checked at the end.

| Category | Score | Evidence |
|---|---|---|
| Narrative purpose | 4 | Every beat either moves the wake-the-House arc or plants a ledgered mystery; no beat is lore-only (quality rule: the mission changes relationships, capabilities, and place). Not a 5: beats 2-4 serve setup more than story. |
| Character motivation | 4 | Maya's forty days precede the player; Katha's evasions are desire-driven (fear of endings), not plot-convenient; Piko wants nothing abstract. Bell not yet on screen to test. |
| Emotional movement | 4 | Grey to one square of color; Maya's one imprecise sentence; the seal lands *after* the triumph, which is the volume's thesis in sequence form. |
| Mystery or discovery | 4 | Five planted threads, all ledgered with payoff windows, none blocking. Half-line restraint (one line, then silence) is the strongest single beat. |
| Player agency | 4 | Three defensible approaches acknowledged in dialogue and journal tags; claim wording is the player's; seal choice recorded with a real Ch4 consequence. Not 5: the slice's destination (the band) is fixed. |
| World reactivity | 4 | Plant, tree, clock, windowsill, gate, and Maya's trust all mutate persistently (§11); the world answers predictions instead of a grader. |
| Learning authenticity | 4 | First differences, unit rates, and means are the *actual* work of beats 6-11, not wallpaper; the ontology's own concept descriptions match the actions (§5.1.1). Not 5: transfer evidence is deferred to Ch3 by design. |
| Simulation relevance | 5 | The MicroSim is the mission; every learning action passes through bed, journal, or assembler; the hidden model's failure signatures are the curriculum. |
| Quality of assessment evidence | 4 | Triangulation across recognition, application, construction, explanation before the shard; hide-correctness; items carry full metadata. Not 5: items are DRAFT pending SAFE-GENQ verification. |
| Creativity supported | 3 | Regimen, Card wording, regulator, failure-space exploration; but the slice's construction space is narrow by cold-start necessity. Honest 3; widens in Ch2-3. |
| Failure quality | 5 | Three distinct, informative failure signatures; the required surprise is load-bearing evidence; no reset, no shame; the branched surprise (§14, weaknesses 2 and 4) guarantees the beat without requiring the player to be wrong. |
| Accessibility | 3 | Color-independent cues, no timed input, captions, redundant tail audio specified (§5.1.4); but dyslexia-friendly journal type, input remapping, and reduced-motion vista are unspecified. Named as a real gap. |
| Continuity | 4 | Ledger seeded with every fact, clue, and promise herein; knowledge boundaries per character; no silent retcon paths identified. |
| Implementation feasibility | 4 | Slice A/C/D are mostly reuse (Appendix A gate 4 findings); Slice B's MicroSim is the one real build. §7 gives engineering the exact hidden model. |
| Future consequence | 4 | Seal choice, nutrient excess, clock ticks, timer choice (Ch4) all ledgered as unresolved consequences with owners. |

**Gates:** no category below 3: PASS. Narrative purpose 4, learning authenticity 4, player agency 4, world reactivity 4: PASS. Real-world scenario review: not triggered (Appendix A, gate 5). Average is not used as a pass criterion.

Content-Gating Rubric (§3 of STORY_DIRECTOR.md) results: Appendix A, all ten rows.

## 14. Revisions made after playtesting

Loop executed through all ten steps, two full rewrite cycles (under the three-cycle cap). Cycle 1 ran against the initial beat design; cycle 2 ran the canon, learning, systems, character, and agency checks plus a second playtest pass against the assembled draft, and found defects the first pass had introduced or missed. Playtest steps ran against all six simulated player types, as required for a major arc plus a capability unlock. Cycle 1 findings and rewrites first, then cycle 2.

**Playtest reports (step 7):**

- **Explorer:** wandered the yard before the garden; draft 1 had four hotspots, all in the garden, so the yard read as empty. Also found the coat and wanted to ask Katha about it; draft had no response. Minor fixes: hotspots redistributed (snail track, rain barrel, boarded cave, hearth page); Katha given one deflecting coat line (feeds MYST-KATHA-NATURE). Vista beat holds attention.
- **Builder:** tried to fix the plant by building a watering contraption instead of running the bed. Draft 1 had no such path and the bench refused. Fixed: Drip Regulator path added as construction evidence (now §5.1.1, §9); Maya's acknowledgment line added.
- **Speedrunner:** broke draft 1 outright. See weakness 1.
- **Struggling Learner:** predicted "too much of something" (correct on the first try) and draft 1's scripted overwatering surprise never fired, leaving the required informative failure beat unreachable. See weakness 2. Also: draft 1's Maya line after a wrong claim assembly read as scolding in this player's read; softened to the diagnostic form now in beat 11.
- **Advanced Learner:** cleared q1/q2 instantly, found the band in two runs, and had four minutes of nothing. Fixed: second bed with measurement noise and a 60 ml five-day budget constraint (means under noise, `statistics_averages` for real; `coordinate_slope` chart view), offered by the journal only when early evidence is strong, per the adaptive-use rules.
- **Collaborator:** wanted to split dial-running from journal-keeping. Engine cannot host this; design intent recorded, deferral declared (§5.1.4, §12). Partial mitigation shipped: the Care Card supports a second author line (Maya uses it; a sibling on the couch can too).

**Critique (step 8), three most damaging weaknesses, and rewrites (step 9):**

**Weakness 1: the slice was speedrunnable into meaninglessness.** In draft 1 the time lever ran without a stamped claim, so a speedrunner could sweep dials, brute-force the band, click through the assembler by trial, and reach the shard with no prediction, no reading, no sentence. That is the exact "advance by clicking through dialogue without acting" failure the quality rules name, and worse, it hollowed the shard.
*Rewrite:* prediction now arms the run: unstamped runs still work (exploration stays free) but condense to grey mist, not evidence; Maya's "I do not run experiments nobody bet on" line makes the rule diegetic. The assembler validates cited runs against the claim's actual intervals, and two failed random assemblies swap in a smaller claim plus Maya's diagnostic question instead of retry spam. Speedrun floor is now about 15 minutes with every evidence class still genuinely touched; the exploit path now *teaches the loop* (the mist is the lesson).

**Weakness 2: the required surprise assumed the player was wrong.** Draft 1 scripted the overwatering failure as the surprise, which collapsed for any player whose first prediction was already correct (the Struggling Learner above, ironically, and many cautious players). A required beat that depends on the player guessing badly is a design failure and quietly punishes good priors.
*Rewrite:* the surprise is now branched and guaranteed without requiring wrongness: if the player over-waters, the yellowing beat fires as written; if the player's water claim is band-correct, the run *still stalls*, because the shutter sits at Maya's inherited 4 hours, and the surprise becomes "you were right and it still drooped," surfacing the second variable and denting Maya's one-dial contradiction on screen. Either branch yields load-bearing evidence (upper endpoint, or the light variable), and both are logged as the same beat-9 event. The hidden model (§7) was rebuilt around this.

**Weakness 3: a lore dump sat on the novice path's critical minute.** Draft 1 had Katha deliver a three-paragraph Living Atlas and Quieting monologue at beat 3, before the player had done anything. That is precisely the shape SAFE-STORYLOAD kills: five minutes of mythology charged to a cold-start student's narrative budget, with zero learning purchase.
*Rewrite:* all Atlas and Quieting exposition is out of the novice path entirely. Katha's intro is four lines and one deflection; the mythology surfaces as one written line at beat 14 (after the learning payoff, thirty seconds, then silence), and the radio fragment, the coat, and the plaque flavor moved to explorer or advanced-tagged content. The full budget is now written down as a rule, not a vibe: Appendix B carries the novice/advanced load table for the opening scene, and the novice column is the default for every cold-start account per SAFE-COLD (tags come from engine evidence, never from age or self-report).

**Cycle 2 (against the assembled draft).** The second pass treated the finished draft as suspect and reran steps 2 through 8. Its three most damaging findings, all fixed by real edits, not notes:

**Weakness 4: beat 9's prose still described only the linear surprise.** The draft's §14 claimed a branched surprise while the beat itself showed one branch; an implementer working from the beat would have built the broken version. The numbers were wrong the same way: baseline watering is 12 ml/day (established by qb.garden.001), so the draft's "doubles the water, 20 to 40" both contradicted the baseline and, doubled from 12, would have landed *inside* the band and helped. *Rewrite:* beat 9 now carries both branches in full prose with corrected numbers (generous branch opens the tap past the 32 threshold; correct-prior branch lands in the low twenties and stalls on Maya's inherited 4-hour shutter), beat 10 gives branch A players the shutter admission before the sweep, and beat 12 no longer applies the model's shutter to an outdoor plant.

**Weakness 5: the capability unlocks contradicted the mission's own flow.** §10 granted "Use (Model Bed)" and "Build" on evidence that can only be produced *by* using the bed and building: a chicken-and-egg the systems check should never have let through. *Rewrite:* in-mission use is diegetic scaffolding under Maya's supervision (which is also why the cold start is playable); the capability graph grants the unsupervised versions of each verb for later sessions, and §10 now says so above the table.

**Weakness 6: the evidence artifacts disagreed with their own narration.** qb.garden.002's height data stepped +3, +3, +3, 0, then negative, contradicting both beat 6's "positive, shrinking, gone" and §7's under-band signature (decays toward zero, no reversal); Piko's gear puzzle referenced a twelve-tooth gear absent from the listed crate; the hotspot count differed between beat 6 and Appendix B; Chapter 2's need was unmotivated (one plant's band is a cupful anyone can carry). *Rewrite:* q2's sequence is now 41, 44, 46, 48, 49, 49 with shrinking differences and distractors rebuilt to match; the gear series lives in the amber joint windows with a twelve and a chipped nine in the crate; hotspots reconciled at six with locations named; Chapter 2's need is now the forty-row scale-up, which also makes the mission's opening arithmetic diegetic.

**Stop (step 10):** all mandatory gates pass after two rewrite cycles; loop halted. Unresolved risks reported honestly in §15 rather than cycled further.

## 15. Unresolved risks

1. **Founder Question #4 is still open, and this document cannot close it.** Nothing here proves the story layer is load-bearing versus gap-diagnosis plus a tutor. The slice is deliberately built so its learning spine (bed, journal, chips, assembler, items) runs with the fiction stripped to almost nothing, which is the honest hedge, and it makes the real experiment cheap: same spine, minimal-frame variant versus full slice, judged on retry behavior and challenge-seeking (FEI events), not enjoyment. Until someone runs that, every hour spent on Volume II lore is an unhedged bet, and this document says so out loud.
2. **Ontology domain tension.** The live ID space is math; the Commons fiction is botanical. The mapping is real (first differences, unit rates, means are genuinely the work), but the region blurb's "causality, plant systems" language flirts with promising science coverage the ontology cannot certify. Mitigated by the SAFE-COVER note in §5.1.1 and the Care Card's limitations field; not eliminated. If a science ontology ever ships, this mapping gets revisited by migration note, not retcon.
3. **Concept ID space is mid-migration.** `ml/data/ontology.json` (15 concepts, v0.2-pilot15) and `ml/data/ontology_complete.json` (37) disagree on IDs (`rates_proportion` vs `ratios_proportions`; `sequences_patterns` vs `sequences_series`). This document targets the versioned pilot file and says so everywhere, but if canonicalization (see `CONCEPT_ID_CANONICALIZATION_BUILD.md`) lands on the other space, every `concept_ids` field herein needs a migration pass. Flagged, not solvable here.
4. **The build flag.** AGENT_RULEBOOK §1.7 still says "do not build yet." This bible is the content spec that section was waiting on; the flag itself belongs to the engine lane. Slices A-D are ready to hand off; they must not be mistaken for permission.
5. **Collaborator support is designed but unsupported.** Deferred with a named partial mitigation; if co-op ever matters to the product, the garden loop needs a real session model, not a second author line.
6. **Katha's brand scope.** BRAND_BOOK §10 defines Katha's binding rules for Solver missions and story splashes ("never mentions the interface," "ends at the threshold"). This bible makes Katha a continuously present in-world character, which STORY_DIRECTOR.md (later canon) establishes, but the two documents have not been formally reconciled on "ends at the threshold." This bible keeps Katha off the UI everywhere; the scope question is flagged for a brand ruling, not silently overridden in either direction.
7. **Name collision: two Mayas, two Jordans.** BRAND_BOOK's student persona is named Maya and its parent persona Jordan; the world bible's cast includes Maya the Naturalist and Jordan the Cartographer. Both documents are canon and this bible follows the world bible's cast as written, but product copy that mentions "Maya" now has two referents. Flagged for the founder; if a rename ever happens it goes through a ledger migration note.
8. **Accessibility is a 3.** The named gaps (journal typography, input remapping, reduced motion) are specified nowhere in the repo's world lane. They should be acceptance criteria on Slice B/D, not a post-ship patch.
9. **Question items are drafts.** All three garden items are blocked from the live bank pending independent key verification per SAFE-GENQ; the preferred ship path is rewrapping verified bank items tagged to the same IDs. Shipping the drafts unverified would fail the gating rubric row that this document itself reports as passing, so: do not.
10. **Equity check is per-arc, not settled.** Volume I passes its own check (Appendix A, gate 10) with real notes, including the garden-familiarity assumption. Volumes II-V each owe their own pass; nothing about Aster being a constructed world settles Open Problem #6 permanently.

---

## Appendix A. Content-Gating Rubric results (STORY_DIRECTOR.md §3, all ten gates)

| Gate | Result | Evidence |
|---|---|---|
| Concept grounding | **PASS** | Every target concept in §5.1.1 and §5.2 resolves in `ml/data/ontology.json` v0.2-pilot15: `sequences_patterns`, `rates_proportion`, `statistics_averages`, `coordinate_slope`, `inequalities`, `words_to_equations`. Prerequisite edges used by the roadmap (`sequences_patterns` and `rates_proportion` into `coordinate_slope`; `sequences_patterns` into `words_to_equations`) exist in that file's edge list. No invented concept IDs anywhere in this bible. ID-space migration risk logged (§15.3). |
| Narrative load budget | **PASS** | Appendix B: written novice/advanced budget for the opening scene; novice path carries 3 named characters, zero mythology before the learning payoff, cold open to first interaction under 20 seconds; tags derive from engine evidence only. Enforced by §14 weakness 3, which removed a draft lore dump. |
| Mastery-authority | **PASS** | The shard mints only from the engine-verified evidence set (§5.1.4 `authority: deterministic_engine_only`); branch lighting and Constellation node consume `evt.shard_minted`; Katha's beat-13 dialogue canonically disclaims granting power; Slice C acceptance test forces each evidence-class absence and asserts no mint. |
| World-object reuse check | **PASS (documented)** | Checked 2026-09-05. `worlds/world2/`: models directory contains one glTF (ramenShop) plus baked-texture, matcap, screen-texture, draco/basis infrastructure and `data/actDiagnostic.json`; nothing garden- or house-shaped to reuse directly; the screen-texture and baked-lighting pipeline is reusable for House interior surfaces, and ramenShop is a strong future skin candidate for Lantern Market (noted in ledger, not used here). `app/src/world/MindCraftWorldScene.tsx`: RoomShell, DeskStation, BookNook, PlantLab, LearningHearth, ReadingNest, MissionBoard, Doorway, Tree, Workshop, OutdoorWorld, WindowScene, Flame, day/night Lighting, Avatar, CameraRig all exist and map nearly 1:1 onto the House at the Edge; §12 assigns reuse per slice. No fourth parallel world system is created by this bible. |
| Real-world scenario standard | **PASS (not triggered, checked anyway)** | The slice touches none of health, disasters, infrastructure, economics, or policy. The nearest edge is "plant care advice": mitigated anyway by the model-versus-reality distinction in character (beat 5), the limitations field (beat 15), and the SAFE-COVER note that no botany is taught or claimed. Ch4's irrigation timer is machinery in a garden, not infrastructure policy; the Fever Marsh standard will bind hard in later volumes and is noted in the ledger's forward rules. |
| Generated-content verification | **PASS (conditional, enforced)** | All three question items are marked DRAFT and blocked from the live bank pending independent key verification (§8, §15.9); preferred ship path is rewrap of already-verified bank items tagged to the same concept IDs. Nothing in this bible authorizes shipping unverified items. |
| Cold-start honesty | **PASS** | No pre-lit state anywhere; the grey tree plus brass plate is the visibly-labeled humble prior (beat 4); hide-correctness before any green (beats 7-11: stamps and world responses, no red/green marking); the first green anything appears only after the engine's mastery event. |
| Struggle designed, not assumed productive | **PASS** | The informative failure is sequenced generate-before-consolidate and branched so it fires for correct and incorrect priors alike (§14 revision 2); three failure signatures are distinct and each reveals a specific model fact (§5.1.1); no failure resets progress; Maya's feedback is diagnostic, never humiliating. |
| Coverage honesty | **PASS** | §5.1.1 states in canon that the mission teaches number patterns, unit rates, and averages, not botany; the Care Card's mandatory limitations field ships the same honesty in the player's own hand; §5.2 chapters name their concepts and depths; no material claims broader coverage than the mapped IDs. |
| Equity check per arc (Vol I) | **PASS (with notes)** | Run for this arc specifically: Aster is a constructed secondary world; the slice's imagery (a house, a garden, a stubborn plant, a stopped clock) crosses cultures with low specificity; cast names span origins and the sub-brand name Katha is existing brand canon; no real-world religion, nation, or mythology is referenced or required. Real notes, recorded rather than waved off: the garden premise assumes basic familiarity with growing things (houseplant-level, judged acceptable; monitored in playtesting with urban students); all dialogue is idiom-light for translation; reading level targets grade 5-6 for the novice path. Volumes II-V owe their own per-arc pass, especially Lantern Market (economics) and Fever Marsh (health). |

No gate failed. Gate 6's condition (verification before bank ship) is a blocking obligation on whoever ships, restated in §15.9.

## Appendix B. Narrative load budget, opening scene (SAFE-STORYLOAD)

Tag source: engine evidence only. A cold-start account is novice-tagged by definition (SAFE-COLD); advanced tagging requires prior mastery evidence, never age, never self-report, never a menu.

| Budget line | Novice-tagged | Advanced-tagged |
|---|---|---|
| Cold open to first interaction | under 20 seconds (window latch) | same scene; two extra readable objects (hearth page, clock face) |
| Katha's introduction | 4 lines, one deflection | 7 lines; the radio's late-night fragment unlocks (a story Katha tells to nobody, cut mid-ending) |
| Named entities before the garden | 3 (Katha, Piko, Maya) | 4 (plus the Archive, legible on the seal from the gate approach) |
| Mythology before the learning payoff | zero | one plaque flourish at the tree; still no Atlas/Quieting exposition |
| Mythology total, slice | one written line at beat 14, then silence | beat 14 line, radio fragment, coat detail live (Katha deflects, once) |
| Optional hotspots | 6 exist, none marked, none required | same 6, journal annotates two of them |
| Dialogue length cap | no NPC speech over 40 words | 60 words |
| Q-item representations | plain words and pictures; band stated verbally | differences column pre-revealed; band as compound inequality; slope chart view; second bed offer |
| Reading level | grade 5-6 | grade 7-8 |

Rule, binding on all future Volume I content: the novice column is the shipped default; every line item above must be re-budgeted per mission, and a mission whose novice path grows a mythology line item fails the gate, not the vibe check.
