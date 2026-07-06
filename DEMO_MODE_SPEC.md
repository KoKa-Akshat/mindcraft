# Temporary no-login demo route for BETA Showcase (2026-07-01)

Goal: a booth visitor taps a link/QR and lands directly on a populated
Dashboard — no signup form, no typing credentials. Under the hood it's still a
real Firebase-authenticated session (one dedicated seeded demo account), so
**no changes to Firestore rules, ML auth, or any existing guarded route are
needed** — this is purely additive.

## 1. One-time setup (do this once, by hand, before the event — not code)

Sign up a real account through the normal flow at `/login` → "Create account":
- Email: `demo@mindcraft.app` (or whatever's actually available/preferred)
- Password: pick something fixed, written down somewhere safe — it'll be
  embedded in the client bundle (see security note below, this is fine for a
  low-stakes seeded account).
- Role: student.

Then, as that account, walk through the **real** app once: complete the 3D
diagnostic or web gap-scan, do a couple of practice sessions across 2-3
concepts so the Dashboard/Knowledge Graph/Practice path all show real,
populated data instead of an empty new-account state. This is what makes the
demo look alive rather than blank.

## 2. New route — `app/src/pages/Demo.tsx` (new file)

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

// Showcase-only seeded account. Low-stakes by design — no real student data.
const DEMO_EMAIL = 'demo@mindcraft.app'
const DEMO_PASSWORD = '<fill in — matches the account created in step 1>'

export default function Demo() {
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => navigate('/login', { replace: true }))
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a2218', color: 'rgba(255,255,255,0.6)',
      fontFamily: 'system-ui, sans-serif', fontSize: 14,
    }}>
      Loading MindCraft…
    </div>
  )
}
```

Matches the exact loading-screen style `AuthGuard` already uses (`App.tsx`
~line 106) so there's no visual flash/mismatch between this and the guarded
`/dashboard` it hands off to.

## 3. Route registration — `app/src/App.tsx`

Add near the other public routes (alongside `/login`, `/book`):
```tsx
<Route path="/demo" element={<Demo />} />
```
No `<AuthGuard>` wrapper — this route's whole job is establishing the session
*before* handing off to a guarded route. By the time `navigate('/dashboard')`
fires, `onAuthStateChanged` will have already fired for the demo sign-in, so
`AuthGuard` on `/dashboard` sees a signed-in user immediately (no bounce back
to `/login`).

## 4. Point the showcase QR/link at `/demo` instead of the marketing site

`demo-assets/showcase-print/PRINT_HANDOFF.md` currently has the QR targeting
`https://mindcraft-marketing-site.web.app/`. For booth use, either:
- generate a second QR pointing at `https://mindcraft-93858.web.app/demo` for
  people trying the live app, keeping the printed card's QR as-is for takeaway
  marketing, or
- if there's still time before print, swap the QR target directly — but since
  cards are likely already ordered/printed per the handoff doc, prefer a
  **second QR** (e.g. a small table-tent or a link shown on the booth
  laptop/tablet itself) rather than reprinting.

## Notes

- **Security:** hardcoding the demo password client-side is acceptable here —
  it's a single seeded account with synthetic/fake practice data, not a real
  student, and the same trust model already applies to every signed-in user
  writing their own `users/{uid}` doc per existing Firestore rules. Nothing
  about this weakens auth for any other account.
- **Reset between visitors:** each person who plays with the demo account will
  change its state (new practice attempts, mastery shifts). There's no
  auto-reset built here — if the booth needs a clean slate between visitors,
  use the existing Admin → Testing → "Retake gap scan" or QAToolbar's "Restart
  Fresh" (`/qa` route) manually between demos. Not worth automating for a
  one-evening event.
- **Removal after the event:** delete `Demo.tsx` and the `/demo` route
  registration whenever this is no longer needed — it's intentionally isolated
  (one new file + one route line) so cleanup is a two-line revert.
- Depends on the `HOTFIX_recommend_500.md` fix being deployed first if you want
  the demo's Dashboard/Practice/GPS panels to show real pathfinder output
  rather than fallback heuristics — cosmetically the demo will still work
  either way, but the recommendations will look better post-hotfix.
