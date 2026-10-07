#!/bin/sh
# OAM Linux launcher. The app is fully offline; firewall it to prove it:
#   sudo iptables -A OUTPUT -m owner --uid-owner "$USER" -j DROP  # (optional test)
set -e
cd "$(dirname "$0")"
python3 -m pip install --quiet -r requirements.txt 2>/dev/null || true
exec python3 apps/linux/oam_gui.py "$@"
