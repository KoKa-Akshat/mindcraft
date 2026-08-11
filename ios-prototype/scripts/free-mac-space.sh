#!/usr/bin/env bash
# Interactive Mac cleanup for MindCraft builds.
# Safe defaults: caches / DerivedData / old simulators / Trash.
# Never deletes your mindcraft repo, Xcode.app, or SSH/Firebase credentials.
#
# Run:
#   bash ios-prototype/scripts/free-mac-space.sh
set -euo pipefail

confirm() {
  local prompt="$1"
  local reply
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]]
}

size_of() {
  local path="$1"
  if [[ -e "$path" ]]; then
    du -sh "$path" 2>/dev/null | awk '{print $1}'
  else
    echo "—"
  fi
}

wipe() {
  local path="$1"
  if [[ -e "$path" ]]; then
    rm -rf "$path"
    echo "  cleared: $path"
  else
    echo "  skip (missing): $path"
  fi
}

echo
echo "=== MindCraft Mac cleanup ==="
echo "This only clears rebuildable caches / junk."
echo "It will NOT delete ~/Developer/mindcraft or Xcode.app."
echo
echo "Disk now:"
df -h / | awk 'NR==1 || /\/$/'
echo

# -------- inventory --------
declare -a ITEMS=()
declare -a PATHS=()
declare -a DEFAULTS=()

add_item() {
  ITEMS+=("$1")
  PATHS+=("$2")
  DEFAULTS+=("$3") # y = offer default yes suggestion in label only
}

add_item "Xcode DerivedData (safe — next build recreates)" \
  "${HOME}/Library/Developer/Xcode/DerivedData" "y"
add_item "Xcode Archives (old .ipa/.xcarchive builds)" \
  "${HOME}/Library/Developer/Xcode/Archives" "y"
add_item "Xcode iOS DeviceSupport (old device symbols)" \
  "${HOME}/Library/Developer/Xcode/iOS DeviceSupport" "y"
add_item "Swift Package Manager cache" \
  "${HOME}/Library/Caches/org.swift.swiftpm" "y"
add_item "Xcode caches" \
  "${HOME}/Library/Caches/com.apple.dt.Xcode" "y"
add_item "Unavailable iOS Simulators (xcrun delete)" \
  "__SIM_UNAVAILABLE__" "y"
add_item "VS Code caches" \
  "${HOME}/Library/Application Support/Code/Cache|${HOME}/Library/Application Support/Code/CachedData|${HOME}/Library/Application Support/Code/CachedExtensions|${HOME}/Library/Application Support/Code/CachedExtensionVSIXs|${HOME}/Library/Application Support/Code/Code Cache|${HOME}/Library/Application Support/Code/GPUCache" "y"
add_item "Cursor caches" \
  "${HOME}/Library/Application Support/Cursor/Cache|${HOME}/Library/Application Support/Cursor/CachedData|${HOME}/Library/Application Support/Cursor/CachedExtensions|${HOME}/Library/Application Support/Cursor/CachedExtensionVSIXs|${HOME}/Library/Application Support/Cursor/Code Cache|${HOME}/Library/Application Support/Cursor/GPUCache" "y"
add_item "npm cache (~/.npm/_cacache)" \
  "${HOME}/.npm/_cacache" "y"
add_item "Homebrew cache" \
  "${HOME}/Library/Caches/Homebrew" "y"
add_item "Chrome cache (keeps bookmarks/passwords)" \
  "${HOME}/Library/Caches/Google/Chrome" "y"
add_item "Slack cache" \
  "${HOME}/Library/Application Support/Slack/Cache|${HOME}/Library/Application Support/Slack/Code Cache|${HOME}/Library/Application Support/Slack/GPUCache" "y"
add_item "Spotify cache" \
  "${HOME}/Library/Caches/com.spotify.client" "y"
add_item "Trash" \
  "${HOME}/.Trash" "y"
add_item "Docker unused images/containers (if Docker installed)" \
  "__DOCKER_PRUNE__" "n"

echo "Candidates (size on disk):"
echo
for i in "${!ITEMS[@]}"; do
  label="${ITEMS[$i]}"
  pathspec="${PATHS[$i]}"
  total="0"
  if [[ "$pathspec" == "__SIM_UNAVAILABLE__" ]]; then
    sz="(run to reclaim)"
  elif [[ "$pathspec" == "__DOCKER_PRUNE__" ]]; then
    if command -v docker >/dev/null 2>&1; then
      sz="$(docker system df 2>/dev/null | awk '/Images/ {print $4}' | head -1 || echo '?')"
    else
      sz="Docker not installed"
    fi
  else
    IFS='|' read -r -a parts <<< "$pathspec"
    # show first existing path size / sum hint
    shown=""
    for p in "${parts[@]}"; do
      if [[ -e "$p" ]]; then
        shown="$(size_of "$p")"
        break
      fi
    done
    sz="${shown:—}"
  fi
  printf "  [%2d] %-55s  %s\n" "$((i + 1))" "$label" "$sz"
done

echo
echo "Tips for apps you can uninstall in UI (I can't click your Mac):"
echo "  Apple menu → System Settings → General → Storage"
echo "  Review: Applications · Documents · iOS Files · Developer"
echo "  Safe to remove if you don't use them for MindCraft:"
echo "    - old games / random Electron apps"
echo "    - duplicate browsers you never open"
echo "    - old Android Studio / Flutter if unused"
echo "  KEEP: Xcode, Cursor, Terminal, Chrome/Safari, Git tooling."
echo

if confirm "Clear ALL recommended caches now (items marked safe above)?"; then
  MODE="all-safe"
else
  MODE="pick"
  echo "Enter numbers to clear (e.g. 1 2 5), or 'all':"
  read -r -p "> " CHOICE
fi

should_clear() {
  local idx="$1" # 0-based
  if [[ "$MODE" == "all-safe" ]]; then
    [[ "${DEFAULTS[$idx]}" == "y" ]]
    return
  fi
  if [[ "${CHOICE:-}" == "all" ]]; then
    return 0
  fi
  local n=$((idx + 1))
  [[ " ${CHOICE:-} " == *" $n "* ]]
}

echo
echo "== Clearing selected items =="
for i in "${!ITEMS[@]}"; do
  should_clear "$i" || continue
  pathspec="${PATHS[$i]}"
  echo "→ ${ITEMS[$i]}"
  if [[ "$pathspec" == "__SIM_UNAVAILABLE__" ]]; then
    xcrun simctl delete unavailable 2>/dev/null || echo "  (simctl unavailable)"
  elif [[ "$pathspec" == "__DOCKER_PRUNE__" ]]; then
    if command -v docker >/dev/null 2>&1; then
      docker system prune -af || true
    else
      echo "  Docker not installed"
    fi
  else
    IFS='|' read -r -a parts <<< "$pathspec"
    for p in "${parts[@]}"; do
      wipe "$p"
    done
  fi
done

# Homebrew cleanup if present
if command -v brew >/dev/null 2>&1; then
  if confirm "Also run brew cleanup -s?"; then
    brew cleanup -s || true
  fi
fi

if command -v npm >/dev/null 2>&1; then
  npm cache clean --force 2>/dev/null || true
fi

echo
echo "=== Done ==="
df -h / | awk 'NR==1 || /\/$/'
echo
echo "Next:"
echo "  cd ~/Developer/mindcraft && git pull origin main"
echo "  open ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj"
echo "  Xcode → File → Packages → Reset Package Caches → Resolve → Clean → Run"
echo
echo "If still low on space: System Settings → General → Storage → Applications"
echo "and delete apps you never use. Do NOT delete Xcode."
