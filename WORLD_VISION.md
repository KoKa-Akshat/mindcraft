# MindCraft: A World Written in Math

*This is not a spec. This is the why. Read it before you touch anything.*

---

## 1. The Problem

Math education treats math as a destination — a thing to get through, a gate between a student and the rest of her life. We hand kids the finished machinery of four thousand years of human curiosity, stripped of every reason it was built, and act surprised when they feel nothing. A student learns to "complete the square" without ever knowing that al-Khwarizmi was literally completing a square — drawing it, cutting it, needing it. She performs the operation. She never feels the force that made it necessary.

The result is everywhere: anxiety, avoidance, the quiet self-sentencing of "I'm just not a math person." That sentence is almost never a verdict about a student's mind. It's a verdict about the story she was told — or rather, the story she wasn't. This is not a learning problem. It is a narrative problem. And narrative problems don't get fixed with more worksheets. They get fixed by giving the math back its world.

## 2. The Vision: Math as a World

Here is what we are building: a living world — not a game, not an app, a **world** — where every math concept is the key to a real place. Navigation requires trigonometry. Markets require ratios. Buildings stand because of geometry and fall without it. Code runs on functions. A student who loves the ocean gets the ocean: a boat, a bearing to hold, a current that pushes back. A student who loves music gets a recording studio where frequency and harmony stay locked behind algebra until the algebra opens them.

Each student's world is shaped by what she knows, what she's curious about, and what her tutor believes she needs. It expands as mastery grows. Fog lifts from the map. Locked rooms open. New characters appear on the dock. The boat goes further than it could last week — and she knows exactly why, because she's the one who learned to steer it.

And here is the part that matters most: the math problems are not interruptions. They are the puzzles that advance the story. Solve the bearing problem and the ship moves. Get it wrong and the current pushes you off course — no red X, no buzzer, just the world responding honestly. Feedback stops being judgment and becomes physics. The student stops asking "did I get it right?" and starts asking "why did the ship drift?" — the question a mathematician asks.

We already have the seed. There is a 3D world at `worlds/world2/` where students walk around right now. There is a character named Jesse. There is a boat. There is an ocean. There are 42 story worlds, one per concept, each with a real protagonist and a real place. This isn't a dream we're pitching. It's a place we've started building.

## 3. The Three Pillars

**Stories.** Every concept has a world with a history, a protagonist, and problems only that math can solve. Not metaphors — real connections. Thales at Giza wasn't using ratios as a metaphor; he was measuring a pyramid he couldn't climb. Simon Stevin invented decimals because army paymasters were suffering over twelfths of guilders by candlelight. Cardano gambled in a Bologna tavern; probability was his rent money. Forty-two of these stories are already written and shipping in `conceptStories.json`. They are the load-bearing walls.

**Proven Questions.** The question bank is not a worksheet. It is the puzzle library of the world. 1,500+ questions from real exams, competitions, and datasets — Eedi, ACT, OpenStax, AMC — every one tagged, leveled, and formatted. When a student navigates by bearing, the question *is* the bearing. The answer *is* the ship moving. The world must not lie: a puzzle a real exam once asked is a puzzle the real world once needed answered.

**Tutor Support.** A human mentor who knows the student's world. Who sets focus areas that appear as highlighted regions on the map. Who gets a weekly digest of where the student wandered and where she got stuck. The tutor is the guide, not the grade — the person on the dock saying "try northeast this time," and meaning it about both the boat and the algebra.

## 4. The Roadmap: Three Horizons

**Horizon 1 — Now (the seed).** Story frames above every question. The ConceptChapterPage as a storybook you flip through — cover, story, puzzles. The knowledge graph as a constellation. The gap scan as a mission briefing. The dashboard as a command center. All of this exists today: the narrative layer laid over the math layer, proving the two belong together.

**Horizon 2 — After first funding (the world).** Jesse's 3D world becomes the primary interface. The concept stories inhabit it: the House of Wisdom is a building you walk into, the Bologna tavern a lit doorway on the map. Your knowledge graph becomes literal terrain — mastered concepts are unlocked regions, gaps are fog. Tutors appear as characters you can ping. The boat navigation puzzle is a real puzzle in the world, not a metaphor for one.

**Horizon 3 — Scale (personalization).** Procedural generation. The world adapts to what each student loves. The music kid gets a studio where every upgrade demands a new concept. The space kid gets an observatory. The same 42 concepts, a thousand different worlds, the question bank feeding whichever world the student stands in — stories generated at the intersection of her interests and the concept in front of her. Never one thing. Always the intersection.

## 5. What This Is Not

- **Not another adaptive learning platform.** Those optimize for correct answers. We optimize for understanding — the world doesn't care if you guessed right; it cares if you can steer.
- **Not gamification.** Points and badges are noise. Narrative is signal.
- **Not a replacement for tutors.** The tutor is the human layer no world can replicate. The world makes the tutor more powerful, never obsolete.
- **Not a test prep tool.** Though students who live in the world get dramatically better at tests — the way sailors get good at knots.

## 6. The Student This Is For

Her name is Maya. She's 16. She thinks she's bad at math — not because she can't think, but because no one has ever shown her that math is the language the world was written in. She's curious about design, about music, about why buildings don't fall down. She doesn't need an easier math class. She needs a reason.

