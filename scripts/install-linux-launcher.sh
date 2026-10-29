#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Installs the X Messenger menu entry + CLI symlink for the current checkout.
# Safe to re-run after moving the tree: every path is generated, nothing is
# hardcoded to a developer machine. Never touches the system menu (user scope
# only) and never deletes the user's other entries.
set -euo pipefail
install_root="$(cd "$(dirname "$0")/.." && pwd)"
[ -x "$install_root/bin/cipherlink" ] || { echo "bin/cipherlink missing in $install_root" >&2; exit 1; }
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/bin"
ln -sfn "$install_root/bin/cipherlink" "$HOME/.local/bin/cipherlink"
# Fresh entry for THIS checkout (loopback GUI; the CLI picks a free port when
# the saved one is busy, so a menu click never dies silently). Icon is the
# absolute SVG shipped in-tree; StartupWMClass groups the native window.
cat > "$HOME/.local/share/applications/cipherlink-offline.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=X Messenger
Comment=Offline encrypted QR messenger
Exec=$install_root/bin/cipherlink gui
TryExec=$install_root/bin/cipherlink
Icon=$install_root/assets/icon.svg
Terminal=false
Categories=Network;InstantMessaging;
Keywords=qr;encrypt;offline;messenger;
StartupNotify=true
StartupWMClass=X-Messenger
EOF
chmod 644 "$HOME/.local/share/applications/cipherlink-offline.desktop"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
echo "Installed X Messenger. Find it in the app menu, or run: cipherlink gui"
