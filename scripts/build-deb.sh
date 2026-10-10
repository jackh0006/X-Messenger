#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
output_path="${1:-$project_root/X-Messenger-Linux.deb}"
stage_dir="$(mktemp -d)"
trap 'rm -rf "$stage_dir"' EXIT

node "$project_root/scripts/build-web.js" >/dev/null
node "$project_root/scripts/build-info.js" >/dev/null

# v2 demo binary (terminal handshake→shred loop). Rebuilt here so the
# shipped binary always matches the shipped source; skipped with a warning
# when no Go ≥1.24 toolchain is present (source still ships for rebuild).
GO_BIN=""
if command -v go >/dev/null 2>&1 && go version 2>/dev/null | grep -qE "go1\.(2[4-9]|[3-9][0-9])"; then
  GO_BIN="go"
elif [ -x "$HOME/sdk/go/bin/go" ]; then
  GO_BIN="$HOME/sdk/go/bin/go"
fi
if [ -n "$GO_BIN" ]; then
  (cd "$project_root/core" && "$GO_BIN" build -trimpath -o v2demo-linux-amd64 ./cmd/xm2demo)
else
  echo "warning: no Go >=1.24 toolchain, shipping existing v2demo binary if present" >&2
fi

install -d "$stage_dir/DEBIAN" "$stage_dir/usr/lib/x-messenger" "$stage_dir/usr/bin" "$stage_dir/usr/share/applications" "$stage_dir/usr/share/icons/hicolor/scalable/apps"
cp -a "$project_root/." "$stage_dir/usr/lib/x-messenger/"
# Prune everything the runtime never touches (keeps the package lean and
# auditable). Runtime needs: www/ bundle, bin/, server.js, core.js, app.js,
# index.html, style.css, assets/, core/ (Go v2 source), model/, docs/,
# scripts/, packaging/, LICENSE/NOTICE. It never needs: git metadata,
# node_modules (www/ is prebuilt; server uses node builtins + openssl),
# Python bytecode, CI workflows, Gradle caches, or local properties.
rm -rf "$stage_dir/usr/lib/x-messenger/.git" "$stage_dir/usr/lib/x-messenger/.github" "$stage_dir/usr/lib/x-messenger/node_modules" "$stage_dir/usr/lib/x-messenger/android/.gradle" "$stage_dir/usr/lib/x-messenger/android/app/build" "$stage_dir/usr/lib/x-messenger/android/local.properties" "$stage_dir/usr/lib/x-messenger/Downloads"
find "$stage_dir/usr/lib/x-messenger" -name "__pycache__" -type d -prune -exec rm -rf {} +
install -m 644 "$project_root/packaging/debian/DEBIAN/control" "$stage_dir/DEBIAN/control"
install -m 644 "$project_root/packaging/debian/x-messenger.desktop" "$stage_dir/usr/share/applications/x-messenger.desktop"
install -m 644 "$project_root/assets/icon.svg" "$stage_dir/usr/share/icons/hicolor/scalable/apps/x-messenger.svg"
install -m 755 "$project_root/packaging/debian/x-messenger" "$stage_dir/usr/bin/x-messenger"
install -m 755 "$project_root/packaging/debian/x-messenger-cli" "$stage_dir/usr/bin/x-messenger-cli"
dpkg-deb --build --root-owner-group "$stage_dir" "$output_path"
echo "Built $output_path"
