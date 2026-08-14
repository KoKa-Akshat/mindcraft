# MindCraft Brand Book

**Version 2.1 · 2026-08-13**  
Product name on the web: **The Desk by MindCraft**. App chrome / home screen: **The Desk**.  
Pedagogy translation of research: [`docs/canon/PEDAGOGY.md`](docs/canon/PEDAGOGY.md) · Research OS: [`agent_work/research/`](agent_work/research/) (Constitution v1.16).  
Shareable PDF: regenerate with `python3 docs/canon/generate_brand_book.py` → `BRAND_BOOK.pdf`.

**v2.1 addition note:** adds the evidence/ownership layer to §4 Vision — every interaction becomes evidence, evidence becomes a student-owned map, and that map is exportable and deletable, not just visible. This is an addition, not a pivot: the essence, manifesto, personas, and voice below are unchanged. Prompted by a conversation with learning-graph researcher Dan McCreary; see the caution below before using his name anywhere public.

This document governs every design, copy, product, and marketing decision at MindCraft. When two options conflict, this book breaks the tie. When the book itself is unclear, the Brand Essence breaks the tie. Read it before you write a headline, pick a color, name a feature, or ship a screen. Agents: start at [`docs/canon/README.md`](docs/canon/README.md).

**v2.0 pivot note:** MindCraft's positioning broadened from "ACT-math tutoring platform" to "the collaborative workspace for learning." This is a layering, not a replacement: everything this book says about Katha, Maya, Jordan, and math-specific voice is still true and still binding — it now describes the **Solver vertical** (the math/ACT-tutoring surface) rather than the entire company. Sections below are rewritten where the company-level frame changed (Essence, Manifesto, Mission, Vision, personas, personality, voice scope, vocabulary scope, anti-positioning, brand story, application examples) and left as-is where the Solver-specific system still applies directly (naming, visual identity, Katha mechanics, most of vocabulary). See `BUSINESS_MODEL.md` for the business case built on this positioning.

---

## 0. Naming (binding)

| Surface | Say |
|---------|-----|
| Company / publisher | **MindCraft** |
| Marketing product | **The Desk by MindCraft** |
| App home screen + in-app chrome | **The Desk** (text only — no MindCraft / raccoon logo mark in chrome) |
| Narrative layer | **Katha** |
| Student sections | **Notes · Solver · Map** |

Never call the student app “MindCraftNotes” in user-facing copy. Internal Xcode target names may lag; display name is **The Desk**.

---

## 1. Brand Essence

**MindCraft is the collaborative workspace for learning: a place where students can work, create, and get live help from the right person without leaving their room.**

**MindCraft — Never work alone.**
*Office hours from your room.*

That is the tagline and the explainer line, in that order, everywhere the company introduces itself. Lead with the entry point — office hours from anywhere — before revealing the larger platform underneath it. Nobody meets MindCraft for the first time with "operating system for all students." They meet it stuck on something, at 11pm, wondering who could help.

Every decision either removes a reason a student is working alone, or gets out of the way of the person who's about to help them stop. The Desk is the place the work happens; MindCraft is the company that built it. Math is one thing MindCraft helps with, not the definition of what MindCraft is — inside the Solver vertical specifically, the older essence still governs word for word (§10).

**Positioning architecture** — the order in which the brand reveals itself, entry point to horizon:

| Layer | Message |
|---|---|
| Entry point | Office hours from your room |
| Core product | A collaborative workspace with on-demand college mentors |
| Differentiation | Help is attached to the student's actual work — not a fixed tutoring curriculum |
| Broader platform | Meetings, notes, presentations, projects, content, and AI |
| Long-term vision | The operating system for student work |
| Emotional promise | Never work alone |

Copy, decks, and product onboarding should generally move down this table in order. Skipping straight to "operating system" without first landing the entry point is the single most common way to lose someone in the first ten seconds.

---

## 2. Manifesto

You are alone with it. The blank document. The problem set. The deck due in the morning. The code that throws the same error for the third time. Somewhere there is a person who has done this exact thing before and could tell you in five minutes what is taking you three hours. You do not have that person's number.

So you keep going alone. You Google it. You ask an AI and it hands back an answer to a slightly different question than the one you asked. You wait for office hours that are two days and one deadline away. You nod along in a group project because admitting you're stuck costs more than staying stuck.

Somebody, somewhere back, decided you were not the kind of person who is good at this. Maybe a teacher said it with a red pen. Maybe a test said it with a number. Maybe you said it yourself, quietly, and nobody argued. Maya heard hers in seventh grade, mid-fractions, from a teacher who meant it kindly: "some people are just more verbal." She has been living inside that sentence for four years. Math is only the room she got stuck in first — these days it is also the essay due Monday and the presentation she has to give alone.

They described a moment. You heard a verdict.

Here is what actually happened: you were working alone on something hard, and nobody who understood it was in the room. That is not a broken brain. That is a broken workflow.

