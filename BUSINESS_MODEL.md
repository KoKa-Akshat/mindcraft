# MindCraft — Business Model

**v1.0 · 2026-08-11**
Companion to [`BRAND_BOOK.md`](BRAND_BOOK.md) v2.0. Validation plan referenced throughout: [`MindCraft_Viability_Research_Strategy.md`](MindCraft_Viability_Research_Strategy.md).

**How to read this document.** This is a business-model draft, not a set of settled facts. Every number that is not directly sourced from an existing repo document is tagged **`[ASSUMPTION]`** inline. Tagged numbers are internally consistent with each other (if a take rate and a session price are both assumed, the downstream math ties out to both) but none of them have been validated against real pricing research, real mentor payout expectations, or real conversion data. Before this document is used in an investor deck, a pricing page, or any external commitment, every `[ASSUMPTION]` needs to be replaced with a real figure or an explicit "still unknown."

---

## 1. Positioning recap

MindCraft is the collaborative workspace for learning: students open the platform, show what they're working on, and get live help from a college mentor without leaving their room — entry point "office hours from your room," broadening into a full workspace for notes, meetings, presentations, projects, content, and AI, with the long-term vision of becoming the operating system for student work. Math tutoring (the Solver vertical — Katha, Maya, "the click") is the deepest-built vertical inside that workspace, not the definition of the company. Full positioning, voice, and the tagline system ("MindCraft — Never work alone. / Office hours from your room.") live in `BRAND_BOOK.md` v2.0; this document assumes that positioning and builds the business case on top of it.

---

## 2. Target segments

