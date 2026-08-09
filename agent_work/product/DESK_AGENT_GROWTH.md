# Desk Agent growth ladder

v0 is live: `POST /api/desk-ask` + iOS Ask MindCraft + web Desk OS Ask.

Do **not** expand tools until v0 is demoed on a real student account.

## Shipped (v0)

| Piece | Location |
|---|---|
| Authenticated Desk Operator | `webhook/api/desk-ask.ts` |
| Memory | Firestore `conversations/desk:{studentId}` |
| Tools | `read_desk_context`, `propose_action`, `note_for_intel` |
| iOS mount | `DeskAskClient.swift` → Field Desk Ask bar |
| Web mount | `agent_work/product/desk_os/js/deskAsk.js` + `app/src/lib/deskAsk.ts` |

## Next tools (in order)

1. **Binder receipts** — cite filed item ids/titles in answers (“Ask the binder”).
2. **Gmail draft tool** — summarize top inbox / put a suggested reply into the Gmail box (human taps Send).
3. **Job OS suggestions** — propose Apply today queue rows from uploaded resume context (never auto-mark Applied).
4. **`ask_tutor` bridge** — one tool that calls existing JARVIS / ML explain for math questions.
5. **Server desk index** — optional Firestore pointers for binder metadata; keep file bodies local.

## Hard rules that stay

- Firebase Auth `uid === studentId`
- No auto-send mail
- No auto-mark Apply Done
- No em dashes in student-facing replies
- Deterministic keyword fallback when Anthropic fails
