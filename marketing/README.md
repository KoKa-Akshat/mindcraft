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

### Authorising Drive

**Personal Gmail must use OAuth.** Service accounts have no storage quota, so
they can only own files inside a Workspace Shared Drive. On a personal account
every upload fails with a 403 no matter how the folder is shared.

1. Google Cloud Console → APIs & Services → enable the **Google Drive API**
2. Credentials → Create credentials → **OAuth client ID** → **Desktop app**
3. Put the id and secret in `marketing/.env` as `MARKETING_DRIVE_CLIENT_ID`
   and `MARKETING_DRIVE_CLIENT_SECRET`
4. `npm run marketing:drive-auth` — opens consent, writes
   `MARKETING_DRIVE_REFRESH_TOKEN` back to `marketing/.env`

**Publish the OAuth consent screen.** Left in Testing mode, Google expires
refresh tokens after 7 days, which breaks a weekly pipeline. `drive.file` is a
non-sensitive scope, so publishing does not require app verification.

`MARKETING_DRIVE_FOLDER_ID` stays **empty**. The `drive.file` scope only reaches
files this app created, so a folder made by hand in the Drive UI returns 404.
The pipeline creates and owns a `MindCraft Marketing` folder instead
(`MARKETING_DRIVE_ROOT_NAME` overrides the name). Set the folder id only for a
Workspace Shared Drive, alongside `MARKETING_DRIVE_SERVICE_ACCOUNT`.

Results are written to `marketing/run/<date>/drive.json`.

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
