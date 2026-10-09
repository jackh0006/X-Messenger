# X Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Strict boundary](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-security.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-security.yml)
[![Verify](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml)
[![Preview release](https://img.shields.io/github/v/release/jackh0006/X-Messenger?include_prereleases&label=preview)](https://github.com/jackh0006/X-Messenger/releases)
![Android](https://img.shields.io/badge/Android-arm64-3DDC84?logo=android&logoColor=white)
![Linux](https://img.shields.io/badge/Ubuntu-amd64-E95420?logo=ubuntu&logoColor=white)

**Offline-first secret courier.** Move small, high-value secrets between trusted
people with no accounts, no servers, and no internet — over QR codes, NFC, or
one encrypted file you carry yourself. One shared Flutter UI on Android and
Ubuntu, one Rust security core, MIT licensed, fully open source.

> **Status: EXPERIMENTAL PREVIEW.** The shared UI shell builds and installs on
> both platforms, but there is deliberately **no usable vault, pairing, or
> transfer yet**. Do not store seed phrases, private keys, or crown-jewel
> material in this build. It must not be called unhackable, military-grade, or
> Signal-compatible. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) and
> [docs/RISK_POLICY.md](docs/RISK_POLICY.md).

## How it works

Two devices never touch a network. The sender's Rust core encrypts the secret
into opaque AEAD ciphertext packets; the untrusted carrier — animated QR
frames, an NFC tap, or a `.courier` file on USB — moves only ciphertext.
The receiver's core rejects anything malformed, replayed, or tampered and
fails closed with a neutral message.

- **Identity is keys only.** No phone number, email, server account, or contact
  upload. Pairing is a face-to-face QR exchange plus a 6-word safety phrase
  compared on both screens.
- **The channel is untrusted by design.** Cameras, sniffers, and stolen USB
  sticks are in the threat model ([docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)).
  Security comes from the encryption inside, never from the carrier.
- **Planned primitives (not yet implemented):** XChaCha20-Poly1305 AEAD,
  Argon2id + hardware secret key hierarchy, HPKE file envelopes, and a
  reviewed session library behind our own protocol interface —
  see [docs/PROTOCOL.md](docs/PROTOCOL.md).

## How X Messenger differs from Signal, Telegram, and WhatsApp

Architecture facts, verified against each project's public documentation.
"Planned" means designed and specified, not built — the honest state of this
preview.

| Property | Signal | Telegram | WhatsApp | X Messenger (goal) |
| --- | --- | --- | --- | --- |
| Identity | Phone number required | Account ID required | Phone number required | **Keys only, no number** (planned) |
| Transport | Central servers | Central servers | Central servers | **No servers; QR / NFC / file only** |
| Works with zero internet | No | No | No | **Yes, by construction** |
| Default chats E2E encrypted | Yes (Signal protocol) | **No** (cloud chats; optional Secret Chats) | Yes (Signal protocol) | Planned AEAD sessions |
| Custom crypto protocol | No (published Signal protocol) | Yes (custom MTProto) | No (Signal protocol) | **No — reviewed primitives only** (rule R2) |
| Operator must be trusted with metadata | Yes | Yes | Yes (Meta) | **No operator exists** |
| Fully open source client + server need | Client open; server centralized | Clients open; server proprietary | Proprietary | **MIT, reproducible builds planned** |
| Contact discovery without uploading address book | Usernames (no bulk upload needed) | Address-book upload standard | Address-book upload standard | **Face-to-face pairing, nothing uploaded** |

What X Messenger does that the others structurally cannot: operate where there
is no network at all, leave no metadata with any operator (there is none), and
prove its offline boundary in CI — `scripts/strict-check.sh` plus the
`aapt2` merged-manifest gate reject any network permission or socket code.

## What works today vs roadmap

| Area | Preview (`v1.0.0-preview.1`) | Roadmap |
| --- | --- | --- |
| Shared Android + Ubuntu UI | ✅ Same source, 4-tab shell | Full chat, vault, scan flows |
| Strict no-network build | ✅ CI gate + release APK verified clean | Reproducible signed builds, SBOM |
| Encrypted vault | ❌ Placeholder screen | Rust core, Argon2id, duress slots |
| Pairing + sessions | ❌ | Reviewed session library, safety phrase |
| QR / NFC / file transport | ❌ | Strict parsers + fuzzing |
| Independent audit | ❌ | Required before any stable release |

## Try the preview

```bash
# Ubuntu amd64
sudo dpkg -i X-Messenger-preview_Linux-amd64.deb
x-messenger
# Android arm64: install X-Messenger-preview_Android-arm64.apk, verify SHA256SUMS first
```

Downloads: [preview releases](https://github.com/jackh0006/X-Messenger/releases).
Preview packages say EXPERIMENTAL and accept no real secrets.

## Repository map

- `app/` — shared Flutter Android/Linux interface (the release path).
- `core/` — legacy Rust draft; not an approved security core.
- `apps/` — legacy platform-specific draft UIs; not the release path.
- `docs/` — [threat model](docs/THREAT_MODEL.md),
  [protocol boundary](docs/PROTOCOL.md),
  [audit checklist](docs/AUDIT_CHECKLIST.md),
  [risk policy](docs/RISK_POLICY.md),
  [release process](docs/RELEASE_PROCESS.md),
  [coding-agent guide](docs/AI_CONTINUATION.md).
- `scripts/strict-check.sh` — offline boundary checks for manifests and UI.
- `SECURITY_REVIEW.md` — evidence-based release blockers.

## Local checks (copy-paste)

```bash
bash scripts/strict-check.sh
cd app
flutter pub get --offline
flutter analyze
flutter test
```

Contributions welcome under [CONTRIBUTING.md](CONTRIBUTING.md) (MIT terms).
Report vulnerabilities privately per [SECURITY.md](SECURITY.md) — never post
real phrases, keys, or message contents anywhere.

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
