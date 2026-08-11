# Prototype books · session notes (Piano + ACT)

**Space:** source in `agent_work/product/desk_os/` · shipped under app hosting at `/desk-os/`.  
**Live:** https://mindcraft-93858.web.app/desk-os/?v=r9b  
**Local:** `http://localhost:5180/?v=r9b` or `http://localhost:5173/desk-os/?v=r9b`

## Success path

1. Continue with Google/Apple → **Student or Tutor** onboarding  
2. Boot → hub shows **field-desk**, **act-fieldbook**, **piano-book**  
3. Open **piano-book** → interactive pages + keyboard (Play phrase / tap keys)  
4. Open **act-fieldbook** → MCQs → optional **Open /try/diagnostic** (Vite `:5173` or live)  
5. Hub **Call** works: student mastery % · tutor session note (`deskOs.callLog`)  
6. Tutors map still under instances (prototype)

## What worked

- Modular pipeline without rewrite: `js/pipeline/{extract,tag,generate,run}.js`  
- Same player shell for Piano + ACT (`js/bookPlayer.js`)  
- Seed JSON makes both playable offline (no Firebase)  
- Studio cook (`Create an instance`) uses the same pipeline; Piano subject → `kind: 'piano'`  
- Call button remains on hub; role-aware copy  

## Custom assets (not PDF conversion)

Piano did **not** ingest a scanned public-domain PDF. Direct conversion was skipped in favor of **purpose-built** interactive assets:

- Hand position / five-finger / Twinkle motif (public-domain melody)  
- Web Audio triangle tones · on-screen keys  

ACT uses **purpose-built** local MCQs in the same page schema (not a live pull from the full question bank). Optional handoff opens the real try-diagnostic iframe.

## Algo gaps (honest)

| Gap | Notes |
|-----|--------|
| PDF / MusicXML extract | Not wired · text/note/seed only |
| LLM chapter language | Deterministic stubs · Groq classify unused here |
| Bank sync | ACT seed ≠ `app` questionBank merge |
| Mastery → graph | Call saves localStorage only · no `/record-outcomes` |
| Auto-book factory | Out of scope · studio is demo cook |
| Per-student cloud | Out of scope |

## iPad polish prep (quick when you return)

Already in place:

- `viewport-fit=cover`, safe-area padding on player  
- 44px min touch targets on primary controls  
- Horizontal boot caption retained  
- Player is full-bleed (no inset card hero)  

Likely next polish pass:

- Landscape-first piano key sizing  
- Larger MCQ tap targets / Dynamic Type  
- Haptics-free “key press” motion tweak  
- Persist role + progress across Safari ITP clears  

## Tests

```bash
cd agent_work/product/desk_os && node tests/run.mjs
```

## Your lane later

Cloud / Vercel / Firestore / Hugging Face and any promote-to-`app/` migration. Prototype stays local preview.
