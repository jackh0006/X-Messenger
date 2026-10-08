# Security release checklist — do not skip

No stable release until every box is checked with evidence.

- [ ] Strict Android APK has no `INTERNET` or `ACCESS_NETWORK_STATE`
      (check merged manifest with `aapt2 dump permissions`).
- [ ] No network code in dependency tree (cargo-deny ban list clean).
- [ ] `bash scripts/strict-check.sh` passes from clean checkout.
- [ ] `flutter analyze` and `flutter test` pass.
- [ ] Rust workspace builds from clean checkout, no `target/` committed.
- [ ] Crypto has known-answer tests (official vectors) + property tests.
- [ ] Every parser (QR, NFC, file, contact card) fuzzed, 24h clean.
- [ ] Negative tests: tampered, replayed, truncated, reordered, duplicated,
      oversized packets rejected without crash.
- [ ] Dependency review: licences compatible, `cargo-audit` clean, SBOM saved.
- [ ] Reproducible builds: two independent builds give same SHA-256.
- [ ] Signed artifacts: SHA256SUMS signed, signatures verified on clean VMs.
- [ ] Independent audit complete, all critical findings fixed.
- [ ] Preview packages say EXPERIMENTAL and accept no real secrets.
