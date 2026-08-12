#!/usr/bin/env bash
# One-command local Xcode recovery for MindCraftNotes (low-disk safe).
# Run on your Mac:
#   bash ios-prototype/scripts/fix-xcode-build.sh
#
# Optional:
#   MC_DERIVED_DATA=/Volumes/YourSSD/mc-dd bash ios-prototype/scripts/fix-xcode-build.sh
#   SKIP_RESOLVE=1  — reuse already-resolved packages
#   LAUNCH=1        — boot iPad sim and launch app (no Xcode GUI)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO="$(cd "${PROTO}/.." && pwd)"
PROJ="${PROTO}/MindCraftNotes/MindCraftNotes.xcodeproj"
MYSCRIPT="${PROTO}/MindCraftNotes/MindCraftNotes/Networking/MyScriptRecognizer.swift"
BUNDLE_ID="com.mindcraft.MindCraftNotes"
# Single DerivedData for resolve+build (two folders doubles disk use).
DD="${MC_DERIVED_DATA:-/tmp/mc-dd}"
SKIP_RESOLVE="${SKIP_RESOLVE:-0}"
LAUNCH="${LAUNCH:-1}"

echo "=== MindCraft iOS build fixer (low-disk) ==="
echo "repo: $REPO"
echo "derivedData: $DD"
df -h / /System/Volumes/Data 2>/dev/null | awk 'NR==1 || /\/$|Data/'
FREE_G=$(df -g /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print $4}')
if [[ -z "${FREE_G:-}" ]]; then
  FREE_G=$(df -g / 2>/dev/null | awk 'NR==2 {print $4}')
fi
echo "Approx free GiB: ${FREE_G:-unknown}"
if [[ -n "${FREE_G:-}" && "${FREE_G}" -lt 10 ]]; then
  echo "WARNING: under ~10GB free. Keep Xcode QUIT during this script."
fi

echo "== Quit Xcode (critical on low disk — GUI doubles DerivedData) =="
killall Xcode 2>/dev/null || true
sleep 1
killall -9 Xcode 2>/dev/null || true
# Drop Spotlight indexing pressure a bit (ignore failures)
killall mds_stores 2>/dev/null || true

echo "== Ensure MyScriptRecognizer stub exists =="
if [[ ! -f "$MYSCRIPT" ]]; then
  cat > "$MYSCRIPT" <<'EOF'
import Foundation
import CoreGraphics
import PencilKit

enum MyScriptRecognizer {
    static func recognizeLatex(drawing: PKDrawing, canvasSize: CGSize) async throws -> String {
        throw NSError(
            domain: "MyScriptRecognizer",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Handwriting recognition is not configured in this build."]
        )
    }
}
EOF
  echo "  wrote stub"
else
  echo "  present"
fi

echo "== Clear Xcode's home DerivedData (keep only $DD) =="
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData"
mkdir -p "${HOME}/Library/Developer/Xcode/DerivedData"
rm -rf "${HOME}/Library/Caches/com.apple.dt.Xcode"
# Keep SPM remote cache if present — redownloading burns space+time.
# Only wipe if FORCE_SPM_RESET=1
if [[ "${FORCE_SPM_RESET:-0}" == "1" ]]; then
  rm -rf "${HOME}/Library/Caches/org.swift.swiftpm"
fi
mkdir -p "$DD"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild missing — open Xcode once, then re-run."
  exit 1
fi

heartbeat() {
  local log="$1" label="$2"
  (
    while true; do
      sleep 30
      SZ=$(wc -c < "$log" 2>/dev/null || echo 0)
      FREE=$(df -h /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print $4}')
      echo "  … ${label} ($(date +%H:%M:%S), log ${SZ}B, Data free ${FREE:-?})"
    done
  ) &
  echo $!
}

if [[ "$SKIP_RESOLVE" != "1" ]]; then
  echo "== Resolve packages (Firebase) into $DD =="
  echo "First time: 10–25 min. Do not Ctrl-C. Keep Xcode quit."
  : > /tmp/mc-spm-resolve.log
  HEART_PID=$(heartbeat /tmp/mc-spm-resolve.log "resolving SPM")
  trap 'kill '"$HEART_PID"' 2>/dev/null || true' EXIT
  set +e
  xcodebuild -resolvePackageDependencies \
    -project "$PROJ" \
    -scheme MindCraftNotes \
    -derivedDataPath "$DD" \
    2>&1 | tee /tmp/mc-spm-resolve.log
  RESOLVE_RC=${PIPESTATUS[0]}
  set -e
  kill "$HEART_PID" 2>/dev/null || true
  if [[ "$RESOLVE_RC" -ne 0 ]]; then
    echo "SPM resolve FAILED."
    grep -Ei 'error:|fatal:|No space|timed out|Could not resolve' /tmp/mc-spm-resolve.log | tail -30 || true
    exit "$RESOLVE_RC"
  fi
