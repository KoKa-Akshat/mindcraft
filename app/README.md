# The app is not here any more

It moved to **`mindcraft-world-voxelize`** on 2026-09-10, to the same path:

```
mindcraft-world-voxelize/app/
```

540 commits came with it via `git subtree`, so `git blame app/src/firebase.ts`
over there still lands on the April 2026 commits under the original author.

## Nothing needs doing in a dashboard

Unlike the webhook, this one is complete. Firebase Hosting deploys from the CLI
rather than from a git connection, so moving `firebase.json` moved the deploy:

```
cd mindcraft-world-voxelize
cd app && npm run build && cd ..
firebase deploy --only hosting:app
```

Verified before this file was written, by deploying to a temporary preview
channel from the new repository. It served `<title>MindCraft` and the exact
bundle hash the new build produced, `index-Bkg9baGv.js`. Production was never
touched.

## Two things went with it that are not obvious

**`agent_work/product/desk_os/`.** The app's build script copies it into
`app/public/desk-os` and exits 1 if it is missing. It is production build input
that happens to live under a directory named `agent_work`, which is worth fixing
and was not a move's job to fix.

**`data/c1_worst_weakness_fixture.json`.** The only path in the whole app that
reached outside `app/`. It could not simply follow, because `data/` is still
published here by the `marketing` hosting target for `dans-archive.html`.
Nothing but one test referenced the fixture, so it moved next to that test as
`app/src/lib/__fixtures__/`, rather than being copied into a second `data/` that
would drift from this one.

## What stayed

`firebase.json` keeps the `world1` and `marketing` hosting targets. Both sites
are live, and both publish directories that did not move: `worlds/world2` and
this repository root. The `storage` section and `firebase/storage.rules` went
with the app.

## A pre-existing bug, found while moving, deliberately not fixed here

`npm ci` in this app fails with an ERESOLVE conflict:
`@firebase/rules-unit-testing@5.0.1` wants `firebase@^12`, the app pins
`10.14.1`. It reproduces identically in this old checkout, so it predates the
move and the app has been installing with `--legacy-peer-deps`. It is a real bug
and it is worth fixing on its own, away from a commit that moves 540 files.
