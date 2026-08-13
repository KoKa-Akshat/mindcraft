# MindCraft Studio — Prototype v0.1

**Open:** http://127.0.0.1:5199/  
**Source:** `agent_work/product/studio_prototype_2026-08-10/index.html`  
**Audience:** grades 7–11 (also works for college) · 9:16 Stories format  
**Status:** local clickable prototype (no accounts, no real video export yet)  
**Research:** [App teardown / school safety](045a55a8-a68b-412a-adf0-a4843ed7258c) ✅ · Teen needs agent hit API limit → finished inline below

## What this is
A Minecraft-poster-energy short-video studio inside the MindCraft world: drop loot → build timeline → add words/beats → craft a story that can later feed the Map as mastery evidence.

## What works now
- Home: XP level, quests, builds list
- Asset Chest: drag/drop or click upload (images / video / audio)
- Seeded blocky assets + math quest templates (Slope, Fractions, Probability, Free Build)
- 9:16 phone preview + playhead / scene bars
- Timeline: scenes, words, music tracks
- Tools: Quests · Text · Stickers · Music (chiptune) · Captions · FX
- Coach steps + XP toasts
- Craft Story modal (fake export celebration)

## Not real yet
- Real MP4/WebM render
- Auto speech-to-caption
- Saving projects / accounts
- Map mastery write-back
- Teacher moderation / class feed

---

## Research synthesis (for v0.2)

### Market gap (headline)
Flip (Flipgrid) died Sept 2024 — orphaned proven classroom demand for safe short video. CapCut is what kids actually use, but has **no education product** and is district-radioactive (ByteDance / perpetual license / paywalls). Nobody today combines CapCut-grade 9:16 fun + school-safe sharing + mastery data. That’s the MindCraft lane.

### Teen tools — what they love / hate

| App | Why teens love it | Top complaint | Pricing pain |
|---|---|---|---|
| CapCut | Vertical-first, templates, auto-captions, trend speed | Ads, notifications, features moved to Pro | Watermark-free export + auto-captions now paywalled / credit-limited |
| iMovie | Free, stable, school-safe on Apple | Weak for Stories (captions/effects/templates) | Free — but not social-native |
| VN / InShot | Cleaner free mobile edits | Fewer trends / weaker AI captions | Freemium |
| Canva | Templates, school Free Pro | Design DNA, not phone-native editor | Ed free; video is secondary |
| DaVinci Resolve | “Pro” power, free | Overwhelming UI; 9:16 + captions take forever | Free — teens bounce on complexity, not price |
| WeVideo | District standard | Not Stories-fun; seat cost | ~$299–374/yr per 30 seats |

**Why teens bounce off DaVinci:** built for cinema, not daily 30s Stories. Manual 9:16 setup + hand-timed captions (~15–20 min for 1 min video vs CapCut under 60s). Root job: *look pro with zero effort before the vibe dies*.

### Feature ranking (5-whys → root job)

**MUST (v1)**
| Feature | Root why |
|---|---|
| 9:16 Stories canvas | Peers watch phone-vertical; landscape feels “homework” |
| Trim / scene blocks | Cut dead air so the story doesn’t feel boring |
| Asset drop-box (chest) | Start from *my* photos/clips, not a blank pro timeline |
| Templates / Quests | First shareable result in minutes, not hours |
| Auto / easy captions | Most watch muted; captions = “looks pro” |
| Text styles (big / blocky) | Voice of the story without recording skill |
| Export without watermark | Watermark = embarrassing / school-unusable |
| Private share to tutor/class | Safe audience; Flip’s real job |

**DELIGHT**
| Feature | Root why |
|---|---|
| Stickers / emoji | Remix culture; identity without drawing |
| Music + simple beat loop | Energy without DAW skill |
| Filters / light FX | One-tap “mood” like CapCut |
| XP / levels | Sticky progress (Duolingo pattern) without public likes |
| Concept-tagged quests | Explaining → Map mastery, not random content |

**SKIP (v1)**
Green screen, speed ramps, Fusion-style VFX, public For You feeds, student DMs — complexity or safety risk before the core loop works.

### School safety (must / avoid)
**Must:** private-by-default · teacher/tutor review queue · moderation · age gate / VPC for under-13 · deletion + retention limits · student owns export · DPAs / no selling data  
**Avoid:** public feeds · unmoderated DMs · share-to-TikTok by default · perpetual content license · training AI on student video without opt-in · indefinite retention  

(Grades 7–11 mostly 13+, but youngest 7th graders can be 12 → COPPA “actual knowledge” still matters.)

### Learning science (why this is more than “fun CapCut”)
Explaining on video beats restudy (protégé / teaching effects; Hoogerheide et al.). Self-explanation d≈0.61. **Learning comes from the explaining, not the editing** — scaffold the script; keep decoration light.

### Ranked MindCraft integration plays
1. **Prove-it missions** — explain concept in 3 scenes → scores into `/record-outcomes` / Map  
2. **Ontology-tagged templates** — hook → worked example → misconception debunk from the 42 concepts  
3. **Tutor timestamp feedback** → feeds next practice  
4. **Private pod feed** matched to viewer weaknesses (protégé effect, no public FYP)  
5. **Growth portfolio** for parents / college (artifact + mastery curve)

---

## Design bets (kid terms) — confirmed by research
1. **Chest first** — dump files, then build (not a blank scary editor)
2. **Quests** — one-tap story starters tied to math (templates = CapCut’s real magic)
3. **Stories phone** — vertical like Instagram, not desktop DaVinci
4. **Blocky UI** — feel like the game world; school-safe brand, not CapCut clone
5. **XP / levels** — Dirt Digger → Diamond Director; light social, no public like-farm
6. **Captions free forever** — CapCut’s #1 betrayal; never paywall this for students
7. **Private by default** — Flip’s orphaned job; tutor-visible, export guaranteed

## Next (v0.2)
- Wire one quest → Map `conceptId` tag (prototype)
- Real browser export (MediaRecorder / ffmpeg.wasm) **without watermark**
- Script scaffold panel (“say this in scene 2”) so editing doesn’t eat explanation time
- Teacher/tutor review stub (approve before class feed)
- Full research dump: see agent transcript + sources below

## Key sources
- Flip shutdown: https://larryferlazzo.edublogs.org/2024/06/03/microsoft-is-shutting-flip-down-here-are-alternatives/
- CapCut paywall/captions: https://www.androidauthority.com/i-am-ditching-capcut-3545614/
- CapCut vs Resolve for Shorts: https://flowith.io/blog/capcut-vs-davinci-resolve-smarter-choice-tiktok-youtube-shorts/
- Teaching-on-video effect: https://www.sciencedirect.com/science/article/abs/pii/S0361476X16000102
- Fiorella & Mayer generative learning: https://eric.ed.gov/?id=EJ1120458
- Full teardown + legal checklist: agent [App teardown and school safety](045a55a8-a68b-412a-adf0-a4843ed7258c)
