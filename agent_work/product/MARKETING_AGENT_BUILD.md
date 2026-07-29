# Instagram Content Agent — Build Spec

**Status:** Living. One file. Full scope for the Instagram content agent.  
**Updated:** 2026-07-29  
**Loop:** generate → human approve → export. **Nothing auto-posts in v1.**

Upstream voice and product context (read, do not fork casually):
- `BRAND_BOOK.md`
- `WORLD_VISION.md`
- `agent_work/product/LIVING_LEARNING_RECORD.md`
- `agent_work/research/MINDCRAFT_RESEARCH_CONSTITUTION_v1.md` + Parts XXVII, XXXIII–XXXVI

---

## 0. Short version (external / pitch)

### What it is

Generates Instagram post ideas (captions + finished images) from MindCraft’s own data. Nothing posts automatically. It builds a batch. We approve what ships.

### Why this beats a generic caption tool

Generic tools invent vibes. This agent is chained to a diagnosis stack competitors cannot copy:

1. **~1,749 named misconception records** with frequency (`ml/data/eedi_misconceptions.json`), not “kids struggle with algebra.”
2. **~1,500 tagged questions** in the live bank, many story-wrapped. Puzzles are selected. Keys are never invented.
3. **A 42-concept map with bridges** so posts can aim at the gap between ideas, where students actually fail.
4. **Brand + claim gates before the queue.** Off-voice, score guarantees, grit posters, marketplace cosplay, and em dashes die before a human sees them.
5. **Split brain.** The model only phrases. Answers, citations, and testimonial quotes come only from sealed fact packs. Empty store → that pillar skips.

Wedge line: **mechanism-true content from our failure data**, not another AI quote farm.

### Content pillars

Puzzles people can solve (story-framed, from the bank) · “Most people get this wrong” traps with reveal · Pure story (no product required) · Learning-science with real citations · Insights from our data · Testimonials · Manifesto quote cards · Tutor recruiting

### Review loop (email is half right)

Email is a good nudge. It is a bad decision surface (no durable approve/reject, Gmail blocks images).

Canonical loop:
1. Batch lands on a simple review page (images + captions).
2. Email links to that page.
3. Approve / reject / edit. Copy button per caption.
4. Approve exports a folder: images + paste-ready `caption.txt`.
5. Auto-post to Instagram later (Business account + Facebook Page). Not v1.

Start local (~a day). Then host behind existing admin login for phone review.

### Batch size

~10 images / week → about 6–8 posts. One sitting.

### Already on disk

Misconceptions, questions, story-wrapped puzzles, story prose, a small set of story illustrations.

### Still needs a human

- Allowlisted learning-science papers (no freestyle citations)
- Testimonials with consent recorded (tutors first; students are often minors)
- More story artwork (that pillar burns images fast)

---

## 1. Job to be done

Produce Instagram-ready creative that makes Maya stop scrolling and makes parents trust the mechanism, using only MindCraft data and research-safe claims, with a human gate before anything public.

**Thesis the agent must not violate:** MindCraft is the memory between the student and the tutor. Front door now is ACT Math. Not an open global “learn anything with anyone” marketplace. Horizon 3 “music kid / space kid” means math through interests, not guitar lessons as a product promise.

**Non-goals (v1):** auto-publish · marketplace posts · inventing pedagogy/scores/quotes · streak / dopamine North Stars

---

## 2. Architecture

```
[Data adapters] → [Pillar picker] → [Sealed fact pack]
                                      ↓
                              [Caption LLM]  ← brand + claim gates
                                      ↓
                              [Image renderer]
                                      ↓
                              [Batch store] → [Review UI] → [Export folder]
                                      ↑
                              [Email nudge → deep link]
```

### Sealed fact pack

Built before any LLM call. The model cannot add facts outside this JSON.

```json
{
  "pillar": "trap_reveal",
  "concept_id": "quadratic_equations",
  "misconception_id": "mis_…",
  "misconception_label": "…",
  "frequency": 128,
  "question_id": "…",
  "stem": "…",
  "correct_key": "B",
  "correct_text": "…",
  "trap_text": "…",
  "citations": [],
  "testimonial": null,
  "product_cta_allowed": false,
  "approved_lines": [],
  "banned_phrases": ["guaranteed", "2-sigma", "unlock your potential", "math Duolingo"]
}
```

