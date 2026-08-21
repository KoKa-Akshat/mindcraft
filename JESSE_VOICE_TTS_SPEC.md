# Jesse voice quality: root cause + proposed fix

Status: **built and live (2026-08-20).** `webhook/fly-tts/` deployed to
Fly.io (`mindcraft-tts.fly.dev`, always-on, `min_machines_running: 1`).
Health check confirmed (`{"ok":true,"modelLoaded":true}`), real generation
tested live (3.3s round-trip for one line, WAV returned correctly).
`KokoroTTSClient.swift` points at it; the `useKokoro: false` opening-line
workaround is removed from every call site in `JesseCallSession.swift` since
its whole reason to exist (cold Vercel starts) is gone. High availability is
off for now (no payment method on the Fly org yet — single machine, fine at
current scale, trivial to add later).

**Revised recommendation (2026-08-20):** keep Kokoro (already tuned, three
real voices, already wired end-to-end from the just-shipped voice picker),
fix its hosting instead of replacing it. See "The actual fix, revised"
below — the original vendor-swap analysis (OpenAI/Deepgram) is kept as the
fallback option, not the lead, after tracing the code and confirming the
cold-start problem is specifically Vercel serverless scale-to-zero, not
something inherent to Kokoro's voice quality.

## The complaint

"It takes forever to load and then say what it wants to say." Voice quality
flips unpredictably mid-conversation.

## Root cause (verified in code, not assumed)

Two distinct, compounding issues in
`ios-prototype/MindCraftNotes/MindCraftNotes/Networking/JesseCallSession.swift`
and `KokoroTTSClient.swift`:

1. **The opening line is deliberately the worse voice.**
   `speak(_:voice:useKokoro:)` is called with `useKokoro: false` specifically
   for the call-opening greeting, forcing the native `AVSpeechSynthesizer`
   (the robotic one) for the very first thing a student hears. This was an
   intentional fix for an earlier complaint ("Jesse is mad slow to speak
   when I start a call", 2026-08-18) — see the doc comment directly above
   `speak()`. It solved the slow-open problem by trading away voice quality
   on exactly the line that sets a student's first impression.

2. **Every line after that silently flips voices depending on server temperature.**
   All later lines try Kokoro first (the good voice), with a 6-second
   timeout (`KokoroTTSClient.swift:39`, cut down from 55s per its own doc
   comment) before falling back to native. Kokoro is self-hosted on
   Vercel's free tier, which cannot keep the ~96MB model warm, so a cold
   container times out and silently falls back mid-conversation. The
   student hears the good voice, then the bad voice, unpredictably,
   with no signal anything changed.

**Net effect:** voice quality isn't just "not great", it's *inconsistent*,
and the inconsistency is structural, not a bug that will go away on its own.

## The "we need more voice options" framing is slightly wrong

Three Kokoro voices are already defined in
`webhook/lib/handlers/tts.ts` and `KokoroTTSClient.swift`
(`af_heart`, `af_bella`, `am_michael`). Checked every call site: `speak()`'s
`voice` parameter defaults to `.heart` and **nothing in the app ever passes
a different value.** The other two voices are built and dead. So the real
gap isn't "add voices," it's "the ones that exist were never wired to
anything a student can pick" — a UI/plumbing fix, not new voice work.

## Why this is worth fixing well, not just patching the timeout

ReadSpeaker and Voice.ai's research on TTS in education both point at the
same two levers: consistent emotional warmth without pitch drift over a
long stretch, and pacing that doesn't sound rushed or mechanical. Both are
exactly what breaks when the app silently flips between two differently-
voiced engines mid-call. Notably, both sources also note high-quality
synthetic voices can outperform human narration for learning specifically
*when the voice's qualities match the context* — inconsistency undermines
that match structurally, not just aesthetically.

## The actual fix, revised (2026-08-20): keep Kokoro, stop cold-starting it

**Read `webhook/lib/handlers/tts.ts` closely before assuming "self-hosted =
switch vendors."** Kokoro isn't a separate service this function calls, it
*is* this function: `kokoro-js` runs the ~96MB ONNX model in-process, inside
the Vercel serverless function itself, loaded into `/tmp` and kept in memory
"for the life of the warm container." The entire cold-start problem is
specifically that Vercel serverless functions scale to zero and cold-boot
on demand. That's a hosting problem, not a voice-vendor problem, and it has
a hosting fix that's cheaper and lower-risk than a vendor migration:

**Move `tts.ts`'s logic off Vercel serverless onto one small always-on
process** (Fly.io or Railway, checked real 2026 pricing: a shared-cpu-1x,
256MB Fly machine runs ~$2-5/mo; Kokoro's 96MB model plus Node overhead
likely wants more like 512MB-1GB, so budget realistically for something in
the $5-15/mo range, still far under either commercial API's likely bill at
real call volume). A persistent Node process loads the model **once, at
boot, forever** — there is no cold path to fall into, because there's no
scale-to-zero. Same `kokoro-js` code, same three already-tuned, already-
chosen voices, same `/api/tts` contract the iOS client already speaks to
(point the URL at the new host, nothing else in `KokoroTTSClient.swift`
needs to change). This gets warm *and* fast from the voice that was already
picked as the right one, instead of trading it away for either the robotic
native fallback or an unproven new vendor's voice.

**Why not just add a Vercel Pro keep-warm cron instead (the cheaper-
sounding option)?** Checked Vercel's own docs: Pro plan does drop the
Hobby-tier daily-cron floor down to 1-minute granularity, so "ping it every
minute" is real and available. But it doesn't reliably solve this: a cron
hit and a real user's call don't provably land on the *same* warm container
under Vercel's autoscaling, so the ping can warm a container nobody's
request ever reaches while a concurrent real call still lands cold. It's a
statistical improvement, not a guarantee, for the exact same $20/mo Pro
plan floor. An always-on process has no such gap by construction, at a
fraction of the cost.

**Second, smaller, complementary fix: stop forcing the native voice for the
opening line at all.** That compromise exists only because *every* opening
greeting currently pays Kokoro's cold-start cost live. Once the model is
never cold, most openings need no special-casing. The generic openers
("Hi, I'm Jesse...") are fixed strings — pre-render them once in each of
the three voices, host the WAV as a static asset, and have the opening
call check a small lookup table before hitting the live model at all. That
makes the very first sound a student hears both instant and the *actual*
chosen voice, not the fallback, closing the last gap `useKokoro: false`
papers over today. The one opener that's genuinely personalized (the
`studentName` variant) still needs live generation, but it's now live
generation against a warm model, not a cold one.

