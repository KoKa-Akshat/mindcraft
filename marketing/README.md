# MindCraft marketing pipeline

The pipeline reads product and engine data but writes only below `marketing/`.
Nothing publishes automatically.

```bash
npm install
npx playwright install chromium
npm run marketing:harvest -- --date 2026-07-28
npm run marketing:build -- --date 2026-07-28
npm run marketing:review -- --date 2026-07-28
```

Add `--llm` to `marketing:build` to use the registered Groq ANGLE/WRITE and
personality-judge calls. The command loads `GROQ_API_KEY` from the environment,
`.env`, `ml/.env.local`, or `webhook/.env.local`. Every failed call falls back
per post and records the reason in `posts.json`; deterministic gates still own
authorship, privacy, vocabulary, composition, and status.

The review page stores decisions in localStorage. Its Export button writes
`marketing/run/<date>/decisions.json` through the local review server. Then run
`npm run marketing:export -- --date <date>` to create upload-ready bundles.

## Publishing a batch to Drive

```bash
npm run marketing:publish -- --date 2026-07-29
```

Uploads a contact-sheet PDF plus one folder per post (slides + `caption.txt`)
into a shared Drive folder, so a reviewer sees the batch without waiting for a
push. Drive cannot run the interactive review page, so the PDF is the artifact
that previews and takes inline comments; the local review page remains the
place where decisions are actually recorded.

Requires `MARKETING_DRIVE_SERVICE_ACCOUNT` (path to a service-account JSON, or
the JSON itself) and `MARKETING_DRIVE_FOLDER_ID`. The service account needs
`drive.file` scope and write access to that folder. Results are written to
`marketing/run/<date>/drive.json`.

**Posts with `status: blocked` are never uploaded.** Publishing is where
content leaves the repo, so the privacy floor is enforced at the upload
boundary. `npm run marketing:contact-sheet` builds the PDF without uploading.

Run output (`marketing/run/`, `marketing/review/`) is gitignored — roughly 5MB
per run, fully regenerable from the sources.

`marketing/sources/research.json` and `testimonials.json` are human-authored
inputs. The pipeline never adds entries to them.

Without `--llm`, ANGLE/WRITE and personality evaluation use an auditable
deterministic fallback. This keeps ordinary local builds reproducible; the post
artifact labels the fallback judge explicitly.
