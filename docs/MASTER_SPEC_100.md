# X Messenger — master specification (100 points)

Single source of truth for the REBUILD track. Current release is the v1.0.5
legacy app (MIT snapshot, tag v1.0.5); statuses below track the rebuild only.
Legend: `[x]` done and verified · `[~]` partially done · `[ ]` not started.
`QUARANTINED` means code exists but must never ship (homemade crypto).

Canonical crypto suite going forward (overrides older 768 choices):
hybrid X25519 + ML-KEM-1024, Ed25519 + ML-DSA-87, AES-256 or
XChaCha20-Poly1305, SHA-384/512 or BLAKE3, Argon2id. Audited libraries only
(libcrux, libsodium, RustCrypto, libsignal, snow). No negotiation.

## A. Foundations (0-5)

- [~] 0. Honesty first: `docs/RISK_POLICY.md` + `SECURITY_REVIEW.md` exist. CNSA 2.0 benchmark: NOT yet adopted — record decision.
- [~] 1. Offline Core vs optional Gateway split: strict build exists (Flutter `app/` + CI gate); Gateway: not started, separate flavor only.
- [~] 2. One Rust core for all platforms: `core/` draft exists but contains custom crypto — QUARANTINED until rebuilt on audited libs.
- [~] 3. Protocol spec, threat model, test vectors first: `docs/THREAT_MODEL.md`, `docs/PROTOCOL.md` exist; vectors: missing.
- [ ] 4. Formal model (Tamarin/ProVerif) + fuzzed parsers: not started.
- [ ] 5. Audited libs only, versioned suites, no negotiation: VIOLATED by current `core/` custom impls — replacement required (see quarantine note).

## B. Offline guarantee (6-12)

- [x] 6. Release APK ships no INTERNET permission (verified with `aapt2` on `app-release.apk`).
- [ ] 7. Separate add-on app with INTERNET over signed local IPC: not started.
- [ ] 8. Two flavors (Offline APK / Online APK): only the offline path exists.
- [ ] 9. iOS compile-out + App Privacy Report note: iOS out of scope for this build.
- [ ] 10. Core transports BLE/NFC/QR/USB/audio; Wi-Fi Direct/LAN in add-on; stated in UI: transports not started.
- [x] 11. Zero phone-home in strict UI: no analytics/crash/Firebase/ads/fonts — enforced by `strict-check.sh`.
- [~] 12. "Network: none (OS-enforced)" screen + CI traffic test + user guide: CI gate exists; screen and guide: missing.

## C. Identity and contacts (13-21)

- [ ] 13-21. On-device keypair identity, per-contact pseudonyms, QR/NFC add + safety code, hard stop on key change, one-time invites, contacts-only inbox, QR device linking, hidden profile + duress + panic wipe, local export + Shamir shards, no recovery server: ALL not started (vault placeholder screens only).

## D. Cryptography (22-36)

- [~] 22. Hybrid X25519 + ML-KEM-1024 handshake: draft code uses ML-KEM-768 and custom impl — QUARANTINED, migrate to 1024 via audited lib.
- [~] 23. Double Ratchet + post-quantum ratchet: draft `ratchet.rs` exists, unreviewed — QUARANTINED.
- [~] 24. AES-256/XChaCha20-Poly1305, SHA-384/512/BLAKE3, 256-bit keys: partially in draft — QUARANTINED pending review.
- [~] 25. Ed25519 + ML-DSA-87 signatures, LMS/XMSS for releases: draft uses ML-DSA-65 custom impl — QUARANTINED; release signing: SHA256SUMS only, no signatures yet.
- [ ] 26. Deniable authentication (MACs on messages): not started.
- [ ] 27. Bounded skipped-key cache, replay windows, counters: not started.
- [ ] 28. Noise device links + hybrid PQ add-on: not started.
- [ ] 29. Pairwise-first groups, MLS (RFC 9420) later: not started.
- [ ] 30. Per-file keys, chunked AEAD, hash trees, padded sizes: not started.
- [ ] 31. Fixed-size packet buckets incl. control messages: not started.
- [ ] 32. Constant-time, zeroized memory, locked pages, clean logs, hardened flags: not started (rule documented).
- [~] 33. Hardware-wrapped + Argon2id keys, passphrase-first: `core/vault` DONE (Argon2id 64MiB/t3/p4, XChaCha20 VMK wrap, duress slot tracked separately); hardware wrap: pending.
- [ ] 34. Encrypted DB/media/filenames, key-deletion disappearing: not started.
- [ ] 35. Swappable PQ (HQC backup) via version bumps: not started.
- [~] 36. Known-answer vectors, Wycheproof, sanitizers, CI fuzzing: vault + transport carry KAT-pinned params and 20 negative/round-trip tests in CI; Wycheproof/sanitizers/full fuzz: pending.

