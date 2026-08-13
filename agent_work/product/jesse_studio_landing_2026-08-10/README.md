# Jesse’s Kitchen → Studio phone (integration proto)

**Idea:** Studio is not a nav tab. It’s **Jesse’s phone left on the kitchen counter.** You pick it up, edit Stories (uploads, Spotify, stickers), put it back.

## Open

Serve from repo root (needed for kitchen images + Studio iframe):

```bash
cd /Users/akoirala/Developer/mindcraft
python3 -m http.server 5201
```

→ http://127.0.0.1:5201/agent_work/product/jesse_studio_landing_2026-08-10/

## Flow
1. Land in Jesse’s Kitchen (warm full-bleed)
2. Tap the phone on the counter → Studio lifts in
3. Edit (loot, Spotify, craft)
4. **Put phone back** / Esc → kitchen again; phone remembers you were editing

## Why this is unique
- World object as portal (not “Open Studio” button)
- Same Stories editor as `studio_prototype_2026-08-10`
- Kitchen atmosphere stays the home; Studio is temporary possession of the phone
