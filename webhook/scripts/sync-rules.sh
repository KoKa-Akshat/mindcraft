#!/bin/bash
# Copies the canonical firebase/firestore.rules + storage.rules (repo root)
# into webhook/firebase/ so Vercel actually bundles them into the deployed
# function — the webhook project's Vercel Root Directory is `webhook/`, so
# anything outside it (like the repo-root `firebase/` folder) is invisible
# to the running deployment. lib/handlers/deploy-rules.ts reads its rules
# from THIS copy, not the repo-root one. Run this before every
# `vercel --prod` deploy of webhook/ whenever firestore.rules/storage.rules
# changed, then call POST /api/deploy-rules to actually push them to Firebase.
set -euo pipefail
cd "$(dirname "$0")/.."
cp ../firebase/firestore.rules firebase/firestore.rules
cp ../firebase/storage.rules firebase/storage.rules
echo "Synced firebase/firestore.rules + storage.rules into webhook/firebase/"