Validators reject any caption or on-image text that introduces numbers, answers, DOIs, or quoted names not in the fact pack.

---

## 3. Voice, claims, and automatic gates

### Hard rules (every caption and on-image string)

- No em dashes (`—`)
- No score guarantees, Bloom 2-sigma, “tutoring is free,” streak-as-learning, empty grit / growth posters
- No inventing puzzle answers, research citations, or testimonials
- Student-facing lines may be identity-led; parent/ACT lines stay clarity and outcome led
- ChatGPT is never the hero of the sentence
- No confetti praise, “rockstar,” streak-guilt, cute error language
- No “learn arts / guitar / anything worldwide” as current product

### Claim ladder (do not sell a higher rung than evidence)

| Rung | May say | Must not say |
|------|---------|--------------|
| L0 Product fact | What ships today | Fake live features |
| L1 Mechanism | Soft wrong, hints before answers, design for independent solving, transfer checks | “We prevent AI dependence” (until measured) |
| L2 Social proof | Consented testimonials | Causal ACT score proof from a quote |
| L3 Measured | Only after instrumented metrics (`retry_120s`, `transfer_pass`, etc.) | Identity / FEI transformation sold from L1 data |
| L4 Competitive | Session-demo wedge; we do not out-library Khan or out-streak Duo | Marketplace cosplay; Bastani-proven MindCraft |

### Approved lines the agent may reuse

- MindCraft is the memory between the student and the tutor.
- Every session remembers. Every tutor knows where to begin.
- ACT tutoring that never starts from zero.
- ACT? We got you.
- Your tutor shows up already knowing how to best help.
- You never have to start over.
- You were never bad at math.
- Clear support without becoming the math teacher.
- Parents buy clarity, trust, and steady progress.
- Practice that still works when the hints are gone.

Site / bio caption (when a product CTA is allowed):

```
ACT? We got you.
Your tutor shows up already knowing how to best help.
You never have to start over.

mindcraft-marketing-site.web.app
```

### Brand Book student headlines (identity surfaces only)

- Feel what it's like to be good.
- Math didn't lose you. The story did.
- The kids in the front row aren't smarter. They just clicked earlier.

### Gate table (queue entry)

| Gate | Fail if |
|------|---------|
| Em dash | `—` anywhere |
| Brand voice | Confetti, rockstar, streak-guilt, cute errors |
| Claim ladder | Any hard ban above |
| Fact seal | Fact not in pack |
| Equity | Magical culture-closes-gap claims (Part XXXVI) |
| Competitive cosplay | Math Duolingo, out-Khan brags, grit posters |
| Wedge drift | Open marketplace / any-subject promises |

Fail → one regeneration with the violation named → still fail → drop and log.

---

## 4. Pillar specs

### 4.1 Story-framed puzzle
- Select playable bank item. Prefer story frame when present.
- Prefer ACT-relevant concepts for beachhead weeks; other concepts OK if honest.
- Image: stem + choices, or stem with answer held for comments when needed.
- Never invent stem or key.

### 4.2 Trap reveal
- Require misconception id + trap text or wrong choice from data.
- Frequency language only if `frequency` is present and fresh; else “a common trap.”
- Arc: hook → try → reveal → one-line why. No shame theater.

### 4.3 Pure story
- Katha / concept story excerpt. Product CTA optional and usually off.
- Art if on disk; else typographic card on brand ground.
- Story must earn the math. No seductive trivia dump (Part XXXVI).

### 4.4 Learning-science
- Citations only from human allowlist file (create `agent_work/product/ig_citations_allowlist.json`; empty = pillar off).
- Seed candidates for the allowlist (not live until listed): Roediger & Karpicke 2006; Cepeda spacing work; Bastani et al. 2025 only as AI-crutch caution, never “we are proven GPT Tutor.”
- Plain-language finding + paper name. No fake DOIs.

### 4.5 Data insight
- Precomputed aggregates only (top misconceptions, coverage, format mix).
- Never student-level or identifiable data.

### 4.6 Testimonials
- Consent record required: who, when, medium, scope includes `instagram`.
- Tutors first. Minors need guardian consent.
- Marketing-site quotes (e.g. Sebastian / Gillian) only if social scope is covered; else re-consent.

