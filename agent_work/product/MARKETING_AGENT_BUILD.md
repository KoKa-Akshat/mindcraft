# Instagram Content Agent — Build Spec

**Status:** Living build for the Instagram content agent (generate → human approve → export).  
**Updated:** 2026-07-29  
**Lane:** Product (`app/` review UI later) · data reads from existing bank / ontology / research  
**Does not auto-post.** Batch only. Human ships.

Copy / claim law the agent must enforce: [`MARKETING_COPY_DOCTRINE.md`](./MARKETING_COPY_DOCTRINE.md)  
Brand law: `BRAND_BOOK.md`  
Product thesis: [`LIVING_LEARNING_RECORD.md`](./LIVING_LEARNING_RECORD.md)  
Evidence: Research Constitution + Parts XXVII, XXXIII–XXXVI

---

## 0. Elevator (short version — use this externally)

### What it is

An Instagram content agent that turns MindCraft’s private learning stack into post-ready batches: captions plus finished images. Nothing posts by itself. It builds a queue. Humans approve what ships.

### Why this is not a caption toy

Generic tools invent vibes. This agent is chained to assets competitors cannot buy:

1. **Named failure modes with frequency.** ~1,749 misconception records from the Eedi ingest (`ml/data/eedi_misconceptions.json` and mapping), not generic “students struggle with algebra.” Each post can aim at a real trap students actually fall into.
2. **A tagged question bank.** ~1,500 exam-grade items across concepts/formats in the live bank, many story-wrapped. Puzzles are selected, never invented.
3. **A 42-concept map with bridges.** Content can point at the gap between ideas (where students actually fail), not chapter titles.
4. **Brand + claim enforcement before the queue.** Every caption and image brief is checked against Brand Book voice and the claim ladder. Off-voice, guarantee language, grit posters, and marketplace cosplay die before a human sees them.
5. **Split brain: model writes; facts are sealed.** The LLM may only phrase. Puzzle answers, research citations, and testimonial quotes come only from verified stores. If the store is empty, that pillar skips. No hallucination path.

That is the wedge: **mechanism-true content from our diagnosis stack**, not another AI quote card farm.

### Content pillars

| Pillar | Source of truth | Agent may |
|--------|-----------------|-----------|
| Story-framed puzzles | Question bank + concept stories | Select item, wrap caption, render card. Never invent the stem or key. |
| “Most people get this wrong” traps | Misconception frequency + linked items | Name the trap, show reveal after. Frequency language only if count exists. |
| Pure story | `conceptStories` / Katha prose | Story only. No product CTA required. |
| Learning-science | Human-curated citation allowlist | Cite only allowlisted papers. No freestyle Scholar. |
| Data insight | Aggregated misconception / bank stats | Numbers only from computed reports. |
| Testimonials | Consent store only | Quote only consented, attributed entries. Prefer tutor quotes first (minors). |
| Manifesto / tutor recruit | Brand Book + approved bank | Quote cards and recruiting. No fake urgency. |

### Review loop (email is half right)

Email is a nudge, not the decision surface. Gmail often blocks images; you cannot record approve/reject in a thread cleanly.

**Canonical loop:**
1. Agent writes a weekly batch to a review page (images + captions laid out).  
2. Email links to that page.  
3. Approve / reject / edit per post. Copy button on each caption.  
4. Approve exports a folder: images + `caption.txt` paste-ready.  
5. Auto-post to Instagram later (needs Business account + Facebook Page). Not in v1.

**Host path:** start local (~one day), then put the review UI behind existing admin auth so it works on a phone.

### Batch size

~10 images / week → roughly 6–8 posts. One sitting to review.

### Already on disk (fuel)

Misconceptions, questions, story-wrapped stems, story prose, and a small set of story illustrations. Pillars that need humans before scale: citation allowlist, consented testimonials (tutors first), more artwork.

---

## 1. Job to be done

**Produce Instagram-ready creative that makes Maya stop scrolling and makes parents trust the mechanism**, using only MindCraft data and research-safe claims, with a human gate before anything public.

Non-goals (v1):
- Auto-publish to Instagram  
- Open “learn guitar / anything” marketplace posts  
- Inventing pedagogy, scores, or quotes  
- Optimizing for streak / dopamine copy  

---

## 2. Architecture (v1)

```
[Data adapters] → [Pillar picker] → [Fact pack (sealed JSON)]
                                      ↓
                              [Caption LLM]  ← Brand + doctrine checks
                                      ↓
                              [Image renderer]
                                      ↓
                              [Batch store] → [Review UI] → [Export folder]
                                      ↑
                              [Email nudge with deep link]
```

### Sealed fact pack (critical)

