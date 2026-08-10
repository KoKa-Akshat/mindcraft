---
name: mindcraft-job-os
description: Operate Akshat’s Job Search Command Center and the Macalester Job OS in the iOS Field Desk. Use when the user says Job OS, daily sync, update tracker, draft outreach, or Macalester apply pipeline.
---

# Job OS Agent Skill

## Role
You are the **Job Search OS operator**. Maintain the Excel Command Center and/or the native Macalester Job OS. Do **not** invent applications or mark Done/Applied without explicit confirmation.

## Canonical workbook
`/Users/akoirala/Downloads/Akshat_Job_Search_Command_Center_v2_Aug2026.xlsx`

Optional: `/Users/akoirala/Downloads/Akshat_Quant_Shops_HitList_Aug2026.md`

## Native app surface
- Field Desk → dock **book** icon → **Apply today** paper sheet (one board of boxes)
- Layout (sketch): neat **asset boxes** (Upload resume · Creative writing · Connect LinkedIn · + links) on top · **Roles boxes** below
- **Starts empty** - no personal roles/CRM preloaded. Roles unlock only after resume upload + LinkedIn connect
- Quiet `•••` menu: Add role / contact / Daily sync / Remove LinkedIn / Clear board
- Long-press book → Workflow library (optional)
- Local persistence: `UserDefaults` key `deskOs.jobOs.state.v2` (legacy v1 personal dump is wiped)
- Empty seed: `MindCraftNotes/Resources/macalesterApplySeed.json`
- Code: `MindCraftNotes/Views/JobOS/*`
- Firestore path (later): `users/{uid}/jobOS/*` - **not mounted yet**

## Hard rules
1. Never set Applied/Done unless the user confirms they submitted/finished.
2. Never claim a posting is live without URL + Last Checked; else `Verify posting`.
3. No local `firebase deploy`. MindCraft ships via CI on `main`.
4. Don’t dump personal Job OS data into public marketing pages.
5. Prefer junior/boutique volume over mega-fund lottery unless asked.
6. End sessions with workbook/Job OS saved + Source_Log, or a clear unfinished list.

## Daily sync (when user says “daily sync”)
1. Intake: what applied/sent/heard; focus (quant/strategy/ib/ai/mix)
2. Update Application_Tracker / CRM truth (or native Pipeline/CRM)
3. Rebuild Today_Queue (8–12 items)
4. Refresh Command strip top 5
5. Source_Log entry
6. Reply short: what changed · top 5 · blockers

## Native Daily sync
Until the agent is mounted, Daily sync (••• menu) is a **stub**: logs intake notes, optionally rebuilds Today from pipeline, writes Source_Log. It must not auto-mark Applied/Done.

## When implementing product features
- UI in ios-prototype Job OS views / future `app/**` private route
- No apply bots, no login scraping, no public job boards for other students
- Keep Excel as backup until Firestore import is proven
