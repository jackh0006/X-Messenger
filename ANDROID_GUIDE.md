# Use X Messenger on Android (v1.3.0+)

Supported: **Android 7.0+ (`minSdk 24`), tested on Android 9 (API 28) through
Android 16**, `armeabi-v7a` (arm32 phones) + `arm64-v8a` + `x86_64`/`x86`
(emulators/tablets). `targetSdk/compileSdk 36` (stable, Play-compliant).

## Install (no build needed)

Download from the stable release and verify `SHA256SUMS.txt` first:

* `X-Messenger-<ver>-Android-arm64.apk` — new phones (2017+).
* `X-Messenger-<ver>-Android-arm32.apk` — Android 9-era / 32-bit phones.
* `X-Messenger-<ver>-Android.aab` — Play upload bundle (not for sideload).

Sideloaded APKs show Play Protect “Unknown app” until Play-signed — this is
expected. Prefer the Play Store listing when published; see
`PLAY_RELEASE.md`.

## Build the standalone Android app

1. Install Android Studio on the Linux computer. At its first launch, accept
   the recommended Android SDK, Build Tools, and Android platform installation.
2. In this project run:

   ```bash
   npm run android:sync
   ```

3. Android Studio opens the native project. Connect a phone by USB, enable
   Developer Options and USB debugging, then select the phone and press the
   green Run button (works on arm32 and arm64).
4. For shareable builds (same code as the release):
   ```bash
   npm run android:apk:release   # per-ABI release APKs (arm32/arm64/x86_64/x86 + universal)
   npm run android:aab           # signed .aab for Play (needs upload key, see PLAY_RELEASE.md)
   ```
   The debug APK (`android:apk`) is for local testing only — never upload a
   debug-signed artifact to Play (Play Protect warning).

After the APK is installed, X Messenger’s HTML, JavaScript, QR encoder, and
QR decoder are bundled inside the app. It does not need the Linux server,
Wi-Fi, mobile data, or internet connection to use encrypted transfers. The
Android manifest requests only camera access for QR scanning; it does not
request internet permission (`aapt dump badging` verifies this every release).

Old WebViews: devices that never updated Android System WebView may lack
WebCrypto (`crypto.subtle`). The app fails closed with “update WebView”
instead of weak crypto. Update WebView from Play, then retry.

## Everyday use

1. On the sender’s device, type a short message and tap the arrow.
2. Choose a long shared phrase. Give the phrase to the receiver in person, never inside the QR code.
3. Show the generated QR code.
4. On the receiver’s device, tap the QR icon, scan the code, enter the same phrase, and tap **Decrypt on this device**.

Use a new phrase for every important transfer and verify your contact in person.
