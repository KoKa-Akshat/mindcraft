# MindCraft World Continuity Ledger

**Status:** live working ledger, seeded 2026-09-05 from `STORY_BIBLE_V1.md` (Volume I and the opening slice The Garden That Forgot Spring).
**Contract (binding on every future story session):**

1. **Query before writing.** Any new mission, dialogue, book, or region content checks the relevant tables here first: character knowledge boundaries, open mysteries, terminology, and unresolved consequences at minimum.
2. **Update after approval.** Approved content adds or amends rows in the same change that ships it.
3. **Never retcon silently.** A canon change requires a migration note appended to §13, identifying affected missions, dialogue, books, assets, and saved-world assumptions.
4. Rows marked **PROJECTED** describe roadmap intent (Chapters 2 to 4) and become established only when those missions ship through the full review loop. Rows marked **PROVISIONAL** are hidden canon the current director intends but future volume development may amend, with a migration note.
5. House style for all story content: no em dashes and no en dashes, anywhere, including prose. Novice narrative budget rules per STORY_BIBLE_V1 Appendix B are binding per mission.

ID conventions: FACT (canon fact), TIME (timeline), CHAR (character record), MYST (open mystery), CLUE (planted clue), PROM (promise to the player), REG (region state), INFO (visibility), TERM (terminology), VER (model/Blueprint/item versions), UNRES (unresolved consequence). A machine-readable index sits in §14.

---

## 1. Canon facts

| ID | Fact | Established |
|---|---|---|
| FACT-001 | The world is Aster, once connected by the Living Atlas, a network holding not only answers but the histories of how understanding was reached. | World bible |
| FACT-002 | The Quieting caused the world to forget why things happen, not facts. The Atlas fragmented into Knowledge Shards; its visible traces form the Constellation. | World bible |
| FACT-003 | The player is a Wayfinder: able to reveal faint causal connections and turn evidence into working change. | World bible |
| FACT-004 | The long-mystery sentence, found in fragments across regions: "The Atlas was not broken. It was closed." Only the first half exists in any player-visible form so far (CLUE-002). | World bible; Ch1 beat 14 |
| FACT-005 | Shards, capabilities, branch lightings, and unlocks are records of engine-verified evidence events. No character grants them; Katha states this in canon dialogue (Ch1 beat 13). | STORY_BIBLE_V1, engine authority note |
| FACT-006 | The House at the Edge holds the Knowledge Tree (grey glass, unlit lanterns, brass plate reading NOTHING IS KNOWN YET. THIS IS AN HONEST PLACE TO START), a locked Workshop, the Room of Pages, a stopped clock, a hearth, and a Desk by the window. | Ch1 |
| FACT-007 | The House clock ticks exactly once per shard minted. Count persists in world state. What it counts toward is deliberately unresolved (MYST-007). | Ch1 beats 14, 17 |
| FACT-008 | The sunwick is a small paired-leaf plant, the last living seedling from Row 7, planted by Maya's sister. Its model-verified needs: water 18 to 28 ml/day and light 6 to 10 h/day (band peak 23 ml, 8 h). Overwater past about 32 ml/day yellows tips in two days; underwater slows growth toward zero without yellowing. | Ch1; hidden model §7 of the bible |
| FACT-009 | Maya ran 40 days of daily height measurements before Day 0; baseline care was 12 ml/day, below band, and the model bed's shutter sat at 4 h/day because Maya turned it down weeks earlier and forgot. | Ch1 |
| FACT-010 | The model bed is a copper-framed MicroSim twin of the pot, built from parts found in the House yard. Maya's canon framing: "It is a guess about a plant. It is not a plant." Model runs and reality are never conflated in dialogue. | Ch1 beat 5 |
| FACT-011 | Unstamped model runs render as grey mist in the journal and produce no evidence. Exploration is free; memory requires a bet. | Ch1 beat 7 |
| FACT-012 | The first Causal Shard (shard.causal.rate_pattern.v1) exists, minted from the player's triangulated evidence; the Knowledge Tree's first branch is lit; one Constellation node shines. Everything else on the tree remains grey. | Ch1 beats 13, 14 |
| FACT-013 | The Sunwick Care Card v1 exists, co-signed by the player and Maya, with a mandatory limitations field: tested on one plant, in a model, for one week. | Ch1 beat 15 |
| FACT-014 | The Archive of Finished Things marks surveyed defects with grey metal seal tags. The Commons garden tag reads: COMMONS GARDEN, PLOT 1. SURVEYED. DEFECT LOGGED. A CERTIFIED SOLUTION IS BEING PREPARED. PLEASE DO NOT ATTEMPT REPAIR. It was placed about four months before Day 0. Nobody came. | Ch1 beat 16 |
| FACT-015 | Piko is assembled from pale wood, copper ribs, a chest Knowledge Shard, and an unfinished simulation. Its brass-leaf tail is an honest uncertainty display; its gear series runs 6, 8, 10, 12 teeth. Piko will not walk under the unlit tree and would not pass the sealed gate. | Ch1 beats 2, 4, 16 |
| FACT-016 | Katha manifests through the radio, lamplight, and dust-writing signed with a small flame; Katha's secret (player-hidden): a surviving fragment of the Living Atlas created to preserve the paths by which understanding was reached. | World bible; Ch1 |
| FACT-017 | The Commons garden's Plot 1 holds permanent color; the sunwick lives on the House windowsill with a bud the color of a struck match. | Ch1 beats 12, 15 |
| FACT-018 | A coat that is not the player's lies on the House window seat, smelling of cedar and rain. Its owner is hidden canon (INFO-H3). | Ch1 beat 1 |
| FACT-019 | The model bed's copper frame carries a maker's mark (explorer hotspot). The dead pump behind the Workshop door carries the same mark (PROJECTED, Ch2). | Ch1; Ch2 outline |
| FACT-020 | Target concepts for the slice resolve in `ml/data/ontology.json` v0.2-pilot15: sequences_patterns, rates_proportion, statistics_averages; advanced coordinate_slope, inequalities; Ch4 adds words_to_equations. The mission teaches number patterns, unit rates, and averages, not botany, and claims nothing wider. | STORY_BIBLE_V1 §5.1.1 |
| FACT-021 | Vale leads the Archive; he is calm, protective, competent, not cartoonish; he survived an invention that destroyed his childhood community. He does not appear in Volume I. | World bible |
| FACT-022 | Surveyor Bell (PROJECTED until Ch4 ships): polite, dust-grey coat, genuinely good at the job, four months late, sorry about it; installs a sealed irrigation timer that works; files "local variance, noted" after seeing the band evidence. | Ch4 outline |