MindCraft rebuilds the workflow. Whatever you are stuck on — a proof, an essay, a pitch deck, a function that will not compile — you open the platform, show your actual work, and someone who has done this before is suddenly in the room with you. Not a ticket in a queue. Not a bot guessing at your intent. A person, live, looking at the same page you're looking at.

And then it happens. The pattern surfaces. The fog burns off. You feel the click, the specific relief of suddenly seeing it, and you know you could have found it alone eventually. You didn't have to.

You were never bad at the work. You were working alone.

Never again.

---

## 3. Mission

Turn every student working alone into a student who never has to be. Build the operating system where students go to think, create, collaborate, and get unstuck.

---

## 4. Vision

**The Desk** becomes the operating system for everything a student does outside class: the workspace where they take notes, join meetings, build presentations, manage projects, create content, and pull in a mentor or an AI the moment they get stuck — on any subject, any kind of work. `WORLD_VISION.md`'s own Horizon 1 already names this shape, in its own words: "The Desk as the student OS ... Binder, Intel, Connect, Ask, workflows, gap scan, Map, story-framed practice." That horizon was written before the company said the positioning out loud; this book is catching up to what the codebase already started building.

Inside that OS, the **Solver vertical** carries its own fuller vision, unchanged: a living world where the student is the character, every math problem is a mission, mastery visibly changes the map, and a mentor walks in already knowing the gap. That is no longer the whole company vision — it is what the vision looks like specifically for math. Full horizon map, including Katha's math-as-a-world roadmap: `WORLD_VISION.md`. Research thesis under audit (developed within Solver): identity transformation, not mathematics delivery (`agent_work/research/`).

**The evidence layer underneath the OS.** Every session, every practice set, every note, every question a mentor answers — all of it is evidence, not just activity. MindCraft turns that evidence into a living map of what a student actually knows, where they're shaky, and what caused the shakiness. That map is the thing MindCraft is actually building; the workspace is where a student uses it. Two commitments follow directly from this, and both are binding, not aspirational copy:

