# v2.0.0 release blocker review

This document records the initial review of commit `3d1acf1`. It is not a
security audit and does not approve the protocol for real secrets.

## Critical release blockers

1. The original v2 manifest declared `INTERNET` and
   `ACCESS_NETWORK_STATE`, registered a connectivity receiver and ran a
   service that opened TCP sockets to user-provided servers. This contradicts
   the advertised strict offline design. The remediation branch removes those
   entry points; the resulting Android build still requires a full build and
   merged-manifest inspection.
2. The repository advertised CIA-grade and post-quantum guarantees without an
   independent audit, reproducible-build evidence or protocol verification.
   Those claims are removed from the top-level presentation.
3. The repository committed generated Python caches, Android IDE state and a
   Rust `target/` directory. Build output is not source, creates noisy
   reviews, can conceal supply-chain tampering and prevents clean
   reproducibility. It is removed on this branch and ignored going forward.
4. The protocol is custom code rather than an adopted, reviewed session
   implementation. Claims of Signal-style ratcheting, forward secrecy,
   deniability and post-quantum security are unverified until a specialist
   review, test vectors, fuzzing and adversarial session simulations pass.
5. The checked-in dependency requirements did not resolve from a clean
   registry: `pqcrypto-kem`, `pqcrypto-sign`, `qr-code-generator` and an
   unavailable `tracing-appender` release were declared despite no source use;
   `x25519-dalek = 2.1` was also unavailable while the lockfile named 2.0.1.
   The unused declarations were removed and X25519 was pinned to the existing
   lockfile version. The full dependency graph remains unapproved until a
   reproducible clean build and dependency review succeed.
6. An offline locked test resolution still fails because `keyring = 1.3` is
   unavailable in the local registry cache. It is declared in the Linux app
   but not referenced by its source. This is a build/reproducibility blocker,
   not evidence that the test suite passes. The ignored per-package Cargo
   profile warnings are also outstanding manifest hygiene issues.

## Required before release

- A strict build gate scans the generated Android manifest for forbidden
  network permissions and scans the dependency tree for networking code.
- Rust and Android builds must compile from a clean checkout with no generated
  artefacts committed.
- The protocol must be reduced to audited components or reviewed independently;
  never make high-assurance claims from source inspection alone.
- Complete a threat model, test plan, parser fuzzing, dependency audit and
  reproducible release process.