### 4.7 Manifesto + tutor recruit
- Only approved bank / Brand Book lines.
- Recruit: peer-level, precise. No gig-labor tone. No “learners.”

---

## 5. Weekly batch recipe

Default **6–8 posts / ~10 images**:

| Count | Pillar |
|------:|--------|
| 2 | Puzzle |
| 2 | Trap reveal |
| 1 | Pure story |
| 1 | Learning-science or data insight (alternate) |
| 1 | Testimonial or manifesto (if fuel exists) |
| 0–1 | Tutor recruit |

No fuel → skip pillar. Never pad with invention.

---

## 6. Review UI

**Phase A local, Phase B admin-hosted.**

Minimum:
- Cards: image, caption, pillar, source ids
- Approve / Reject / Needs edit
- Copy caption
- Export: `exports/ig/YYYY-WW/<slug>/{image.png,caption.txt,meta.json}`
- Email: “Batch ready” + deep link only

Hosted auth: existing admin role. No public batch URLs.

---

## 7. Data adapters

| Fuel | Where |
|------|--------|
| Misconceptions | `ml/data/eedi_misconceptions.json` (~1,749); `data/eedi/` mapping |
| Questions | `app/src/lib/questionBank.ts` merge (static + actMaster + eedi + generated) |
| Stories | concept stories / story module data under `app/src/data` as wired |
| Illustrations | marketing `img/` + story art inventory in agent config |
| Brand / claims | this file §3 compiled to machine rules + `BRAND_BOOK.md` |
| Citations allowlist | `agent_work/product/ig_citations_allowlist.json` (create; empty = off) |
| Testimonial consents | `agent_work/product/ig_testimonial_consents.json` (create) |

Do not scrape live student Firestore for Instagram content.

---

## 8. Human inputs (not the agent)

| Need | Why |
|------|-----|
| Citation allowlist | Research bans freestyle citations |
| Consent log | Legal; minors |
| More story art | Story pillar runs out fast |
| Weekly approve sitting | Voice and quality |

---

## 9. Success metrics

- First-pass gate pass rate
- Human reject rate by pillar (aim: puzzle/trap rejects under 30% after week 2)
- Zero fact-seal violations reaching Approve
- Review time under 20 minutes per batch
- Later (manual post): saves/shares. Not a v1 blocker.

Banned North Stars: raw post count, time-on-tool, streak metaphors in captions.

---

## 10. Implementation phases

**Phase A (~1 day, local)**  
Fact packs for puzzle + trap · caption + gates · static/typographic cards · localhost review HTML · export folder

**Phase B (admin host)**  
Auth-gated review URL · email nudge · consent + citation JSON wired

**Phase C (later)**  
Meta Business publish for Approved exports only · still no invent path

---

## 11. Competitive stance (for captions that mention “why us”)

| Competitor | They optimize | We do not | We show |
|------------|---------------|-----------|---------|
| Khan | Coverage | Out-contenting | Diagnosis + human wrap |
| Duolingo | Streaks | Streak-as-learning | Soft wrong → stay with it → transfer |
| Brilliant | Delight for the curious | Prestige-only | Anxious middle; trap reveals |
| Marketplaces | Access to humans | Random global board | Briefed tutor + memory |
| ChatGPT Base | Fluent answers | Solve-for-me cosplay | Guarded help; practice that works when hints are gone |

Prefer session-demo storytelling over feature-matrix brag lists (research CSA-2 hypothesis).

---

## 12. Evolution protocol

When research changes commercial language:
1. Edit §3 in this file.
2. Bump machine gates to match.
3. Add a changelog row.
4. Do not silently widen into marketplace or grit-poster content.

Open constraints (do not fake closure in captions):
- Parents buy clarity and progress; identity is the deeper student result.
- Do not claim parent digest / full living-record automation until shipped.
- Do not claim we prevent AI dependence until measured.

---

## 13. Changelog

| Date | Change |
|------|--------|
| 2026-07-29 | Single-file Instagram Content Agent build. Folded claim/voice law into this file. Removed side docs. Strengthened diagnosis-stack wedge and sealed fact pack. |
