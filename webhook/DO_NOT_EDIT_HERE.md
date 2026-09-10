# This webhook now exists in two repositories, on purpose, temporarily

**The copy you should edit is in `mindcraft-world-voxelize/webhook/`.**

This copy is the one Vercel currently builds and serves. Both are byte identical
today, 103 tracked files each. That will stop being true the moment somebody
edits one.

## Why there are two

The webhook moved to `mindcraft-world-voxelize` on 2026-09-10 with its history.
This copy was then deleted, and deleting it took the live webhook down.

The reasoning that failed is worth writing down, because it sounds right:
*"Vercel holds the last successful deployment, so the live service keeps serving
until the new source is connected."* That is true when the new build **fails**.
It is false here. The Vercel project's root directory is `webhook`, and after
the deletion that directory still existed with a single README in it. So the
build did not fail. It succeeded, produced a project with no API routes, and
that success replaced the working deployment. Every endpoint went to 404.

A successful build of nothing beats a stale good one.

## The order that actually works

1. Repoint the Vercel project's Git source **first**
2. Confirm the new source deploys and serves
3. Only then delete this copy

## What has to happen, in the dashboard

> Vercel, project `mindcraft-webhook`, Settings, Git: disconnect
> `KoKa-Akshat/mindcraft`, connect `mindcraft-world/mindcraft-world-voxelize`.

The project's root directory is already `webhook`, and the new repository has
the code at that same path, so nothing else about the build changes.

Environment variables live on the Vercel project rather than in the repository,
so `FIREBASE_SERVICE_ACCOUNT` and the Stripe keys survive untouched. Nothing
needs copying and no secret needs re-entering.

## After that is done

Delete this directory from this repository, and verify with a real request
rather than a green deploy:

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://mindcraft-webhook.vercel.app/api/jarvis
```

**401 is the healthy answer**, because the auth check is running. 404 means the
project is serving an empty build again. `/api/gemini` returning 500 is a
separate, pre-existing AI provider billing problem and is not a signal about
this move.
