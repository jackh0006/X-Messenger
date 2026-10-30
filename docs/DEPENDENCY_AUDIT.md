# X-Messenger Dependency Audit (v1.5.3-self-audited; dependency set unchanged)

**Status:** Maintained. This documents every security-critical dependency per the cryptographic dependency policy.

**Honesty constraint:** A dependency's upstream audit or maintenance status does **not** guarantee the security of this application.

---

## Browser / Web Crypto (built-in, not a dependency)

| Component | Purpose | Standard |
|-----------|---------|----------|
| Web Crypto API | AES-256-GCM, PBKDF2-HMAC-SHA256, CSPRNG (`crypto.getRandomValues`) | W3C Web Cryptography API |

These are provided by the browser/WebView, not installed as packages. Security depends on the platform WebView implementation.

---

## NPM Dependencies (`package.json`)

| Package | Version | Purpose | License | Maintenance | Known vulns | Why selected | How used | Linux | Android |
|---------|---------|---------|---------|-------------|-------------|--------------|----------|-------|---------|
| qrcode | ^1.5.4 | QR code generation | MIT | Active | None known | Standard QR gen library | Generate QR codes for sealed payloads | Yes | Yes |
| jsqr | ^1.4.0 | QR code scanning | MIT | Active | None known | Standard QR scan library | Scan incoming QR codes | Yes | Yes |
| @capacitor/core | ^8.5.2 | Native bridge for Android | MIT | Active (Ionic team) | None known | Cross-platform native access | Camera, filesystem, storage on Android | No | Yes |
| @capacitor/cli | ^8.5.2 | Build tooling | MIT | Active | None known | Capacitor project tooling | Build Android APK/AAB | No | Yes |
| @capacitor/android | ^8.5.2 | Android platform | MIT | Active | None known | Capacitor Android integration | Android native code | No | Yes |
| browserify | ^17.0.1 | Bundling (dev) | MIT | Active | None known | Bundle Node-style modules for browser | Dev-only build step | Yes | Yes |

---

## Transitive Dependencies

The full tree is recorded in `package-lock.json`. The security-critical path (QR encode/decode) depends only on `qrcode` and `jsqr`, both small, well-maintained, MIT-licensed libraries with no known vulnerabilities at time of writing.

---

## Dependency Management Policy

1. **Pin all versions:** `package-lock.json` is committed to version control.
2. **Minimize surface:** Only QR encode/decode and Capacitor native bridging are used; no analytics, telemetry, crash reporting, or tracking dependencies.
3. **Review at release:** Re-evaluate maintenance status, known vulnerabilities, and licensing before each release.
4. **No embedded secrets:** No dependency contains production keys or shared secrets.
5. **Android/Linux parity:** Web Crypto is used on both platforms; no platform-specific crypto substitutions.

---

## Known Limitations

- `qrcode` and `jsqr` have not undergone an independent security audit to our knowledge.
- No automated vulnerability scanning (e.g., `npm audit`) is integrated into CI in v1. Future work.
- All licenses are MIT, permitting open-source use and redistribution.
