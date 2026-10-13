#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Multi-arch Debian builder: amd64 / arm64 / armhf.
# Usage: bash scripts/build-deb.sh [arch] [output.deb]
#   arch defaults to host (dpkg --print-architecture), outputs to dist/.
# Version comes from package.json (single source of truth).
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
requested_arch="${1:-$(dpkg --print-architecture 2>/dev/null || echo amd64)}"
output_path="${2:-}"

case "$requested_arch" in
  amd64|x86_64) DEB_ARCH=amd64; GOARCH=amd64; GOARM=""; DEMO_BIN="v2demo-linux-amd64" ;;
  arm64|aarch64) DEB_ARCH=arm64; GOARCH=arm64; GOARM=""; DEMO_BIN="v2demo-linux-arm64" ;;
  armhf|armv7l|arm) DEB_ARCH=armhf; GOARCH=arm; GOARM="7"; DEMO_BIN="v2demo-linux-armhf" ;;
  i386|i686) DEB_ARCH=i386; GOARCH=386; GOARM=""; DEMO_BIN="v2demo-linux-386" ;;
  *) echo "Unsupported arch: $requested_arch (use amd64|arm64|armhf|i386)" >&2; exit 2 ;;
esac

version="$(node -p "require('$project_root/package.json').version")"
if [[ -z "${output_path}" ]]; then
  mkdir -p "$project_root/dist"
  output_path="$project_root/dist/X-Messenger-${version}-Linux-${DEB_ARCH}.deb"
fi

stage_dir="$(mktemp -d)"
trap 'rm -rf "$stage_dir"' EXIT

node "$project_root/scripts/build-web.js" >/dev/null
node "$project_root/scripts/build-info.js" >/dev/null

# v2 demo binary for THIS arch (terminal handshake→shred loop). Rebuilt so the
# shipped binary always matches the shipped source; skipped with a warning
# when no Go ≥1.24 toolchain is present (source still ships for rebuild).
GO_BIN=""
if command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qE "go1\.(2[4-9]|[3-9][0-9])"; then
  GO_BIN="go"
elif [ -x "$HOME/sdk/go/bin/go" ]; then
  GO_BIN="$HOME/sdk/go/bin/go"
fi
if [ -n "$GO_BIN" ]; then
  if [ -n "$GOARM" ]; then
    (cd "$project_root/core" && GOOS=linux GOARCH="$GOARCH" GOARM="$GOARM" "$GO_BIN" build -trimpath -o "$DEMO_BIN" ./cmd/xm2demo)
  else
    (cd "$project_root/core" && GOOS=linux GOARCH="$GOARCH" "$GO_BIN" build -trimpath -o "$DEMO_BIN" ./cmd/xm2demo)
  fi
  # bin/cipherlink resolves per-arch at runtime; keep the legacy amd64 name
  # working by copying when we built amd64.
  if [ "$DEMO_BIN" != "v2demo-linux-amd64" ] && [ ! -f "$project_root/core/v2demo-linux-amd64" ]; then
    echo "note: legacy v2demo-linux-amd64 absent; runtime falls back to $DEMO_BIN" >&2
  fi
else
  echo "warning: no Go >=1.24 toolchain, shipping existing v2demo binary if present" >&2
fi

install -d "$stage_dir/DEBIAN" "$stage_dir/usr/lib/x-messenger" "$stage_dir/usr/bin" "$stage_dir/usr/share/applications" "$stage_dir/usr/share/icons/hicolor/scalable/apps"
cp -a "$project_root/." "$stage_dir/usr/lib/x-messenger/"
# Prune everything the runtime never touches (keeps the package lean and
# auditable). Runtime needs: www/ bundle, lib/, bin/, server.js, core.js, app.js,
# index.html, style.css, assets/, core/ (Go v2 source), model/, docs/,
# scripts/, packaging/, LICENSE/NOTICE. It never needs: git metadata,
# node_modules (www/ is prebuilt; server uses node builtins + openssl),
# Python bytecode, CI workflows, Gradle caches, or local properties.
rm -rf "$stage_dir/usr/lib/x-messenger/.git" \
  "$stage_dir/usr/lib/x-messenger/.github" \
  "$stage_dir/usr/lib/x-messenger/node_modules" \
  "$stage_dir/usr/lib/x-messenger/android/.gradle" \
  "$stage_dir/usr/lib/x-messenger/android/.idea" \
  "$stage_dir/usr/lib/x-messenger/android/app/build" \
  "$stage_dir/usr/lib/x-messenger/android/local.properties" \
  "$stage_dir/usr/lib/x-messenger/Downloads" \
  "$stage_dir/usr/lib/x-messenger/dist" \
  "$stage_dir/usr/lib/x-messenger/oam" \
  "$stage_dir/usr/lib/x-messenger/tests" \
  "$stage_dir/usr/lib/x-messenger/screenshots" \
  "$stage_dir/usr/lib/x-messenger/cipherlink-v2-audit" \
  "$stage_dir/usr/lib/x-messenger/.local" \
  "$stage_dir/usr/lib/x-messenger/AGENTS.md" \
  "$stage_dir/usr/lib/x-messenger/agent-config.example.jsonc" \
  "$stage_dir/usr/lib/x-messenger/.opencode" \
  "$stage_dir/usr/lib/x-messenger/packaging/debian/DEBIAN" 2>/dev/null || true
find "$stage_dir/usr/lib/x-messenger" -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true
# Drop non-matching-arch demo binaries to keep the package small.
for f in "$stage_dir/usr/lib/x-messenger/core"/v2demo-*; do
  [ -e "$f" ] || continue
  case "$f" in
    *"$DEMO_BIN"*|*.go|go.mod|go.sum) ;;
    */v2demo-linux-amd64)
      # Keep legacy name only on amd64; drop elsewhere.
      [ "$DEB_ARCH" = "amd64" ] || rm -f "$f" ;;
    *) rm -f "$f" ;;
  esac
done
# Per-arch control file (version + architecture from build inputs).
sed -e "s/^Version:.*/Version: $version/" -e "s/^Architecture:.*/Architecture: $DEB_ARCH/" \
  "$project_root/packaging/debian/DEBIAN/control" > "$stage_dir/DEBIAN/control"
chmod 644 "$stage_dir/DEBIAN/control"
install -m 755 "$project_root/packaging/debian/DEBIAN/postinst" "$stage_dir/DEBIAN/postinst"
install -m 644 "$project_root/packaging/debian/x-messenger.desktop" "$stage_dir/usr/share/applications/x-messenger.desktop"
install -m 644 "$project_root/assets/icon.svg" "$stage_dir/usr/share/icons/hicolor/scalable/apps/x-messenger.svg"
install -m 755 "$project_root/packaging/debian/x-messenger" "$stage_dir/usr/bin/x-messenger"
install -m 755 "$project_root/packaging/debian/x-messenger-cli" "$stage_dir/usr/bin/x-messenger-cli"
dpkg-deb --build --root-owner-group "$stage_dir" "$output_path"
echo "Built $output_path (arch=$DEB_ARCH version=$version)"