## 2. Timeline

Relative anchor: **Day 0 = the player wakes in the House.** Absolute dates are deliberately unfixed.

| ID | When | Event | Status |
|---|---|---|---|
| TIME-001 | Years before Day 0, unfixed | The Quieting begins; the Atlas fragments. How long ago is CANON-UNFIXED on purpose; do not state a number anywhere. | Established |
| TIME-002 | Before the Quieting, unfixed | The invention disaster that shaped Vale's childhood. Its relation to the Quieting itself: deliberately unfixed. | Established |
| TIME-003 | Seasons before Day 0 | Maya's sister plants Row 7; later vanishes while investigating the Quieting. Order of planting versus vanishing: planting first. | Established (sister unnamed, see CHAR-007) |
| TIME-004 | About Day -120 | Archive seal tag placed on the Commons garden gate. | Established |
| TIME-005 | Day -40 to Day 0 | Maya measures the sunwick daily; growth pattern: positive, shrinking, gone. | Established |
| TIME-006 | Day 0 | The slice: wake, Piko, Katha, tree, garden, model week, restoration begun. | Established |
| TIME-007 | Day 1, morning | The sunwick buds. Shard minted, branch lit, clock ticks once, Care Card authored, seal discovered, vista promise. | Established |
| TIME-008 | Days 2 to about 30, one season at most | Chapters 2 to 4: pump, meadow census, Surveyor Bell and the timer, one cold snap, volume close with the second vista. | PROJECTED |

## 3. Character records

Format per character: knows / wants / fears / contradiction / relationship states (current, end of slice; PROJECTED for volume end).

