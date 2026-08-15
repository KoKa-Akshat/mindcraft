# Job OS Source_Log

## 2026-08-15 — Matcher landed on main

- Ported LinkedIn match algorithm from `cursor/augeo-crm-contacts-9659` onto current main so other agents can read it.
- Files: `JobOSLinkedInGraph.swift`, `JobOSRoleDetailView.swift`, store/shell merge, `MATCH_RULES.md`. Seed still empty. Nobody Applied.

## 2026-08-15 — LinkedIn graph + Augeo job card

- Why Hareth was missing: Connect LinkedIn only stored a profile URL. No graph, no company match, no past-employer alias. Augeo CRM was typed names only.
- Fix: LinkedIn graph (CSV / paste) + alias family Augeo↔Kigo + job card shows every field and the match rule.
- **Alhareth Ali (Hareth)** — 1st degree (you said so). Past: Kigo / Augeo 2024 intern. [linkedin.com/in/alharethali](https://www.linkedin.com/in/alharethali)
- **Devan Grose** — the “Deven” row. Hareth’s mentor. Staff SWE Kigo 2023–2024. [linkedin.com/in/devangrose](https://www.linkedin.com/in/devangrose)
- Huldah Cooper + David Kristal unchanged. Nothing marked Applied.
- iOS: ••• → Load Augeo design example to see Hareth on the job. Or import Connections.csv and add `past:Kigo,Augeo` on Hareth’s line (LinkedIn’s CSV is current-company only).
