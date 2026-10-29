#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Portable tarball for non-deb Linux distros (Fedora/Arch/NixOS) + offline audit.
# Usage: bash scripts/build-tarball.sh [arch] [output.tar.gz]
# Bundles: prebuilt www/, Node runtime files, Go v2 source + per-arch demo binary.
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
requested_arch="${1:-$(uname -m)}"
output_path="${2:-}"
case "$requested_arch" in
  x86_64|amd64) TAR_ARCH=amd64; GOARCH=amd64; GOARM=""; DEMO_BIN="v2demo-linux-amd64" ;;
  aarch64|arm64) TAR_ARCH=arm64; GOARCH=arm64; GOARM=""; DEMO_BIN="v2demo-linux-arm64" ;;
  armv7l|armhf|arm) TAR_ARCH=armhf; GOARCH=arm; GOARM="7"; DEMO_BIN="v2demo-linux-armhf" ;;
  i686|i386) TAR_ARCH=i386; GOARCH=386; GOARM=""; DEMO_BIN="v2demo-linux-386" ;;
  *) echo "Unsupported arch: $requested_arch" >&2; exit 2 ;;
esac
version="$(node -p "require('$project_root/package.json').version")"
if [[ -z "$output_path" ]]; then
  mkdir -p "$project_root/dist"
  output_path="$project_root/dist/X-Messenger-${version}-Linux-${TAR_ARCH}.tar.gz"
fi
node "$project_root/scripts/build-web.js" >/dev/null
node "$project_root/scripts/build-info.js" >/dev/null
GO_BIN=""
if command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qE "go1\.(2[4-9]|[3-9][0-9])"; then GO_BIN="go"
elif [ -x "$HOME/sdk/go/bin/go" ]; then GO_BIN="$HOME/sdk/go/bin/go"; fi
if [ -n "$GO_BIN" ]; then
  if [ -n "$GOARM" ]; then
    (cd "$project_root/core" && GOOS=linux GOARCH="$GOARCH" GOARM="$GOARM" "$GO_BIN" build -trimpath -o "$DEMO_BIN" ./cmd/xm2demo)
  else
    (cd "$project_root/core" && GOOS=linux GOARCH="$GOARCH" "$GO_BIN" build -trimpath -o "$DEMO_BIN" ./cmd/xm2demo)
  fi
fi
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
pkgdir="$stage/x-messenger-${version}-linux-${TAR_ARCH}"
mkdir -p "$pkgdir"
for f in www lib bin server.js core.js app.js index.html style.css manifest.webmanifest service-worker.js assets build-info.json package.json LICENSE NOTICE README.md LINUX_GUIDE.md LINUX_INSTALL.md SECURITY.md PRIVACY.md; do
  [ -e "$project_root/$f" ] && cp -a "$project_root/$f" "$pkgdir/"
done
mkdir -p "$pkgdir/core" "$pkgdir/docs" "$pkgdir/model"
cp -a "$project_root/core"/go.mod "$project_root/core"/go.sum "$pkgdir/core/" 2>/dev/null || true
for gof in device.go handshake.go ratchet.go store.go suite.go wire.go; do
  [ -f "$project_root/core/$gof" ] && cp -a "$project_root/core/$gof" "$pkgdir/core/"
done
[ -f "$project_root/core/$DEMO_BIN" ] && cp -a "$project_root/core/$DEMO_BIN" "$pkgdir/core/"
[ -f "$project_root/core/v2demo-linux-amd64" ] && [ "$DEMO_BIN" != "v2demo-linux-amd64" ] && cp -a "$project_root/core/v2demo-linux-amd64" "$pkgdir/core/" 2>/dev/null || true
cp -a "$project_root/docs" "$pkgdir/" 2>/dev/null || true
cp -a "$project_root/model" "$pkgdir/" 2>/dev/null || true
cat > "$pkgdir/INSTALL.txt" <<EOF
X Messenger $version — portable Linux ($TAR_ARCH)
Requires: node >= 18, openssl, a Chromium/Chrome/Edge browser.
Run:  ./run.sh gui        (loopback https://127.0.0.1:443, fallback 8443)
      ./run.sh --help
No install, no root, no network. See LINUX_INSTALL.md.
EOF
cat > "$pkgdir/run.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec node bin/cipherlink "$@"
EOF
chmod 755 "$pkgdir/run.sh"
tar -czf "$output_path" -C "$stage" "x-messenger-${version}-linux-${TAR_ARCH}"
echo "Built $output_path"