**CHAR-001 The Wayfinder (player).**
Knows: everything player-visible in INFO §9; nothing hidden. Wants and fears: authored by play. Relationships at slice end: Piko imprinted (permanent); Maya trust tier 1 (working partners, first-name basis, she keeps the Card copy); Katha warm but twice observed evading. PROJECTED volume end: Maya tier 2; Bell met once, mutually respectful; Vale never met.

**CHAR-002 Katha, Keeper of Unfinished Stories.**
Knows (hidden from player): what the tree was, what the Atlas was, what the Quieting was, who last lived in the House, what Katha itself is. Wants: the player to stay; a story whose ending Katha does not know; to never be asked the tree question directly. Fears: endings; being fully known. Contradiction: celebrates uncertainty while curating what the player learns and when. On-record evasions after the slice: two (the middle-of-story deflection, beat 3; the filing line plus radio station change, beat 16), plus the lamp moving away at beat 14. Rule: every Katha evasion must be witnessable on replay; Katha never lies outright in Volume I. Voice rule: never references UI chrome; theatrical, affectionate, no line over 40 words on the novice path. Relationship to Maya: she believes Katha is "the House's voice," nothing more.

**CHAR-003 Maya, Naturalist of Hidden Systems.**
Knows: her sister planted Row 7 and vanished investigating the Quieting (says only "my sister planted these" in Ch1; full admission PROJECTED Ch3); forty days of data; that she set the model shutter to 4 hours (admits it when caught, beat 9B or 10). Does not know: anything hidden in INFO §9; that the handwriting in the House journal matches the tin note (PROJECTED Ch3 clue, and she does not notice it herself). Wants: the sunwick alive; mechanisms, not comfort; forty rows on the Care Card before the season turns (PROJECTED Ch2). Fears: vague explanations; losing the last living link to her sister's rows. Contradiction: treats living systems as fully knowable one-dial machines; dented on screen in Ch1 ("It is not one dial. I hate that. Keep going."), not resolved. Canon speech rules: never says "wrong" about a run; "Sad is not a mechanism"; writes down the nothings. Age: about thirteen. NOTE: name collides with the BRAND_BOOK student persona Maya; flagged in STORY_BIBLE_V1 §15.7, unresolved, do not rename silently.

**CHAR-004 Piko, The First Working Thing.**
Knows: nothing at first; learning everything; recognizes the player permanently after beat 2. Wants: nearness to the player; a steady tail. Fears: its own reflection (fading); the unlit tree and the sealed gate (persistent avoidances, unexplained). Contradiction: built from a spec, keeps exceeding it in small unprogrammed ways. Tail: honest uncertainty display bound to evidence coverage of the active claim; never a hint engine. Maker: deliberately unassigned (MYST-006).

**CHAR-005 Director Vale, Keeper of Certainty.**
Knows: unrevealed. Wants: no child harmed by someone else's reckless idea; stability. Fears: a repeat of his childhood loss. Contradiction: mistakes removing agency for removing danger. Volume I presence: institution only (tag, crate, Bell), face never shown, name never spoken in the Commons. Do not put Vale on screen before Volume II at the earliest.

**CHAR-006 Surveyor Bell (minor). PROJECTED until Ch4 ships.**
Knows: Archive procedure; nothing of Katha, shards, or the player's history beyond the filed defect. Wants: to do the job well; genuinely to help. Fears: filing an inaccurate report. Contradiction: kind in person, employed by a system that cannot see persons; files "local variance, noted" because a window will not fit in a single-number form. Asks, mildly, where the seal tag went if it is missing.

**CHAR-007 Maya's sister. Deliberately unnamed in Volume I.**
Everything about her beyond FACT-008/TIME-003 and the Ch3 tin note is hidden or provisional (INFO-H3, INFO-H4). Naming her, showing her face, or fixing her fate is a Volume II+ decision requiring a migration note.

## 4. Open mysteries

