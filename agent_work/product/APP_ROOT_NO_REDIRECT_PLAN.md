# App root: stop redirecting `/` to joinmindcraft.com

**Lane: Product (Cursor), files entirely in `app/**` + root `firebase.json`.**
No Engine files touched.

## Context
`mindcraft-93858.web.app` (the `app` Hosting target) currently bounces bare
`/` to `https://joinmindcraft.com/` via **two** layers:

1. Hosting-level 302 redirect — [`firebase.json`](../../firebase.json), `hosting[0]` (target `app`), `redirects[0]`:
   ```json
   { "source": "/", "destination": "https://joinmindcraft.com/", "type": 302 }
   ```
2. Client-side fallback — [`app/src/App.tsx`](../../app/src/App.tsx):
   ```tsx
   // line ~249
   function MarketingRedirect() {
     useEffect(() => {
       window.location.replace(MARKETING_BASE)
     }, [])
     return null
   }
   ...
   // line ~386
   <Route path="/" element={<MarketingRedirect />} />
   ```

This made sense when `mindcraft-93858.web.app` was treated as a possible
stray public entry point that should funnel visitors to the real marketing
site. In practice it now only gets hit by people testing the app directly
(everyone else lands on `joinmindcraft.com`, which is the separate
`mindcraft-marketing-site` Hosting site — see `firebase hosting:sites:list`),
so the redirect is pure friction for testing: you can't open the app root
without an extra manual `/dashboard` or `/login` hop.

## Change
Remove both redirect layers so `/` on `mindcraft-93858.web.app` falls through
to the existing wildcard route instead of bouncing off-site:

1. **`firebase.json`** — delete the `"/"` entry from `hosting[0].redirects`
   (the `app` target's redirects array). Leave the other three
   (`/landing.html`, `/blog.html`, `/article.html`) — those are legacy static
   paths with no SPA route, still correctly forwarded to marketing.
2. **`app/src/App.tsx`** — delete the `<Route path="/" element={<MarketingRedirect />} />`
   line (and the now-unused `MarketingRedirect` function + its `MARKETING_BASE`
   import, if nothing else references it — check `Dashboard.tsx`, `Admin.tsx`,
   `DemoNotebook.tsx`, `ManjushreeZone.tsx`, `lib/siteUrls.ts` still use
   `MARKETING_BASE`/`joinmindcraft.com` elsewhere, so only remove the redirect
   component itself, not the constant/import file).

With the `/` route gone, it falls through to the existing catch-all:
```tsx
<Route path="*" element={<Navigate to="/login" replace />} />
```
So `mindcraft-93858.web.app/` → `/login` (or straight into the app if already
authenticated, same as any other route). No new route/component needed.

## Verify
- `curl -so /dev/null -w '%{http_code}\n' https://mindcraft-93858.web.app/` → `200` (not `302`)
- Visiting `https://mindcraft-93858.web.app/` in a browser lands on `/login`
  (logged out) or the dashboard (logged in), not `joinmindcraft.com`.
- `joinmindcraft.com` itself is untouched (separate `mindcraft-marketing-site`
  Hosting site/target — this change only touches the `app` target's redirect
  rules).

## Explicitly out of scope
- No change to the `marketing` or `world1` Hosting targets.
- No change to `mindcraft-marketing-site` content or the `joinmindcraft.com`
  custom domain mapping.
- Ships via the normal `git push origin main` → CI Hosting deploy. Do not
  `firebase deploy` locally (CLAUDE.md).
