# Desk integrate — Scheduling Workflows

## Behavior contract
When **Workflows** appear on the desk:

1. **Other icons go down** — float dock / top chrome tuck (`deskOverlayChromeBlocked = true` while `showSchedulingWorkflows`).
2. **Tabs disappear** — binder edge tabs + ACT stage chrome stay out of the way; overlay owns the pad.
3. **Opens in desk** — same kitchen wallpaper / pan canvas behind a soft dim; board is a Studio-style floating create space (not Safari, not a new root tab).
4. **Gmail + GCal already connected** — editors read desk connect state; show “Linked · Gmail · Calendar” chip. Do not re-prompt OAuth in the happy path.
5. **Booking** — hand off to Calendly (`https://calendly.com/joinmindcraft/30min` or tutor’s linked URL). In-house three stay native.

## iOS hook points
- `FieldDeskView`: `@State showSchedulingWorkflows`
- Dock workflows control → open picker (Apply today can stay long-press or secondary)
- Overlay: `SchedulingWorkflowsView(onClose:)`
- Include flag in `deskOverlayChromeBlocked`

## Prototype → native map
| HTML | Swift |
|------|--------|
| `#picker` | `SchedulingWorkflowsView` picker phase |
| `#board` | editor phase (poll / signup / oneOne) |
| `#slides` Add slide + | `slides[]` + AI customize sheet |
| Calendly card | `UIApplication.shared.open(calendlyURL)` |