**When the vendor-swap table below is still the right call:** if warm
Kokoro's per-request generation time (not yet measured, needs a real check
once it's off cold-start hosting) turns out too slow for natural
turn-taking even when warm, or if genuine Spanish-voice support becomes a
hard requirement Kokoro can't add. Keeping it here as the fallback option,
not the lead:

| | OpenAI TTS | Deepgram Aura-2 |
|---|---|---|
| Cost | ~$15 / 1M characters | ~$27-30 / 1M characters |
| Voices | ~9-13 | fewer, purpose-built |
| Latency | ~0.5s | sub-90ms |
| Fit | cheap, simple, no subscription | built specifically for real-time conversational agents |

## Open questions for Blake

- ~~Confirm actual warm-Kokoro generation latency~~ **Answered, real
  measurement (2026-08-20): 3.3s round-trip for one line**, curl-tested
  against the live deploy, not simulated. Fast enough that the vendor
  table above stays the fallback, not a live need — revisit only if a
  real conversation turn (not a single curl) shows this compounding badly
  turn over turn.
- Fly.io billing: account is under an SSO-gated org tied to a `.edu`
  signup (`akshat-koirala-923`), no payment method added yet — HA is off
  as a result (see status line above). Add a payment method before this
  runs long on real traffic, and consider whether product infra belongs
  under a personal-email org instead of a school-linked one long term.
- Does the always-on host change anything about the Spanish-language gap
  (`StudentLanguage.usesKokoro == false`)? Almost certainly no on its own,
  Kokoro still has no Spanish voice; that's a separate, real gap either
  path leaves open.

## Sources

- Text to Speech (TTS) in Education — ReadSpeaker
- 12 Most Popular Text-to-Speech Voices — Voice.ai
- OpenAI TTS Pricing 2026 — TextToLab
- AI Voice TTS Pricing 2026 — buildmvpfast
- [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Vercel docs, Pro plan's 1-minute cron floor vs. Hobby's daily-only limit
- [Cost Management on Fly.io](https://fly.io/docs/about/cost-management/) — always-on shared-cpu-1x machine pricing
