# X Messenger platform roadmap — v1.5.3-self-audited

This maps the requested app types to what ships today and what needs an
audited native core first. Nothing here changes the crypto.

## Shipped today (1.5.3-self-audited)

- Crypto: `AES-256-GCM + PBKDF2-SHA256/600k` in `core.js` only
  (v2 seals, v1 reads). See `SECURITY.md`. No XChaCha20, no Argon2id,
  no SQLCipher in the shipped bundle — those would be new crypto and
  need an audit first (see `AGENTS.md` hard rule 1).
- History: on-device `XMV1.` vault (`vaultSeal`/`vaultOpen`, same
  primitives, fresh salt+nonce). Plaintext in memory only while
  unlocked, wiped on hide/lock. Settings → Delete removes vault blob,
  labels, settings, session messages, first-run flag, clears clipboard.
- Offline: Android `CAMERA` only (no `INTERNET`,
  `android/app/src/main/AndroidManifest.xml`). Linux GUI loopback-only
  `https://127.0.0.1` with device-local CA leaf, deny-by-default camera,
  no remote navigation (`bin/cipherlink-gui`). `www/` only fetches
  same-origin `/api/info` + local `vendor/` bytes — no remote XHR.
- Gateway: explicit opt-in `--lan` / `--vps` with consent + fingerprint
  compare. See `docs/GATEWAY.md`.

## Requested stacks (future, audited Rust core required)

| Target | Requested | Path | OS keystore |
| --- | --- | --- | --- |
| Linux | Tauri (Rust) or Qt, small + open | Tauri shell loading the same `www/` bundle, or Qt WebEngine shell | Secret Service (`libsecret` / GNOME Keyring) or KWallet; files `0600/0700` |
| Windows | Tauri (Rust) or .NET (C#) | Same bundle in WebView2; per-user `%APPDATA%` data, no admin | DPAPI CurrentUser; TPM 2.0 only via audited native module |
| Android | Kotlin native (max coverage) or Flutter (one codebase) | Keep Capacitor now; Kotlin/Flutter shells must keep `CAMERA`-only, `allowBackup=false` | Android Keystore (hardware-backed where present) wrapping the vault passphrase; never in `localStorage` cleartext |
| iOS | Swift native (preferred) or Flutter | Requires macOS + Xcode + Apple Developer account; Apple controls install | Keychain + Secure Enclave (`kSecAttrTokenIDSecureEnclave` where available) |
| Shared | Flutter + Rust core, one codebase | `flutter_rust_bridge` calling a small Rust core that reimplements **exactly** `core.js` (AES-GCM + PBKDF2/600k, padded buckets, XM1/XMV1) with `zeroize`, then OS keystore wrappers | Per-OS as above; SQLCipher/Argon2id/XChaCha20 only after spec + audit |

## Why not SQLCipher / XChaCha20 / Argon2id today

They are reasonable future choices, but each is a protocol change:

- New KDF (Argon2id params, calibration for low-end Android) breaks
  `test/crypto.test.js` lockstep and old vaults.
- New cipher (XChaCha20) needs new AAD/version negotiation — fail-closed
  downgrade risk.
- SQLCipher adds native deps per ABI (Linux amd64/arm64/armhf, Windows
  x64/arm64, Android arm32/arm64/x86_64, iOS arm64) + signed reproducible
  builds.

Per `SECURITY.md`: move to a small audited native Rust/libsodium core
with OS-backed storage, X25519/Ed25519 identities, audited double
ratchet, reproducible builds, and an external audit first.

## iPhone note

No iOS target ships from this Linux checkout. iOS needs a Mac, Xcode,
`ios/` Capacitor project, signing identity, and TestFlight/App Store
review. Do not sideload promises without that machine + account.

## Open risks

- Any Rust/Flutter rewrite must byte-match XM1/XMV1 or provide a
  migration that keeps v1 reads working.
- Platform keystore APIs differ in backup behavior — test uninstall,
  restore, and lock-screen wipe per OS.
- VPS/LAN metadata (IP/domain/port/sizes) stays observable even with
  E2E content protection.
