# Desk OS · post-login home (local)

**What this is:** the screen after sign-in. Not wired into Firebase yet. Local demo only.

## How to test

1. Serve: `cd agent_work/product/desk_os && python3 -m http.server 5180`
2. Open http://localhost:5180 · hard refresh (Cmd+Shift+R)
3. Continue with Email → **Field Kitchen** (first time)
4. Type an ACT prep note · drag/tap the owl onto the note · watch typewriter → **ACT FieldBook** appears next to Search
5. Desk opens with Tonight / Binder / ACT + FieldBook page
6. Binder → **Open binder field** (or double-click) · full journal · other pages slide away · **−** restores
7. **Record** · transcript pops in live and fun
8. Calendar / Mail · only **×** (no “close” text)

Reset kitchen: `localStorage.removeItem('deskOs.fieldbookCooked')` then refresh.

## Zoom pack

Pinch a sheet (trackpad: pinch / Ctrl+scroll · phone: two fingers). It grows; neighbors ease into open gaps. Alt+scroll also zooms the sheet under the cursor.

## Student loop

COOK (FieldBook) → Connect → FILE (binder book) → LEARN (ACT) · DROP anytime
