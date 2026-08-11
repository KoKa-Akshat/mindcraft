# Field Desk Cursor Handoff

## Preview

- Marketing story: `http://127.0.0.1:8766/index.html`
- Standalone Desk: `http://127.0.0.1:8766/desk.html`
- Start locally: `python3 -m http.server 8766`

## Product Contract

The Desk is a calm spatial workspace, not a dashboard grid. Jesse's Kitchen stays central. A pinned memo sits northwest of it, the current ACT map sits southeast, and the auto-transcription card floats over Jesse without taking over the canvas.

Every panel can be dragged. Standalone panels also expose a lower-right resize grip. Desk zoom ranges from `0.33x` to `3x`; drag sensitivity and pan limits adapt to the current scale.

The black circular `+` in the standalone Desk lives at bottom-left. It opens a composer directly above itself. Every submission appends a new draggable and resizable memo; it must never overwrite an existing memo.

Clicking Jesse opens the command bar. Sending a prompt updates the transcription context, then closes the command bar.

## Implementation Map

- `desk.html`: standalone spatial prototype, controls, drag/resize/zoom logic, note composer.
- `index.html`: marketing story and embedded interactive Desk demo.
- `img/app/desk-ipad-live.png`: Jesse's Kitchen workspace capture.
- `img/new-dash-home.jpg`: current ACT dashboard capture.
- `img/blake-kell.jpg`: Blake portrait used in the human-care chapter.

Key standalone selectors:

- `#scene`: pan and zoom transform owner.
- `[data-draggable]`: movable panel.
- `[data-resizable]`: panel that receives a resize grip.
- `#addNote` and `#noteComposer`: append-only memo flow.
- `#noteLayer`: destination for newly created memo boxes.
- `#kitchen` and `#command`: Jesse prompt flow.

## Note API Boundary

The prototype sends `POST /api/marketing-note` with same-origin credentials, JSON content, and `X-MindCraft-Intent: pin-note`.

Production requirements:

1. Require an authenticated same-origin session.
2. Enforce CSRF protection and verify the intent header server-side.
3. Validate a plain-text `note` of 1-180 characters; reject unknown fields.
4. Rate-limit by account and IP, and record ownership on every note.
5. Return a server-generated note ID and timestamp. Never expose database or model keys to the browser.
6. Render note content with `textContent`, never `innerHTML`.

The static preview intentionally falls back to an in-memory local memo when the endpoint is unavailable. The memo appears immediately while persistence happens asynchronously.

## Acceptance Checks

- Zoom reaches approximately `0.33x` and `3x` and remains pannable.
- Jesse, the original memo, the ACT map, and every new memo can be resized independently.
- Two note submissions produce two new boxes while the original memo remains unchanged.
- Mobile has no horizontal document overflow and keeps both bottom controls reachable.
- The marketing headline uses one desktop line for "Learning that learns you." and keeps supporting copy to one sentence.