Before any LLM call, the agent builds a **fact pack** the model cannot override:

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
  "banned_phrases": ["guaranteed", "2-sigma", "unlock your potential"]
}
```

The model receives the fact pack and a style brief. It returns caption variants + image layout hints.  
**Validators reject** any output that introduces numbers, answers, names, or citations not present in the fact pack.

---

## 3. Brand and research gates (automatic)

Run on every candidate before it enters the review queue:

| Gate | Fail if |
|------|---------|
| Em dash | Caption or on-image text contains `—` |
| Brand voice | Confetti praise, “rockstar,” streak-guilt, cute error language |
| Claim ladder | Score guarantees, Bloom 2-sigma, “prevent AI dependence,” marketplace promises |
| Fact seal | Any numeral, answer choice, DOI, or proper-name quote not in fact pack |
| Equity | “Culturally magical world closes the gap” style claims (Part XXXVI) |
| Competitive cosplay | “Math Duolingo,” out-Khan library brags, grit-poster empty mindset |
| ACT wedge drift | Posts that promise any subject / any tutor worldwide as current product |

On fail: regenerate once with the violation named; if still fail, drop from batch and log.

---

## 4. Pillar specs (precise)

### 4.1 Puzzle post
- Pick playable bank item with story frame when available.  
- Image: stem + choices or stem-only with “answer in comments” if format needs it.  
- Caption: human, short, optional soft CTA to try MindCraft. No invented keys.  
- Prefer ACT-relevant concepts for the beachhead, but any bank concept is allowed if labeled honestly.

### 4.2 Trap reveal (“most people get this wrong”)
- Require misconception_id + linked wrong choice or documented trap.  
- Frequency line only when `frequency` is present and computed. Prefer “a common trap” if count is stale.  
- Structure: hook → attempt → reveal → one-line why. Mechanism-true, not shame.

### 4.3 Pure story
- Katha / concept story excerpt. No product mention required.  
- Visual: story illustration if on disk; else typographic card on brand ground.  
- Do not dump heritage trivia that fails seductive-details caution (Part XXXVI). Story must earn the math.

### 4.4 Learning-science
- Citations **only** from `citations_allowlist.json` (human maintained).  
- Allowed seed direction (examples, not auto-added until listed): Roediger & Karpicke 2006; Cepeda spacing syntheses; Bastani et al. 2025 only for AI-crutch caution, never as “we are proven GPT Tutor.”  
- Caption must state the finding in plain language and name the paper. No fake DOIs.

### 4.5 Data insight
- From precomputed reports only (misconception top-N, concept coverage, format mix).  
- No student-level or identifiable data. Ever.

### 4.6 Testimonials
- Source: consent table (`consent_recorded_at`, medium, scope includes `instagram`).  
- Start with tutors. Students who are minors need guardian consent on file.  
- Sebastian / Gillian style assets already on the marketing site may be reused only if consent scope covers social; otherwise re-consent.

### 4.7 Manifesto + tutor recruit
- Lines from Brand Book / doctrine approved bank only.  
- Recruit: peer-level, precise. Never gig-labor language. Never “learners.”

---

## 5. Weekly batch recipe (default)

Target **6–8 posts / ~10 images**:

| Count | Pillar |
|------:|--------|
| 2 | Puzzle |
| 2 | Trap reveal |
| 1 | Pure story |
| 1 | Learning-science **or** data insight (alternate weeks) |
| 1 | Testimonial **or** manifesto (if consent/art available) |
| 0–1 | Tutor recruit |

If a pillar lacks fuel, skip. Do not pad with invented content.

---

## 6. Review UI (v1)

**Local first**, then admin-hosted.

Minimum page:
- Grid of cards: rendered image, caption, pillar tag, source ids  
- Approve / Reject / Needs edit  
- Copy caption  
- Export approved → `exports/ig/YYYY-WW/<slug>/{image.png,caption.txt,meta.json}`  
- Email: “Batch ready” + deep link only  

Auth for hosted: reuse admin role gate. No public batch URLs.

---

## 7. Human inputs (not the agent’s job)

| Need | Why | Owner |
|------|-----|-------|
| Citation allowlist | Research bans freestyle citations | Research / founder |
| Testimonial consent log | Legal + minors | Founder / tutors |
| More story art | Story pillar burns images fast | Design |
| Weekly approve sitting | Quality + voice | Founder |

---

## 8. Data adapters (repo paths)

| Fuel | Path / note |
|------|-------------|
| Misconceptions | `ml/data/eedi_misconceptions.json` (~1,749); mapping CSV under `data/eedi/` |
| Questions | `app/src/lib/questionBank.ts` merge (static + actMaster + eedi + generated) |
| Stories | `app/src/data` concept stories / story module caches as wired |
| Illustrations | marketing `img/` + story art folders (inventory in agent config) |
| Brand checks | `BRAND_BOOK.md` + `MARKETING_COPY_DOCTRINE.md` compiled to machine rules |
| Citations | `agent_work/product/ig_citations_allowlist.json` (create; empty = pillar off) |
| Consents | `agent_work/product/ig_testimonial_consents.json` (create) |

Do not scrape live student Firestore for IG content.

---

## 9. Success metrics (agent, not vanity)

- % batch passing gates on first try  
- Human reject rate by pillar (target: trap/puzzle rejects &lt; 30% after week 2)  
- Zero fact-seal violations reaching Approve  
- Time to review one batch &lt; 20 minutes  
- Later: save/share on IG (only after manual post). Not a v1 blocker.

Banned North Stars for this agent: raw post count, time-on-tool, streak metaphors in captions.

---

## 10. Implementation phases

### Phase A — Local batch (≈1 day)
- Fact-pack builders for puzzle + trap  
- Caption generation + gates  
- Simple static image cards (typographic + existing art)  
- HTML review page on localhost  
- Export folder  

### Phase B — Admin host
- Auth-gated review URL  
- Email nudge  
- Consent + citation JSON wired  

### Phase C — Auto-post (later)
- Meta Business login  
- Publish API only for Approved exports  
- Still no invent path  

---

## 11. Evolution protocol

When Research Lab changes commercial language or bans:
1. Update `MARKETING_COPY_DOCTRINE.md` claim ladder first.  
2. Bump gate rules in this agent.  
3. Note in §12 Changelog.  
4. Do not silently widen pillars into marketplace or grit-poster content.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-07-29 | Rewrote BUILD as Instagram Content Agent spec. Moved general copy law to MARKETING_COPY_DOCTRINE.md. Replaced weak “better than a caption tool” pitch with sealed-facts + diagnosis-stack wedge. |
| 2026-07-28 | (superseded) File briefly held a general marketing copy doctrine under the wrong job title. |
