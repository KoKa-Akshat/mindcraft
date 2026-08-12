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
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild missing — open Xcode once, then re-run."
  exit 1
fi

set +e
xcodebuild -resolvePackageDependencies \
  -project "$PROJ" \
  -scheme MindCraftNotes \
  -derivedDataPath /tmp/mc-dd-resolve \
  2>&1 | tee /tmp/mc-spm-resolve.log | tail -40
RESOLVE_RC=${PIPESTATUS[0]}
set -e

if [[ "$RESOLVE_RC" -ne 0 ]]; then
  echo
  echo "SPM resolve FAILED (exit $RESOLVE_RC)."
  echo "Last errors:"
  rg -i 'error:|fatal:|No space|timed out|Could not resolve' /tmp/mc-spm-resolve.log | tail -30 || true
  echo
  echo "If you see 'No space left on device' → free Storage → Developer rows, re-run."
  echo "If network/timeout → retry on stable Wi‑Fi."
  exit "$RESOLVE_RC"
fi

echo "== Build for iOS Simulator (typecheck) =="
set +e
xcodebuild build \
  -project "$PROJ" \
  -scheme MindCraftNotes \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/mc-dd-build \
  CODE_SIGNING_ALLOWED=NO \
  2>&1 | tee /tmp/mc-xcodebuild.log | tail -50
BUILD_RC=${PIPESTATUS[0]}
set -e

if [[ "$BUILD_RC" -ne 0 ]]; then
  echo
  echo "BUILD FAILED. Compile errors:"
  rg -n 'error:' /tmp/mc-xcodebuild.log | head -40 || true
  exit "$BUILD_RC"
fi

echo
echo "=== BUILD SUCCEEDED ==="
echo "Open Xcode and Run (Cmd+R) on iPad:"
echo "  open \"$PROJ\""
echo
df -h / | awk 'NR==1 || /\/$/'
