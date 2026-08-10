# Fable 5 dashes — Studio + Workflows (2026-08-10)

Source: `agent_work/product/desk_os/{studio,workflows}/`  
Synced into `app/public/desk-os` on `npm run build` / CI.

## Live links (after push to main)

| Dash | Short | Full |
|------|--------|------|
| **Studio** (video/photo create) | https://mindcraft-93858.web.app/studio | https://mindcraft-93858.web.app/desk-os/studio/?v=f5 |
| **Workflows** (poll / signup / 1:1 / Calendly) | https://mindcraft-93858.web.app/workflows | https://mindcraft-93858.web.app/desk-os/workflows/?v=f5 |

Local: `cd app && npm run sync:desk-os && npm run dev` → same paths on `:5173`.

## Behavior
- Bottom desk Ask/search filters widgets; scroll down tucks, scroll up shows
- Dense layout (tight gaps, short chrome)
- Studio: IndexedDB media, timeline play, text/stickers/captions/looks, Craft
- Workflows: localStorage publish + `?w=` respond/vote/claim; Booking → Calendly
