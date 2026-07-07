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
  --exclude=mindcraft \
  --exclude=google-cloud-sdk \
  --exclude=google-cloud-cli-linux-x86_64.tar.gz \
  --exclude=mindcraft_remaining_modules.zip \
  --exclude='data/*.npz' \
  --exclude='*.deb' \
  --exclude='*.zip' \
  -cf - . | tar -C "$TMP_DIR" -xf -
mv "$TMP_DIR/README_HF.md" "$TMP_DIR/README.md"

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
