#!/usr/bin/env bash
# One-command local Xcode recovery for MindCraftNotes.
# Run on your Mac (not in the cloud agent):
#   bash ios-prototype/scripts/fix-xcode-build.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO="$(cd "${PROTO}/.." && pwd)"
PROJ="${PROTO}/MindCraftNotes/MindCraftNotes.xcodeproj"
MYSCRIPT="${PROTO}/MindCraftNotes/MindCraftNotes/Networking/MyScriptRecognizer.swift"

echo "=== MindCraft iOS build fixer ==="
echo "repo: $REPO"
df -h / | awk 'NR==1 || /\/$/'
# macOS `df -g` reports GiB free in column 4
FREE_G=$(df -g / 2>/dev/null | awk 'NR==2 {print $4}')
if [[ -n "${FREE_G:-}" && "${FREE_G}" -lt 8 ]]; then
  echo
  echo "WARNING: under ~8GB free. SPM/Firebase often fails to resolve."
  echo "Apple menu → System Settings → General → Storage → Developer → Delete."
  echo "Or: bash ${SCRIPT_DIR}/free-mac-space.sh"
  echo
fi

echo "== Quit Xcode =="
killall Xcode 2>/dev/null || true
sleep 1
killall -9 Xcode 2>/dev/null || true

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
  echo "  wrote stub: $MYSCRIPT"
else
  echo "  present: $MYSCRIPT"
fi

echo "== Clear wedged Xcode / SPM state =="
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData/"*
rm -rf "${HOME}/Library/Caches/org.swift.swiftpm"
rm -rf "${HOME}/Library/Caches/com.apple.dt.Xcode"
rm -rf "${PROTO}/MindCraftNotes/.swiftpm"
rm -rf "${PROTO}/MindCraftNotes/MindCraftNotes.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved" 2>/dev/null || true
# keep SourcePackages only if you want a harder reset:
rm -rf "${HOME}/Library/Developer/Xcode/DerivedData"

echo "== Resolve packages from CLI (this is the Firebase fix) =="
echo "NOTE: first Firebase download is BIG. Expect 10–25 minutes of quiet work."
echo "You should see heartbeat lines every 30s. Do NOT Ctrl-C unless >30 min with no heartbeat."
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild missing — open Xcode once, then re-run."
  exit 1
fi

# Stream logs live (old `tail -40` made this look frozen until the end).
: > /tmp/mc-spm-resolve.log
(
  while true; do
    sleep 30
    if ! kill -0 $$ 2>/dev/null; then exit 0; fi
    SZ=$(wc -c < /tmp/mc-spm-resolve.log 2>/dev/null || echo 0)
    echo "  … still resolving SPM ($(date +%H:%M:%S), log ${SZ} bytes)"
  done
) &
HEART_PID=$!
trap 'kill $HEART_PID 2>/dev/null || true' EXIT

set +e
# stdbuf may be missing on macOS; plain tee still streams better than tail.
xcodebuild -resolvePackageDependencies \
  -project "$PROJ" \
  -scheme MindCraftNotes \
  -derivedDataPath /tmp/mc-dd-resolve \
  2>&1 | tee /tmp/mc-spm-resolve.log
RESOLVE_RC=${PIPESTATUS[0]}
set -e
kill "$HEART_PID" 2>/dev/null || true

if [[ "$RESOLVE_RC" -ne 0 ]]; then
  echo
  echo "SPM resolve FAILED (exit $RESOLVE_RC)."
  echo "Last errors:"
  grep -Ei 'error:|fatal:|No space|timed out|Could not resolve' /tmp/mc-spm-resolve.log | tail -30 || true
  echo
  echo "If you see 'No space left on device' → free Storage → Developer rows, re-run."
  echo "If network/timeout → retry on stable Wi‑Fi."
  exit "$RESOLVE_RC"
fi

echo "== Build for iOS Simulator (typecheck) =="
echo "NOTE: first clean build can take another 10–20 minutes. Heartbeat every 30s."
: > /tmp/mc-xcodebuild.log
(
  while true; do
    sleep 30
    SZ=$(wc -c < /tmp/mc-xcodebuild.log 2>/dev/null || echo 0)
    echo "  … still building ($(date +%H:%M:%S), log ${SZ} bytes)"
  done
) &
HEART_PID=$!

set +e
xcodebuild build \
  -project "$PROJ" \
  -scheme MindCraftNotes \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/mc-dd-build \
  CODE_SIGNING_ALLOWED=NO \
  2>&1 | tee /tmp/mc-xcodebuild.log
BUILD_RC=${PIPESTATUS[0]}
set -e
kill "$HEART_PID" 2>/dev/null || true
trap - EXIT

if [[ "$BUILD_RC" -ne 0 ]]; then
  echo
  echo "BUILD FAILED. Compile errors:"
  grep -n 'error:' /tmp/mc-xcodebuild.log | head -40 || true
  exit "$BUILD_RC"
fi

echo
echo "=== BUILD SUCCEEDED ==="
echo "Open Xcode and Run (Cmd+R) on iPad:"
echo "  open \"$PROJ\""
echo
df -h / | awk 'NR==1 || /\/$/'
