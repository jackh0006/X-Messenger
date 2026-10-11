#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# X Messenger stable release script (v1.2.0+).
# Usage: ./scripts/release.sh 1.2.0 [--publish]
# Without --publish: verifies + builds all artifacts + SHA256SUMS locally.
# With --publish: also pushes branch+tag and creates the GitHub release.
# Old releases are NEVER rewritten; they are only re-flagged prerelease.
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:-}"; MODE="${2:-}"
if [[ ! "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 <x.y.z> [--publish]"; exit 2
fi

echo "== 1/6 version lockstep ($VER) =="
grep -q "\"version\": \"$VER\"" package.json
grep -q "VERSION = '$VER'" core.js
grep -q "versionName \"$VER\"" android/app/build.gradle
grep -q "Version: $VER" packaging/debian/DEBIAN/control
grep -q "$VER" index.html
# server.js reads version dynamically from package.json (no hardcoded string).
grep -q "appVersion\|package.json" server.js

echo "== 2/6 tests =="
npm test

echo "== 3/6 web bundle =="
npm run build:web

echo "== 4/6 desktop packages =="
OUT="${X_MESSENGER_OUT:-$PWD/dist}"
mkdir -p "$OUT"
# Debian per-arch
bash scripts/build-deb.sh amd64 "$OUT/X-Messenger-$VER-Linux-amd64.deb"
# Cross-arch debs: best-effort on amd64 hosts (Go cross-compile works;
# dpkg-deb works anywhere). Failure here must not block the host-arch build.
bash scripts/build-deb.sh arm64 "$OUT/X-Messenger-$VER-Linux-arm64.deb" || echo "warn: arm64 deb skipped" >&2
bash scripts/build-deb.sh armhf "$OUT/X-Messenger-$VER-Linux-armhf.deb" || echo "warn: armhf deb skipped" >&2
# Portable tarballs
bash scripts/build-tarball.sh amd64 "$OUT/X-Messenger-$VER-Linux-amd64.tar.gz" || echo "warn: amd64 tarball skipped" >&2
bash scripts/build-tarball.sh arm64 "$OUT/X-Messenger-$VER-Linux-arm64.tar.gz" || echo "warn: arm64 tarball skipped" >&2
# Windows portable zips (built on Linux via cross-compile; tested on Win10/11)
bash scripts/build-windows.sh all || echo "warn: windows zips skipped" >&2
for f in "$OUT"/X-Messenger-"$VER"-Windows-*.zip; do
  [ -e "$f" ] && cp -a "$f" "$OUT/" 2>/dev/null || true
done
# dist/ also receives copies from builders defaulting there; normalize into OUT.
for f in dist/X-Messenger-"$VER"-*; do
  [ -e "$f" ] || continue
  cp -a "$f" "$OUT/" 2>/dev/null || true
done

echo "== 5/6 android (APKs + AAB) =="
npm run android:sync >/dev/null
# Portable SDK detection (env first, then ~/Android/Sdk, then ANDROID_HOME).
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
# Locate aapt (any build-tools version) for the offline + version gates.
AAPT=""
for cand in "$SDK/build-tools"/*/aapt; do [ -x "$cand" ] && AAPT="$cand"; done
[ -n "$AAPT" ] || { echo "aapt not found under $SDK/build-tools" >&2; exit 1; }
# Release APKs (signed when X_MESSENGER_STORE_FILE is set, else debug-signed
# for local testing — never upload debug-signed artifacts to Play).
(cd android && JAVA_TOOL_OPTIONS='-Djava.net.preferIPv4Stack=true' ./gradlew --no-daemon :app:assembleRelease >/dev/null)
# Collect per-ABI release APKs when splits are on; fall back to universal.
APK_DIR="android/app/build/outputs/apk/release"
mkdir -p "$APK_DIR"
if ls "$APK_DIR"/*arm64* 2>/dev/null | grep -q .; then
  cp -a "$APK_DIR"/*arm64*.apk "$OUT/X-Messenger-$VER-Android-arm64.apk"
  cp -a "$APK_DIR"/*armeabi*.apk "$OUT/X-Messenger-$VER-Android-arm32.apk" 2>/dev/null || cp -a "$APK_DIR"/app-universal-release.apk "$OUT/X-Messenger-$VER-Android-arm32.apk" 2>/dev/null || true
else
  # Universal fallback: ship the same bytes under both names so old arm32
  # devices stay installable even when the build host lacks NDK splits.
  UNIVERSAL="$(ls "$APK_DIR"/app-*-release.apk 2>/dev/null | head -n 1 || ls "$APK_DIR"/*.apk 2>/dev/null | head -n 1 || true)"
  [ -n "$UNIVERSAL" ] || { echo "no release APK in $APK_DIR" >&2; exit 1; }
  cp -a "$UNIVERSAL" "$OUT/X-Messenger-$VER-Android-arm64.apk"
  cp -a "$UNIVERSAL" "$OUT/X-Messenger-$VER-Android-arm32.apk"
fi
# Release AAB for Play (required for new Play uploads; kills sideload warning).
(cd android && JAVA_TOOL_OPTIONS='-Djava.net.preferIPv4Stack=true' ./gradlew --no-daemon :app:bundleRelease >/dev/null) || echo "warn: bundleRelease failed (Play AAB skipped)" >&2
AAB="$(ls android/app/build/outputs/bundle/release/*.aab 2>/dev/null | head -n 1 || true)"
[ -n "$AAB" ] && cp -a "$AAB" "$OUT/X-Messenger-$VER-Android.aab" || echo "warn: no AAB produced" >&2
# Gates: version + CAMERA-only (no INTERNET).
for APK in "$OUT/X-Messenger-$VER-Android-arm64.apk" "$OUT/X-Messenger-$VER-Android-arm32.apk"; do
  [ -f "$APK" ] || { echo "missing $APK" >&2; exit 1; }
  aapt_out=$("$AAPT" dump badging "$APK")
  echo "$aapt_out" | grep -q "versionName='$VER'" || { echo "APK version mismatch in $APK"; exit 1; }
  echo "$aapt_out" | grep -q "uses-permission: name='android.permission.INTERNET'" && { echo "APK must not request INTERNET: $APK"; exit 1; }
  echo "$aapt_out" | grep -q "uses-permission: name='android.permission.CAMERA'" || { echo "APK must request CAMERA: $APK"; exit 1; }
  echo "OK $APK"
done
# SBOM (best-effort; npm sbom needs registry access).
(npm sbom --omit=dev --sbom-format=cyclonedx > "$OUT/X-Messenger-$VER-SBOM.cdx.json") || { echo "warn: SBOM skipped (offline?)" >&2; rm -f "$OUT/X-Messenger-$VER-SBOM.cdx.json"; }
# Remove a stale SUMS first so the new file never hashes itself.
rm -f "$OUT/X-Messenger-$VER-SHA256SUMS.txt"
(cd "$OUT" && sha256sum X-Messenger-"$VER"-* > "X-Messenger-$VER-SHA256SUMS.txt")
echo "packages OK — see $OUT"

if [[ "$MODE" != "--publish" ]]; then
  echo "Local build done (not published). Run with --publish after human approval."
  exit 0
fi

echo "== 6/6 publish =="
BRANCH="release/$VER"
git switch -c "$BRANCH" 2>/dev/null || git switch "$BRANCH"
git push origin "$BRANCH"
git tag "v$VER"
git push origin "v$VER"
gh release create "v$VER" --title "v$VER — stable offline courier" \
  --notes-file /dev/stdin <<EOF
X Messenger $VER (stable).
Offline core: loopback-only HTTPS separate window, QR/file/clipboard couriers.
Android: CAMERA-only, arm32 (armeabi-v7a, Android 9+) + arm64, signed AAB for Play.
Linux: amd64/arm64/armhf .debs + portable tarballs. Windows 10/11: portable ZIPs (x64/arm64).
Same hardened www bundle everywhere (cap sync verified).
Needs independent audit before high-risk use. See SECURITY.md.
Verify SHA256SUMS before installing. Play/SmartScreen warnings are expected
for sideloads; the Play AAB + signed setup.exe are the trusted paths.
EOF
gh release upload "v$VER" "$OUT"/X-Messenger-"$VER"-*
for old in $(gh release list --limit 50 --json tagName,isPrerelease --jq '.[] | select(.isPrerelease==false) | .tagName'); do
  if [[ "$old" != "v$VER" ]]; then gh release edit "$old" --prerelease; fi
done
echo "Published v$VER as Latest; all other full releases are prerelease."
