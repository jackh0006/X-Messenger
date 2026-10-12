# Google Play release (v1.3.1+)

The debug APK is only for testing. Google Play requires a signed Android App
Bundle (`.aab`) and your own upload key. Sideloaded APKs will **always** show
Play Protect “Unknown app” until the app is Play-signed + verified — this is
expected and documented, not a bug.

## One-time: upload key (never commit)

```bash
keytool -genkeypair -v -keystore ~/x-messenger-upload.jks -alias xmessenger \
  -keyalg RSA -keysize 3072 -validity 10950
# Then per build:
export X_MESSENGER_STORE_FILE=~/x-messenger-upload.jks
export X_MESSENGER_STORE_PASS='…' X_MESSENGER_KEY_ALIAS=xmessenger X_MESSENGER_KEY_PASS='…'
```

Back up the `.jks` + passwords offline. Losing the upload key = new app
listing. Never commit `*.jks`/`key.properties` (see `.gitignore`).

## Build (same code as GitHub APKs)

```bash
npm run android:sync
npm run android:aab        # → android/app/build/outputs/bundle/release/*.aab
npm run android:apk:release
```

Current `versionCode`/`versionName` come from `android/app/build.gradle`
(v1.3.1 = `versionCode 13`, per-ABI `*10+offset` for GitHub multi-APK;
Play serves splits from the single `.aab`). `minSdk 24` covers Android 9
(API 28); `targetSdk/compileSdk 36` is Play-compliant stable (37 is preview).

## Pre-upload gates (must all pass)

```bash
AAPT=~/Android/Sdk/build-tools/*/aapt
$AAPT dump badging X-Messenger-<ver>-Android-arm64.apk | grep -E "versionName|uses-permission|native-code"
# Expect: versionName='1.3.1', CAMERA only, NO internet, native-code includes armeabi-v7a + arm64-v8a
```

Test on: Android 9 (API 28, arm32) + Android 13/14 (arm64) + emulator
x86_64, airplane-mode seal→scan→decrypt, backup/restore, dark/text-scale.

## Play Console disclosures (truthful)

* Paste listing + data safety from `docs/store-listing.md` (no data
  collected/shared, Camera only for QR, offline-first).
* Privacy policy from `docs/privacy-policy.md`.
* Declare: no ads, no analytics, no INTERNET permission, no background
  service. Upload the signed `.aab` (never a debug APK).
* Roll out: closed testing (arm32 + Android 9 devices in pre-launch) →
  production. Keep GitHub APKs as byte-identical direct downloads with
  `SHA256SUMS.txt` for verification.

This app requests Camera only for QR scanning and has no Internet permission.
Verify with `aapt dump permissions` at every release. Do not market it as
“unhackable” or “CIA-grade.” Sell instead: no signal needed, no account
needed, no server to leak.
