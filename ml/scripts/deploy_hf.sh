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
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

git clone "$REMOTE" "$TMP_DIR"

find "$TMP_DIR" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
# concept_embeddings.npz / pca_axes.npz / classification_index.npz self-heal at
# container startup (serve.py rebuilds them from the ontology JSON + a
# downloaded sentence-transformer if missing/stale) so they're safe to exclude.
#
# data/bank_index.npz is DIFFERENT — do not add it to this list. It's built by
# scripts/build_bank_index.py from app/src/data + app/src/lib/questionBank.ts,
# neither of which ship in this tarball, so it can NEVER regenerate inside the
# Space. Excluding it via a blanket 'data/*.npz' glob (43dd7f15) broke every
# prod deploy since: classification_index.npz's own rebuild path loads
# bank_index.npz as an input, so its absence turned a harmless missing cache
# into a hard container crash (BUILD_ERROR, FileNotFoundError).
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
  --exclude='*.deb' \
  --exclude='*.zip' \
  -cf - . | tar -C "$TMP_DIR" -xf -
mv "$TMP_DIR/README_HF.md" "$TMP_DIR/README.md"

# bank_index.npz cannot regenerate inside the Space (see comment above) — fail
# fast here rather than pushing a build that will crash on startup.
if [ ! -f "$TMP_DIR/data/bank_index.npz" ]; then
  echo "ERROR: data/bank_index.npz is missing from the staged deploy. It must" >&2
  echo "ship as-is; do not add it to the tar --exclude list above." >&2
  exit 1
fi

(
  cd "$TMP_DIR"
  git add .
  if git diff --cached --quiet; then
    echo "No changes to deploy."
    exit 0
  fi
  git commit -m "Deploy mindcraft ML Space"
  git push origin HEAD:main
)
