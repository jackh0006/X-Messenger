# QUARANTINE — do not ship this code

<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

Everything under `core/` is an unreviewed draft containing custom
"pure Rust" implementations of standardized cryptography (ML-KEM, ML-DSA,
ratchet). That violates the project's own rule: audited libraries only,
never homemade crypto.

Binding rule: nothing in `core/` may be compiled into a release or wired
to the UI until it is replaced by audited libraries (libcrux `ml-kem`,
ed25519-dalek, RustCrypto AEAD/HKDF/Argon2, `snow`), each with
known-answer tests. Tracked in `docs/MASTER_SPEC_100.md` (sections D, I).
The old code stays for reference until the replacement lands, then it is
deleted.
