#!/usr/bin/env bash
# X Messenger stable release script (v1.0.7+).
# Usage: ./scripts/release.sh 1.0.7 [--publish]
# Without --publish: verifies + builds .deb/.apk + SHA256SUMS locally.
# With --publish: also pushes branch+tag and creates the GitHub release.
# Old releases are NEVER rewritten; they are only re-flagged prerelease.
set -euo pipefail
cd "$(dirname "$0")/.."

VER="${1:-}"; MODE="${2:-}"
if [[ ! "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 <x.y.z> [--publish]"; exit 2
fi

echo "== 1/5 version lockstep ($VER) =="
grep -q "\"version\": \"$VER\"" package.json
grep -q "VERSION = '$VER'" core.js
grep -q "versionName \"$VER\"" android/app/build.gradle
grep -q "Version: $VER" packaging/debian/DEBIAN/control
grep -q "version: '$VER'" server.js

echo "== 2/5 tests =="
npm test

echo "== 3/5 web bundle =="
npm run build:web

echo "== 4/5 packages =="
OUT=/home/mhh06/Downloads/X-Messenger
# Canonical asset names (stable since 1.0.7, all releases carry these):
#   X-Messenger-<ver>-Linux-amd64.deb
#   X-Messenger-<ver>-Android-arm64.apk
#   X-Messenger-<ver>-SHA256SUMS.txt
DEB="$OUT/X-Messenger-$VER-Linux-amd64.deb"
APK="$OUT/X-Messenger-$VER-Android-arm64.apk"
SUMS="$OUT/X-Messenger-$VER-SHA256SUMS.txt"
bash scripts/build-deb.sh "$DEB"
ln -sfn /home/mhh06/cipherlink/node_modules node_modules
npm run android:sync >/dev/null
export ANDROID_HOME=/home/mhh06/Android/Sdk ANDROID_SDK_ROOT=/home/mhh06/Android/Sdk
(cd android && JAVA_TOOL_OPTIONS='-Djava.net.preferIPv4Stack=true' ./gradlew --no-daemon :app:assembleDebug >/dev/null)
rm -f node_modules
cp android/app/build/outputs/apk/debug/app-debug.apk "$APK"
(cd "$OUT" && sha256sum "X-Messenger-$VER-Linux-amd64.deb" "X-Messenger-$VER-Android-arm64.apk" > "X-Messenger-$VER-SHA256SUMS.txt")
aapt_out=$(/home/mhh06/Android/Sdk/build-tools/36.0.0/aapt dump badging "$APK")
echo "$aapt_out" | grep -q "versionName='$VER'" || { echo "APK version mismatch"; exit 1; }
echo "$aapt_out" | grep -q "uses-permission: name='android.permission.INTERNET'" && { echo "APK must not request INTERNET"; exit 1; }
echo "packages OK"

if [[ "$MODE" != "--publish" ]]; then
  echo "Local build done (not published). Run with --publish after human approval."
  exit 0
fi

echo "== 5/5 publish =="
BRANCH="release/$VER"
git switch -c "$BRANCH" 2>/dev/null || git switch "$BRANCH"
git push origin "$BRANCH"
git tag "v$VER"
git push origin "v$VER"
gh release create "v$VER" --title "v$VER — stable offline courier" \
  --notes-file /dev/stdin <<EOF
X Messenger $VER (stable).
Offline core: loopback-only HTTPS separate window. Optional gateway: LAN IP / VPS domain / VPS IP with custom ports (docs/GATEWAY.md).
Same hardened bundle on Android (CAMERA-only) and Linux.
Needs independent audit before high-risk use. See SECURITY.md.
EOF
gh release upload "v$VER" "$OUT/X-Messenger-$VER-Linux-amd64.deb" "$OUT/X-Messenger-$VER-Android-arm64.apk" "$OUT/X-Messenger-$VER-SHA256SUMS.txt"
for old in $(gh release list --limit 50 --json tagName,isPrerelease --jq '.[] | select(.isPrerelease==false) | .tagName'); do
  if [[ "$old" != "v$VER" ]]; then gh release edit "$old" --prerelease; fi
done
echo "Published v$VER as Latest; all other full releases are prerelease."