**Who uses the product** (not necessarily who pays):
- **Students** — the core user on both sides of the interaction: as a person seeking help (any subject, any kind of work) and, over time, as a mentor once they have experience of their own (the Brand Book's "as the students we support gain experience of their own, we hope they return as mentors" line — this is a real supply-growth mechanic, not just sentiment).
- **Mentors** — currently college students and recent grads; the supply side of the marketplace.
- **Parents** — mostly relevant for the Solver/high-school-ACT slice of the student base; pay for or co-decide on paid tiers, consume the reporting add-on (§3).
- **Institutions** (eventually) — college academic-support offices, high schools, possibly employers/bootcamps — a licensing buyer, not a near-term segment.

**Who pays:**
- Students/families directly (subscription + marketplace session fees).
- Parents specifically for the reporting/oversight add-on.
- Institutions, once a licensing motion exists (not near-term — see §6).

### TAM / SAM / SOM — methodology, not just a number

The right way to size this is bottom-up from campuses, not top-down from a national headline number (a top-down "N million students" figure invites exactly the kind of unsupported scale claim Akshat has already ruled out — see the note on the killed "1.6 billion" line below). Still, a rough top-down frame is useful as a ceiling check, so both are shown.

**Top-down ceiling (methodology: national enrollment counts, not usage data):**
- TAM — US students who regularly do "work that could stall and need live help": roughly all US undergraduates plus college-bound high schoolers, on the order of **24–27 million** people `[ASSUMPTION — not sourced to a specific NCES/IPEDS pull; needs a real citation before use externally]`.
- SAM — the slice at institutions/communities where a peer-mentor culture already exists or is plausible (residential colleges, ACT/SAT-prep-active high schools), and where students have some ability to pay directly or through parents: roughly **8–12 million** `[ASSUMPTION]`.
- SOM (3-year horizon) — reachable via the campus-grassroots motion in §6, not paid acquisition: **~50 campuses/communities × ~3,000 addressable students each ≈ 150,000** `[ASSUMPTION, both the campus count and per-campus student count]`.

**Bottom-up build (methodology: start from the actual GTM unit — one campus — and multiply):**
1. One campus (e.g., Macalester, ~2,100 undergrads) → assume **40–60% of a campus is "addressable"** in year one (students who do enough independent academic/project work to plausibly want this) `[ASSUMPTION]` → ~900–1,250 addressable students per small liberal-arts campus.
2. Mentor supply per campus: assume **3–5% of addressable students** are willing to mentor for pay `[ASSUMPTION]`, i.e., 30–60 mentors at Macalester's scale — enough to test whether "any subject, on demand" is a real supply story or a thin one (see §8 risk).
3. Multiply the per-campus addressable count by the number of campuses reached via the grassroots playbook in a given year (§6 lays out the sequencing; no specific campus count beyond year one is assumed here) to get SOM at any point in time.

This bottom-up build is the one to actually track — it is falsifiable per campus, which the top-down TAM is not.

**Killed claim:** the old "1.6 billion [students worldwide]" scale line does not appear in this document and should not appear anywhere else. Akshat explicitly killed it as a scale claim the company cannot defend.

---

## 3. Revenue streams

Grounded in two things already in the repo rather than invented from scratch: `CODEX_BRIEF.md`'s existing pricing note ("pricing is invitation-based, not transactional... 'A few seats remain'... 'Apply for a seat'") and `backup.md`'s tutor/parent monetization idea ("auto weekly reports, exact weak concepts, suggested sessions, and receipts of improvement — this sells the business better than 'AI tutor' alone").

**Reconciling "invitation-based" with a real revenue model.** "Invitation-based, not transactional" describes the *marketing funnel and scarcity framing* at the front door (controlled rollout, "apply for a seat," no self-serve checkout page) — it does not mean the backend is free. It's compatible with every stream below: access is gated by an application/invite, and once in, the streams below are how the gated relationship is monetized.

| Stream | Mechanism | Rate `[ASSUMPTION]` |
|---|---|---|
| **Mentor-session marketplace take rate** | Platform fee on paid mentor sessions booked through MindCraft | 20% platform / 80% mentor payout `[ASSUMPTION]` |
| **Desk OS subscription — free tier** | Workspace, notes, rate-limited AI tools, browsing the mentor marketplace | $0 |
| **Desk OS subscription — paid individual tier ("Plus")** | Unlimited AI tools, priority mentor matching, a monthly mentor-session credit, unlimited notes/presentation storage | $12–15/month `[ASSUMPTION]` |
| **Family/parent reporting add-on** | The `backup.md` monetization loop: automated weekly reports, exact weak concepts (pulled from the same mastery graph that powers Solver), suggested sessions, receipts of improvement | $10/month per student, stacks on top of a student plan `[ASSUMPTION]` |
| **Institutional/school licensing** (eventual, not near-term) | Per-seat annual license for a college academic-support office or a high school; bulk seats, admin dashboard, aggregate (non-identifying) insight | $8–15/seat/year `[ASSUMPTION]` |

The family/parent add-on is worth calling out specifically because it is the one revenue line already partially validated by product reality: the mastery graph, weakness detection, and evidence tracking described in `CLAUDE.md` already exist for Solver. Turning that into a parent-facing weekly digest is closer to a packaging decision than a new build — which is exactly why `backup.md` flags it as selling the business better than "AI tutor" alone. It is still `[ASSUMPTION]`-tagged here because the price point and attach rate are unvalidated.

---

## 4. Unit economics `[ASSUMPTION — all figures, kept internally consistent]`

Baseline assumptions carried through this section:
- Average mentor session price: **$25/hour** `[ASSUMPTION]`.
- Marketplace take rate: **20%** → **$5/hour platform revenue, $20/hour mentor payout**.
- Average paying-student marketplace usage: **2 hours/month** → **$10/month** marketplace revenue per active marketplace user `[ASSUMPTION]`.
- Desk OS Plus subscription: **$12/month** `[ASSUMPTION]`.
- Blended ARPU for a paying, marketplace-active student (subscription + marketplace, not additive for every user — some pay only one or the other): **~$18–22/month** `[ASSUMPTION]`.

**Gross margin:**
- Marketplace revenue is close to pure margin minus payment processing (~3%) and support/trust-and-safety overhead — assume **~85% gross margin** on the take-rate line `[ASSUMPTION]`.
- Subscription revenue carries AI inference cost (LLM calls for notes/AI tools, ~$1–2/active user/month at current model pricing) plus hosting — assume **~75–80% gross margin** on the subscription line `[ASSUMPTION]`, in line with typical SaaS.
- Family add-on is close to zero marginal cost (mostly automated report generation off data already collected) — assume **~90% gross margin** `[ASSUMPTION]`.

**CAC:**
- Campus-grassroots CAC (the GTM model in §6 — direct recruiting, no paid ads): **$8–15 per acquired active student** `[ASSUMPTION]`, materially below typical tutoring-marketplace paid-acquisition CAC (which runs $40–80+ for comparable products going through paid channels — cited as an industry ballpark, not a MindCraft-specific figure).
- Mentor-side acquisition cost via the same grassroots channel (flyers, tutoring-center outreach, a small referral incentive): **$5–10 per onboarded mentor** `[ASSUMPTION]`.

**LTV:**
- Assume average active tenure of **18 months** (spans multiple semesters, including summer drop-off) `[ASSUMPTION]`.
- LTV ≈ ARPU × blended gross margin × months retained ≈ $20 × 0.80 × 18 ≈ **$288** `[ASSUMPTION]`.
- Against a **$8–15 grassroots CAC**, that implies an LTV:CAC ratio in the **19:1–36:1** range — this is almost certainly too good, and the honest read is that campus-grassroots CAC is not a number that survives past the first one or two founder-adjacent campuses (see §8). Treat this ratio as a best-case floor-tester, not a plan input.

**Mentor lifetime value to the platform** (a second-order number worth tracking, not just student LTV): a mentor doing ~5 sessions/week for two semesters (~28 weeks) at $5/hour platform take ≈ **$700 in platform revenue per mentor over an academic year** `[ASSUMPTION]`. Mentor supply is therefore not just a cost center (payouts) — a retained, high-volume mentor is a real revenue asset, which argues for investing in mentor retention (the "co-author, never gig labor" treatment in Brand Book §6) as a unit-economics lever, not just a brand nicety.

---

## 5. Pricing tiers (draft)

| Tier | Price `[ASSUMPTION]` | What's included |
|---|---|---|
| **Free** | $0 | Workspace (notes, project boards), rate-limited AI tools, browse/apply to mentors, one intro session or async Q&A `[ASSUMPTION on the intro-session mechanic]` |
| **Individual — Plus** | $12–15/month `[ASSUMPTION]` | Unlimited AI tools, priority mentor matching, one included mentor-session credit/month, unlimited storage for notes/presentations/projects |
| **Family add-on** | +$10/month `[ASSUMPTION]`, stacks on a student plan | Weekly report, weak-concept summary (Solver-linked where applicable), suggested next sessions, receipts of improvement — the `backup.md` loop |
| **Institutional / school** (eventual) | $8–15/seat/year `[ASSUMPTION]`, custom above a seat threshold | Bulk seats, admin dashboard, aggregate progress insight, integration with the institution's existing tutoring-center mentor supply where one exists |

---

## 6. Go-to-market

This is not a new plan — it builds directly on `MindCraft_Viability_Research_Strategy.md`, which already lays out a bottoms-up, campus-grassroots research and validation methodology centered on Macalester and the surrounding St. Paul community. That document should stay the operating reference for the research/validation phase; this section only sequences it into a broader GTM arc.

**Phase 0 — Validate before scaling (already planned, not yet run at time of writing).** Run the 15-conversation protocol from `MindCraft_Viability_Research_Strategy.md`: 5 students, 5 parents, 5 tutors/mentors, sourced from the locations that document already names (Macalester campus green, library, Dunn Bros/Black Coffee & Waffle Bar on Grand Ave, Summit Ave/Crocus Hill door-to-door, high school pickup zones, the Macalester tutoring center/TA offices). Output: affinity-mapped jobs-to-be-done per stakeholder, and a kill/keep/build list — feeds directly back into §3's revenue-stream prioritization and §8's risk list.

**Phase 1 — One-campus bootstrap (Macalester).** Recruit mentor supply first (tutoring center, TA office bulletin boards, the $5 coffee-gift-card flyer approach already specified in the research doc), because a workspace with no one on the other end of it has nothing to sell. Recruit students through the same low-friction, in-person channels. Parents reached via the door-to-door/pickup-zone channels already mapped for the reporting add-on specifically — that's the segment most likely to pay for §3's family stream first.

**Phase 2 — Replicate the playbook at 2–4 similar campuses.** Same channel mix (campus-center recruiting, in-person conversations, no paid acquisition), chosen for similarity to Macalester (residential, small-to-mid liberal-arts, walkable off-campus student neighborhood) so the playbook transfers with minimal adaptation. This phase is where the CAC assumption in §4 gets its first real test outside a founder's personal network.

**Phase 3 — Broaden campus type + open the institutional conversation.** Once mentor-supply liquidity and retention are proven at 4–5 campuses, expand to larger state schools and to high schools (where the Solver vertical already has product-market fit signal) and begin institutional-licensing conversations (§3, §5) with academic-support offices at campuses where organic usage is already meaningful — sell the license into the community that already exists, not into a cold institution.

---

## 7. Competitive landscape & moat

| Competitor type | Example | What it optimizes for | Why MindCraft inverts it (Brand Book §12) |
|---|---|---|---|
| Tutoring marketplace | Wyzant-style hour marketplaces | Selling hours, matching on availability/price | Sells the click, not the hour — the human session sits inside a persistent workspace with context, not a transaction that ends when the timer does |
| Productivity suite | Notion, Google Workspace | Infinite blank tools, self-serve, no human in the loop | Every tool is one tap from a live mentor; a better blank page has never gotten anyone unstuck |
| AI-only tutor | Khanmigo-style AI tutoring | Scaling a single AI interlocutor across every student | Combines AI's scalability with a real human's judgment, encouragement, and read on where a specific student is stuck — the elevator pitch's explicit argument for why AI alone isn't enough |
| Content library | Khan Academy | Organizing the world's material for the already-motivated | Manufactures the motivation itself via live human connection, for the student who wasn't going to open a library on their own |
| Gamified habit app | Duolingo | The mechanic (streaks) as the product | The work itself, and the person helping with it, are the product — no engagement-bolted-on-boredom mechanic |

**Moat, in order of durability:**
1. **The mastery/evidence graph.** Solver's knowledge graph (per-student mastery, misconception tracking, gap detection — real, shipped, described in `CLAUDE.md`) is the deepest technical asset and the hardest to replicate quickly; it's also what makes the family-reporting stream (§3) close to a packaging exercise rather than new engineering. Extending an analogous "context object" to non-math mentoring sessions (what a student already tried, where they're stuck) is the workspace-wide version of the same moat.
2. **Workspace lock-in.** Once a student's notes, project history, and mentor relationships live on MindCraft, switching cost rises the way it does for any workspace tool — this is the productivity-suite competitors' own moat, turned against a category (tutoring marketplaces) that currently has none.
3. **Trust layer / mentor community.** Verified mentors, session history, and the "co-author, not gig labor" mentor relationship (Brand Book §6) compound over time in a way a pure marketplace's anonymous hour-sellers don't.
4. **Campus-native distribution.** The grassroots GTM in §6 is slow but close to unpaid-CAC; a VC-funded competitor optimizing for paid-channel growth has a structurally worse cost basis in the same early market.

None of these are validated moats yet — they're the intended shape of one, and #1 is the only one with real evidence behind it today (a working knowledge graph). #2–#4 are theses that Phase 0–2 of §6 should be testing.

---

## 8. Risks & what needs validation

Ordered roughly by how much this business model depends on each one, most load-bearing first. `MindCraft_Viability_Research_Strategy.md` is the existing plan to de-risk the first three.

1. **Supply-side liquidity outside math.** Solver has real mentor supply and product-market signal. Does "any mentor, any subject, on demand" hold once you leave math — or is coverage thin outside a few popular subjects, undermining the "different mentor for different needs" pitch in §14 of the Brand Book? Needs direct validation via the tutor-interview protocol in the research doc, expanded to ask specifically about subject breadth, not just willingness to tutor.
2. **Willingness to pay for workspace features.** Notion and Google Workspace have trained students to expect notes/docs/presentation tools for free. The model here leans on the marketplace take rate and family add-on to carry revenue rather than the workspace tools themselves — that bet needs the research doc's parent and student questions ("what would make you switch," "how much do you currently spend") answered before it's trusted.
3. **The family/parent reporting add-on's actual demand and price sensitivity.** `backup.md` asserts this "sells the business better than AI tutor alone," and the research doc already has the right parent-facing questions queued up (what would need to be in a session summary, what earns 30-day trust) — but nobody has run those conversations yet as of this document.
4. **CAC durability past founder-adjacent campuses.** The `[ASSUMPTION]`-tagged $8–15 grassroots CAC in §4 is very likely a first-campus number, not a steady-state one. The LTV:CAC ratio in §4 is flagged there as too good to plan around — Phase 2 of §6 is the actual test.
5. **On-demand supply/demand matching at the moment a student is stuck.** The core promise ("show what you're working on, instantly enter a workspace with a mentor") requires enough mentors online at the right moment. Cold-start liquidity risk is highest late at night and in low-supply subjects — exactly when the emotional need (per Maya's 2am scene) is highest.
6. **Every rate in §3–§5 is invented.** Session price, take rate, subscription price, and licensing price are placeholders chosen to be internally consistent, not researched. Real comparable pricing (existing tutoring marketplace rates, what parents currently pay per `MindCraft_Viability_Research_Strategy.md`'s own question "how much do you currently spend on tutoring per month?") should replace all of them before any external use.
7. **Institutional sales cycle.** Untested and likely slow (higher-ed and K-12 procurement cycles run long) — §6 deliberately sequences this last and treats it as opportunistic (sell into an already-organic community) rather than a near-term revenue plan.
