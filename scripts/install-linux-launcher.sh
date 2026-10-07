#!/usr/bin/env bash
set -euo pipefail
install_root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/bin"
ln -sfn "$install_root/bin/cipherlink" "$HOME/.local/bin/cipherlink"
install -m 644 "$install_root/linux/cipherlink-offline.desktop" "$HOME/.local/share/applications/cipherlink-offline.desktop"
sed -i "s|/home/mhh06/cipherlink|$install_root|g" "$HOME/.local/share/applications/cipherlink-offline.desktop"
echo "Installed X Messenger. Find it in the app menu, or run: cipherlink gui"
