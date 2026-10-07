#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
output_path="${1:-$project_root/X-Messenger-Linux.deb}"
stage_dir="$(mktemp -d)"
trap 'rm -rf "$stage_dir"' EXIT

node "$project_root/scripts/build-web.js" >/dev/null

install -d "$stage_dir/DEBIAN" "$stage_dir/usr/lib/x-messenger" "$stage_dir/usr/bin" "$stage_dir/usr/share/applications" "$stage_dir/usr/share/icons/hicolor/scalable/apps"
cp -a "$project_root/." "$stage_dir/usr/lib/x-messenger/"
rm -rf "$stage_dir/usr/lib/x-messenger/.git" "$stage_dir/usr/lib/x-messenger/android/.gradle" "$stage_dir/usr/lib/x-messenger/android/app/build" "$stage_dir/usr/lib/x-messenger/android/local.properties" "$stage_dir/usr/lib/x-messenger/Downloads"
install -m 644 "$project_root/packaging/debian/DEBIAN/control" "$stage_dir/DEBIAN/control"
install -m 644 "$project_root/packaging/debian/x-messenger.desktop" "$stage_dir/usr/share/applications/x-messenger.desktop"
install -m 644 "$project_root/assets/icon.svg" "$stage_dir/usr/share/icons/hicolor/scalable/apps/x-messenger.svg"
install -m 755 "$project_root/packaging/debian/x-messenger" "$stage_dir/usr/bin/x-messenger"
install -m 755 "$project_root/packaging/debian/x-messenger-cli" "$stage_dir/usr/bin/x-messenger-cli"
dpkg-deb --build --root-owner-group "$stage_dir" "$output_path"
echo "Built $output_path"