- **The record belongs to the student.** Exportable, inspectable, deletable — the same way it would be if the student kept it themselves. MindCraft earns the right to compute a recommendation from that record; it does not own the record.
- **Knowledge shouldn't be locked up either.** The instinct that makes a student's own data theirs runs the other direction too — the best learning material available should be as easy to find as the person who already learned it, not gated behind a login it doesn't need. The **Open Learning Archive** (linked from the marketing site) is a first, small expression of that: free, open, no-login intelligent textbooks a curious student can walk into today, with no product pitch attached. Public name is deliberately neutral — `Dan's Digital Archive` is the internal/engineering name only, pending his explicit sign-off per §16.

This layer is a design influence from the wider open intelligent-textbook and learning-graph research community, most directly a conversation with researcher Dan McCreary — credit the work, not a partnership. See the anti-endorsement rule in §16 before his name, photo, or work appears anywhere public.

---

## 5. The Student

Her name is Maya. She is sixteen, a junior, and she takes the ACT in April. Math is where she got stuck first. It is no longer the only room she gets stuck in.

She is not failing math. That is the part everyone gets wrong. She holds a B minus by memorizing procedures the night before tests and forgetting them by Friday. She writes strong history essays. Her English teacher reads her paragraphs out loud to the class. In seventh grade she switched schools mid-year, landed in a class three weeks deep into fractions, and never caught up. A teacher, meaning to comfort her, said "some people are just more verbal." Maya heard it as a diagnosis. She has been living inside it for four years.

Here is Maya at 2am, six days before the ACT. A practice test glows on her laptop. She has read question 14 five times. Each read, the symbols dissolve a little more. She switches tabs, watches a video about a topic she already understands, because understanding something, anything, quiets the chest-tightness for a minute. She is not lazy. She is rationing shame. Every problem she attempts and misses confirms the verdict, so she has learned to stop attempting. Giving up is not her weakness. Giving up is her armor.

Here is Maya on a different night, three weeks earlier, on the thing she supposedly *is* good at. A slides tab has been open since 4pm: six blank frames and a title she has rewritten four times. Her psych group project is due at 9am and her two partners went quiet in the group chat around dinner. She knows the content — she did the reading, she took the notes — she does not know how to turn it into eight minutes that won't put the class to sleep. She opens a template, deletes it, opens another. At 1am she gives up and writes plain bullet points she knows are flat, which she will read off tomorrow in a voice that says *this is fine* while nothing about it feels fine. Nobody sees this stuck moment. It never shows up on a report card. It just costs her a night, and whatever confidence she walked in with.

What she tells people: "I don't really care about math. I'm more of a words person." What she doesn't say out loud: being a words person doesn't make the blank page easy. It just makes the shame quieter, and better hidden.

What she never tells anyone: she watches the front-row kids finish early and wants, more than almost anything, to know what that feels like from the inside. Not the grade. The feeling. She wants to be the one somebody turns to and asks, "wait, how did you do that?" She has rehearsed explaining things she does not yet understand — the math, and lately, how to actually structure a deck.

What earns her trust: being taken seriously. Real stakes. Plain language about exactly where she's stuck, delivered without a verdict attached, whether the subject is a quadratic or a slide deck. A hard problem given to her like she can handle it, because she can.

What loses her in three seconds: cartoon mascots. "Math is fun!" Confetti for trivial things. Anything that smells remedial. Being told to try again with no new information, as if her attempt were a coin flip that might land differently this time.

Maya does not need motivation. She needs one honest click — on a concept, on a deck, on whatever is actually in front of her — and then she will supply her own.

---

## 6. The Tutor

His name is Jordan. He is twenty, a sophomore studying engineering, and he tutors math on MindCraft. He is one mentor among many the platform runs on — a design senior who walks a stranger through her first real slide deck at 10pm, a CS junior who debugs someone else's takehome between classes, a founder-track junior who workshops a pitch on a Tuesday afternoon. MindCraft mentors are not one job description; Jordan is the version whose story we tell in full, because it is one real, specific path through what every mentor on this platform goes through, not a definition that flattens the rest of them.

He remembers his own click with photographic precision: eleventh grade, a physics TA, a spring problem that suddenly became a picture instead of a formula. He has been chasing the chance to hand that moment to someone else ever since.

He tutors partly for money and mostly because explaining things is the best version of himself. His frustration is structural, not personal: he spends the first forty minutes of every session playing detective, poking at problems, guessing where the real gap hides, and by the time he finds it the hour is gone. Worse, his students have learned to perform understanding. They nod at the right moments to end the session politely. He can feel it happening and cannot always stop it. Every mentor on MindCraft — whatever they actually help with — describes some version of this same tax: too much of the hour spent finding the real problem, not enough spent solving it.

What MindCraft gives him: the map, already drawn. For Jordan that's literal — the engine walks in knowing that Maya's quadratics problem is actually a slopes problem from three concepts back. For a mentor helping with a deck or a pitch, it's the equivalent: what the student already tried, where they got stuck, what they actually need from this session. Either way, the mentor's hour goes to the human part — the analogy, the patience, the eye contact when the click lands — not the detective work that used to eat it.

How the brand treats him, and every mentor like him: as a co-author, never as gig labor. He is the person who carries the flame across the table. Copy aimed at mentors runs peer-level and technical. It never says "learners." It never says "leverage outcomes." It says: here is exactly where your student is stuck, here is why, go do the thing you are great at.

---

## 7. Brand Personality

Five adjectives. Every piece of MindCraft output should score on at least three.

**1. Cinematic.**
MindCraft frames everything as a scene with stakes, never as a curriculum unit. If a screen could open a film, it belongs; if it could open a textbook chapter, it does not.
*Sounds like:* "The flood is three days out and the fields are still unmarked."
*Never sounds like:* "Welcome to Chapter 4: How to Format Your Notes."

**2. Electric.**
The brand chases the click, so its energy is sharp, sudden, and earned rather than constant and cheap. Excitement that fires at everything means nothing; MindCraft saves the voltage for the moment it matters.
*Sounds like:* "There it is."
*Never sounds like:* "Great job!!! Keep up the amazing work!"

**3. Certain.**
MindCraft speaks in declaratives because the engine actually knows things and the story actually goes somewhere. Hedging tells an already-doubtful student that even the software doubts them.
*Sounds like:* "You can learn this. The map says so."
*Never sounds like:* "You might want to consider possibly reviewing some earlier topics."

**4. Human.**
The brand knows exactly what 2am feels like and never pretends otherwise, but warmth here means respect, not babying. It talks to Maya like the capable person she is about to discover she is.
*Sounds like:* "That gap has been sitting there since seventh grade. It ends today."
*Never sounds like:* "Don't worry! This is hard for everyone!"

**5. Unflinching.**
MindCraft names gaps plainly, keeps the stakes real, and refuses both sugarcoating and shame. Honesty without a verdict is the whole trick: the gap is a fact about the map or the draft, never a fact about the person.
*Sounds like:* "Your thesis statement is the weak point in this draft right now. Here's the way through."
*Never sounds like:* "Oopsie! Let's give that another whirl!"

---

## 8. Voice and Tone

One voice, six dials. The voice never changes; the tone adjusts to what the student is feeling in that moment.

**Universal voice rules:**
- Second person. Present tense. Active voice.
- Verbs first. Short sentences. Declaratives.
- Stakes before instructions.
- Sentence case everywhere. No exclamation marks in UI chrome. No emoji in product copy, ever.
- The word "yet" is sacred. "You can't do this" never ships. "You can't do this yet" barely ships. "You haven't done this yet" ships.
- Never blame the student. Never baby the student. The distance between those two is where MindCraft lives.

**Scope note — two registers, one voice.** Everything below splits into **Solver-specific tone** (gap scan, mastery moments, "the click," story splash) and **general workspace-surface tone** (notes, meetings, mentor booking, project work). Solver keeps full cinematic voltage — that system is unchanged. The general workspace surfaces pull from the same five adjectives in §7 but dial Cinematic and Electric down and lean on Certain, Human, and Unflinching instead: calmer, more practical, closer to the elevator pitch's register in §14. A student booking a mentor for a deck at 11pm wants a straight answer fast, not a film title card. That's a different dial setting, not a different brand voice.

### UI microcopy
Compressed, kinetic, six words or fewer. Buttons are actions in a story, not functions in software.

- Start button: **Run the mission**
- Diagnostic entry: **Start the gap scan**
- Continue: **Next move**
- Knowledge graph: **Open the map**
- Session end: **That's the run. See what changed.**

### Story splash text
This is Katha's territory (see Section 10). Present tense, sensory, a human in a crisis whose shape is the math. Roughly 200 words, ending on the problem itself. The math is never announced; it surfaces.

*Example opening:* "Kai has been awake for thirty hours. The playtest is at noon, and the character still jumps wrong: too high off the ledge, too flat off the ramp, like the world's gravity changes its mind. Somewhere in the jump code, one relationship is lying."

### Error states (technical failures)
Calm, honest, ownership taken by the system. The student never wonders if they broke something, because they didn't.

- Connection loss: **"The connection dropped. We saved your progress. Reconnecting now."**
- Load failure: **"That didn't load. It's on us. Give it a second and pull the map again."**
- Never: "Oops!", "Uh-oh!", "Something went wrong :(", or any error that performs cuteness.

### Success states
Understated and electric. The click needs no cheerleading; it needs acknowledgment. The bigger the moment, the fewer the words.

- Correct in practice: **"There it is."**
- Concept mastered: **"Mastered. The map just changed."**
- Gap closed: **"That gap held you for two years. It's gone."**
- Never: confetti language, "Awesome!", "You're a rockstar," streak-guilt framing.

### Marketing headlines
These are **Solver-specific** — the verdict-reversal register for the math/ACT surface. For the company-level tagline and elevator pitch, see §1 and §14. Big claims stated flatly, aimed at the verdict Maya carries. Every headline should make the kid who gave up stop scrolling. Product line when naming the app: **The Desk by MindCraft**.

- **You were never bad at math.**
- **Feel what it's like to be good.**
- **Math didn't lose you. The story did.**
- **The kids in the front row aren't smarter. They just clicked earlier.**
- **The Desk by MindCraft — learning that learns you.**

### Claims we will not make (research-aligned)

Defendable claims only — see Pedagogy Canon + Constitution kills:

- No ACT / score **point guarantees**.
- No streak / XP / leaderboard as proof of mastery.
- No “AI replaces tutors” or “tutoring is free.”
- No item-count or “complete ACT bank” hero without coverage honesty.
- No Identity / Belief / Anxiety Score™ theater in parent or student copy.

### Email subject lines
Sentence case, specific, story-forward. No fake urgency, no "Don't miss out," no discount energy.

- **Your map changed overnight**
- **One gap left in linear equations**
- **Kai's game still crashes. The function is waiting.**
- **Six days to the ACT. Here's your actual weak point.**

### Tone dials by context

| Context | What the student feels | Tone dial |
|---|---|---|
| Gap scan | Exposed, braced for judgment | Steady, factual, zero verdicts |
| Story splash | Curious, guard lowered | Full cinematic, immersive |
| Mid-practice miss | Old shame flickering | Direct, forward-pointing, brief |
| Mastery moment | The click | Electric, spare, let it land |
| Marketing | Skeptical, burned before | Certain, unflinching, bold |
| Tutor-facing | Professional, invested | Peer-level, precise, warm |
| Notes / meetings / project work | Focused, task-forward, not in crisis | Calm, plain, practical — Certain and Human, low Cinematic |
| Mentor booking | Deciding who to trust with this | Certain, warm, no hype, no cinematic buildup |
| Company-level marketing | Skeptical, evaluating a new tool | Certain, direct, leads with the entry point (§1), not the whole platform at once |

---

## 9. Visual Identity

Two stages, one brand — and the split already scales past math: Deep Field carries any story or marketing moment, cream Desk OS carries any workspace surface, whether the student is inside a Solver mission or writing meeting notes.

1. **Story / marketing / Katha** — film title sequence energy: Deep Field, enormous type, high contrast. Never looks like a school LMS.
2. **The Desk OS** (Jesse's Kitchen — Solver's onboarding world — plus the general Work and Create surfaces) — cream paper workspace, soft ink (`#143a2e`), lime accents. Feels like a real desk a student owns, not a dark theater. Do not force Deep Field onto The Desk surfaces.

