#!/usr/bin/env bash
# Build a local, unsigned X Messenger preview package for amd64 Ubuntu systems.
set -euo pipefail

root_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
version=$(awk '/^version:/{split($2, v, "+"); print v[1]; exit}' "$root_dir/pubspec.yaml")
stage_dir=$(mktemp -d)
package_name="x-messenger_${version}_amd64.deb"
output_dir="$root_dir/dist"

cleanup() { rm -rf "$stage_dir"; }
trap cleanup EXIT

bash "$root_dir/../scripts/strict-check.sh"
flutter build linux --release

bundle="$root_dir/build/linux/x64/release/bundle"
test -x "$bundle/x_messenger"

install -d "$stage_dir/DEBIAN" "$stage_dir/opt/x-messenger" \
  "$stage_dir/usr/bin" "$stage_dir/usr/share/applications" \
  "$stage_dir/etc/apparmor.d"
cp -a "$bundle/." "$stage_dir/opt/x-messenger/"
install -m 0755 "$root_dir/packaging/x-messenger" "$stage_dir/usr/bin/x-messenger"
install -m 0644 "$root_dir/packaging/x-messenger.desktop" "$stage_dir/usr/share/applications/x-messenger.desktop"
install -m 0644 "$root_dir/packaging/usr.bin.x-messenger" "$stage_dir/etc/apparmor.d/usr.bin.x-messenger"

cat > "$stage_dir/DEBIAN/control" <<EOF
Package: x-messenger
Version: $version
Section: utils
Priority: optional
Architecture: amd64
Depends: libgtk-3-0 | libgtk-3-0t64, libblkid1, liblzma5, libstdc++6, libgcc-s1
Maintainer: X Messenger contributors
Description: X Messenger offline shared-interface preview
 This unsigned preview contains no usable cryptographic vault or transport.
EOF

mkdir -p "$output_dir"
dpkg-deb --root-owner-group -Zxz --build "$stage_dir" "$output_dir/$package_name"
sha256sum "$output_dir/$package_name" > "$output_dir/$package_name.sha256"
printf 'Created %s\n' "$output_dir/$package_name"
