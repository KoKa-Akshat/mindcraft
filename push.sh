#!/usr/bin/env bash
# push.sh — push files to GitHub via API (bypasses local git state)
# Usage:
#   ./push.sh "commit message" file1 [file2 ...]
#   ./push.sh "commit message"          # stages all tracked changes via git add -u
set -euo pipefail

REPO="KoKa-Akshat/mindcraft"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

MSG="${1:?Usage: ./push.sh \"commit message\" [file1 file2 ...]}"
shift

# If no files given, collect modified/new tracked files from git status
if [ $# -eq 0 ]; then
  mapfile -t FILES < <(git -C "$REPO_DIR" diff --name-only HEAD 2>/dev/null; git -C "$REPO_DIR" diff --name-only 2>/dev/null) 2>/dev/null || true
  if [ ${#FILES[@]} -eq 0 ]; then
    echo "No changes detected. Pass file paths explicitly: ./push.sh \"msg\" file1 file2"
    exit 0
  fi
else
  FILES=("$@")
fi

# Get current HEAD on GitHub
HEAD_SHA=$(gh api "repos/$REPO/git/refs/heads/main" --jq '.object.sha')
BASE_TREE=$(gh api "repos/$REPO/git/commits/$HEAD_SHA" --jq '.tree.sha')
echo "→ base $HEAD_SHA"

# Create blobs
ENTRIES="["
SEP=""
for FILE in "${FILES[@]}"; do
  FULL="$REPO_DIR/$FILE"
  if [ ! -f "$FULL" ]; then
    echo "  skip (not found): $FILE"
    continue
  fi
  base64 < "$FULL" > "$TMP/b64"
  jq -n --rawfile content "$TMP/b64" '{"encoding":"base64","content":$content}' > "$TMP/req.json"
  BLOB=$(gh api "repos/$REPO/git/blobs" --method POST --input "$TMP/req.json" --jq '.sha')
  echo "  blob: $FILE"
  ENTRY=$(jq -n --arg p "$FILE" --arg s "$BLOB" '{"path":$p,"mode":"100644","type":"blob","sha":$s}')
  ENTRIES="${ENTRIES}${SEP}${ENTRY}"
  SEP=","
done
ENTRIES="${ENTRIES}]"

# Create tree
NEW_TREE=$(jq -n --arg base "$BASE_TREE" --argjson tree "$ENTRIES" \
  '{"base_tree":$base,"tree":$tree}' | \
  gh api "repos/$REPO/git/trees" --method POST --input - --jq '.sha')
echo "→ tree $NEW_TREE"

# Create commit
CO="Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
NEW_COMMIT=$(gh api "repos/$REPO/git/commits" \
  --method POST \
  --field "message=${MSG}

${CO}" \
  --field "tree=$NEW_TREE" \
  --field "parents[]=$HEAD_SHA" \
  --jq '.sha')
echo "→ commit $NEW_COMMIT"

# Update ref
gh api "repos/$REPO/git/refs/heads/main" \
  --method PATCH \
  --field "sha=$NEW_COMMIT" \
  --field "force=false" > /dev/null

echo ""
echo "✓  ${MSG}"
echo "   https://github.com/KoKa-Akshat/mindcraft/commit/$NEW_COMMIT"
echo "   Live in ~2 min: https://mindcraft-93858.web.app"
