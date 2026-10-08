#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

if ! command -v grep >/dev/null 2>&1; then
  echo 'strict-check: grep is required but not installed' >&2
  exit 1
fi

for manifest in apps/android/app/src/main/AndroidManifest.xml app/android/app/src/main/AndroidManifest.xml; do
  if [ ! -f "$manifest" ]; then
    echo "strict-check: missing expected manifest $manifest" >&2
    exit 1
  fi
  if grep -E -q 'android\.permission\.(INTERNET|ACCESS_NETWORK_STATE)' "$manifest"; then
    echo "strict-check: Android network permission found in $manifest" >&2
    exit 1
  fi
done

if grep -R -E -q 'java\.net\.|SyncService|NetworkChangeReceiver' apps/android/app/src/main; then
  echo 'strict-check: Android network code found' >&2
  exit 1
fi

if grep -R -E -q "dart:io|HttpClient|WebSocket|(^|[^A-Za-z0-9_])Socket([^A-Za-z0-9_]|$)" app/lib; then
  echo 'strict-check: Dart network API found in shared UI' >&2
  exit 1
fi

if git ls-files | grep -E -q '(^target/|(^|/)__pycache__/|\.idea/)'; then
  echo 'strict-check: generated build or IDE artefacts are tracked' >&2
  exit 1
fi

echo 'strict-check: strict Android and source-tree invariants passed'