### Color system

| Color | Hex | Name | Role |
|---|---|---|---|
| Near-black | `#080e14` | Deep Field | Marketing, story, Katha, cinematic moments. |
| Desk paper | `#f7f5f0` / `#f8faf7` | Field Desk cream | The Desk OS canvas (Work / Create / kitchen chrome). |
| Ink green | `#143a2e` | Desk ink | Primary text on cream Desk surfaces. |
| White / chalk | `#f5f5f5` | Chalk | Primary text on Deep Field. |
| Lime | `#c4f547` | The Click | Mastery, primary CTAs, earned signal. |
| Red | `#c1121f` | Stakes | Narrative tension, gap severity, Katha's flame — never student shame. |
| Navy | `#1d3a8a` | Depth | Graph edges / secondary structure on dark stages. |

**Usage rules:**

- **Stage-appropriate canvas.** Deep Field for story and marketing. Cream for The Desk OS. Do not mix randomly on one screen.
- **The Click is earned.** Lime means something just happened or is about to. Never two competing lime CTAs.
- **Stakes belongs to the story, never to the student.** Red never marks a miss as “you failed.” A red X on student work is banned.
- **Desk chrome stays calm.** Top-left product mark is the words **The Desk** — no raccoon / MindCraft logo in app chrome (logo stays for marketing site / company mark).

