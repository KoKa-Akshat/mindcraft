# The webhook is not here any more

It moved to **`mindcraft-world-voxelize`** on 2026-09-10, to the same path:

```
mindcraft-world-voxelize/webhook/
```

History came with it. `git subtree split` extracted the 151 commits that touch
this directory, and `git subtree add` grafted them in, so `git blame` on
`webhook/lib/firebase.ts` over there still lands on the April 2026 commits that
wrote it, under the original author.

## The one thing that has to happen in a dashboard

The Vercel project **`mindcraft-webhook`** still builds from *this* repository.
Its `rootDirectory` is already `webhook`, so nothing about the build changes,
but its Git source has to be repointed:

> Vercel, project `mindcraft-webhook`, Settings, Git: disconnect
> `KoKa-Akshat/mindcraft` and connect `mindcraft-world/mindcraft-world-voxelize`.

**Environment variables live on the Vercel project, not in the repository, so
they survive this untouched.** That includes `FIREBASE_SERVICE_ACCOUNT` and the
Stripe keys. Nothing needs to be copied and no secret needs re-entering.

Until that is done the live webhook keeps serving, because Vercel holds the last
successful deployment. What stops working is *new* deployments: changes made in
the other repository will not ship, and a push here will fail its build because
`webhook/` no longer has a `package.json`.

That failure is deliberate and loud. The quiet version, leaving a second copy
here that still builds, is how two copies drift until nobody knows which one is
serving traffic.

## Why it left

Compound moved onto this project's Firebase project, `mindcraft-93858`, because
`mindcraft-world` belongs to a Google account the Firebase CLI cannot reach. The
Firestore rules followed on the same day. The webhook follows them because it is
the Firebase Admin half of the same system: it holds the service account, and it
is what will handle Compound's Stripe signups.

`storage.rules` and the `storage` and `hosting` sections of `firebase.json` are
still here. They belong to the app, and they move when the app does.
