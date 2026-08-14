#!/bin/sh
set -eu

# Deploy the ml/ directory to a Hugging Face Docker Space.
#
# Usage:
#   HF_ORG=mindcraft ./scripts/deploy_hf.sh
#   HF_SPACE=mindcraft-ml HF_REMOTE=https://huggingface.co/spaces/mindcraft/mindcraft-ml ./scripts/deploy_hf.sh
#
# The script stages a temporary Space repo, copies ml/ into its root, renames
# README_HF.md to README.md, commits, and pushes to the Space git remote.

SPACE_NAME="${HF_SPACE:-mindcraft-ml}"
HF_ORG="${HF_ORG:-}"

if [ -n "${HF_REMOTE:-}" ]; then
  REMOTE="$HF_REMOTE"
elif [ -n "$HF_ORG" ]; then
  REMOTE="https://huggingface.co/spaces/${HF_ORG}/${SPACE_NAME}"
else
  echo "Set HF_ORG or HF_REMOTE before deploying." >&2
  exit 1
fi

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ML_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR" "${TMP_DIR}.stash"
}
trap cleanup EXIT INT TERM

git clone "$REMOTE" "$TMP_DIR"

# data/bank_index.npz and .gitattributes are managed exclusively via the Hub
# API step at the bottom of this script (git push rejects binary blobs — see
# that step's comment). Stash whatever's currently committed for them across
# the wipe-and-retar below, so an *absence* in our tarball (it's deliberately
# excluded from the tar) doesn't read to git as "delete this file" when we
# `git add .` — that bug shipped once (238b3eb) and force-pushed a rebuild
# with no bank index, i.e. reintroduced the exact crash this script exists to
# prevent.
STASH_DIR="${TMP_DIR}.stash"
mkdir -p "$STASH_DIR"
[ -f "$TMP_DIR/data/bank_index.npz" ] && cp "$TMP_DIR/data/bank_index.npz" "$STASH_DIR/bank_index.npz"
[ -f "$TMP_DIR/.gitattributes" ] && cp "$TMP_DIR/.gitattributes" "$STASH_DIR/.gitattributes"

find "$TMP_DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
# concept_embeddings.npz / pca_axes.npz / classification_index.npz self-heal at
# container startup (serve.py rebuilds them from the ontology JSON + a
# downloaded sentence-transformer if missing/stale) so they're safe to exclude.
#
# data/bank_index.npz is DIFFERENT — it's built by scripts/build_bank_index.py
# from app/src/data + app/src/lib/questionBank.ts, neither of which ship in
# this tarball, so it can NEVER regenerate inside the Space; classification_index.npz's
# own rebuild path loads it as an input, so its absence is a hard container
# crash (BUILD_ERROR, FileNotFoundError), not a harmless missing cache. It IS
# excluded here too, but only because the Hub's git backend now rejects plain
# binary pushes outright — see the Hub API step below, which is how it
# actually ships.
tar -C "$ML_DIR" \
  --exclude=.git \
  --exclude='.env*' \
  --exclude=.pytest_cache \
  --exclude=.ruff_cache \
  --exclude=__pycache__ \
  --exclude='*.pyc' \
  --exclude='*.pkl' \
  --exclude='*.egg-info' \
  --exclude=.venv \
  --exclude=venv \
  --exclude=env \
  --exclude=img \
  --exclude='*.png' \
  --exclude='*.jpg' \
  --exclude='*.jpeg' \
  --exclude='*.mp4' \
  --exclude=mindcraft \
  --exclude=google-cloud-sdk \
  --exclude=google-cloud-cli-linux-x86_64.tar.gz \
  --exclude=mindcraft_remaining_modules.zip \
  --exclude='data/concept_embeddings.npz' \
  --exclude='data/pca_axes.npz' \
  --exclude='data/classification_index.npz' \
  --exclude='data/bank_index.npz' \
  --exclude='*.deb' \
  --exclude='*.zip' \
  -cf - . | tar -C "$TMP_DIR" -xf -
mv "$TMP_DIR/README_HF.md" "$TMP_DIR/README.md"

if [ ! -f "$ML_DIR/data/bank_index.npz" ]; then
  echo "ERROR: ml/data/bank_index.npz is missing locally. It must ship (via the" >&2
  echo "Hub API step below); do not delete it or add it back to the tar exclude" >&2
  echo "list expecting git to carry it." >&2
  exit 1
fi

mkdir -p "$TMP_DIR/data"
[ -f "$STASH_DIR/bank_index.npz" ] && cp "$STASH_DIR/bank_index.npz" "$TMP_DIR/data/bank_index.npz"
[ -f "$STASH_DIR/.gitattributes" ] && cp "$STASH_DIR/.gitattributes" "$TMP_DIR/.gitattributes"
rm -rf "$STASH_DIR"

(
  cd "$TMP_DIR"
  git add .
  if git diff --cached --quiet; then
    echo "No text/code changes to deploy."
  else
    git commit -m "Deploy mindcraft ML Space"
    git push origin HEAD:main
  fi
)

# --- data/bank_index.npz: uploaded via the Hub API, not git -----------------
# As of 2026-08, the Hub's git backend rejects plain (non-LFS/Xet) binary
# blobs outright ("Your push was rejected because it contains binary files").
# git-lfs isn't guaranteed to be installed, so this goes through
# huggingface_hub instead, which speaks Xet natively. This file is therefore
# permanently untracked by git on the Space side (excluded from the tar
# above) — there's no local git history to diff against for a "did it
# change" check, so we just always call upload_file; the Hub API itself
# content-hashes and no-ops ("Skipping to prevent empty commit", verified
# 2026-08-14 — no rebuild triggered) when the bytes already match.
if ! python3 -c "import huggingface_hub" >/dev/null 2>&1; then
  echo "ERROR: python3 -c 'import huggingface_hub' failed — required to upload" >&2
  echo "bank_index.npz. Activate the ml/mindcraft venv (has it installed) or:" >&2
  echo "  pip install huggingface_hub" >&2
  exit 1
fi
if [ -z "${HF_TOKEN:-}" ]; then
  echo "ERROR: HF_TOKEN is not set — required to upload bank_index.npz via the Hub API." >&2
  echo "Get a write token at https://huggingface.co/settings/tokens and export HF_TOKEN=..." >&2
  echo "(a git-credential-stored token for huggingface.co, if you have one, works too —" >&2
  echo " see ~/.git-credentials.)" >&2
  exit 1
fi
SPACE_REPO_ID="$(printf '%s' "$REMOTE" | sed -E 's#.*/spaces/##')"
python3 - "$SPACE_REPO_ID" "$ML_DIR/data/bank_index.npz" <<'PY'
import sys
from huggingface_hub import HfApi
api = HfApi()
info = api.upload_file(
    path_or_fileobj=sys.argv[2],
    path_in_repo="data/bank_index.npz",
    repo_id=sys.argv[1],
    repo_type="space",
    commit_message="Update bank_index.npz",
)
print("Uploaded (or already current):", info)
PY