Minute one: instead of a placement test, Maya gets a mission briefing. The gap scan asks how she feels about each territory — not to rank her, but to chart where the fog is. Nothing is graded. Nothing is red. By minute five she has a map of her own mind, honest and unashamed, and a command center: *here's your weak spot, here's what to learn next, here's your guide.*

By minute twelve she's opened her first concept chapter. It reads like a book because it is one — a cover, a story about a real person with a real problem, pages she turns herself. Then the questions arrive, and they aren't a quiz bolted to the end; they're the problem the protagonist faced, handed to her. She misses one. The world doesn't scold her; it shows her where the current took her. She tries again. At minute twenty she looks up and realizes she wasn't enduring math. She was somewhere.

## 7. The Infrastructure That Makes Scale Possible

The world isn't built once. It's built in layers, each one modular enough to be replaced, extended, or swapped without touching the others.

**Question pipelines.** The Eedi ingestion (`ml/scripts/ingest_eedi.py`) proved the pattern: a source adapter → filter → normalizer → annotator → validator → output. The new multi-source pipeline (`ml/scripts/pipeline/`) generalizes this to OpenStax (84K exercises cached), AMC competitions, Khan Academy, and any future source. Each source is a 200-line file that knows its own tag format and hands clean `Question` objects to shared infrastructure. Adding a new source — AMC 12, IB past papers, UKMT — is adding one file. This is intentional. Data must scale faster than engineering hours.

**Story pipelines.** `story_generator.py` samples 3 real questions per concept before generating a story world, so the setting is always compatible with the actual problems. This breaks the most common failure mode: a 1585 bookkeeper wrapping questions about calculators. Stories get regenerated when their quality falls below threshold — the pipeline is rerunnable, not a one-time ritual.

**Ontology as the spine.** The 42-concept ontology with 179 ingredients, 16 bridges, and 450+ question instances isn't just a lookup table — it's the canonical ID space that joins every data layer. Every pipeline writes `conceptId` as a canonical slug. Every source maps to this space. When we expand to science or history, we add concepts to the ontology first, and all pipelines inherit the new ID space automatically.

**MCP and AI connections.** The architecture intentionally leaves seams for LLM integration: the story module calls Groq, the check-in agent calls Claude, the webhook calls Anthropic. The next integration layer — AI tutors with access to a student's full knowledge graph, concept stories, and Firestore history via MCP — is already implied by how these seams are shaped. The student's world isn't just a UI; it's a context that an AI guide can read and reason about. Claude with MCP access to the graph can say "you've mastered derivatives but keep failing the chain rule bridge — here's what that means in Jesse's world." That's Horizon 2.

## 8. The Roblox Dimension

The co-founder is building in Roblox. This isn't a distraction — it's the fastest path to Horizon 3.

Roblox reaches 70M daily active users, most of them the age of Maya. The social graph is already there. The avatar is already there. The student who builds a game on Roblox and realizes she needs to understand probability to make the loot drops feel fair — that student is already in the world. She just doesn't know it yet.

The bridge between the Roblox world and the MindCraft knowledge graph is a small seam: a Roblox game calls an API endpoint, passes a student ID and a math concept encountered in the game, and the graph updates. Jesse's boat navigating by trig and the Roblox game where probability governs loot drops are the same concept, expressed differently. The 42-concept spine handles both.

Stay modular. Stay API-first. The 3D world at `worlds/world2/` and the Roblox world are not competitors — they're two skins on the same graph.

## 9. What the Story Experience Must Feel Like

This deserves its own section because it's the one thing that can't be fixed with a backend hotfix.

Stories are not UI copy. They are the atmosphere the student walks into before a question lands. Every element must be considered:

- **Typography.** Source Serif 4 at 17px/32px with a drop cap. Not Inter, not a sans-serif. The story body is a book, not a dashboard.
- **The scene stamp.** Before the first sentence, the student sees who she's following and where: *William Harrison · At sea, bound for Jamaica, 1761.* She knows whose problem she's inheriting before she reads a word.
- **The ruled margin.** The story body has horizontal rules and a left margin accent line. This is intentional. It feels like a journal entry, not a web page.
- **Question integration.** The story-module rewraps question stems so the problem *is* the protagonist's problem. Archimedes doesn't explain buoyancy; he discovers it in the problem the student is about to solve.
- **No ugly fallbacks.** If there's no story for a concept, the fallback reads like a letter, not a missing-page error. `makeSyntheticStory` should feel intentional. Every concept eventually gets a real story.

The test: show the story page to someone who has never used MindCraft. Within 10 seconds they should understand: *this is a person, this is a place, this is a problem I'm being asked to help solve.* If they don't get that in 10 seconds, the story isn't ready yet.

## 10. A Note to Engineers

If you're reading this with the repo open: the codebase is already carrying this vision. The 42 stories are in `conceptStories.json`. The knowledge graph is live and tracking real students. The 3D world is deployed and walkable. The question bank is real, tagged, and growing. You're not being asked to build a dream from nothing — you're being asked to keep making a real thing more real.

Every line of code is either building the world or not. Every schema decision, every animation, every fallback path. When in doubt, ask one question: **does this make the world more real for a student like Maya?** If yes, ship it. If no, we probably don't need it.

The boat is in the water. Let's go.