## E. QR, NFC, Bluetooth, offline paths (37-50)

- [~] 37-38. QR-hash bundle flow DONE in `core/transport` (strict packets, 700B frames, any-order reassembly, QR encode via qrcodegen + decode via rxing, 4 KiB end-to-end test green); animated on-screen sequencing is UI-side: pending.
- [ ] 39-50. NOT started: NFC tap/HCE + hardware-key factor, BLE privacy + dirty-wire E2EE, Wi-Fi Aware/Direct handoff, opt-in mesh, mailbox tags, spam controls, USB/SD/sound/LoRa, honest delivery states, BLE-mesh audit, opt-in discovery.

## F. Metadata and device safety (51-60)

- [x] 51. No push metadata surface in strict UI (no push code at all).
- [x] 52. Read receipts/typing/previews/auto-download/upload: none exist (nothing to disable).
- [ ] 53. EXIF strip, sandboxed decode, no message WebView: not started.
- [~] 54. FLAG_SECURE + blank switcher preview done in Flutter app; incognito keyboard, clipboard auto-clear, no autofill: missing.
- [ ] 55. Auto-lock, wipe after N tries, disguised icon: missing.
- [x] 56. `allowBackup=false`: done in app manifest.
- [ ] 57. Root/overlay/accessibility/OS warnings: missing.
- [ ] 58. No crash dumps/logs/thumbnail caches: partial (no reporters; caches not audited).
- [ ] 59. Sealed sender: not started.
- [ ] 60. Per-chat timers, best-effort delete label: not started.

## G. Online gateway (61-76)

- [ ] 61-76. ALL not started and explicitly out of the strict build: setup flow, Let's Encrypt modes, Tor onion, port policy, zero-knowledge relay, Privacy Pass access, Noise inner tunnel, hardened admin dashboard, web client + integrity, WASM core + WebAuthn, fallback invites, per-contact relay, server hardening, Sigstore releases, burn command.

## H. Hiding from CDN/VPS/ISP/DPI (77-92)

- [ ] 77-92. ALL not started (gateway-dependent): E2EE-only assumption, Tunnel/origin-pull, CT/wildcard/decoy, TLS/chrome-fingerprint shaping, padding profiles, ECH stance, aged domains, transport ladder, Tor/VPN/two-hop, RAM-only servers, DNS hygiene, traffic-analysis honesty, disguise tests.

## I. Open source and trust (93-97)

- [~] 93. AGPL-3.0 everywhere: SWITCHED this commit (was MIT); publish clients/relay/spec/scripts/threat model: partial.
- [~] 94. Reproducible builds, signed releases, SBOM, SLSA, offline keys: SHA256SUMS done; signatures/SBOM/SLSA: missing.
- [ ] 95. Audits, bounty, security.txt, CI fuzzing: missing.
- [~] 96. F-Droid, GitHub, direct APK, PWA distribution; Android verification noted: GitHub + direct APK done (prerelease); rest missing.
- [~] 97. Per-mode docs (Offline/Online/Web) with plain warnings, localized: Offline docs exist; Online/Web: N/A yet; localization: missing.

## J. Roadmap (98-100)

- [~] 98. Order: (1) offline split, PQ handshake, QR-hash, encrypted DB — in progress; (2) BLE/mesh/groups/files; (3) gateway/web; (4) stealth/transports/audits.
- [x] 99. Basics before stealth: enforced by this phasing.
- [~] 100. Hostile-server judgment + audit before claims: process documented (`docs/RISK_POLICY.md`); audit pending.

## Quarantine note (binding)

`core/crypto` custom "pure Rust" ML-KEM/ML-DSA/ratchet code must never be
compiled into a release. Replacement track: audited `ml-kem` (libcrux),
ed25519-dalek, RustCrypto AEAD/HKDF/Argon2, `snow` for Noise — each with
known-answer tests before UI wiring. The old code stays for reference until
the replacement lands, then it is deleted.
