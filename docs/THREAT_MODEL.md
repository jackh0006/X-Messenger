# X-Messenger Threat Model (v1.5.3-self-audited)

**Status:** Maintained. This documents the assets, adversaries, attack surfaces, trust assumptions, and residual risks for X-Messenger v1.5.3-self-audited.

**Honesty constraint:** Encryption cannot reliably protect plaintext while a device is compromised, unlocked, or when the attacker can access the app or its memory. This document does not claim protection against traffic analysis. No claim of anonymity, invisibility to an ISP, or resistance to every attacker is made.

---

## 1. Assets

| Asset | Sensitivity | Where it lives |
|-------|-------------|----------------|
| User messages / message contents | High | Plaintext in app memory while composing/viewing; ciphertext (XM1) or vault (XMV1) at rest |
| Conversation history | High | Encrypted vault file (XMV1) on device |
| Attachments | High | Encrypted vault at rest |
| Vault passphrase / shared phrase | High | Never stored; only derived key material in memory |
| Vault encryption key | High | In memory while vault is unlocked |
| Local contact names / fingerprints | Medium | Encrypted vault |
| Contact trust state | Medium | Encrypted vault |
| Metadata (message timing, size, who talked to whom) | Medium | Local vault; may be exposed by any transport used |

---

## 2. Adversaries (attackers)

1. Someone who obtains a locked device.
2. Someone who steals an encrypted backup / vault file.
3. Someone who obtains exported encrypted message files (.xmsg).
4. A malicious or compromised relay/VPS operator (LAN/VPS opt-in only).
5. A network observer, ISP, Wi-Fi operator, or DNS resolver.
6. A person conducting deep packet inspection or traffic analysis.
7. A malicious contact who sends crafted messages or files.
8. A malicious or compromised dependency.
9. A local unprivileged application attempting to read private data.
10. Malware or an attacker who already controls the user's device.
11. A person who can observe the screen or coerce the user.
12. An attacker exploiting a vulnerability in the OS, browser, or WebView.
13. An attacker who captures an identity key before it is revoked.
14. An attacker who can compare message timing, packet sizes, and connection patterns.

---

## 3. Threat matrix

| # | Attacker | What they can access | Protection implemented | How tested | Assumptions | Not protected against | Remaining work |
|---|----------|----------------------|------------------------|------------|-------------|----------------------|----------------|
| 1 | Locked device obtained | Vault file at rest | AES-256-GCM authenticated encryption; PBKDF2-HMAC-SHA256 (600k) | crypto.test.js, offline.test.js | Strong passphrase; device locked | Offline guessing if passphrase weak; cold-boot | Measure KDF timing; document passphrase guidance |
| 2 | Encrypted backup/vault stolen | Vault file | Same authenticated encryption as vault | crypto.test.js; vault roundtrip tests | Backup created with user passphrase | Weak passphrase; coerced disclosure | Backup integrity verification; restore testing |
| 3 | Exported .xmsg files obtained | Exported file | Per-message AEAD envelope | crypto.test.js roundtrip; tamper tests | Recipient verifies phrase out-of-band | Metadata via file name/size; weak passphrase | Defined export format versioning |
| 4 | Compromised relay/VPS operator | Relayed ciphertext (LAN/VPS opt-in only) | End-to-end encryption; relay never sees plaintext or keys | N/A (opt-in transport) | User configures correct relay; endpoint authenticated | Traffic analysis; metadata at relay | Document metadata exposure; opt-in warnings |
| 5 | Network observer | Online-mode traffic (if enabled) | No network in default offline mode | Code review for network calls | User enables deliberately | None in offline mode (no traffic) | Runtime network guard; connection-state UI |
| 6 | Deep packet inspection / traffic analysis | Packet sizes, timing, connection patterns | None claimed | N/A | N/A | **Traffic analysis is not mitigated** | Document as limitation; evaluate padding if online mode added |
| 7 | Malicious contact | Messages they send; crafted payloads | Strict input validation; size limits; authenticated decryption rejects forgeries | crypto.test.js; ui-invariants.test.js | Sender identity verified by user | Social engineering; impersonation if fingerprint not checked | Contact trust UI with fingerprint comparison |
| 8 | Malicious/compromised dependency | All app behavior via dependency | Minimal pinned dependencies (qrcode, jsqr, capacitor) | package-lock.json pinned | Upstream libs correctly implemented | Supply-chain compromise after lock | Dependency audit; consider automated scanning |
| 9 | Local unprivileged app | App files accessible to same user | OS file permissions; vault encrypted at rest | N/A (platform-dependent) | Other apps cannot read app's private directories | Rooted/jailbroken device; same-user malware | Document platform trust boundaries |
| 10 | Full device compromise | Everything, including memory and passphrase entry | None possible | N/A | N/A | **All secrets exposed** | Document clearly; minimize in-memory secret lifetime |
| 11 | Screen observation / coercion | Screen contents; user actions | Phrase wiped on background/visibility change | app.js visibilitychange handler | User not observed entering phrase | Shoulder surfing; coercion | App-lock; notification hiding; screenshot prevention |
| 12 | OS/WebView vulnerability | Kernel, browser, all software | None in app | N/A | N/A | All | Document reliance on OS/WebView integrity |
| 13 | Identity key captured pre-revocation | Contact's identity key | Fingerprint comparison + explicit trust + change warning | pair.test.js; ui-invariants.test.js | User compares fingerprints out-of-band | Silent substitution if user skips verification | Revocation/re-pairing flow |
| 14 | Traffic analysis observer | Timing, sizes, connections | None claimed | N/A | N/A | **Traffic analysis** | Document as limitation |

---

## 4. Trust assumptions

- The user's device OS / WebView enforces basic process and file isolation.
- The user chooses a strong, unique passphrase/phrase and does not disclose it.
- For contact verification, the user compares fingerprints over a trusted separate channel (in person, voice call, etc.) before marking a contact trusted.
- Web Crypto (AES-GCM, PBKDF2, CSPRNG) is correctly implemented by the browser/WebView.
- Offline mode performs no network I/O; any LAN/VPS transport is opt-in and explicitly configured by the user.

---

## 5. Residual risks

- **Weak passphrase:** PBKDF2 slows offline guessing but does not prevent it. A weak passphrase with a stolen vault is crackable.
- **Device compromise:** An attacker controlling the device can capture passphrases, keys in memory, and screen contents.
- **Traffic analysis:** No padding or traffic-shaping mitigations; do not claim resistance.
- **Dependency risk:** Security depends on Web Crypto and bundled libs (qrcode, jsqr). Compromise of these affects the app.
- **No forward-secrecy claim:** v1 uses a passphrase-derived key per message. It does not implement double-ratchet forward secrecy or post-compromise recovery.

---

## 6. Explicitly not claimed

- Anonymity or invisibility to an ISP.
- Resistance to traffic analysis.
- Protection against a fully compromised device.
- Post-quantum security (v2 P-384 + ML-KEM-1024 is experimental and unaudited).
- Compatibility with Signal, MLS, or any established protocol unless implemented and tested to conform.

---

## 7. Maintenance

Review this threat model on every release and whenever:
- A new transport (LAN, VPS, QR, Bluetooth) is added.
- A new dependency is added.
- The vault format or protocol version changes.
