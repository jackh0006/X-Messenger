#!/usr/bin/env bash
set -euo pipefail

if command -v x-messenger-cli >/dev/null 2>&1; then
  exec x-messenger-cli "$@"
fi

echo "X Messenger is not installed. Install X-Messenger-Linux.deb first:" >&2
echo "  sudo apt install ./X-Messenger-Linux.deb" >&2
exit 1
