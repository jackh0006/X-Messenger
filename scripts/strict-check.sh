#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

for manifest in apps/android/app/src/main/AndroidManifest.xml app/android/app/src/main/AndroidManifest.xml; do
  if rg -q 'android\.permission\.(INTERNET|ACCESS_NETWORK_STATE)' "$manifest"; then
    echo "strict-check: Android network permission found in $manifest" >&2
    exit 1
  fi
done

if rg -q 'java\.net\.|SyncService|NetworkChangeReceiver' apps/android/app/src/main; then
  echo 'strict-check: Android network code found' >&2
  exit 1
fi

if rg -q "^(import 'dart:io'|.*\b(?:HttpClient|Socket|WebSocket)\b)" app/lib; then
  echo 'strict-check: Dart network API found in shared UI' >&2
  exit 1
fi

if git ls-files | rg -q '(^target/|(^|/)__pycache__/|\.idea/)'; then
  echo 'strict-check: generated build or IDE artefacts are tracked' >&2
  exit 1
fi

echo 'strict-check: strict Android and source-tree invariants passed'
