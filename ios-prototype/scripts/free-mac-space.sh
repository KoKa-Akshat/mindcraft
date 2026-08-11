#!/usr/bin/env bash
# One-shot disk cleanup so Xcode / git pull / SPM can run again.
# Run on your Mac:  bash ios-prototype/scripts/free-mac-space.sh
set -euo pipefail

echo "== Before =="
df -h / | tail -1

echo "== Clearing Xcode / SPM (safe; rebuilds next compile) =="
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData/"* 2>/dev/null || true
rm -rf "${HOME}/Library/Caches/org.swift.swiftpm" 2>/dev/null || true
rm -rf "${HOME}/Library/Caches/com.apple.dt.Xcode" 2>/dev/null || true
xcrun simctl delete unavailable 2>/dev/null || true

echo "== Clearing VS Code / Cursor caches =="
for app in Code Cursor; do
  base="${HOME}/Library/Application Support/${app}"
  rm -rf "${base}/Cache" \
         "${base}/CachedData" \
         "${base}/CachedExtensions" \
         "${base}/CachedExtensionVSIXs" \
         "${base}/Code Cache" \
         "${base}/GPUCache" 2>/dev/null || true
done

echo "== Clearing npm / Homebrew / Trash =="
npm cache clean --force 2>/dev/null || true
rm -rf "${HOME}/.npm/_cacache" 2>/dev/null || true
brew cleanup -s 2>/dev/null || true
rm -rf "${HOME}/.Trash/"* 2>/dev/null || true

echo "== After =="
df -h / | tail -1
echo
echo "Need several GB free. Then:"
echo "  cd ~/Developer/mindcraft && git pull origin main"
echo "  open ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj"
echo "  Xcode → File → Packages → Reset Package Caches → Resolve → Clean Build → Run"