### Typography direction

No specific typefaces mandated. The feelings are mandated.

- **Display (MindCraft voice):** a confident geometric grotesque with tight tracking and real presence at poster scale. It should feel like a title card, an athletic brand, a launch countdown. Set it huge: the type scale jumps hard, display sizes at four times body or more, so every screen has one loud statement and quiet everything else.
- **UI text:** a clean humanist sans built for legibility at small sizes, with tabular numerals wherever the engine reports data (mastery, timing, counts). The engine's numbers should feel machined.
- **Story text (Katha voice):** an editorial serif with genuine literary character, the kind of face you'd find in a novel, not a textbook. When the serif appears, the reader knows without being told: the storyteller is speaking now.
- **Never:** rounded "friendly" fonts, handwriting fonts, anything that signals children's education, chalkboard textures, comic-adjacent anything.

### Imagery direction

**Belongs:**
- Cinematic scenes from the stories: the game studio at 2am lit by one monitor, the Nile at flood under a red dawn, rendered like film stills with a single dominant light source.
- The knowledge graph as an object of beauty: constellation-like node fields on Deep Field, navy edges, lime nodes where mastery lives, red where gaps burn.
- Bold geometric abstraction with narrative weight: a parabola as the arc of a jump, a slope as a rising floodline. Math as scenery, not decoration.
- Darkness with a point of light. This is the brand's core image: the click, visualized.

**Never belongs:**
- Stock photos of any kind. Especially smiling students at laptops.
- Chat bubbles, robot mascots, anthropomorphized anything.
- Clip-art math: floating pi symbols, raining numbers, cartoon calculators.
- Trophies, gold stars, badge-cabinet iconography.
- Anything a school would laminate.

### Motion principles

1. **Motion means state change.** Things move because the world changed: a node lights, an edge strengthens, a path redraws. Nothing animates to seem lively.
2. **Weight over bounce.** Elements move with mass and settle with intent. Nothing springs, jiggles, or celebrates cutely.
3. **The click gets the budget.** Mastery moments earn the largest, slowest, most considered animation in the product: the node ignites, the map ripples, up to 800ms. Routine UI stays fast and invisible, 150 to 250ms.
4. **Nothing begs.** No idle loops, no wiggling buttons, no notification-dot anxiety mechanics. The world waits with dignity.
5. **Dark stays dark.** Transitions move through Deep Field, never through white flashes.

---

## 10. The Katha Sub-brand

**Katha** (Sanskrit: story) is the narrative layer of MindCraft. It is a sub-brand with its own voice, its own typography, and its own mark, living entirely inside MindCraft.

**Scope.** Katha is the storytelling voice of the **Solver vertical** specifically — the math-as-a-world system described in `WORLD_VISION.md`. It is not the company's only storytelling voice. MindCraft's broader workspace surfaces (notes, meetings, mentor booking, project work) tell their own story in the calmer register defined in §8; they do not borrow Katha's flame, serif, or red. If a mentor-booking screen or a meetings feature wants narrative flourish, it does not become a Katha frame by default — Katha's rules below (never mentions the interface, ends at the threshold, etc.) are binding specifically for Solver missions and story splashes.

### The division of labor

**MindCraft is the system. Katha is the fire.**

MindCraft measures, maps, diagnoses, and builds: the engine, the knowledge graph, the gap scan, the mastery model. It speaks in the geometric sans, signals in lime and navy, and deals in facts about the map.

Katha tells the story: every splash, every scene, every mission frame. It speaks in the editorial serif, burns in red and chalk, and deals in humans in trouble. Kai's broken jump. The scribe watching the flood erase the field lines.

The handoff is a designed moment. The engine decides *what* Maya needs (that is MindCraft's job, deterministic and auditable) and then the flame appears, the serif takes over, and Katha gives her a *reason* (that is Katha's job, and the engine never writes a word of it). One brand does the math about the math. The other makes it matter.

### How Katha sounds

- Present tense, sensory, specific. Always a person, always a crisis, always stakes.
- Katha never mentions the interface. It does not say "concept," "practice," "mastery," "level," "question," or "click here." The moment story text acknowledges the software, the spell breaks.
- Katha never explains the math. It arranges the crisis so the math is the only door out, then steps aside.
- Katha ends every story at the threshold of the problem, never past it. The student, not the narrator, opens the door.

### How Katha looks

