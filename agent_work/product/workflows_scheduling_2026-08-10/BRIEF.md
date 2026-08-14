# Scheduling Workflows — Desk pass (2026-08-10)

**Open:** serve repo root → `agent_work/product/workflows_scheduling_2026-08-10/?v=wf1`  
**Layout language:** same floating Create-space board as MindCraft Studio  
**Integrates into:** Field Desk (iOS) — tabs/dock tuck when this opens

## Product
Doodle-style **Select your workflow** with four cards:

| Card | Build | Notes |
|------|--------|--------|
| Group Poll | **In-house** | GCal free/busy + Gmail invite → pick times that work |
| Sign-up Sheet | **In-house** | Slots / workshops; people claim seats |
| 1:1 | **In-house** | Offer times; client picks one (GCal + Gmail) |
| Booking Page | **Calendly** | Opens existing MindCraft Calendly |

Gmail + Google Calendar are already linked on the desk — these workflows consume them (no new OAuth for the prototype).

## Desk integration (when wiring)
1. User opens **Workflows** from the dock.
2. **Other dock icons drop / chrome tucks** (`deskOverlayChromeBlocked`).
3. Binder / ACT tabs hide — this board owns the desk pad.
4. Picker appears on the desk (not a new app tab).
5. Choosing a card opens the Studio-like editor board; Booking jumps to Calendly.
6. Close restores dock + tabs.

## Slideshow + AI
- Inside any in-house editor: **Add slide +** builds a mute-friendly share deck.
- Under each card **Create**: secondary **AI customize** (prompt → fills title/slots/copy). Prototype drafts locally; live path will hit Desk Ask / operator.

## Files
- `index.html` — clickable prototype (lock-in)
- `INTEGRATE_DESK.md` — iOS / desk wiring checklist
- iOS: `SchedulingWorkflowsView.swift` + Field Desk overlay flag
