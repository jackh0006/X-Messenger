# Risk policy — X Messenger

Simple words. No software is impossible to hack, including this one.
This file explains residual risk and how we reduce it.

## 1. Honest claim

We do NOT claim: unhackable, zero bugs, military-grade, or safe for
life-critical secrets without an audit.

We DO claim: small attack surface, memory-safe core, proven crypto only,
fail-closed errors, heavy testing, open source with reproducible builds.

## 2. Top risks and what we do

- Bug in our code → small strict build, typed Rust core, `forbid(unsafe_code)`
  except tiny FFI, 90%+ core coverage, fuzzing, Miri, CodeQL, Semgrep.
- Bad dependency → pinned, vendored, lockfiles committed, audit/deny/vet in CI.
  Every new dependency needs a written reason.
- Stolen device → encrypted vault, Argon2id + hardware secret, auto-lock,
  panic wipe, duress vault, crypto erase (delete wrapped key = instant wipe).
- Tricked user (fake QR/file) → AEAD rejects, neutral error, no sensitive logs.
- Coerced user → panic gesture/PIN, decoy vault with equal-size slots.
- Record now, decrypt later (quantum) → plan hybrid X25519 + ML-KEM-768.
  Not implemented yet, so do not advertise it.

## 3. What you must do

- Use a clean device (updated OS, screen lock, full-disk encryption).
- Check signatures and hashes before you install any APK or DEB.
- Compare safety phrases face to face.
- Split crown-jewel secrets (for example 2-of-3), send shares at different
  times on different channels, use view-once.
- Rehearse backup and wipe before you need them.

## 4. Fail-closed rule

Any doubt = reject. No partial decrypt, no verbose error, no secret in logs.
