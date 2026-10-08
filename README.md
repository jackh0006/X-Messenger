# X Messenger

X Messenger is an open-source, offline-first messenger project for moving small
secrets between trusted people using QR, NFC, or an encrypted file carrier.
The intended targets are Android and Ubuntu, with one Flutter user interface
and a Rust security core.

## Status — do not use for valuable secrets

This repository is an **experimental engineering project**, not a finished
secure messenger. It must not be described as CIA-grade, unhackable,
Signal-compatible, or safe for seed phrases, private keys, recovery codes, or
other crown-jewel information. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

The shared Flutter shell is in `app/`. It uses the same source for Android and
Linux, has no network packages, disables Android backups and cleartext traffic,
and enables Android's secure-window flag. It deliberately has no usable vault,
encryption, contact pairing, QR transfer, or NFC transfer yet.

## Open source

The project is released under the [MIT License](LICENSE). Contributions are
welcome under the rules in [CONTRIBUTING.md](CONTRIBUTING.md).

## Continue with a coding agent

Read [docs/AI_CONTINUATION.md](docs/AI_CONTINUATION.md) before
asking any coding agent to change this repository. It has the safe
workflow, phased prompts, and mandatory review checks.

Never put API keys, GitHub tokens, passphrases, recovery phrases, or personal
secrets in Git, issues, prompts, source files, logs, screenshots, or release
assets. Any token already pasted into a chat should be revoked and replaced.

## Repository map

- `app/` — shared Flutter Android/Linux interface.
- `core/` — legacy Rust draft; it is not an approved security core.
- `apps/` — legacy platform-specific draft UIs; not the release path.
- `docs/` — threat model, protocol boundary, audit checklist, and agent guide.
- `scripts/strict-check.sh` — offline boundary checks for source manifests and
  the shared UI.
- `SECURITY_REVIEW.md` — evidence-based release blockers.

## Local checks

```bash
cd /home/mhh06/cipherlink-v2-audit
bash scripts/strict-check.sh
cd app
flutter pub get --offline
flutter analyze
flutter test
```

## Release policy

Do not create a stable release or upload a secret-handling APK/DEB until every
item in `docs/AUDIT_CHECKLIST.md` and `SECURITY_REVIEW.md` is resolved, the
security core is implemented with reviewed libraries, both platforms build from
a clean checkout, and an independent security audit is complete. Preview
packages must say **experimental** and must not accept valuable secrets.

## Donate (no ads, no premium)

Keeping releases signed and free costs time. If this offline freedom helps
you, please support it:

| Asset | Address |
| --- | --- |
| Bitcoin | `bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83` |
| DOGE | `D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC` |
| Ethereum / USDT ERC20 / BNB | `0xdad428900a4359be8f76b3062df34211582e09eb` |
| TRX / USDT TRC20 | `TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf` |
| SOL / USDT SPL / USDC SPL | `BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL` |
| XRP | `rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9` |
| TON | `UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX` |
| LTC | `ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8` |

Support / security contact: jackh109867@gmail.com (never send real phrases
or message contents).
