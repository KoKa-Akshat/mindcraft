#!/usr/bin/env bash
# Copy Engine pipeline outputs into app/src/data for questionBank.ts imports.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ -f "$ROOT/ml/data/openstaxMCQ.json" ]]; then
  cp "$ROOT/ml/data/openstaxMCQ.json" "$ROOT/app/src/data/openstaxMCQ.json"
  echo "Synced openstaxMCQ.json ($(python3 -c "import json;print(json.load(open('$ROOT/ml/data/openstaxMCQ.json'))['_meta']['total'])" 2>/dev/null || echo '?') questions)"
fi
# Merge LLM + non-template ingredient cells (excludes tank fallback duplicates).
python3 "$ROOT/ml/scripts/merge_story_cells_for_app.py" --out "$ROOT/app/src/data/storyCells.json"
echo "Merged storyCells.json ($(python3 -c "import json;print(json.load(open('$ROOT/app/src/data/storyCells.json'))['_meta']['total'])" 2>/dev/null || echo '?') cells)"
