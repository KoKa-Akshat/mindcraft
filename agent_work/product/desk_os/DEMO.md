# Desk OS · local demo checklist

## Serve

```bash
# Desk OS
cd agent_work/product/desk_os && python3 -m http.server 5180

# MindCraft app (required for ACT iframe on localhost)
cd app && npm run dev   # → http://localhost:5173
```

Open **http://localhost:5180/?v=r8a** (hard refresh).

## Walkthrough

1. **Gate** · Continue with Google (or Apple) → boot screen.
2. **Boot** · “Keep horizontal for the best experience”; tool icons fade in after ~0.5s, then hub.
3. **Hub** · Set goal, mastery cube, Call phone → mastery check-in saves an honest %.
4. **Open field-desk** · pan/zoom desk; owl click opens Ask bar bottom-right.
5. **Open act-fieldbook** (hub) or **ACT Fieldbook cover** (desk) → iframe starts at **`/try/diagnostic`** (not Contents).
6. Finish preview diagnostic → app moves to **`/try/dashboard`** cover inside the iframe.
7. If Vite is down, iframe falls back to live `mindcraft-93858.web.app/try/diagnostic` with a status chip.
8. Left rail **Repository** = binder (not ACT). **Search** = device scan.
9. Tutors map under instances; Workflow market one row of three under tutors (search kept).

## Tests

```bash
cd agent_work/product/desk_os && node tests/run.mjs
```

## Notes

- Auth is still a local demo profile (no Firebase in Desk OS).
- Real student OAuth should open top-level `/login?next=/diagnostic` (iframes often block Google).
- Moodle/Gmail OAuth and Live tutor Meet sessions are out of this pass.
