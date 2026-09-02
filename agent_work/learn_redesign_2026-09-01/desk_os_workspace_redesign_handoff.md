# Desk OS · Workspace redesign handoff (2026-09-02)

Combined work: Codex's Workspace/Tutors redesign, finished and extended here
with a matching Resume Helper pass. All in `agent_work/product/desk_os/`
(source of truth — `app/public/desk-os/` and `app/dist/desk-os/` are
generated copies, `npm run sync:desk-os` / `npm run build` in `app/`).

## What Codex built

- Replaced the oversized cube hero with a paper-workspace layout: a
  hero "next page" sheet that opens `/learn`, a Jesse activity slip tied to
  the real `learnActivityCount` handoff, three real header tabs (Workspace,
  Resume studio, Tutors & events) that swap surfaces in place — no page
  navigation between them.
- Wired both Learn entry points (`hub-hero-cta`, the paper sheet itself) to
  navigate immediately, no artificial delay.
- Fixed a real responsive bug: the tab row was overflowing the header on
  narrower screens. Moved to its own grid row below 1100px
  (`styles.css:6460`), confirmed no horizontal overflow at 834px and 390px
  widths.
- Verified via real screenshots: desktop, iPad both orientations, phone,
  and tutor role (tutor tiles swap in for the student hero/Jesse slip).

## What I added: Resume Helper polish

The founder asked specifically for Resume Helper to "look so much better"
now that it's a first-class tab next to Workspace and Tutors. It already
shared the same card chrome (`.hub-tutor-duo`/`.hub-tutor-pane`) but the
interior felt like a bare form next to Tutors' richer cards. Changes,
scoped to `index.html`, `styles.css`, `js/resumeHelper.js`:

1. **Starter prompt chips** (`js/resumeHelper.js` `STARTER_PROMPTS`,
   `.rh-starters`/`.rh-starter`): three tap-to-send opening messages
   ("I don't have a resume yet…", "I'm looking for summer internships…",
   "Ask me the right questions…") shown only on a genuinely first-time
   profile (same `substantive` check the existing greeting already used).
   Tapping one sends it through the real chat pipeline (`bubble('you', …)`
   + `askJesse(…)`), same as typing it — not decorative, and it retires
   itself the moment the student sends anything, including their own typed
   message or a file upload (moved the hide into `bubble()` itself so every
   real-engagement path covers it, not three separate call sites).
   This also fixes a latent bug in the same spot: `greetOnce()`'s
   "already greeted" check was `!transcript.childElementCount`, which
   would have broken the moment a static element ever lived inside
   `.rh-transcript` — changed to `!transcript.querySelector('.rh-bubble')`.
2. Upload buttons ("Upload resume (PDF)", "Upload a writing piece") got a
   small upload icon — previously bare dashed-outline text buttons.
3. The profile pane header got an icon badge (lime circle, matches the
   `.rh-chip` treatment already used for skills) so it visually pairs with
   Jesse's avatar circle instead of reading as a plain form label.
4. "Add" buttons for skills/links upgraded from flat white-outline to the
   same dark-fill treatment as the Send/Search buttons elsewhere in the
   hub, for consistent visual weight on primary actions.

No data hooks, auth flow, or backend contracts touched — every
`data-rh-*` attribute `resumeHelper.js` reads is unchanged.

## Verification

- Playwright walkthrough against a local static build of `app/dist`
  (unauthenticated local demo path, `/try/desk`-equivalent): entered as
  Student, screenshotted Workspace, Tutors, and both Resume Helper steps
  (build + jobs table) at desktop width, then Resume Helper again at
  834×1194 (iPad portrait) and 390×844 (phone) — zero horizontal overflow
  at either width, no console errors or exceptions during the whole walk.
- Clicked a starter chip live: confirmed it sends through the real chat
  path (user bubble appears, "Jesse is reading" status, chips retire
  immediately) rather than just looking clickable.
- `node --check js/resumeHelper.js` — syntax clean.
- `npm run build` in `app/` (sync:desk-os + tsc + vite build) — clean.
