# Desk OS · local demo checklist

## Serve

```bash
# Desk OS (prototype shell)
cd agent_work/product/desk_os && python3 -m http.server 5180

# Optional · ACT live diagnosis page from the book action
cd app && npm run dev   # → http://localhost:5173
```

**Live (Firebase app):** https://mindcraft-93858.web.app/desk-os/?v=r9b  

**Local:** `http://localhost:5180/?v=r9b` or Vite `http://localhost:5173/desk-os/?v=r9b` after `npm run dev` in `app/`.

## Walkthrough

1. **Gate** · Continue with Google (or Apple).  
2. **Onboarding** · pick **Student** or **Tutor** (first time; stored in `deskOs.role`).  
3. **Boot** · “Keep horizontal for the best experience”; diagram → hub.  
4. **Hub** · instances include **piano-book** and **act-fieldbook** (+ field-desk).  
5. **Call** · phone button → student mastery check-in **or** tutor session note.  
6. **Open piano-book** · cover → reads → keyboard drills → reflection.  
7. **Open act-fieldbook** · cover → MCQs → optional **Open /try/diagnostic**.  
8. Finish preview diagnostic (if opened) → app `/try/dashboard` inside iframe.  
9. Left rail **Repository** = binder (not ACT).  
10. **Create an instance** · cook with subject Piano or ACT Math · same pipeline.

## Tests

```bash
cd agent_work/product/desk_os && node tests/run.mjs
```

## Notes

- Auth + role are local demo only (no Firebase in Desk OS).  
- See `PROTOTYPE_BOOKS.md` for assets, algo gaps, iPad prep.  
- Do **not** firebase deploy this shell.
