#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Windows portable ZIPs: x64 + arm64 (+ experimental x86) (no admin, no installer required).
# Usage: bash scripts/build-windows.sh [x64|arm64|x86|all]
# Requires: node >= 18, Go >= 1.24 for v2 demo + GUI launcher cross-compile (else source ships).
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
only="${1:-all}"
version="$(node -p "require('$project_root/package.json').version")"
mkdir -p "$project_root/dist"

node "$project_root/scripts/build-web.js" >/dev/null
node "$project_root/scripts/build-info.js" >/dev/null

GO_BIN=""
if command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qE "go1\.(2[4-9]|[3-9][0-9])"; then GO_BIN="go"
elif [ -x "$HOME/sdk/go/bin/go" ]; then GO_BIN="$HOME/sdk/go/bin/go"; fi

build_one() {
  local label="$1"; local goarch="$2"
  local demo="v2demo-windows-amd64.exe"
  if [ "$goarch" = "arm64" ]; then demo="v2demo-windows-arm64.exe"; fi
  if [ "$goarch" = "386" ]; then demo="v2demo-windows-386.exe"; fi
  echo "== windows/$label =="
  if [ -n "$GO_BIN" ]; then
    (cd "$project_root/core" && GOOS=windows GOARCH="$goarch" "$GO_BIN" build -trimpath -o "$demo" ./cmd/xm2demo) || echo "warning: windows $label demo build failed" >&2
    # GUI launcher .exe (by jackh0006): finds node.exe, spawns offline GUI.
    (cd "$project_root/core" && GOOS=windows GOARCH="$goarch" "$GO_BIN" build -trimpath -o "X-Messenger-GUI-windows-$label.exe" ./cmd/xm-launcher) || echo "warning: windows $label launcher build failed" >&2
  else
    echo "warning: no Go >=1.24, shipping existing $demo if present" >&2
  fi
  local stage; stage="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$stage'" RETURN
  local pkgdir="$stage/x-messenger-${version}-windows-${label}"
  mkdir -p "$pkgdir/app"
  for f in www lib bin server.js core.js app.js index.html style.css manifest.webmanifest service-worker.js assets build-info.json package.json LICENSE NOTICE README.md SECURITY.md PRIVACY.md WINDOWS_GUIDE.md; do
    [ -e "$project_root/$f" ] && cp -a "$project_root/$f" "$pkgdir/app/"
  done
  mkdir -p "$pkgdir/app/core" "$pkgdir/app/docs" "$pkgdir/app/model"
  cp -a "$project_root/core"/go.mod "$project_root/core"/go.sum "$pkgdir/app/core/" 2>/dev/null || true
  for gof in device.go handshake.go ratchet.go store.go suite.go wire.go; do
    [ -f "$project_root/core/$gof" ] && cp -a "$project_root/core/$gof" "$pkgdir/app/core/"
  done
  [ -f "$project_root/core/$demo" ] && cp -a "$project_root/core/$demo" "$pkgdir/app/core/"
  if [ -f "$project_root/core/X-Messenger-GUI-windows-$label.exe" ]; then
    cp -a "$project_root/core/X-Messenger-GUI-windows-$label.exe" "$pkgdir/X-Messenger-GUI.exe"
  fi
  cp -a "$project_root/docs" "$pkgdir/app/" 2>/dev/null || true
  cp -a "$project_root/model" "$pkgdir/app/" 2>/dev/null || true
  cp -a "$project_root/packaging/windows/x-messenger.cmd" "$pkgdir/x-messenger.cmd"
  # GUI entry that keeps a console window for logs (double-click friendly).
  cat > "$pkgdir/X-Messenger-GUI.cmd" <<EOF
@echo off
REM X Messenger $version ($label) — double-click to open the offline GUI.
"%~dp0x-messenger.cmd" gui
pause
EOF
  cat > "$pkgdir/README-Windows.txt" <<EOF
X Messenger $version — Windows ($label), portable, no admin. By jackh0006.
Requires: Node.js 18+ on PATH (x64/arm64: Node 20 LTS; x86: Node 18 32-bit EOL, insecure — x64 preferred), Edge/Chrome, openssl
  (Git for Windows provides openssl.exe) for first-run local CA.
Run:  X-Messenger-GUI.exe            (double-click .exe launcher, recommended)
      x-messenger.cmd gui            (https://127.0.0.1:443 loopback, fallback 8443)
      x-messenger.cmd setup
      x-messenger.cmd encrypt "hello"
      X-Messenger-GUI.cmd            (double-click .cmd fallback)
Data: %APPDATA%\\x-messenger (per-user, no admin).
SmartScreen: first run may say Unknown publisher until the binary gains
  reputation. Prefer the signed setup.exe when published; verify SHA256SUMS.
See WINDOWS_GUIDE.md. Needs independent audit before high-risk use.
EOF
  local out="$project_root/dist/X-Messenger-${version}-Windows-${label}.zip"
  rm -f "$out"
  (cd "$stage" && python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[2])" "${out%.zip}" "x-messenger-${version}-windows-${label}")
  echo "Built $out"
}

case "$only" in
  x64|amd64) build_one x64 amd64 ;;
  arm64) build_one arm64 arm64 ;;
  x86|386|32) build_one x86 386 ;;
  all) build_one x64 amd64; build_one arm64 arm64; build_one x86 386 ;;
  *) echo "Usage: $0 [x64|arm64|x86|all]" >&2; exit 2 ;;
esac