- Editorial serif on Deep Field. Generous margins and negative space, like the page of a novel printed on darkness.
- Red and chalk are Katha's colors. Lime almost never appears in Katha's frame: lime belongs to the engine, and the click happens after the story, not inside it.
- Illustrated or rendered scenes composed like film stills: one light source, one figure, one problem in the air.
- Every story signs itself: a small flame mark and the words **A Katha story**.

### The flame

The flame mark carries three meanings, in order:

1. **Stories began around fire.** Katha is the oldest technology for making knowledge survivable: wrap it in a narrative and pass it around the flame. The mark claims that lineage.
2. **The click is a strike of light in the dark.** The whole visual system is darkness waiting for ignition. The flame is the promise that ignition comes.
3. **Fire is carried.** Tutor to student, story to student, student to the next student who gave up. Nobody keeps the flame. Everybody hands it on.

**Flame rules:** the flame appears whenever Katha speaks and nowhere else. Red on Deep Field. Never a mascot, never given a face, never animated in idle loops. It may flare once, briefly, at a mastery moment: the story's stakes resolving into the engine's light.

---

## 11. Vocabulary

Words build the world. These pairs are binding for all product copy, marketing, and support.

**Scope note.** Some rows below are **Solver-specific** — they name pieces of the math/ACT system precisely and should not be borrowed loosely into unrelated surfaces: **mission, gap, the click, gap scan, master, tutor** (as the human title inside a Solver session). Others are **general-workspace** terms that apply company-wide: **you/player, story-driven, earn/unlock**, and the new rows below (mentor, office hours, workspace, bring what you're working on, get unstuck). When in doubt: if the copy is happening inside a Solver mission or story splash, reach for the Solver-specific word; everywhere else, reach for the general one.

| We say | We never say | Why |
|---|---|---|
| **challenge** | quiz | A quiz judges you at school. A challenge invites you into a story. "Quiz" is banned outright. |
| **weakness** (with care) | deficiency, deficit | "Weakness" is honest and useful when it describes the map, spoken privately, attached to a concept. It never describes the person. |
| **not yet / not this one** | wrong | "Wrong" is a verdict on the person. "Not yet" is a fact about time. |
| **not yet / not this one** | incorrect | "Incorrect" is "wrong" wearing a lab coat. Same verdict, colder delivery. |
| **look at [the specific thing], then take the next one** | try again | "Try again" asks the student to repeat a failure with no new information. MindCraft always points at what to see differently first. |
| **mission** | assignment, homework | Assignments come from authority. Missions come from stakes. |
| **story** | content | "Content" is what gets poured into feeds. Nobody ever changed their life because of content. |
| **the click** | aha moment, lightbulb moment | The click is the brand's own word for its own promise. Greeting-card synonyms dilute it. |
| **gap** | falling behind | A gap is a location on a map: findable, closeable, gone when closed. "Behind" is a race the student already believes they lost. |
| **practice** | drill | Drilling is what happens to teeth and soldiers. Practice is what musicians and athletes do on purpose. |
| **master** | complete, finish | You complete a form. You master a skill. Concepts are never "done"; they are owned. |
| **you / player** | user | Users consume software. Players inhabit worlds. In student-facing copy, just say "you." |
| **world / map** | app, platform | Student-facing copy never names the software category. The product is a place, not a program. |
| **gap scan** | diagnostic test, placement test | Both banned terms contain "test," and "test" is the exact machine that issued Maya's verdict. A scan finds things; a test judges people. |
| **yet** | can't (unqualified) | "Yet" is the single most important word in the vocabulary. Every statement of inability carries it or dies in review. |
| **sharp, locked in** | smart, dumb | Intelligence-as-identity language is banned in both directions. Praise the seeing, never the ceiling. |
| **quick / short** | easy | Calling a problem "easy" sets a trap: miss it and the verdict returns doubled. Describe length, never difficulty-as-judgment. |
| **tutor** (Solver-specific copy) | instructor, coach | Inside a Solver mission or math-specific copy, tutor is still the one name for the human across the table. |
| **story-driven** | gamified | "Gamified" means points bolted onto boredom. The story is load-bearing. Banned even in internal decks. |
| **earn / unlock** | reward | Rewards are pellets from a dispenser. Earning and unlocking are things that happen inside a world because you changed it. |
| **mentor** (general workspace copy) | tutor (outside Solver-specific copy) | Outside Solver, "mentor" is the umbrella term for who's on the other side of a session — a writer, designer, coder, or founder, not only a math tutor. Reserve "tutor" for the Solver-specific relationship. |
| **office hours** | tutoring session (in company-level marketing) | "Tutoring session" narrows the whole platform back to one subject. "Office hours" is the entry-point promise (§1) — it describes the shape of the help, not its subject. |
| **bring what you're working on** | submit your assignment | "Submit" implies grading and one right answer waiting on the other side. MindCraft mentors show up on the student's actual, unfinished work, not a completed hand-in. |
| **workspace** | app, tool, platform (in company-level copy) | Same instinct as "world / map" in Solver copy: naming the software category flattens the thing into generic SaaS. "Workspace" names the place, not the product category. |
| **get unstuck** | get help, get answers | "Get answers" sounds like a vending machine. "Get unstuck" names the actual outcome: momentum resumes. That is a different promise than being handed a solution. |

---

## 12. Anti-positioning

What MindCraft is explicitly not, and why each comparison fails on contact.

**Not Khan Academy.** A library assumes you walked in wanting a book; MindCraft exists for the student who stopped walking in. Khan organizes the world's math superbly for the already-motivated, while MindCraft manufactures the motivation itself, which is the actual missing ingredient for the kid who gave up.

**Not Duolingo.** Duolingo made the mechanic the point: streaks, guilt, an owl trained to make you open an app, with the content as filler between dopamine hits. MindCraft inverts it: the story is the point and math is the mechanism, because streak anxiety teaches you to launch software, and it has never once taught anyone to see a pattern.

**Not a tutoring app.** Tutoring marketplaces sell hours and pray that chemistry happens inside them; MindCraft sells the click and uses the engine to make the human hour count, because the tutor should spend forty minutes teaching, not forty minutes guessing where the gap is.

**Not a homework helper.** Homework helpers optimize for tonight: answer delivered, dependence deepened, gap untouched and compounding. MindCraft optimizes for the version of you that stops needing help, and any feature that hands out answers without building the seeing has failed the brand test by definition.

**Not a productivity suite.** Notion and Google Workspace hand you an infinite set of blank tools — a doc, a deck, a board — and zero help actually using them; they optimize for organizing work you already know how to do alone. MindCraft inverts it: every tool in the workspace sits one tap from a live person who can actually help, because a better blank page has never once gotten anyone unstuck, and a folder structure has never taught anyone anything.

---

## 13. Brand Story

MindCraft started at a tutoring table, watching the same scene repeat. A student flinches at a worksheet. The same student, twenty minutes later, leans all the way in because the problem became a person: a game developer whose character jumps at the wrong height, a scribe watching the flood erase every boundary in the valley. Same math. Different story. Completely different kid.

The founders kept pulling on that thread and found two separable problems. Finding the gap is a systems problem: it takes a knowledge graph, real evidence, and a deterministic engine that never guesses. Caring about the gap is a story problem: it takes stakes, a character, a world that answers back. Every product on the market solved one and ignored the other.

So MindCraft builds both, welded together: an engine that knows exactly where math lost you, and a storyteller that gives you a reason to go back for it.

That was the origin of Solver — and for a while, it was the whole company: a platform for booking college tutors, one subject, one session at a time. But the tutoring table kept teaching the founders things they hadn't asked to learn. A tutor would open a shared doc to sketch a proof, and the student would ask to keep using that same doc for an English paper due the next morning. A tutor would stay online after the booked hour ended because the student was now stuck on something else entirely — a presentation, a coding assignment, a scholarship essay. Students weren't booking a fixed subject with a fixed person. They were showing up with whatever was actually in front of them, hoping the person on the other end could help with that too.

So the platform grew the way real use grows a product: not by a founder's roadmap, but by watching what people did with it anyway. What started as a tutor-connection tool for one subject became a place students opened for office hours, for meetings, for notes, for building a deck at midnight, for pulling in a mentor who happened to know exactly the thing they were stuck on that day — math or not. MindCraft stopped being the company that booked tutoring hours and became the company that builds the room where the work happens, with the right person a tap away whenever it stalls.

Solver — Maya's engine, Katha's stories, the click — is what that room looks like for math specifically, and it remains the deepest, most built-out corner of the workspace. The rest of the workspace is the same bet, applied everywhere else a student gets stuck alone.

---

## 14. Application Examples

Ten real contexts, final copy quality. This is what the brand sounds like in the wild. The first six below are **Solver-specific** — math/ACT copy in the engine's and Katha's voice, unchanged from v1.1. The four after that are **company-level** — the workspace's own voice: calmer, broader, and new in v2.0.

**Push notification** (re-engagement, student mid-story on functions):
> Kai's game still crashes at the jump. The function is waiting.

**Story splash opening line** (fractions, the Nile scribe):
> The flood took the field markers in the night, and by morning forty farmers stand at the water's edge, each one certain his land was bigger than this.

**Wrong-answer feedback message** (practice, linear equations):
> Not this one. The slope tells you how fast it changes, not where it starts. Take the next one with that in your pocket.

**Dashboard headline** (returning student, one gap from a milestone):
> One gap stands between you and quadratics. It's the same one from seventh grade. Today's the day.

**Marketing site hero headline:**
> You were never bad at math.
> *Subhead:* Somebody told you that, and you built a life around it. The Desk by MindCraft finds the exact moment math lost you, then tells the story that brings you back.

**App Store description, opening lines:**
> The Desk by MindCraft is where you find out you were never bad at math.
>
> A learning engine maps exactly where math lost you: not the chapter, the concept, the precise gap. Then a story world gives you a reason to go back for it. Every concept is a scene. Every problem is a mission. And somewhere in your first week, it happens: the pattern surfaces, the fog burns off, and you feel the click the front-row kids have been feeling all along.

**Company tagline** (primary, everywhere the company introduces itself):
> **MindCraft — Never work alone.**
> *Explainer line:* Office hours from your room.

**Elevator pitch** (two-minute, spoken or written — the canonical company pitch):
> College students spend hours every day working alone — writing papers, debugging code, studying for exams, creating presentations, or trying to turn an idea into something real. When they get stuck, their options are limited: wait for office hours, search through disconnected online content, ask AI and hope it understands, or schedule an expensive tutoring session days later.
>
> MindCraft gives students another option: open the platform, show what they're working on, and instantly enter a collaborative workspace with a college mentor who can help them move forward.
>
> This isn't traditional tutoring, where you're assigned one tutor for one subject and locked into recurring sessions. On MindCraft, students can work with different people depending on what they need — a mathematics student for calculus, a designer for a presentation, a founder for a startup idea, or a writer for an essay. They can return to mentors they trust or discover someone new.
>
> But MindCraft has grown beyond mentor discovery. It is becoming the workspace where the work itself happens. Students can join virtual office hours, collaborate in live rooms, take notes, create presentations and content, organize projects, meet with classmates, and use AI alongside real people — all without switching between five different platforms.
>
> AI can generate an answer, but learning often requires conversation, judgment, encouragement, and another person who understands where you're stuck. MindCraft combines the scalability of AI with the intelligence and connection of a real academic community.
>
> Our vision is to build the operating system for student work: one place to think, create, collaborate, and get unstuck.
>
> MindCraft brings the people, tools, and workspace of a university directly into every student's room.

**Elevator pitch, 30-second version** (same voice, compressed — use where the two-minute version doesn't fit):
> MindCraft is office hours from your room. Students bring anything they're working on — an essay, a math problem, a presentation, code, or even a startup idea — and collaborate live with a college mentor who can help them move forward. Unlike traditional tutoring, students aren't locked into one tutor or one subject. MindCraft combines on-demand human guidance, AI, meetings, notes, and creation tools in one collaborative workspace. We're building the operating system where students think, create, and get unstuck.

**Company page copy** (LinkedIn or equivalent company-profile surface):
> Tagline: Office hours from your room. Think, create, collaborate, and get unstuck with AI and real college mentors.
>
> About: Being a student means constantly encountering things you have never done before. Solving a difficult problem, writing a paper, creating a presentation, learning a new domain, or applying for your first internship. But the right support is rarely available when you actually need it. MindCraft brings office hours directly into every student's room. Students can bring whatever they are working on, collaborate with college mentors who have done it before, and use AI-powered tools to think, create, and move forward. They can work with different mentors for different needs or return to someone they trust. AI can generate an answer, but learning often requires conversation, judgment, encouragement, and another person who understands where you are stuck. MindCraft combines the scalability of AI with the intelligence and connection of a real academic community. Our vision is to build the operating system for student work. One place to think, create, collaborate, and get unstuck. MindCraft brings the people, tools, and workspace of a university directly into every student's room. As the students we support gain experience of their own, we hope they return as mentors for the students following in their footsteps.

---

## 15. Research handshake

Brand copy must stay inside what pedagogy can defend. When research kills a Score™ or packaging claim, Brand Book follows — we do not keep the pretty lie.

| Topic | Look first |
|-------|------------|
| What to build / measure | `docs/canon/PEDAGOGY.md` |
| Evidence + Red Team | `agent_work/research/MINDCRAFT_RESEARCH_CONSTITUTION_v1.md` |
| Why / horizons | `WORLD_VISION.md` |
| Agent index | `docs/canon/README.md` |

---

## 16. External credit and endorsement

A warm conversation with a researcher, mentor, or potential partner is not the same as a formal advisor relationship, a testimonial, or permission to use their name, photo, or title publicly. This rule exists specifically for how MindCraft talks about **Dan McCreary** and anyone like him, and it is binding.

| Do | Don't |
|---|---|
| Credit his public, freely-shared work by name when linking to it (e.g. the Open Learning Archive's in-page credit line) | Say "built with," "advised by," or imply a formal relationship without his explicit written agreement |
| Keep the internal codename (`Dan's Digital Archive`) off public-facing titles/nav/branding until he's seen it and said yes | Name a public product or feature after him before he's agreed to that specific use |
| Treat the conversation as a design and research influence internally | Put his photo, quote, or an "advisor" badge on the site |
| Ask permission before any public use of his name, title, or likeness | Repeat a private compliment as if it were a public testimonial |
| Link out to open work; never rehost or rewrite it as MindCraft's own | Imply MindCraft created content that a named external researcher actually created |

If he later formally advises the company, update this section and the team/advisor copy with his preferred bio and photo — until then, the safe move is a plain "research & influences" credit, not a relationship claim. Same rule applies to any other mentor, researcher, or public figure MindCraft cites.

---

*End of Brand Book v2.1. When in doubt, reread the essence: never work alone, office hours from your room, The Desk is the place — and inside Solver specifically, math is still the mechanism, the story is still the point, and everything there still serves the click.*