else
  echo "== SKIP_RESOLVE=1 — reusing packages in $DD =="
fi

# Prefer one concrete iPad simulator (arm64 only) — much smaller than generic.
SIM_NAME="$(
  xcrun simctl list devices available 2>/dev/null \
    | awk -F'[()]' '/iPad/{gsub(/^ +| +$/,"",$1); print $1; exit}'
)"
if [[ -z "${SIM_NAME}" ]]; then
  DEST='generic/platform=iOS Simulator'
  echo "== No iPad sim found; using generic destination =="
else
  DEST="platform=iOS Simulator,name=${SIM_NAME}"
  echo "== Building for simulator: ${SIM_NAME} =="
fi

echo "== Build (lean flags for ~15GB free) =="
: > /tmp/mc-xcodebuild.log
HEART_PID=$(heartbeat /tmp/mc-xcodebuild.log "building")
trap 'kill '"$HEART_PID"' 2>/dev/null || true' EXIT
set +e
xcodebuild build \
  -project "$PROJ" \
  -scheme MindCraftNotes \
  -destination "$DEST" \
  -derivedDataPath "$DD" \
  -configuration Debug \
  ONLY_ACTIVE_ARCH=YES \
  COMPILER_INDEX_STORE_ENABLE=NO \
  CODE_SIGNING_ALLOWED=NO \
  2>&1 | tee /tmp/mc-xcodebuild.log
BUILD_RC=${PIPESTATUS[0]}
set -e
kill "$HEART_PID" 2>/dev/null || true
trap - EXIT

if [[ "$BUILD_RC" -ne 0 ]]; then
  echo
  echo "BUILD FAILED:"
  grep -Ei 'error:|No space' /tmp/mc-xcodebuild.log | head -40 || true
  echo
  echo "If No space: delete Storage → Developer rows, empty Trash, re-run with Xcode quit."
  echo "Or put builds on an external SSD:"
  echo "  MC_DERIVED_DATA=/Volumes/YourSSD/mc-dd bash ios-prototype/scripts/fix-xcode-build.sh"
  exit "$BUILD_RC"
fi

APP="$(find "$DD/Build/Products" -name 'MindCraftNotes.app' -type d 2>/dev/null | head -1)"
echo
echo "=== BUILD SUCCEEDED ==="
echo "app: ${APP:-unknown}"
df -h /System/Volumes/Data 2>/dev/null | awk 'NR==1 || /Data/' || df -h /

if [[ "$LAUNCH" == "1" && -n "${APP:-}" && -n "${SIM_NAME:-}" ]]; then
  echo "== Launch on simulator (skip Xcode GUI to save disk) =="
  # Boot best-effort
  UDID="$(xcrun simctl list devices available | awk -v n="$SIM_NAME" '
    $0 ~ n && /\(/ {
      if (match($0, /\(([0-9A-F-]{36})\)/, a)) { print a[1]; exit }
    }')"
  if [[ -z "$UDID" ]]; then
    # Fallback parse without GNU awk
    UDID="$(xcrun simctl list devices available | grep "$SIM_NAME" | head -1 | sed -n 's/.*(\([A-F0-9-]\{36\}\)).*/\1/p')"
  fi
  if [[ -n "$UDID" ]]; then
    xcrun simctl boot "$UDID" 2>/dev/null || true
    open -a Simulator
    xcrun simctl install "$UDID" "$APP"
    xcrun simctl launch "$UDID" "$BUNDLE_ID" || \
      xcrun simctl launch "$UDID" "$(defaults read "$APP/Info" CFBundleIdentifier 2>/dev/null || echo "$BUNDLE_ID")"
    echo "Launched on $SIM_NAME. Keep Xcode quit unless you need the debugger."
  else
    echo "Could not find simulator UDID. Open Xcode → pick iPad Simulator → Cmd+R"
  fi
else
  echo "Open Xcode only when needed:"
  echo "  open \"$PROJ\""
  echo "Destination MUST be an iPad Simulator (not Any iOS Device)."
fi
