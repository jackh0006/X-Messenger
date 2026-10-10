# Phase 0 gates (no app code yet)

## Toolchain required before Phase 1
- Go ≥ 1.24 (`crypto/mlkem` with 1024, `crypto/hkdf`, `crypto/ecdh` P-384).
  Present here: check with `go version`. Install from https://go.dev/dl,
  verify the published SHA-256 + GPG signature.
- Tamarin prover (for `model/v2-handshake.spthy`): https://tamarin-prover.github.io
- `golang.org/x/crypto` (argon2): pin + review on first use.

## Definition of done for Phase 0
- [ ] Human approves `docs/PROTOCOL-v2.md` (every MUST challenged).
- [ ] `model/v2-handshake.spthy` loads in Tamarin; lemmas stated.
- [ ] At least one lemma (secrecy of `root`) proved or counterexample understood.
- [ ] Open questions §7 triaged into audit scope.
- [ ] No `core/` Go code written yet.
