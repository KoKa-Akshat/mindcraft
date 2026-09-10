# The Firestore rules are not here any more

They moved to **`mindcraft-world-voxelize`** on 2026-09-10:

```
mindcraft-world-voxelize/firebase/firestore.rules
mindcraft-world-voxelize/firestore.indexes.json
```

Deploy them from there:

```
cd mindcraft-world-voxelize
firebase deploy --only firestore:rules
```

## Why they left

Compound moved onto `mindcraft-93858`, this project's Firebase project, because
`mindcraft-world` belongs to a Google account the Firebase CLI cannot reach.
That left Compound's code in one repository and the rules protecting its data in
another, which is a split nobody can hold in their head.

A Firebase project publishes exactly **one** Firestore ruleset. There is no
version of this where each product keeps its own file. So the single file went
to the repository that owns the product being actively built, and this one keeps
a pointer instead of a copy. Two copies would drift, and the copy that loses is
always the one nobody deployed.

The move was verified rather than assumed: the file was copied byte for byte
(sha256 identical), then deployed from the new location, and Firebase replied
`latest version already up to date, skipping upload`, which is the server
confirming the published ruleset did not change.

`storage.rules` is still here, and so is the `storage` section of
`firebase.json`. It belongs to the app, and it moves when the app does.

**Do not recreate `firestore.rules` in this repository.** If you need to change
the rules, change them in `mindcraft-world-voxelize` and deploy from there. A
stray copy here deployed by mistake would replace the whole ruleset, and that
ruleset is 32 collections the live app depends on plus Compound's.
