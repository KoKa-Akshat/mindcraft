# Field Desk session checkpoint — 2026-08-09

**Status:** Saved on `main` (pushed). Do not re-derive; start from this + the commits below.

## Repos / tips

| Repo | Remote tip |
|---|---|
| `ios-prototype` → `mindcraft-ios-prototype` | `4c30ccf` Coffee-shop desk pass |
| `mindcraft` (webhook + desk_os + app) | `a8e0fd7e` desk-ask top-reply |

Real iPad: `00008103-0012296E01D0C01E` · bundle `com.mindcraft.notes-prototype`

## What shipped today (locked)

### Desk layout
- Field Desk is post-login home (boot → Field Desk; hub via house)
- Cream paper cards: Binder, memo, calendar, Connect (top-right next to memo/calendar), intel
- Gmail + Apply today are movable/resizable workflow boxes
- Connectors are enablers; linking files Agent tips into intel

### Gmail / Calendar (real, not AgentMail)
- `GmailClient` + `GmailWorkflowBoxView` — OAuth Gmail read/send + Calendar read
- Calendar card loads Google Calendar or Apple Calendar (no sample week by default)
- Mail dock icon lime **only while** Gmail panel is open
- Hard admin blocker if still failing: enable Gmail API (+ Calendar API) on GCP project `mindcraft-93858` / `1024068467805`

### Desk Operator agent
- `POST /api/desk-ask` (Firebase Bearer, memory `conversations/desk:{uid}`)
- iOS Ask MindCraft → DeskAskClient → actions
- Actions: open Gmail, **open top mail + ready reply**, Apply, Connect, refresh calendar, prepend intel
- `recommend_workflow` from linked connectors
- Growth ladder: `agent_work/product/DESK_AGENT_GROWTH.md`

### Hub / settings / instances
- Hub cards: Field Desk + test-instance + Create (ACT hub card removed for now)
- Binder builtins: Doc→Cook / test only (+ customs)
- Manage → **settings gear**; AgentMail API UI removed; Whitepaper under Billing
- House next to student name on Field Desk → hub (tutors + workflows expanded)

### Record / transcribe
- Dock record → `DeskRecordSheet` — on-device Apple Speech (free), tags, file to Binder + intel

### Auth
- Firebase session persists; `GIDSignIn.restorePreviousSignIn` on launch for Google/Gmail warmth

## Key files

**iOS**
- `Views/FieldDeskView.swift`, `FieldDeskStore.swift`, `DeskRecordSheet.swift`
- `Views/GmailWorkflowBoxView.swift`, `Networking/GmailClient.swift`, `DeskAskClient.swift`
- `Views/DeskShellView.swift`, `AccountManageView.swift`, `AuthService.swift`
- Job OS: `Views/JobOS/*`

**Webhook / web**
- `webhook/api/desk-ask.ts`
- `app/src/lib/deskAsk.ts`, `App.tsx` auth bridge
- `agent_work/product/desk_os/js/deskAsk.js` + `app.js`

## Next session (suggested order)

1. Confirm Gmail API enabled; inbox + top-reply Ask work for any student account
2. Harden live record in noisy coffee-shop (permissions, longer sessions, better tags)
3. Grow agent tools: binder receipts → Gmail draft from real snippet → Job OS suggestions → `ask_tutor`
4. Keep ACT instance available later; do not bury Field Desk behind hub again

## Do not

- Reintroduce AgentMail as primary school mail
- Auto-send mail or auto-mark Apply Done
- Dump personal job-tracker seed into Apply today
- Em dashes in student-facing copy
