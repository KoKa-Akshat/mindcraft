# Apply today — reach-out matcher (no black box)

LinkedIn OpenID does **not** include connections or Experience. We do not scrape.

## How a person gets on a job

1. **LinkedIn graph** (imported Connections.csv or paste), then
2. **CRM rows** you added on the desk.

A person appears on a role only if their **current or past company** matches the role company after normalize + alias family.

## Normalize

Lowercase. Strip `inc / llc / ltd / corp / corporation / company / co / the / punctuation`. Collapse spaces.

## Alias family used for Augeo

`augeo` = `augeo affinity marketing` = `augeo marketing` = `augeo workplace` = `augeo workplace engagement` = `kigo` = `kigo llc` = `heaps` = `heaps by augeo`

So **Alhareth Ali** with `past:Kigo,Augeo` matches an **Augeo** role even if LinkedIn’s CSV only says Chamfr (CSV has current company only — that is why `past:` exists).

## Rank (lower = first)

1. LinkedIn 1st, works there now  
2. LinkedIn 1st, worked there before (Hareth on Augeo)  
3. CRM intern-pipeline / People  
4. Other CRM  
5. Cold executive  
6. Verify-first (incomplete identity)

## What the job card must show

Apply by · live status · last checked · role URL · careers URL · why · fit · eligibility · lane · process · resume/CL · every reach-out with **why they are here** and **match rule** · Apply is log-only.

## Official import

LinkedIn → Settings → Data privacy → Get a copy of your data → Connections.
