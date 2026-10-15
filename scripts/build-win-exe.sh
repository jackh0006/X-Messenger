#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Windows .exe stage: Go GUI launcher + NSIS per-user setup.exe.
# Usage: bash scripts/build-win-exe.sh [x64|arm64|x86|all]
# Best-effort: missing makensis or Go toolchain warns, never fails the ZIP build.
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
only="${1:-all}"
version="$(node -p "require('$project_root/package.json').version")"

GO_BIN=""
if command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qE "go1\.(2[4-9]|[3-9][0-9])"; then GO_BIN="go"
elif [ -x "$HOME/sdk/go/bin/go" ]; then GO_BIN="$HOME/sdk/go/bin/go"; fi

build_launcher() {
  local label="$1"; local goarch="$2"
  local out="$project_root/core/X-Messenger-GUI-windows-$label.exe"
  if [ -z "$GO_BIN" ]; then echo "warning: no Go >=1.24, skip launcher $label" >&2; return 0; fi
  echo "== launcher windows/$label =="
  (cd "$project_root/core" && GOOS=windows GOARCH="$goarch" "$GO_BIN" build -trimpath -o "$out" ./cmd/xm-launcher) || echo "warning: launcher $label failed" >&2
}

build_setup() {
  local label="$1"
  local stagedir="$project_root/dist/win-stage-$label"
  local zip="$project_root/dist/X-Messenger-$version-Windows-$label.zip"
  if [ ! -f "$zip" ]; then echo "warning: $zip missing, run build-windows.sh $label first" >&2; return 0; fi
  if ! command -v makensis >/dev/null 2>&1; then echo "warning: makensis missing, skip setup.exe $label (ZIP still ships)" >&2; return 0; fi
  rm -rf "$stagedir"; mkdir -p "$stagedir"
  (cd "$stagedir" && python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall('.')" "$zip")
  local builddir
  builddir="$(find "$stagedir" -maxdepth 1 -name "x-messenger-*-windows-$label" | head -n 1)"
  # Current ZIPs are flat (app/ + launchers at root); older ones nested the
  # tree one level down. Accept both, fail closed on neither.
  if [ -n "$builddir" ]; then :; elif [ -f "$stagedir/app/core.js" ]; then builddir="$stagedir"; else { echo "warning: unexpected ZIP layout $label" >&2; return 0; }; fi
  makensis -DVERSION="$version" -DARCH="$label" -DBUILD_DIR="$builddir" "$project_root/packaging/windows/x-messenger.nsi" || { echo "warning: NSIS $label failed" >&2; return 0; }
  local setup="$project_root/X-Messenger-$version-Windows-$label-setup.exe"
  # NSIS OutFile lands next to the script CWD; normalize into dist/.
  # (Relative OutFile resolves against the .nsi file's directory, so sweep
  # packaging/windows too.)
  for f in "$project_root"/*.exe ./X-Messenger-*-setup.exe "$project_root/packaging/windows"/X-Messenger-*-setup.exe; do [ -f "$f" ] || continue; mv -f "$f" "$project_root/dist/" 2>/dev/null || true; done
  echo "setup.exe staged for $label (unsigned; verify SHA256SUMS; SmartScreen expected)"
}

case "$only" in
  x64|amd64) build_launcher x64 amd64; build_setup x64 ;;
  arm64) build_launcher arm64 arm64; build_setup arm64 ;;
  x86|386|32) build_launcher x86 386; build_setup x86 ;;
  all) build_launcher x64 amd64; build_launcher arm64 arm64; build_launcher x86 386; build_setup x64; build_setup arm64; build_setup x86 ;;
  *) echo "Usage: $0 [x64|arm64|x86|all]" >&2; exit 2 ;;
esac
