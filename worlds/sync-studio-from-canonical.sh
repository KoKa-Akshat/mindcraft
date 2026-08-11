#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/agent_work/product/desk_os/studio"
DEST="$ROOT/worlds/studio"
rm -rf "$DEST"
cp -a "$SRC" "$DEST"
echo "synced $SRC -> $DEST"
