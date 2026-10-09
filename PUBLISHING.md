# Publication checklist

## GitHub (standard)

1. Create a public repository without private keys, APK signing keys, backups, or local data. Include `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/privacy-policy.md`, `docs/store-listing.md`.
2. Run `npm ci && npm test && npm run build:web` and require the included GitHub Actions workflow to pass (Node 22, `test/` includes crypto + offline checks).
3. Tag `v<ver>` (current `versionCode`/`versionName` from `android/app/build.gradle`). Publish the source archive, `SHA256SUMS`, SECURITY.md, and an honest release note. Do not claim that the application is unhackable or certified by any government agency.
4. Sell needs honestly: hero “No signal? No account? Send it anyway.” + Why-different table + screenshots in `screenshots/`.

## Google Play (standard)

1. Use a new, private upload key; never commit it. Build a signed Android App Bundle (`.aab`), not the debug APK. `applicationId com.jackh0006.xmessenger`, `current `versionCode`/`versionName` (`android/app/build.gradle`), `targetSdk 37`.
2. Complete the Play Data safety (No collection/sharing), privacy policy (`docs/privacy-policy.md` URL), content rating (Everyone, no ads), and app-access (no login + reviewer path) declarations accurately. The application requests the Camera permission only for QR scanning. Copy/paste from `docs/store-listing.md`.
3. Test the release on physical ARM64 devices, including camera permission denial, QR transfer, backup restore, theme switching, and deletion of local data.
4. Upload `512x512 icon`, `1024x500 feature`, 4–8 phone screenshots. Track: Internal → Closed → Production.
5. Obtain an independent security review before presenting the app as suitable for high-risk communications.

Google Play requires new apps and updates submitted after 31 August 2026 to target Android API 36 or higher. X Messenger targets API 37, which satisfies that requirement.
