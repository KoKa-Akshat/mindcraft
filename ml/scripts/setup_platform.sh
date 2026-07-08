#!/usr/bin/env bash
# One-time local ML setup for story pipeline + Groq batch scripts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== MindCraft ML setup =="

if [[ ! -d mindcraft ]]; then
  echo "Creating venv mindcraft/ ..."
  python3 -m venv mindcraft
fi
# shellcheck disable=SC1091
source mindcraft/bin/activate

pip install -q -U pip
pip install -q -e ".[dev]" groq requests python-dotenv

if [[ ! -f .env.local ]]; then
  cp .env.local.example .env.local
  echo ""
  echo "Created ml/.env.local from example."
  echo "→ Open ml/.env.local and paste GROQ_API_KEY from https://console.groq.com/keys"
  echo ""
fi

python scripts/patch_story_contexts.py

if python scripts/check_groq.py; then
  echo ""
  echo "Groq ready. Optional batch re-wrap:"
  echo "  python scripts/reskin_story_batch.py --bank all --write --limit 50"
else
  echo ""
  echo "Tier-1 story display works without Groq (frontend render layer)."
  echo "Add GROQ_API_KEY to ml/.env.local, then re-run: python scripts/check_groq.py"
fi
