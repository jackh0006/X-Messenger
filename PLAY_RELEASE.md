# Google Play release

The debug APK is only for testing. Google Play requires a signed Android App Bundle (`.aab`) and your own upload key.

1. In Android Studio open `android/`.
2. Select **Build → Generate Signed Bundle / APK → Android App Bundle**.
3. Create and safely store an upload keystore outside this repository. Never commit it.
4. Generate a release `.aab` (current `versionCode`/`versionName` from `android/app/build.gradle`), test it on a physical Android ARM64 device, and complete Play Console disclosures truthfully.
5. Paste listing + data safety from `docs/store-listing.md`. Privacy policy from `docs/privacy-policy.md`.

This app requests Camera only for QR scanning and has no Internet permission. Verify with `aapt dump permissions` at every release. Do not market it as “unhackable” or “CIA-grade.” Sell instead: no signal needed, no account needed, no server to leak.
