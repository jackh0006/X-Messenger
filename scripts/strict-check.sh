#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

manifest='apps/android/app/src/main/AndroidManifest.xml'

if rg -q 'android\.permission\.(INTERNET|ACCESS_NETWORK_STATE)' "$manifest"; then
  echo 'strict-check: Android network permission found' >&2
  exit 1
fi

if rg -q 'java\.net\.|SyncService|NetworkChangeReceiver' apps/android/app/src/main; then
  echo 'strict-check: Android network code found' >&2
  exit 1
fi

if git ls-files | rg -q '(^target/|(^|/)__pycache__/|\.idea/)'; then
  echo 'strict-check: generated build or IDE artefacts are tracked' >&2
  exit 1
fi

echo 'strict-check: strict Android and source-tree invariants passed'