| ID | Mystery | Planted | Player-visible? | Payoff window | Owner notes |
|---|---|---|---|---|---|
| MYST-001 | "The Atlas was not broken." What is the rest, and what does it mean? | Ch1 beat 14 dust-writing | Yes, one line | Second fragment: Vol II or III, a far region. Meaning: Vol IV to V | Never explain early; Katha never comments |
| MYST-002 | What happened to Maya's sister? | "My sister planted these" (Ch1); tin note (Ch3, PROJECTED) | Yes | Trail: Vol II. Truth: Vol IV | Volume I never chases her; Maya asks for rows kept alive, not a search |
| MYST-003 | What is Katha? | Two evasions + lamp retreat + radio station change (Ch1) | Felt, not stated | Vol IV (Katha's omissions damage group trust, per world bible) | Every evasion logged here as it ships |
| MYST-004 | Who built the model bed and the pump; whose coat; whose handwriting? | Maker's mark hotspot (Ch1); pump mark (Ch2); handwriting match (Ch3) | Explorer-visible | Hints Vol II; converges with MYST-002 in Vol IV | See INFO-H3/H4 for current hidden intent |
| MYST-005 | Why did the Archive never come back for Plot 1? | Seal date, beat 16 | Yes | Vol III: the Archive triages whole regions; certainty has a queue | Seeds the Vol III theme; Bell does not know |
| MYST-006 | Who made Piko, and can a simulation exceed its specification? | Crate stenciled UNFINISHED; Piko's small excesses | Ambient | Maker: deliberately unassigned, decide by Vol II development with migration note. The bigger question: series-long, never fully closed | World bible marks this a continuing question |
| MYST-007 | What is the House clock counting toward? | One tick per shard (Ch1) | Attentive players | Vol V | Do not resolve before the finale |

## 5. Planted clues

| ID | Clue | Where | Feeds | Visibility |
|---|---|---|---|---|
| CLUE-001 | Grey seal tag, dated four months back, nobody came | Ch1 beat 16 | MYST-005, Archive arc | All paths |
| CLUE-002 | Dust-writing: "the Atlas was not broken", flame signature, sentence unfinished | Ch1 beat 14 | MYST-001 | All paths, one line, then silence |
| CLUE-003 | The coat that is not the player's, cedar and rain | Ch1 beat 1 hotspot | MYST-004 | Explorer/advanced; Katha deflects once if asked |
| CLUE-004 | Maker's mark on the model bed's copper frame | Ch1 beat 6 hotspot | MYST-004 | Explorer |
| CLUE-005 | Piko's sleeping tail steadies and points at the river | Ch1 beat 17; again Ch4 close | Vol II opening | All paths |
| CLUE-006 | Radio's late-night fragment: a story Katha tells to nobody, cut mid-ending | Advanced-tagged path only | MYST-003 | Advanced |
| CLUE-007 | Half-burnt page in the hearth | Ch1 hotspot | MYST-003/MYST-004 (content deliberately undecided; decide with migration note before referencing) | Explorer |
| CLUE-008 | Pump's maker's mark matches the bed's | Ch2, PROJECTED | MYST-004 | Explorer |
| CLUE-009 | Tin note: "Row 7. If they stop waking, start with what changed." | Ch3, PROJECTED | MYST-002; the sentence is also a Wayfinder method statement, reusable much later | All paths in Ch3 |
| CLUE-010 | Tin-note handwriting matches older House journal entries | Ch3, PROJECTED | MYST-002 + MYST-004 convergence | Explorer; nobody confirms |
| CLUE-011 | Bell's pamphlet: THE ARCHIVE MAINTAINS THE RIVER GATES | Ch4, PROJECTED | Vol II hook (river region) | All paths |
| CLUE-012 | Snail's silver track avoids one garden row | Ch1 hotspot | Unassigned flavor; may be promoted to a clue only via migration note | Explorer |

Rule: no clue ships without a row here carrying a payoff window. CLUE-007 and CLUE-012 are the only deliberately unassigned plants; anything built on them must update this table first.

## 6. Promises to the player

Promises are debts. Breaking one requires a migration note and a very good reason.

| ID | Promise | Made | Due |
|---|---|---|---|
| PROM-001 | The fog rolls back; a much larger world exists (two mountains and a silver river, warm lanterns, a geometric glow) and the player will reach it | Ch1 beat 17 vista | Vol II onward, progressively; the river first |
| PROM-002 | "The House holds what you made": everything preserved in the House persists across sessions | Katha, Ch1 beat 17 | Every session, forever; binding on engineering via world_state |
| PROM-003 | Grey is not lack; everything grey can, with evidence, be lit | Katha, Ch1 beat 14; brass plate | Continuous; no branch ever lights without a real mastery event, and no lit branch ever silently unlights |
| PROM-004 | Katha's endings question will eventually be faced (implicit in the deflections; the audience contract of an evasive narrator) | Ch1 beats 3, 14, 16 | Vol IV to V |
| PROM-005 | The Archive has now seen the player's evidence and filed it ("local variance, noted") | Ch4, PROJECTED | Must matter in Vol III (the file resurfaces); do not let it vanish |
| PROM-006 | Piko's pointing means something | Ch1 beat 17 | Vol II opening confirms the river |

## 7. Region states

**REG-COMMONS-BEFORE (Day 0, established).** House dormant, clock stopped, dust; Workshop locked; Room of Pages quiet, endings missing; Knowledge Tree grey, all lanterns unlit, brass plate in place; garden grey-green, sunwick failing on 12 ml/day and bench shade; seal tag on gate, four months weathered; crate under workbench (Piko); meadow to thistle; cave boarded; Mission Hall board empty; fog static at the edge.

**REG-COMMONS-AFTER-CH1 (Day 1, established).** Plot 1 holds color; sunwick budded, on the House windowsill, waterable in later sessions; tree branch 1 lit, rest grey; one Constellation node; clock ticked once (count = 1); Garden Ledger p.1 in the Room of Pages; Care Card v1 pinned; model bed operational, second bed offerable; seal tag on gate or in House drawer per player choice (UNRES-002); hearth banked once; Piko active companion; Workshop still locked; fog unchanged except the one-minute vista.

**REG-COMMONS-AFTER-CH2 (PROJECTED).** Workshop open; pump running geared under well recovery rate; Flow Box available; certified part kept or refused (UNRES-006); regulator Blueprint formalized if built.

**REG-COMMONS-AFTER-CH3 (PROJECTED).** Meadow sampled and partially cleared; seed stock ledgered; Garden Ledger a true Living Book with data pages; tin note found; Maya trust tier 2.

**REG-COMMONS-AFTER-CH4 (PROJECTED).** Archive timer installed and running, kept/removed/hybrid per choice (UNRES-003); Mission Hall board waking with region notices; pamphlet in the House; second vista shown; volume closed.

**Forward rule for all other regions:** Fever Marsh and any health/disaster/infrastructure/economics/policy content binds to the Real-World Scenario Standard with no flavor exception; Lantern Market (economics) and Fever Marsh (health) owe full provenance/uncertainty/dignity/safety review and their own per-arc equity checks before any content ships.

## 8. Terminology

| Term | Meaning and usage rules |
|---|---|
| Aster | The world. Constructed secondary world; tied to no real culture's mythology. |
| The Quieting | The event that made the world forget why things happen. Never dated. Never explained in Vol I. |
| Living Atlas | The former network of understanding-histories. Vol I: named only in the world bible, never in player-facing Vol I text except CLUE-002's half-line ("the Atlas"). |
| Constellation | The Atlas's visible traces in the sky; also the learner's evolving knowledge graph. One node lit after Ch1. |
| Knowledge Shard | Crystallized demonstrated understanding; unlocks capabilities. Only the engine mints them. |
| Causal Shard | Shard subtype recording a supported causal claim with cited evidence. First: shard.causal.rate_pattern.v1. |
| Wayfinder | The player's role. Not "chosen one"; the term implies method, not destiny. |
| House at the Edge | Player home: workshop, library, laboratory, gallery, mission center, spatial record of growth. "The House wakes" is literal: clock ticks per shard. |
| Knowledge Tree | Grey glass tree of shard-lanterns behind the House. "Unlit, not dead" is the mandatory framing; never "empty," never "failed." |
| Model bed | The copper-framed MicroSim garden bed. Always distinguished from the real plant in dialogue. Plural later: beds. |
| Sunwick | Invented plant, paired leaves, bud the color of a struck match. The last seedling is from Row 7. |
| Row 7 | The sister's planting row. Say "Row 7," not "the sister's row," in player-facing text until Ch3. |
| The band / the window | The sunwick's tolerance range. Maya's word is "window." Advanced representation: compound inequality. |
| Grey mist | What an unstamped run condenses to in the journal: visible, unusable, honest. |
| Claim chip / Claim Assembler | Structured prediction and explanation objects; the serialized forms of bets and supported claims. |
| Observation Journal | The bench-lid evidence store: time series, differences column, chart view. |
| Garden Ledger | The Room of Pages book that grows from journal pages into a Living Book (Ch3). |
| Sunwick Care Card | The first Blueprint; provenance, cited tests, mandatory limitations. |
| Archive of Finished Things | Vale's institution. Player-facing order of encounter: tag, crate, person. "The Archive files things." |
| Certified Solution / Certified Parts | Archive deliverables: sealed, effective, uninspectable. Never mocked; they work. |
| Seal tag | The grey metal defect tag. Full text fixed in FACT-014; quote exactly. |
| Surveyor | Archive field rank (Bell). Not "agent," not "inspector." |
| Piko's tail | Uncertainty display. Never called a meter in dialogue; characters read it like weather. |

## 9. Player-visible versus hidden information

| ID | Information | State |
|---|---|---|
| INFO-V1 | Everything in REG-COMMONS-AFTER-CH1, the seal text, the half-line, Maya's "my sister planted these," Piko's pointing | Player-visible |
| INFO-V2 | The three question items and all journal evidence | Player-visible, player-owned |
| INFO-H1 | Katha is a surviving fragment of the Living Atlas | Hidden. Reveal window: Vol IV |
| INFO-H2 | Vale's backstory and the Archive's internal reasoning | Hidden. Vale unseen in Vol I |
| INFO-H3 | The coat belongs to Maya's sister, who was the last person to try to wake the House | Hidden, PROVISIONAL (intended canon; Vol II development may amend with migration note) |
| INFO-H4 | The sister built the model bed and the pump; the maker's marks and the House-journal handwriting are hers | Hidden, PROVISIONAL, converges MYST-002 and MYST-004 in Vol IV |
| INFO-H5 | Why the Archive never returned: triage; the Commons ranked below other regions | Hidden. Reveal: Vol III |
| INFO-H6 | The hidden model numbers of the bed (band, thresholds, light interaction) | Hidden from UI as numbers; discoverable as behavior; fixed for engineering in STORY_BIBLE_V1 §7 |
| INFO-H7 | What the clock counts toward | Hidden. Vol V |

## 10. Model, Blueprint, and item versions referenced by the story

| ID | Artifact | Version | Status |
|---|---|---|---|
| VER-001 | Concept ID space | `ml/data/ontology.json` v0.2-pilot15 | Binding reference for every concept_ids field; migration risk logged (bible §15.3) |
| VER-002 | Model Bed hidden model | v1 (parameters in bible §7) | Spec fixed; not built (AGENT_RULEBOOK §1.7 flag) |
| VER-003 | shard.causal.rate_pattern.v1 | v1 | Spec fixed; engine-mint only |
| VER-004 | blueprint.sunwick_care_card | v1 | Player-authored artifact schema fixed |
| VER-005 | blueprint.drip_regulator | v1 draft | Formalized in Ch2 if built in Ch1 |
| VER-006 | qb.garden.001 / 002 / 003 | v1 | DRAFT; blocked from live bank pending independent key verification (SAFE-GENQ); preferred ship path is rewrap of verified bank items on the same concept IDs |
| VER-007 | Mission | mission.commons.garden_spring.v1 | Content-complete; build gated by engine lane |

## 11. Unresolved consequences

| ID | Consequence | Origin | Comes due |
|---|---|---|---|
| UNRES-001 | Excess nutrient drops are "retained in soil"; journal logged, nothing visible in 7 days | Ch1 beat 8 | Deliberately open; candidate callback Ch3 (soil tests) or Vol III (small unintended consequence of the player's own habits) |
| UNRES-002 | Seal tag left on gate or taken into the House drawer | Ch1 beat 16 choice | Ch4: Bell asks where it went; drawer opens or the lie is told, both recorded |
| UNRES-003 | Timer kept, removed, or hybrid | Ch4 choice, PROJECTED | Vol III: the player's own automation and its unintended consequences |
| UNRES-004 | Clock tick count | Every shard | Vol V (MYST-007) |
| UNRES-005 | Grey mist runs: currently pure loss; should any later capability let a player retroactively stamp and recover them? | Ch1 design | Open design question; decide before Vol II ships, migration note either way |
| UNRES-006 | The certified part that fits perfectly and cannot be opened, kept or refused | Ch2, PROJECTED | Vol III inspectability arc |
| UNRES-007 | Maya's one-dial worldview: dented, not resolved | Ch1 beat 9/10 | Her whole arc; world bible marks the contradiction as long-running |
| UNRES-008 | Two-Mayas and two-Jordans naming collision with BRAND_BOOK personas | Bible §15.7 | Founder decision; any rename is a migration note touching every dialogue line |

## 12. Planned payoff windows (summary)

| Window | Due items |
|---|---|
| Vol II | CLUE-005/PROM-006 (river confirmed); MYST-002 trail; MYST-004 hints; MYST-006 maker decision (with migration note); UNRES-005 decision |
| Vol III | MYST-005 reveal (Archive triage); PROM-005 (the filed variance resurfaces); UNRES-003, UNRES-006 come due |
| Vol IV | MYST-003 (Katha), MYST-002 truth, MYST-004 convergence; PROM-004 |
| Vol V | MYST-001 meaning; MYST-007/UNRES-004 (the clock); the governance finale per the world bible |

## 13. Migration notes

None yet. Append here; never edit history above without a note.

## 14. Machine-readable index

```yaml
ledger_version: 1
seeded_from: STORY_BIBLE_V1.md
date: 2026-09-05
id_space: ml/data/ontology.json@0.2-pilot15
entries:
  facts:        {established: [FACT-001, FACT-002, FACT-003, FACT-004, FACT-005, FACT-006, FACT-007, FACT-008, FACT-009, FACT-010, FACT-011, FACT-012, FACT-013, FACT-014, FACT-015, FACT-016, FACT-017, FACT-018, FACT-020, FACT-021],
                 projected: [FACT-019, FACT-022]}
  timeline:     {established: [TIME-001, TIME-002, TIME-003, TIME-004, TIME-005, TIME-006, TIME-007], projected: [TIME-008]}
  characters:   [CHAR-001, CHAR-002, CHAR-003, CHAR-004, CHAR-005, CHAR-006, CHAR-007]
  mysteries:
    - {id: MYST-001, payoff: [vol2, vol5]}
    - {id: MYST-002, payoff: [vol2, vol4]}
    - {id: MYST-003, payoff: [vol4]}
    - {id: MYST-004, payoff: [vol2, vol4]}
    - {id: MYST-005, payoff: [vol3]}
    - {id: MYST-006, payoff: [vol2, open_ended]}
    - {id: MYST-007, payoff: [vol5]}
  clues:        {assigned: [CLUE-001, CLUE-002, CLUE-003, CLUE-004, CLUE-005, CLUE-006, CLUE-008, CLUE-009, CLUE-010, CLUE-011],
                 unassigned: [CLUE-007, CLUE-012]}
  promises:     [PROM-001, PROM-002, PROM-003, PROM-004, PROM-005, PROM-006]
  regions:      {established: [REG-COMMONS-BEFORE, REG-COMMONS-AFTER-CH1],
                 projected: [REG-COMMONS-AFTER-CH2, REG-COMMONS-AFTER-CH3, REG-COMMONS-AFTER-CH4]}
  hidden_info:  {fixed: [INFO-H1, INFO-H2, INFO-H5, INFO-H6, INFO-H7], provisional: [INFO-H3, INFO-H4]}
  versions:     [VER-001, VER-002, VER-003, VER-004, VER-005, VER-006, VER-007]
  unresolved:   [UNRES-001, UNRES-002, UNRES-003, UNRES-004, UNRES-005, UNRES-006, UNRES-007, UNRES-008]
  migration_notes: []
```
